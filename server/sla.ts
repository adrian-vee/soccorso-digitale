import { db } from "./db";
import { 
  slaMetrics, 
  healthCheckLogs, 
  slaTargets, 
  slaBreaches,
  InsertSlaMetric,
  InsertHealthCheckLog,
  InsertSlaTarget,
} from "../shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
let totalResponseTime = 0;

export function trackRequest(responseTimeMs: number, isError: boolean) {
  requestCount++;
  totalResponseTime += responseTimeMs;
  if (isError) {
    errorCount++;
  }
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

export function getUptimePercentage(): number {
  const totalSeconds = getUptimeSeconds();
  if (totalSeconds === 0) return 100;
  return 100;
}

export function getAverageResponseTime(): number {
  if (requestCount === 0) return 0;
  return Math.round(totalResponseTime / requestCount);
}

export function getErrorRate(): number {
  if (requestCount === 0) return 0;
  return (errorCount / requestCount) * 100;
}

export function getRequestCount(): number {
  return requestCount;
}

export async function logHealthCheck(data: InsertHealthCheckLog) {
  return await db.insert(healthCheckLogs).values(data).returning();
}

export async function getRecentHealthChecks(limit = 100) {
  return await db
    .select()
    .from(healthCheckLogs)
    .orderBy(desc(healthCheckLogs.checkedAt))
    .limit(limit);
}

export async function getHealthChecksByService(serviceName: string, limit = 50) {
  return await db
    .select()
    .from(healthCheckLogs)
    .where(eq(healthCheckLogs.serviceName, serviceName))
    .orderBy(desc(healthCheckLogs.checkedAt))
    .limit(limit);
}

export async function recordSlaMetric(data: InsertSlaMetric) {
  return await db.insert(slaMetrics).values(data).returning();
}

export async function getSlaMetrics(serviceName?: string, period?: string) {
  let query = db.select().from(slaMetrics);
  
  if (serviceName && period) {
    return await query
      .where(and(
        eq(slaMetrics.serviceName, serviceName),
        eq(slaMetrics.period, period)
      ))
      .orderBy(desc(slaMetrics.periodEnd))
      .limit(100);
  } else if (serviceName) {
    return await query
      .where(eq(slaMetrics.serviceName, serviceName))
      .orderBy(desc(slaMetrics.periodEnd))
      .limit(100);
  }
  
  return await query.orderBy(desc(slaMetrics.periodEnd)).limit(100);
}

export async function createSlaTarget(data: InsertSlaTarget) {
  return await db.insert(slaTargets).values(data).returning();
}

export async function getSlaTargets() {
  return await db.select().from(slaTargets).where(eq(slaTargets.isActive, true));
}

export async function updateSlaTarget(id: string, data: Partial<InsertSlaTarget>) {
  return await db
    .update(slaTargets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(slaTargets.id, id))
    .returning();
}

export async function deleteSlaTarget(id: string) {
  return await db
    .update(slaTargets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(slaTargets.id, id))
    .returning();
}

export async function recordSlaBreach(data: {
  slaTargetId: string;
  serviceName: string;
  metricType: "uptime" | "response_time" | "error_rate" | "throughput" | "availability";
  targetValue: number;
  actualValue: number;
  breachSeverity: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return await db.insert(slaBreaches).values(data).returning();
}

export async function getSlaBreaches(resolved = false) {
  if (resolved) {
    return await db
      .select()
      .from(slaBreaches)
      .orderBy(desc(slaBreaches.createdAt))
      .limit(100);
  }
  
  return await db
    .select()
    .from(slaBreaches)
    .where(sql`${slaBreaches.resolvedAt} IS NULL`)
    .orderBy(desc(slaBreaches.createdAt))
    .limit(100);
}

export async function resolveBreach(id: string, resolution: string) {
  return await db
    .update(slaBreaches)
    .set({ resolvedAt: new Date(), resolution })
    .where(eq(slaBreaches.id, id))
    .returning();
}

export async function getSystemHealth() {
  const uptimeSeconds = getUptimeSeconds();
  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  let dbStatus: "healthy" | "unhealthy" = "healthy";
  let dbResponseTime = 0;
  
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    dbResponseTime = Date.now() - dbStart;
  } catch {
    dbStatus = "unhealthy";
  }
  
  const recentChecks = await getRecentHealthChecks(10);
  const healthyChecks = recentChecks.filter(c => c.status === "healthy").length;
  const healthPercentage = recentChecks.length > 0 
    ? Math.round((healthyChecks / recentChecks.length) * 100) 
    : 100;
  
  return {
    status: dbStatus === "healthy" ? "healthy" : "degraded",
    uptime: {
      seconds: uptimeSeconds,
      formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
      percentage: getUptimePercentage(),
    },
    performance: {
      averageResponseTimeMs: getAverageResponseTime(),
      requestCount: getRequestCount(),
      errorRate: getErrorRate(),
    },
    database: {
      status: dbStatus,
      responseTimeMs: dbResponseTime,
    },
    healthChecks: {
      recent: recentChecks.length,
      healthyPercentage: healthPercentage,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function runHealthCheck() {
  const services = ["api", "database"];
  const results = [];
  
  for (const service of services) {
    const startTime = Date.now();
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let errorMessage = null;
    let statusCode = 200;
    
    try {
      if (service === "database") {
        await db.execute(sql`SELECT 1`);
      }
    } catch (error: any) {
      status = "unhealthy";
      errorMessage = error.message;
      statusCode = 500;
    }
    
    const responseTime = Date.now() - startTime;
    
    if (status === "healthy" && responseTime > 1000) {
      status = "degraded";
    }
    
    const [log] = await logHealthCheck({
      serviceName: service,
      endpoint: service === "api" ? "/health" : "postgres",
      status,
      responseTimeMs: responseTime,
      statusCode,
      errorMessage,
    });
    
    results.push(log);
  }
  
  return results;
}

export async function aggregateHourlyMetrics() {
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);
  
  const checks = await db
    .select()
    .from(healthCheckLogs)
    .where(and(
      gte(healthCheckLogs.checkedAt, hourStart),
      lte(healthCheckLogs.checkedAt, hourEnd)
    ));
  
  if (checks.length === 0) return;
  
  const healthyCount = checks.filter(c => c.status === "healthy").length;
  const avgResponseTime = checks.reduce((sum, c) => sum + (c.responseTimeMs || 0), 0) / checks.length;
  
  const uptimePercentage = (healthyCount / checks.length) * 100;
  
  await recordSlaMetric({
    metricType: "uptime",
    serviceName: "api",
    value: uptimePercentage,
    unit: "percent",
    period: "hourly",
    periodStart: hourStart,
    periodEnd: hourEnd,
  });
  
  await recordSlaMetric({
    metricType: "response_time",
    serviceName: "api",
    value: avgResponseTime,
    unit: "ms",
    period: "hourly",
    periodStart: hourStart,
    periodEnd: hourEnd,
  });
  
  const targets = await getSlaTargets();
  for (const target of targets) {
    if (target.serviceName === "api") {
      let actualValue = 0;
      if (target.metricType === "uptime") {
        actualValue = uptimePercentage;
      } else if (target.metricType === "response_time") {
        actualValue = avgResponseTime;
      }
      
      let isBreach = false;
      let severity = "warning";
      
      if (target.metricType === "uptime" && actualValue < target.targetValue) {
        isBreach = true;
        if (target.criticalThreshold && actualValue < target.criticalThreshold) {
          severity = "critical";
        }
      } else if (target.metricType === "response_time" && actualValue > target.targetValue) {
        isBreach = true;
        if (target.criticalThreshold && actualValue > target.criticalThreshold) {
          severity = "critical";
        }
      }
      
      if (isBreach) {
        await recordSlaBreach({
          slaTargetId: target.id,
          serviceName: target.serviceName,
          metricType: target.metricType,
          targetValue: target.targetValue,
          actualValue,
          breachSeverity: severity,
          period: "hourly",
          periodStart: hourStart,
          periodEnd: hourEnd,
        });
      }
    }
  }
}

export async function seedDefaultSlaTargets() {
  const existing = await getSlaTargets();
  if (existing.length > 0) return;
  
  await createSlaTarget({
    serviceName: "api",
    metricType: "uptime",
    targetValue: 99.9,
    warningThreshold: 99.5,
    criticalThreshold: 99.0,
    period: "monthly",
    description: "API Uptime SLA - 99.9% garantito",
  });
  
  await createSlaTarget({
    serviceName: "api",
    metricType: "response_time",
    targetValue: 500,
    warningThreshold: 750,
    criticalThreshold: 1000,
    period: "monthly",
    description: "API Response Time - max 500ms media",
  });
  
  await createSlaTarget({
    serviceName: "database",
    metricType: "uptime",
    targetValue: 99.99,
    warningThreshold: 99.9,
    criticalThreshold: 99.5,
    period: "monthly",
    description: "Database Uptime SLA - 99.99% garantito",
  });
  
  console.log("[SLA] Default targets created");
}
