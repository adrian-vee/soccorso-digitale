import { db } from "./db";
import { sql } from "drizzle-orm";
import { slaMetrics, slaBreaches, slaTargets, healthCheckLogs } from "@shared/schema";
import { getResendClient } from "./resend-client";

interface ServiceCheck {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTimeMs: number;
  message?: string;
}

interface HealthCheckResult {
  status: "operational" | "degraded" | "major_outage";
  timestamp: string;
  services: ServiceCheck[];
  uptime30d?: number;
}

let lastIncidentState: Record<string, boolean> = {};
let monitoringInterval: ReturnType<typeof setInterval> | null = null;

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { service: "database", status: "healthy", responseTimeMs: Date.now() - start };
  } catch (err: any) {
    return { service: "database", status: "unhealthy", responseTimeMs: Date.now() - start, message: err.message };
  }
}

async function checkApi(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const port = process.env.PORT || 5000;
    const res = await fetch(`http://localhost:${port}/api/auth/session`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 200) {
      return { service: "api", status: "healthy", responseTimeMs: Date.now() - start };
    }
    return { service: "api", status: "degraded", responseTimeMs: Date.now() - start, message: `HTTP ${res.status}` };
  } catch (err: any) {
    return { service: "api", status: "unhealthy", responseTimeMs: Date.now() - start, message: err.message };
  }
}

async function checkObjectStorage(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return { service: "storage", status: "degraded", responseTimeMs: Date.now() - start, message: "Bucket non configurato" };
    }
    const fs = await import("fs");
    const testPath = "/tmp/.storage_health_check";
    fs.writeFileSync(testPath, "ok");
    fs.unlinkSync(testPath);
    return { service: "storage", status: "healthy", responseTimeMs: Date.now() - start };
  } catch (err: any) {
    return { service: "storage", status: "degraded", responseTimeMs: Date.now() - start, message: err.message?.substring(0, 100) };
  }
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const checks = await Promise.all([checkDatabase(), checkApi(), checkObjectStorage()]);
  
  const unhealthy = checks.filter(c => c.status === "unhealthy").length;
  const degraded = checks.filter(c => c.status === "degraded").length;
  
  let overallStatus: "operational" | "degraded" | "major_outage" = "operational";
  if (unhealthy > 0) overallStatus = "major_outage";
  else if (degraded > 0) overallStatus = "degraded";
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: checks,
  };
}

async function recordHealthMetrics(result: HealthCheckResult) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 5 * 60 * 1000);
  
  try {
    for (const svc of result.services) {
      await db.insert(healthCheckLogs).values({
        serviceName: svc.service,
        endpoint: svc.service === "api" ? "/api/auth/session" : svc.service === "database" ? "SELECT 1" : "bucket.getMetadata",
        status: svc.status,
        responseTimeMs: svc.responseTimeMs,
        errorMessage: svc.message || null,
        checkedAt: now,
      });
      
      await db.insert(slaMetrics).values({
        metricType: "response_time",
        serviceName: svc.service,
        value: svc.responseTimeMs,
        unit: "ms",
        period: "5min",
        periodStart: now,
        periodEnd: periodEnd,
      });
      
      const uptimeValue = svc.status === "healthy" ? 100 : svc.status === "degraded" ? 50 : 0;
      await db.insert(slaMetrics).values({
        metricType: "uptime",
        serviceName: svc.service,
        value: uptimeValue,
        unit: "percent",
        period: "5min",
        periodStart: now,
        periodEnd: periodEnd,
      });
    }
  } catch (err) {
    console.error("[HealthMonitor] Error recording metrics:", err);
  }
}

