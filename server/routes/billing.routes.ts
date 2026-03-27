/**
 * Billing, Marketplace & Payment Routes
 *
 * Handles premium modules, org subscriptions, Stripe checkout/webhooks,
 * marketplace browsing, trial activation, purchases, analytics, and invoices.
 */

import type { Express } from "express";
import { db } from "../db";
import {
  premiumModules,
  orgSubscriptions,
  paymentHistory,
  organizations,
} from "@shared/schema";
import { and, eq, lte, sql, desc } from "drizzle-orm";
import {
  requireAdmin,
  requireSuperAdmin,
} from "../auth-middleware";

// Moduli combo: quando si attiva il module_key, si abilitano TUTTI gli id sidebar elencati
const COMBO_MODULES: Record<string, string[]> = {
  analisi_economica_utif: ['analisi_economica', 'report_accise'],
};

function getEnabledIds(moduleKey: string): string[] {
  return COMBO_MODULES[moduleKey] ?? [moduleKey];
}

function disableModuleIds(current: string[], moduleKey: string): string[] {
  const toRemove = getEnabledIds(moduleKey);
  return current.filter(m => !toRemove.includes(m));
}

const PDFDocument = new Proxy(function () {} as any, {
  construct(_target: any, args: any[]) {
    const Mod = require("pdfkit");
    return new Mod(...args);
  },
  get(_target: any, prop: string) {
    const Mod = require("pdfkit");
    return Mod[prop];
  },
});

