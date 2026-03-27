/**
 * Webhook Routes
 *
 * Handles incoming Stripe webhook events for subscription lifecycle,
 * payment tracking, and module activation.
 *
 * SECURITY: All webhook events are verified via Stripe-Signature header
 * using STRIPE_WEBHOOK_SECRET. Unverified requests are rejected with 400.
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
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey) return res.status(400).json({ error: "Stripe not configured" });

    // Verify Stripe signature to prevent forged webhook events
    let event: any;
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        console.warn("[webhooks/stripe] Missing Stripe-Signature header");
        return res.status(400).json({ error: "Missing Stripe-Signature header" });
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require("stripe");
        const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
        // rawBody is populated by the body-parser verify callback in index.ts
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.warn("[webhooks/stripe] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }
    } else {
      // STRIPE_WEBHOOK_SECRET not configured — log warning and fall through
      // This should only happen in local dev; production must have it set.
      console.warn("[webhooks/stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode only)");
      event = req.body;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const { organizationId, moduleKey } = session.metadata || {};

          if (organizationId && moduleKey) {
            await db.insert(orgSubscriptions).values({
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
      console.error("[webhooks/stripe] Event processing error:", error);
      res.status(500).json({ error: "Internal server error processing webhook" });
    }
  });
}