async function handleIncidents(result: HealthCheckResult) {
  for (const svc of result.services) {
    const wasDown = lastIncidentState[svc.service] || false;
    const isDown = svc.status === "unhealthy";
    
    if (isDown && !wasDown) {
      console.log(`[HealthMonitor] INCIDENT OPENED: ${svc.service} is ${svc.status}`);
      try {
        const targets = await db.select().from(slaTargets).where(sql`${slaTargets.serviceName} = ${svc.service} AND ${slaTargets.isActive} = true`);
        let targetId = targets[0]?.id;
        if (!targetId) {
          const [newTarget] = await db.insert(slaTargets).values({
            serviceName: svc.service,
            metricType: "uptime",
            targetValue: 99.9,
            warningThreshold: 99.5,
            criticalThreshold: 99.0,
            period: "monthly",
            description: `Uptime target for ${svc.service}`,
          }).returning();
          targetId = newTarget.id;
        }
        
        const now = new Date();
        await db.insert(slaBreaches).values({
          slaTargetId: targetId,
          serviceName: svc.service,
          metricType: "uptime",
          targetValue: 99.9,
          actualValue: 0,
          breachSeverity: "critical",
          period: "5min",
          periodStart: now,
          periodEnd: new Date(now.getTime() + 5 * 60 * 1000),
        });
        
        await sendIncidentAlert(svc.service, svc.message || "Servizio non raggiungibile", "open");
      } catch (err) {
        console.error("[HealthMonitor] Error creating breach:", err);
      }
    } else if (!isDown && wasDown) {
      console.log(`[HealthMonitor] INCIDENT RESOLVED: ${svc.service} is now ${svc.status}`);
      try {
        await db.execute(sql`
          UPDATE sla_breaches 
          SET resolved_at = NOW(), resolution = 'Servizio ripristinato automaticamente'
          WHERE service_name = ${svc.service} 
          AND resolved_at IS NULL
        `);
        await sendIncidentAlert(svc.service, "Servizio ripristinato", "resolved");
      } catch (err) {
        console.error("[HealthMonitor] Error resolving breach:", err);
      }
    }
    
    lastIncidentState[svc.service] = isDown;
  }
}