export function registerBillingRoutes(app: Express) {
  // ============================================================================
  // PREMIUM MODULES & SUBSCRIPTIONS (Admin)
  // ============================================================================

  app.get("/api/admin/premium-modules", requireAdmin, async (req, res) => {
    try {
      const modules = await db.select().from(premiumModules)
        .where(eq(premiumModules.isActive, true))
        .orderBy(premiumModules.sortOrder);
      res.json(modules);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/admin/org-subscriptions", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const subs = await db.select().from(orgSubscriptions)
        .where(eq(orgSubscriptions.organizationId, userOrgId as any));
      res.json(subs);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/create-checkout-session", requireAdmin, async (req, res) => {
    try {
      const { moduleKey, billingPeriod } = req.body;
      const userOrgId = req.session?.organizationId;

      if (!moduleKey) return res.status(400).json({ error: "Modulo non specificato" });

      const [module] = await db.select().from(premiumModules)
        .where(eq(premiumModules.moduleKey, moduleKey));
      if (!module) return res.status(404).json({ error: "Modulo non trovato" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId as any));
      const price = billingPeriod === 'yearly' ? module.priceYearly : module.priceMonthly;

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        const [sub] = await db.insert(orgSubscriptions).values({
          organizationId: userOrgId as any,
          moduleKey,
          status: 'pending_payment',
          billingPeriod: billingPeriod || 'monthly',
        }).returning();

        return res.json({
          success: true,
          mode: 'manual',
          message: 'Richiesta di attivazione registrata. Verrai contattato per il pagamento.',
          subscription: sub
        });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);

      let customerId;
      const [existingSub] = await db.select().from(orgSubscriptions)
        .where(eq(orgSubscriptions.organizationId, userOrgId as any)).limit(1);

      if (existingSub?.stripeCustomerId) {
        customerId = existingSub.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          name: org?.name || 'Organizzazione',
          email: org?.email || undefined,
          metadata: { organizationId: userOrgId || '' },
        });
        customerId = customer.id;
      }

      let stripePriceId = billingPeriod === 'yearly' ? module.stripePriceIdYearly : module.stripePriceIdMonthly;

      if (!stripePriceId) {
        let productId = module.stripeProductId;
        if (!productId) {
          const product = await stripe.products.create({
            name: module.name,
            description: module.description || undefined,
            metadata: { moduleKey },
          });
          productId = product.id;
          await db.update(premiumModules)
            .set({ stripeProductId: productId })
            .where(eq(premiumModules.id, module.id));
        }

        const stripePrice = await stripe.prices.create({
          product: productId,
          unit_amount: price,
          currency: 'eur',
          recurring: { interval: billingPeriod === 'yearly' ? 'year' : 'month' },
        });
        stripePriceId = stripePrice.id;

        if (billingPeriod === 'yearly') {
          await db.update(premiumModules)
            .set({ stripePriceIdYearly: stripePriceId })
            .where(eq(premiumModules.id, module.id));
        } else {
          await db.update(premiumModules)
            .set({ stripePriceIdMonthly: stripePriceId })
            .where(eq(premiumModules.id, module.id));
        }
      }

      const domain = process.env.REPLIT_DEV_DOMAIN || 'soccorsodigitale.app';
      const protocol = domain.includes('localhost') ? 'http' : 'https';

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${protocol}://${domain}/admin?payment=success&module=${moduleKey}`,
        cancel_url: `${protocol}://${domain}/admin?payment=cancelled`,
        metadata: { organizationId: userOrgId || '', moduleKey },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Errore nella creazione della sessione di pagamento" });
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeKey) return res.status(400).json({ error: "Stripe not configured" });

      const event = req.body;

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const { organizationId, moduleKey } = session.metadata || {};

          if (organizationId && moduleKey) {
            const [sub] = await db.insert(orgSubscriptions).values({
              organizationId,
              moduleKey,
              stripeSubscriptionId: session.subscription,
              stripeCustomerId: session.customer,
              status: 'active',
              billingPeriod: 'monthly',
              currentPeriodStart: new Date(),
            }).returning();

            const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
            if (org) {
              const enabledModules = Array.isArray(org.enabledModules) ? [...(org.enabledModules as string[])] : [];
              const toAdd = getEnabledIds(moduleKey);
              let changed = false;
              toAdd.forEach(id => { if (!enabledModules.includes(id)) { enabledModules.push(id); changed = true; } });
              if (changed) {
                await db.update(organizations)
                  .set({ enabledModules })
                  .where(eq(organizations.id, organizationId));
              }
            }

            await db.insert(paymentHistory).values({
              organizationId,
              stripePaymentIntentId: session.payment_intent,
              amount: session.amount_total || 0,
              currency: session.currency || 'eur',
              status: 'succeeded',
              description: `Attivazione modulo: ${moduleKey}`,
              moduleKey,
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await db.update(orgSubscriptions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(orgSubscriptions.stripeSubscriptionId, subscription.id));
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            await db.update(orgSubscriptions)
              .set({ status: 'past_due', updatedAt: new Date() })
              .where(eq(orgSubscriptions.stripeSubscriptionId, invoice.subscription));
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/payment-history", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const payments = await db.select().from(paymentHistory)
        .where(eq(paymentHistory.organizationId, userOrgId as any))
        .orderBy(desc(paymentHistory.createdAt));
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // MARKETPLACE MANAGEMENT (Super Admin - SaaS)
  // ============================================================================

  app.get("/api/saas/marketplace-items", requireSuperAdmin, async (req, res) => {
    try {
      const items = await db.select().from(premiumModules).orderBy(premiumModules.sortOrder);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/saas/marketplace-items", requireSuperAdmin, async (req, res) => {
    try {
      const { moduleKey, name, description, longDescription, category, icon, badgeText, badgeColor,
              priceMonthly, priceYearly, priceOneTime, billingType, trialDays, maxUsers,
              features, requirements, isActive, isFeatured, isVisible, sortOrder } = req.body;
      if (!moduleKey || !name) return res.status(400).json({ error: "Chiave modulo e nome sono obbligatori" });
      const [item] = await db.insert(premiumModules).values({
        moduleKey, name, description, longDescription,
        category: category || 'modulo',
        icon: icon || 'package',
        badgeText, badgeColor,
        priceMonthly: priceMonthly || 0,
        priceYearly: priceYearly || 0,
        priceOneTime,
        billingType: billingType || 'recurring',
        trialDays: trialDays || 0,
        maxUsers,
        features: features || [],
        requirements: requirements || [],
        isActive: isActive !== false,
        isFeatured: isFeatured || false,
        isVisible: isVisible !== false,
        sortOrder: sortOrder || 0,
      }).returning();
      res.json(item);
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: "Chiave modulo gia esistente" });
      console.error("Error creating marketplace item:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/saas/marketplace-items/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };
      const fields = ['moduleKey', 'name', 'description', 'longDescription', 'category', 'icon',
        'badgeText', 'badgeColor', 'priceMonthly', 'priceYearly', 'priceOneTime', 'billingType',
        'trialDays', 'maxUsers', 'features', 'requirements', 'isActive', 'isFeatured', 'isVisible', 'sortOrder'];
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      const [item] = await db.update(premiumModules).set(updates).where(eq(premiumModules.id, id)).returning();
      if (!item) return res.status(404).json({ error: "Elemento non trovato" });
      res.json(item);
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: "Chiave modulo gia esistente" });
      console.error("Error updating marketplace item:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/saas/marketplace-items/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(premiumModules).where(eq(premiumModules.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting marketplace item:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/saas/marketplace-stats", requireSuperAdmin, async (req, res) => {
    try {
      const allItems = await db.select().from(premiumModules);
      const allSubs = await db.select().from(orgSubscriptions);
      const allPayments = await db.select().from(paymentHistory);
      const activeSubs = allSubs.filter(s => s.status === 'active');
      const totalRevenue = allPayments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0);
      const categories: Record<string, number> = {};
      allItems.forEach(i => { categories[i.category] = (categories[i.category] || 0) + 1; });
      res.json({
        totalItems: allItems.length,
        activeItems: allItems.filter(i => i.isActive).length,
        totalSubscriptions: allSubs.length,
        activeSubscriptions: activeSubs.length,
        totalRevenue,
        categories,
        recentPayments: allPayments.slice(0, 10),
      });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // MARKETPLACE BROWSE (Org Admin)
  // ============================================================================

  app.get("/api/marketplace", requireAdmin, async (req, res) => {
    try {
      const items = await db.select().from(premiumModules)
        .where(and(eq(premiumModules.isActive, true), eq(premiumModules.isVisible, true)))
        .orderBy(premiumModules.sortOrder);
      const userOrgId = req.session?.organizationId;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId as any));
      const enabledModules = Array.isArray(org?.enabledModules) ? (org.enabledModules as string[]) : [];
      const subs = await db.select().from(orgSubscriptions)
        .where(eq(orgSubscriptions.organizationId, userOrgId as any));
      const enriched = items.map(item => ({
        ...item,
        isOwned: enabledModules.includes(item.moduleKey),
        subscription: subs.find(s => s.moduleKey === item.moduleKey) || null,
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/marketplace/my-purchases", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const subs = await db.select().from(orgSubscriptions)
        .where(eq(orgSubscriptions.organizationId, userOrgId as any))
        .orderBy(desc(orgSubscriptions.createdAt));
      const payments = await db.select().from(paymentHistory)
        .where(eq(paymentHistory.organizationId, userOrgId as any))
        .orderBy(desc(paymentHistory.createdAt));
      res.json({ subscriptions: subs, payments });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // MARKETPLACE TRIAL ACTIVATION (Org Admin)
  // ============================================================================

  app.post("/api/marketplace/activate-trial", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const { moduleKey } = req.body;
      if (!moduleKey) return res.status(400).json({ error: "Chiave modulo obbligatoria" });

      const [module] = await db.select().from(premiumModules).where(eq(premiumModules.moduleKey, moduleKey));
      if (!module) return res.status(404).json({ error: "Modulo non trovato" });
      if (!module.trialDays || module.trialDays <= 0) return res.status(400).json({ error: "Questo modulo non prevede un periodo di prova" });

      const existingSub = await db.select().from(orgSubscriptions)
        .where(and(eq(orgSubscriptions.organizationId, userOrgId as any), eq(orgSubscriptions.moduleKey, moduleKey)));
      if (existingSub.length > 0) return res.status(409).json({ error: "Hai gia una sottoscrizione o trial attivo per questo modulo" });

      const trialStart = new Date();
      const trialEnd = new Date(trialStart.getTime() + module.trialDays * 24 * 60 * 60 * 1000);

      const [sub] = await db.insert(orgSubscriptions).values({
        organizationId: userOrgId as any,
        moduleKey,
        moduleName: module.name,
        status: 'trialing',
        billingPeriod: 'monthly',
        trialStart,
        trialEnd,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        amount: module.priceMonthly || 0,
      }).returning();

      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId as any));
      const enabledModules = Array.isArray(org?.enabledModules) ? [...(org.enabledModules as string[])] : [];
      const toAddTrial = getEnabledIds(moduleKey);
      let trialChanged = false;
      toAddTrial.forEach(id => { if (!enabledModules.includes(id)) { enabledModules.push(id); trialChanged = true; } });
      if (trialChanged) {
        await db.update(organizations).set({ enabledModules }).where(eq(organizations.id, userOrgId as any));
      }

      res.json({ success: true, subscription: sub, trialEnd: trialEnd.toISOString() });
    } catch (error) {
      console.error("Error activating trial:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/marketplace/cancel-subscription", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const { subscriptionId } = req.body;
      if (!subscriptionId) return res.status(400).json({ error: "ID sottoscrizione obbligatorio" });

      const [sub] = await db.select().from(orgSubscriptions)
        .where(and(eq(orgSubscriptions.id, subscriptionId), eq(orgSubscriptions.organizationId, userOrgId as any)));
      if (!sub) return res.status(404).json({ error: "Sottoscrizione non trovata" });

      await db.update(orgSubscriptions).set({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      }).where(eq(orgSubscriptions.id, subscriptionId));

      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId as any));
      const enabledModules = disableModuleIds(Array.isArray(org?.enabledModules) ? (org.enabledModules as string[]) : [], sub.moduleKey);
      await db.update(organizations).set({ enabledModules }).where(eq(organizations.id, userOrgId as any));

      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/marketplace/purchase", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const { moduleKey, billingPeriod } = req.body;
      if (!moduleKey) return res.status(400).json({ error: "Chiave modulo obbligatoria" });

      const [module] = await db.select().from(premiumModules).where(eq(premiumModules.moduleKey, moduleKey));
      if (!module) return res.status(404).json({ error: "Modulo non trovato" });

      const existingActive = await db.select().from(orgSubscriptions)
        .where(and(
          eq(orgSubscriptions.organizationId, userOrgId as any),
          eq(orgSubscriptions.moduleKey, moduleKey),
          sql`${orgSubscriptions.status} IN ('active')`
        ));
      if (existingActive.length > 0) return res.status(409).json({ error: "Hai gia un abbonamento attivo per questo modulo" });

      const period = billingPeriod || 'monthly';
      const amount = period === 'yearly' ? (module.priceYearly || 0) : (module.priceMonthly || 0);
      const now = new Date();
      const periodEnd = new Date(now);
      if (period === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId as any));

      const existingTrialing = await db.select().from(orgSubscriptions)
        .where(and(
          eq(orgSubscriptions.organizationId, userOrgId as any),
          eq(orgSubscriptions.moduleKey, moduleKey),
          eq(orgSubscriptions.status, 'trialing')
        ));

      let sub;
      if (existingTrialing.length > 0) {
        [sub] = await db.update(orgSubscriptions).set({
          status: 'active',
          billingPeriod: period,
          amount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        }).where(eq(orgSubscriptions.id, existingTrialing[0].id)).returning();
      } else {
        [sub] = await db.insert(orgSubscriptions).values({
          organizationId: userOrgId as any,
          moduleKey,
          moduleName: module.name,
          status: 'active',
          billingPeriod: period,
          amount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        }).returning();
      }

      const enabledModules = Array.isArray(org?.enabledModules) ? [...(org.enabledModules as string[])] : [];
      const toAddPurchase = getEnabledIds(moduleKey);
      let purchaseChanged = false;
      toAddPurchase.forEach(id => { if (!enabledModules.includes(id)) { enabledModules.push(id); purchaseChanged = true; } });
      if (purchaseChanged) {
        await db.update(organizations).set({ enabledModules }).where(eq(organizations.id, userOrgId as any));
      }

      const invoiceCount = await db.select({ count: sql<number>`count(*)::int` }).from(paymentHistory);
      const invoiceNumber = `SD-${now.getFullYear()}-${String((invoiceCount[0]?.count || 0) + 1).padStart(5, '0')}`;

      await db.insert(paymentHistory).values({
        organizationId: userOrgId as any,
        amount,
        currency: 'eur',
        status: 'succeeded',
        description: `Acquisto ${module.name} - Piano ${period === 'yearly' ? 'Annuale' : 'Mensile'}`,
        moduleKey,
        moduleName: module.name,
        billingPeriod: period,
        invoiceNumber,
        orgName: org?.name || '',
      });

      res.json({ success: true, subscription: sub, mode: 'manual', message: `${module.name} attivato con successo!` });
    } catch (error) {
      console.error("Error purchasing module:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/marketplace/my-purchases-detailed", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const subs = await db.select().from(orgSubscriptions)
        .where(eq(orgSubscriptions.organizationId, userOrgId as any))
        .orderBy(desc(orgSubscriptions.createdAt));
      const payments = await db.select().from(paymentHistory)
        .where(eq(paymentHistory.organizationId, userOrgId as any))
        .orderBy(desc(paymentHistory.createdAt));

      const allModules = await db.select().from(premiumModules);
      const moduleMap: Record<string, any> = {};
      allModules.forEach(m => { moduleMap[m.moduleKey] = m; });

      const enrichedSubs = subs.map(s => ({
        ...s,
        module: moduleMap[s.moduleKey] || null,
        daysRemaining: s.trialEnd ? Math.max(0, Math.ceil((new Date(s.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null,
        isTrialExpired: s.status === 'trialing' && s.trialEnd && new Date(s.trialEnd) < new Date(),
      }));

      res.json({ subscriptions: enrichedSubs, payments });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // MARKETPLACE ANALYTICS (Super Admin)
  // ============================================================================

  app.get("/api/saas/marketplace-analytics", requireSuperAdmin, async (req, res) => {
    try {
      const allItems = await db.select().from(premiumModules);
      const allSubs = await db.select().from(orgSubscriptions);
      const allPayments = await db.select().from(paymentHistory);
      const allOrgs = await db.select().from(organizations);

      const activeSubs = allSubs.filter(s => s.status === 'active');
      const trialingSubs = allSubs.filter(s => s.status === 'trialing');
      const cancelledSubs = allSubs.filter(s => s.status === 'cancelled');
      const succeededPayments = allPayments.filter(p => p.status === 'succeeded');
      const totalRevenue = succeededPayments.reduce((sum, p) => sum + p.amount, 0);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const revenueThisMonth = succeededPayments.filter(p => new Date(p.createdAt) >= thirtyDaysAgo).reduce((sum, p) => sum + p.amount, 0);
      const revenueLastMonth = succeededPayments.filter(p => new Date(p.createdAt) >= sixtyDaysAgo && new Date(p.createdAt) < thirtyDaysAgo).reduce((sum, p) => sum + p.amount, 0);

      const mrr = activeSubs.reduce((sum, s) => {
        if (s.billingPeriod === 'yearly') return sum + Math.round((s.amount || 0) / 12);
        return sum + (s.amount || 0);
      }, 0);

      const revenueByMonth: Record<string, number> = {};
      succeededPayments.forEach(p => {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        revenueByMonth[key] = (revenueByMonth[key] || 0) + p.amount;
      });

      const subsByModule: Record<string, number> = {};
      activeSubs.forEach(s => { subsByModule[s.moduleKey] = (subsByModule[s.moduleKey] || 0) + 1; });

      const topModules = Object.entries(subsByModule)
        .map(([key, count]) => {
          const mod = allItems.find(i => i.moduleKey === key);
          return { moduleKey: key, name: mod?.name || key, count, category: mod?.category || 'modulo' };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const revenueByCategory: Record<string, number> = {};
      succeededPayments.forEach(p => {
        const mod = allItems.find(i => i.moduleKey === p.moduleKey);
        const cat = mod?.category || 'altro';
        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + p.amount;
      });

      const trialConversions = allSubs.filter(s => s.trialStart && s.status === 'active').length;
      const totalTrials = allSubs.filter(s => s.trialStart).length;
      const trialConversionRate = totalTrials > 0 ? Math.round((trialConversions / totalTrials) * 100) : 0;

      const subsByMonth: Record<string, number> = {};
      allSubs.forEach(s => {
        const d = new Date(s.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        subsByMonth[key] = (subsByMonth[key] || 0) + 1;
      });

      res.json({
        summary: {
          totalItems: allItems.length,
          activeItems: allItems.filter(i => i.isActive).length,
          totalSubscriptions: allSubs.length,
          activeSubscriptions: activeSubs.length,
          trialSubscriptions: trialingSubs.length,
          cancelledSubscriptions: cancelledSubs.length,
          totalRevenue,
          revenueThisMonth,
          revenueLastMonth,
          revenueGrowth: revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : 0,
          mrr,
          arr: mrr * 12,
          trialConversionRate,
          totalOrganizations: allOrgs.length,
          payingOrganizations: new Set(activeSubs.map(s => s.organizationId)).size,
        },
        charts: {
          revenueByMonth,
          subsByMonth,
          revenueByCategory,
          topModules,
        },
        recentPayments: succeededPayments.slice(0, 15).map(p => ({
          ...p,
          orgName: allOrgs.find(o => o.id === p.organizationId)?.name || 'N/A',
        })),
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // INVOICE PDF GENERATION
  // ============================================================================

  app.get("/api/marketplace/invoice/:paymentId", requireAdmin, async (req, res) => {
    try {
      const { paymentId } = req.params;
      const userOrgId = req.session?.organizationId;
      const userRole = req.session?.userRole;

      let paymentQuery;
      if (userRole === 'super_admin') {
        [paymentQuery] = await db.select().from(paymentHistory).where(eq(paymentHistory.id, paymentId));
      } else {
        [paymentQuery] = await db.select().from(paymentHistory)
          .where(and(eq(paymentHistory.id, paymentId), eq(paymentHistory.organizationId, userOrgId as any)));
      }

      if (!paymentQuery) return res.status(404).json({ error: "Fattura non trovata" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, paymentQuery.organizationId));

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=fattura-${paymentQuery.invoiceNumber || paymentId}.pdf`);
      doc.pipe(res);

      doc.rect(0, 0, 595, 120).fill('#0066CC');
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff').text('SOCCORSO DIGITALE', 50, 35);
      doc.fontSize(10).font('Helvetica').fillColor('#ffffff').text('Piattaforma SaaS per Trasporti Sanitari', 50, 68);
      doc.fontSize(10).text('www.soccorsodigitale.app | info@soccorsodigitale.app', 50, 83);

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text('FATTURA', 430, 35, { align: 'right', width: 115 });
      doc.fontSize(10).font('Helvetica').fillColor('#ffffff');
      doc.text(paymentQuery.invoiceNumber || `SD-${paymentId.slice(0,8).toUpperCase()}`, 380, 65, { align: 'right', width: 165 });
      doc.text(new Date(paymentQuery.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }), 380, 80, { align: 'right', width: 165 });

      let y = 145;
      doc.fillColor('#333333');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0066CC').text('EMITTENTE', 50, y);
      y += 15;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text('Soccorso Digitale S.r.l.', 50, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('P.IVA: IT12345678901', 50, y); y += 12;
      doc.text('Via della Tecnologia, 42', 50, y); y += 12;
      doc.text('20100 Milano (MI), Italia', 50, y); y += 12;
      doc.text('PEC: soccorsodigitale@pec.it', 50, y);

      y = 145;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0066CC').text('DESTINATARIO', 320, y);
      y += 15;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text(org?.name || paymentQuery.orgName || 'Organizzazione', 320, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      if (paymentQuery.orgVatNumber) { doc.text(`P.IVA: ${paymentQuery.orgVatNumber}`, 320, y); y += 12; }
      if (paymentQuery.orgFiscalCode) { doc.text(`C.F.: ${paymentQuery.orgFiscalCode}`, 320, y); y += 12; }
      if (paymentQuery.orgAddress) { doc.text(paymentQuery.orgAddress, 320, y); y += 12; }

      y = 265;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      y += 15;

      doc.rect(50, y, 495, 28).fill('#f1f5f9');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
      doc.text('DESCRIZIONE', 60, y + 8, { width: 250 });
      doc.text('PERIODO', 320, y + 8, { width: 80 });
      doc.text('IMPORTO', 440, y + 8, { width: 95, align: 'right' });
      y += 38;

      const netAmount = paymentQuery.amount;
      const ivaRate = 0.22;
      const ivaAmount = Math.round(netAmount * ivaRate);
      const totalAmount = netAmount + ivaAmount;

      doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
      doc.text(paymentQuery.description || paymentQuery.moduleName || paymentQuery.moduleKey || 'Servizio', 60, y, { width: 250 });
      doc.text(paymentQuery.billingPeriod === 'yearly' ? 'Annuale' : 'Mensile', 320, y, { width: 80 });
      doc.text(`${(netAmount / 100).toFixed(2)} EUR`, 440, y, { width: 95, align: 'right' });
      y += 25;

      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      y += 20;

      doc.fontSize(9).font('Helvetica').fillColor('#64748b');
      doc.text('Imponibile:', 370, y); doc.text(`${(netAmount / 100).toFixed(2)} EUR`, 440, y, { width: 95, align: 'right' }); y += 16;
      doc.text('IVA (22%):', 370, y); doc.text(`${(ivaAmount / 100).toFixed(2)} EUR`, 440, y, { width: 95, align: 'right' }); y += 20;

      doc.rect(360, y - 4, 195, 30).fill('#0066CC');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('TOTALE:', 370, y + 3);
      doc.text(`${(totalAmount / 100).toFixed(2)} EUR`, 440, y + 3, { width: 95, align: 'right' });
      y += 50;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0066CC').text('DETTAGLI PAGAMENTO', 50, y);
      y += 15;
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text(`Stato: ${paymentQuery.status === 'succeeded' ? 'Pagato' : paymentQuery.status}`, 50, y); y += 12;
      doc.text(`Valuta: EUR (Euro)`, 50, y); y += 12;
      doc.text(`Metodo: Piattaforma Soccorso Digitale`, 50, y); y += 12;
      if (paymentQuery.stripePaymentIntentId) { doc.text(`Rif. Pagamento: ${paymentQuery.stripePaymentIntentId}`, 50, y); y += 12; }

      const footerY = 770;
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
      doc.text('Documento generato automaticamente dalla piattaforma Soccorso Digitale. Questo documento non ha valore fiscale ai fini IVA.', 50, footerY + 8, { width: 495, align: 'center' });
      doc.text('Per fatturazione elettronica contattare: fatturazione@soccorsodigitale.app', 50, footerY + 20, { width: 495, align: 'center' });

      doc.end();
    } catch (error) {
      console.error("Error generating invoice:", error);
      res.status(500).json({ error: "Errore nella generazione della fattura" });
    }
  });

  app.post("/api/saas/expire-trials", requireSuperAdmin, async (req, res) => {
    try {
      const now = new Date();
      const expiredTrials = await db.select().from(orgSubscriptions)
        .where(and(eq(orgSubscriptions.status, 'trialing'), lte(orgSubscriptions.trialEnd, now)));

      for (const trial of expiredTrials) {
        await db.update(orgSubscriptions).set({ status: 'trial_expired', updatedAt: now })
          .where(eq(orgSubscriptions.id, trial.id));

        const [org] = await db.select().from(organizations).where(eq(organizations.id, trial.organizationId));
        if (org) {
          const enabledModules = disableModuleIds(
            Array.isArray(org.enabledModules) ? (org.enabledModules as string[]) : [],
            trial.moduleKey
          );
          await db.update(organizations).set({ enabledModules }).where(eq(organizations.id, trial.organizationId));
        }
      }

      res.json({ expired: expiredTrials.length });
    } catch (error) {
      console.error("Error expiring trials:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });
}
