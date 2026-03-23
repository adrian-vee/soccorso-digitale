/**
 * Routes Orchestrator
 *
 * Central entry point that imports and mounts all domain-specific route modules.
 * Each domain file registers its routes directly on the Express app.
 */

import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { auditMiddleware } from "../audit-middleware";
import { registerOrgAdminRoutes } from "../org-admin-routes";
import { registerHubRoutes } from "../hub-routes";
import { createProviderRoutes } from "./providers.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerTripRoutes } from "./trips.routes";
import { registerFleetRoutes } from "./fleet.routes";
import { registerShiftRoutes } from "./shifts.routes";
import { registerInventoryRoutes } from "./inventory.routes";
import { registerFinanceRoutes } from "./finance.routes";
import { registerBookingRoutes } from "./booking.routes";
import { registerBillingRoutes } from "./billing.routes";
import { registerAnalyticsRoutes } from "./analytics.routes";
import { registerAdminRoutes } from "./admin.routes";
import { registerWebhookRoutes } from "./webhooks.routes";
import { requireAuth, requireAdmin } from "../auth-middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Global WebSocket server reference for broadcasting
let wss: WebSocketServer | null = null;

export function getWss(): WebSocketServer | null {
  return wss;
}

export function broadcastMessage(message: any) {
  if (wss) {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Global middleware
  app.use("/api", auditMiddleware);

  // External route modules (pre-existing)
  registerOrgAdminRoutes(app);
  registerHubRoutes(app);

  // Provider API routes (geocoding, weather, holidays, validation, alerts)
  app.use("/api/providers", createProviderRoutes(requireAuth, requireAdmin));

  // Domain route modules
  registerAuthRoutes(app);
  registerTripRoutes(app);
  registerFleetRoutes(app);
  registerShiftRoutes(app);
  registerInventoryRoutes(app);
  registerFinanceRoutes(app);
  registerBookingRoutes(app);
  registerBillingRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminRoutes(app);
  registerWebhookRoutes(app);

  // HTTP + WebSocket server
  const httpServer = createServer(app);

  wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection for chat");

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  });

  // GDPR: Auto-clear expired patient names from scheduled services (24h after import)
  setInterval(async () => {
    try {
      const result = await db.execute(sql`
        UPDATE scheduled_services
        SET patient_name = NULL, patient_phone = NULL, patient_notes = NULL
        WHERE patient_name_expires_at IS NOT NULL
          AND patient_name_expires_at < NOW()
          AND patient_name IS NOT NULL
      `);
      const count = (result as any)?.rowCount || 0;
      if (count > 0) {
        console.log(`[GDPR] Cleaned ${count} expired patient names from scheduled services`);
      }
    } catch (err) {
      console.error('[GDPR] Error cleaning expired patient names:', err);
    }
  }, 60 * 60 * 1000); // Every hour

  return httpServer;
}