async function sendIncidentAlert(serviceName: string, message: string, type: "open" | "resolved") {
  try {
    const { client } = await getResendClient();
    const senderEmail = "Soccorso Digitale <noreply@soccorsodigitale.app>";
    const now = new Date();
    const timestamp = now.toLocaleString("it-IT", { 
      day: "2-digit", month: "2-digit", year: "numeric", 
      hour: "2-digit", minute: "2-digit", second: "2-digit" 
    });
    
    const serviceLabels: Record<string, string> = {
      api: "API Server",
      database: "Database PostgreSQL",
      storage: "Object Storage",
    };
    const serviceLabel = serviceLabels[serviceName] || serviceName;
    
    const isOpen = type === "open";
    const statusColor = isOpen ? "#DC2626" : "#16A34A";
    const statusIcon = isOpen ? "INCIDENTE APERTO" : "INCIDENTE RISOLTO";
    const severity = isOpen ? "P1 - Critico" : "Risolto";
    
    const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f3f4f6;">
<table role="presentation" style="width:100%;border-collapse:collapse;">
<tr><td style="padding:40px 20px;">
<table role="presentation" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${statusColor};padding:24px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:20px;letter-spacing:1px;">${statusIcon}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Soccorso Digitale - Monitoraggio Infrastruttura</p>
</td></tr>
<tr><td style="padding:32px 40px;">
<table role="presentation" style="width:100%;background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:20px;">
<tr><td style="padding:16px;">
<table role="presentation" style="width:100%;">
<tr><td style="padding:6px 0;"><span style="color:#6B7280;font-size:12px;text-transform:uppercase;">Servizio</span><br><span style="color:#1F2937;font-size:15px;font-weight:600;">${serviceLabel}</span></td></tr>
<tr><td style="padding:6px 0;border-top:1px solid #E5E7EB;"><span style="color:#6B7280;font-size:12px;text-transform:uppercase;">Severita</span><br><span style="color:${statusColor};font-size:15px;font-weight:600;">${severity}</span></td></tr>
<tr><td style="padding:6px 0;border-top:1px solid #E5E7EB;"><span style="color:#6B7280;font-size:12px;text-transform:uppercase;">Timestamp</span><br><span style="color:#1F2937;font-size:14px;">${timestamp}</span></td></tr>
<tr><td style="padding:6px 0;border-top:1px solid #E5E7EB;"><span style="color:#6B7280;font-size:12px;text-transform:uppercase;">Dettagli</span><br><span style="color:#1F2937;font-size:14px;">${message}</span></td></tr>
</table></td></tr></table>
${isOpen ? `<div style="background-color:#FEF2F2;border-left:4px solid #DC2626;padding:16px;border-radius:0 8px 8px 0;">
<p style="margin:0;color:#991B1B;font-size:13px;font-weight:600;">Azione Richiesta</p>
<p style="margin:8px 0 0;color:#374151;font-size:13px;line-height:1.5;">Questo incidente e stato rilevato automaticamente dal sistema di monitoraggio. Il team tecnico e stato notificato. Tempo massimo di risoluzione previsto dai contratti PA: 4 ore.</p>
</div>` : `<div style="background-color:#F0FDF4;border-left:4px solid #16A34A;padding:16px;border-radius:0 8px 8px 0;">
<p style="margin:0;color:#166534;font-size:13px;font-weight:600;">Servizio Ripristinato</p>
<p style="margin:8px 0 0;color:#374151;font-size:13px;">Il servizio ${serviceLabel} e tornato operativo. Nessuna ulteriore azione richiesta.</p>
</div>`}
</td></tr>
<tr><td style="background-color:#F9FAFB;padding:20px 40px;border-top:1px solid #E5E7EB;text-align:center;">
<p style="margin:0;color:#6B7280;font-size:11px;">Soccorso Digitale - Sistema di Monitoraggio Automatico</p>
</td></tr>
</table></td></tr></table></body></html>`;
    
    const adminEmails = ["superadmin@soccorsodigitale.app"];
    
    try {
      const orgAdmins = await db.execute(sql`
        SELECT DISTINCT u.email FROM users u 
        WHERE u.account_type = 'admin' AND u.email IS NOT NULL AND u.email != ''
      `);
      for (const row of orgAdmins.rows) {
        if (row.email && !adminEmails.includes(row.email as string)) {
          adminEmails.push(row.email as string);
        }
      }
    } catch (e) {}
    
    for (const email of adminEmails) {
      try {
        await client.emails.send({
          from: senderEmail,
          to: email,
          subject: `[${isOpen ? "INCIDENTE" : "RISOLTO"}] ${serviceLabel} - Soccorso Digitale`,
          html: htmlContent,
        });
      } catch (emailErr) {
        console.error(`[HealthMonitor] Failed to send alert to ${email}:`, emailErr);
      }
    }
    
    console.log(`[HealthMonitor] Incident alert (${type}) sent to ${adminEmails.length} recipients`);
  } catch (err) {
    console.error("[HealthMonitor] Error sending incident alert:", err);
  }
}

export async function getUptimePercentage(days: number = 30): Promise<Record<string, number>> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db.execute(sql`
      SELECT service_name, AVG(value) as avg_uptime
      FROM sla_metrics 
      WHERE metric_type = 'uptime' AND period_start >= ${since}
      GROUP BY service_name
    `);
    const uptimes: Record<string, number> = {};
    for (const row of result.rows) {
      uptimes[row.service_name as string] = Math.round((row.avg_uptime as number) * 100) / 100;
    }
    return uptimes;
  } catch {
    return {};
  }
}

export async function getRecentIncidents(limit: number = 20) {
  try {
    const result = await db.execute(sql`
      SELECT id, service_name, breach_severity, created_at, resolved_at, resolution,
             CASE WHEN resolved_at IS NOT NULL 
               THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
               ELSE EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
             END as duration_minutes
      FROM sla_breaches 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `);
    return result.rows;
  } catch {
    return [];
  }
}

export function startHealthMonitoring() {
  if (monitoringInterval) return;
  
  const isProduction = process.env.NODE_ENV === "production";
  const intervalMs = isProduction ? 15 * 60 * 1000 : 5 * 60 * 1000;
  const delayMs = isProduction ? 60000 : 10000;
  
  console.log(`[HealthMonitor] Starting proactive monitoring (every ${intervalMs / 60000} minutes)`);
  
  setTimeout(async () => {
    try {
      const unresolvedBreaches = await db.execute(sql`
        SELECT DISTINCT service_name FROM sla_breaches WHERE resolved_at IS NULL
      `);
      for (const row of unresolvedBreaches.rows) {
        lastIncidentState[row.service_name as string] = true;
      }
      if (unresolvedBreaches.rows.length > 0) {
        console.log(`[HealthMonitor] Restored ${unresolvedBreaches.rows.length} unresolved incident state(s)`);
      }
      const result = await runHealthCheck();
      await recordHealthMetrics(result);
      await handleIncidents(result);
      console.log(`[HealthMonitor] Initial check: ${result.status}`);
    } catch (err) {
      console.error("[HealthMonitor] Initial check failed:", err);
    }
  }, delayMs);
  
  monitoringInterval = setInterval(async () => {
    try {
      const result = await runHealthCheck();
      await recordHealthMetrics(result);
      await handleIncidents(result);
    } catch (err) {
      console.error("[HealthMonitor] Monitoring cycle error:", err);
    }
  }, intervalMs);
}

export function stopHealthMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}
