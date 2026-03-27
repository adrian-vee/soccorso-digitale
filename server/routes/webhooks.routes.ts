/**
 * Webhook Routes
 *
 * Handles incoming Stripe webhook events for subscription lifecycle,
 * payment tracking, and module activation.
 */

import type { Express } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  organizations,
  orgSubscriptions,
  paymentHistory,
} from "@shared/schema";

export function registerWebhookRoutes(app: Express): void {
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
              const comboIds = moduleKey === 'analisi_economica_utif'
                ? ['analisi_economica', 'report_accise'] : [moduleKey];
              const enabledModules = Array.isArray(org.enabledModules) ? [...(org.enabledModules as string[])] : [];
              let hookChanged = false;
              comboIds.forEach(id => { if (!enabledModules.includes(id)) { enabledModules.push(id); hookChanged = true; } });
              if (hookChanged) {
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
}
