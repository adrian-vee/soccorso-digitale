import { db } from "./db";
import { auditLogEntries, auditHashChainVerifications, type InsertAuditLogEntry } from "../shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import crypto from "crypto";

// ============================================================================
// ENTERPRISE AUDIT TRAIL SYSTEM
// Compliant with ISO 27001, GDPR, and Italian ASL requirements
// ============================================================================

// Context interface for audit logging
export interface AuditContext {
  // Actor information
  actorType: "user" | "vehicle" | "system" | "admin";
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  
  // Session/device info
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  
  // Location context
  locationId?: string;
  locationName?: string;
  vehicleId?: string;
  vehicleCode?: string;
}

// Audit entry creation interface
export interface CreateAuditEntry {
  action: InsertAuditLogEntry["action"];
  entityType: string;
  entityId?: string;
  entityName?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  description?: string;
  metadata?: Record<string, unknown>;
  isSensitive?: boolean;
  isCompliance?: boolean;
}

// Global request context (set by middleware)
let currentRequestContext: AuditContext | null = null;

// Set request context from middleware
export function setRequestContext(context: AuditContext): void {
  currentRequestContext = context;
}

// Clear request context
export function clearRequestContext(): void {
  currentRequestContext = null;
}

// Get current request context
export function getRequestContext(): AuditContext | null {
  return currentRequestContext;
}

// ============================================================================
// CRYPTOGRAPHIC HASH FUNCTIONS
// ============================================================================

// Canonicalize JSON by sorting keys recursively for deterministic hashing
function canonicalizeJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }
  // Handle Date objects - convert to ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeJson);
  }
  if (typeof obj === "object" && obj !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = canonicalizeJson((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

// Generate SHA-256 hash of audit entry
function generateEntryHash(entry: Omit<InsertAuditLogEntry, "id" | "entryHash" | "createdAt">): string {
  const canonicalData = JSON.stringify({
    occurredAt: entry.occurredAt instanceof Date ? entry.occurredAt.toISOString() : entry.occurredAt,
    actorType: entry.actorType || null,
    actorId: entry.actorId || null,
    actorName: entry.actorName || null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId || null,
    previousValue: canonicalizeJson(entry.previousValue),
    newValue: canonicalizeJson(entry.newValue),
    description: entry.description || null,
    previousHash: entry.previousHash || null,
  });
  
  return crypto.createHash("sha256").update(canonicalData).digest("hex");
}

// Get the hash of the most recent audit entry (for chain linking)
async function getLastEntryHash(): Promise<string | null> {
  const lastEntry = await db
    .select({ entryHash: auditLogEntries.entryHash })
    .from(auditLogEntries)
    .orderBy(desc(auditLogEntries.occurredAt))
    .limit(1);
  
  return lastEntry.length > 0 ? lastEntry[0].entryHash : null;
}

// Calculate changed fields between two objects
function calculateChangedFields(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined
): string[] {
  if (!previous || !next) return [];
  
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  
  for (const key of allKeys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      changedFields.push(key);
    }
  }
  
  return changedFields;
}

// ============================================================================
// AUDIT LOGGING FUNCTIONS
// ============================================================================

// Create an audit log entry with hash chain integrity
export async function createAuditEntry(entry: CreateAuditEntry): Promise<void> {
  const context = currentRequestContext || {
    actorType: "system" as const,
  };
  
  const occurredAt = new Date();
  const previousHash = await getLastEntryHash();
  
  const changedFields = calculateChangedFields(
    entry.previousValue as Record<string, unknown>,
    entry.newValue as Record<string, unknown>
  );
  
  const fullEntry: Omit<InsertAuditLogEntry, "id" | "createdAt"> = {
    occurredAt,
    actorType: context.actorType,
    actorId: context.actorId,
    actorName: context.actorName,
    actorEmail: context.actorEmail,
    sessionId: context.sessionId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    deviceInfo: context.deviceInfo,
    locationId: context.locationId,
    locationName: context.locationName,
    vehicleId: context.vehicleId,
    vehicleCode: context.vehicleCode,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    changedFields,
    description: entry.description,
    metadata: entry.metadata,
    previousHash,
    entryHash: "", // Will be calculated below
    isSensitive: entry.isSensitive || false,
    isCompliance: entry.isCompliance || false,
    retentionYears: 10, // Default 10 years retention
  };
  
  // Generate hash after all fields are set
  fullEntry.entryHash = generateEntryHash(fullEntry);
  
  try {
    await db.insert(auditLogEntries).values(fullEntry);
  } catch (error) {
    console.error("[AUDIT] Failed to create audit entry:", error);
    // Don't throw - audit failures should not break operations
  }
}

// Convenience functions for common audit actions
export const auditLog = {
  // User actions
  async login(userId: string, userName: string, email: string, metadata?: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "login",
      entityType: "user",
      entityId: userId,
      entityName: userName,
      description: `User ${userName} logged in`,
      metadata,
    });
  },
  
  async logout(userId: string, userName: string): Promise<void> {
    await createAuditEntry({
      action: "logout",
      entityType: "user",
      entityId: userId,
      entityName: userName,
      description: `User ${userName} logged out`,
    });
  },
  
  async passwordChange(userId: string, userName: string): Promise<void> {
    await createAuditEntry({
      action: "password_change",
      entityType: "user",
      entityId: userId,
      entityName: userName,
      description: `Password changed for user ${userName}`,
      isSensitive: true,
    });
  },
  
  async roleChange(userId: string, userName: string, oldRole: string, newRole: string): Promise<void> {
    await createAuditEntry({
      action: "role_change",
      entityType: "user",
      entityId: userId,
      entityName: userName,
      previousValue: { role: oldRole },
      newValue: { role: newRole },
      description: `Role changed from ${oldRole} to ${newRole} for user ${userName}`,
      isCompliance: true,
    });
  },
  
  // Vehicle actions
  async vehicleAccess(vehicleId: string, vehicleCode: string): Promise<void> {
    await createAuditEntry({
      action: "vehicle_access",
      entityType: "vehicle",
      entityId: vehicleId,
      entityName: vehicleCode,
      description: `Vehicle ${vehicleCode} accessed`,
    });
  },
  
  // Trip actions
  async tripSubmit(tripId: string, progressiveNumber: string, tripData: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "trip_submit",
      entityType: "trip",
      entityId: tripId,
      entityName: progressiveNumber,
      newValue: tripData,
      description: `Trip ${progressiveNumber} submitted`,
    });
  },
  
  async tripUpdate(tripId: string, progressiveNumber: string, previousData: Record<string, unknown>, newData: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "update",
      entityType: "trip",
      entityId: tripId,
      entityName: progressiveNumber,
      previousValue: previousData,
      newValue: newData,
      description: `Trip ${progressiveNumber} updated`,
    });
  },
  
  async tripDelete(tripId: string, progressiveNumber: string, tripData: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "delete",
      entityType: "trip",
      entityId: tripId,
      entityName: progressiveNumber,
      previousValue: tripData,
      description: `Trip ${progressiveNumber} deleted`,
      isCompliance: true,
    });
  },
  
  // Checklist actions
  async checklistSubmit(checklistId: string, vehicleCode: string, checklistData: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "checklist_submit",
      entityType: "checklist",
      entityId: checklistId,
      entityName: vehicleCode,
      newValue: checklistData,
      description: `Checklist submitted for vehicle ${vehicleCode}`,
    });
  },
  
  // GDPR actions
  async consentGranted(userId: string, consentType: string, policyVersion: string): Promise<void> {
    await createAuditEntry({
      action: "consent_granted",
      entityType: "consent",
      entityId: userId,
      metadata: { consentType, policyVersion },
      description: `Consent granted for ${consentType}`,
      isCompliance: true,
    });
  },
  
  async consentRevoked(userId: string, consentType: string): Promise<void> {
    await createAuditEntry({
      action: "consent_revoked",
      entityType: "consent",
      entityId: userId,
      metadata: { consentType },
      description: `Consent revoked for ${consentType}`,
      isCompliance: true,
    });
  },
  
  async dataExportRequested(userId: string, userName: string, requestId: string): Promise<void> {
    await createAuditEntry({
      action: "data_export_requested",
      entityType: "gdpr_export",
      entityId: requestId,
      entityName: userName,
      description: `Data export requested by user ${userName}`,
      isCompliance: true,
    });
  },
  
  async dataErasureRequested(userId: string, userName: string, requestId: string): Promise<void> {
    await createAuditEntry({
      action: "data_erasure_requested",
      entityType: "gdpr_erasure",
      entityId: requestId,
      entityName: userName,
      description: `Data erasure requested by user ${userName}`,
      isCompliance: true,
    });
  },
  
  // Generic CRUD
  async create(entityType: string, entityId: string, entityName: string, data: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "create",
      entityType,
      entityId,
      entityName,
      newValue: data,
      description: `Created ${entityType}: ${entityName}`,
    });
  },
  
  async read(entityType: string, entityId: string, entityName?: string, isSensitive = false): Promise<void> {
    await createAuditEntry({
      action: "read",
      entityType,
      entityId,
      entityName,
      description: `Read ${entityType}: ${entityId}`,
      isSensitive,
    });
  },
  
  async update(entityType: string, entityId: string, entityName: string, previousData: Record<string, unknown>, newData: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "update",
      entityType,
      entityId,
      entityName,
      previousValue: previousData,
      newValue: newData,
      description: `Updated ${entityType}: ${entityName}`,
    });
  },
  
  async delete(entityType: string, entityId: string, entityName: string, data: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "delete",
      entityType,
      entityId,
      entityName,
      previousValue: data,
      description: `Deleted ${entityType}: ${entityName}`,
    });
  },
  
  // Export action
  async export(entityType: string, format: string, recordCount: number, metadata?: Record<string, unknown>): Promise<void> {
    await createAuditEntry({
      action: "export",
      entityType,
      metadata: { format, recordCount, ...metadata },
      description: `Exported ${recordCount} ${entityType} records as ${format}`,
    });
  },
  
  // Chat message
  async chatMessage(messageId: string, vehicleCode: string | null): Promise<void> {
    await createAuditEntry({
      action: "chat_message",
      entityType: "chat",
      entityId: messageId,
      entityName: vehicleCode || undefined,
      description: vehicleCode ? `Chat message sent from ${vehicleCode}` : "Chat message sent",
    });
  },
};

// ============================================================================
// HASH CHAIN VERIFICATION
// ============================================================================

// Verify integrity of audit log hash chain
export async function verifyHashChain(
  startDate?: Date,
  endDate?: Date
): Promise<{ isValid: boolean; entriesChecked: number; issues: string[] }> {
  const conditions = [];
  if (startDate) {
    conditions.push(gte(auditLogEntries.occurredAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(auditLogEntries.occurredAt, endDate));
  }
  
  const entries = await db
    .select()
    .from(auditLogEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(auditLogEntries.occurredAt);
  
  const issues: string[] = [];
  let previousHash: string | null = null;
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Verify chain link
    if (i > 0 && entry.previousHash !== previousHash) {
      issues.push(`Chain break at entry ${entry.id}: expected previousHash ${previousHash}, got ${entry.previousHash}`);
    }
    
    // Verify entry hash
    const calculatedHash = generateEntryHash({
      occurredAt: entry.occurredAt,
      actorType: entry.actorType,
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue as Record<string, unknown>,
      newValue: entry.newValue as Record<string, unknown>,
      description: entry.description,
      previousHash: entry.previousHash,
      entryHash: "",
      isSensitive: entry.isSensitive,
      isCompliance: entry.isCompliance,
      retentionYears: entry.retentionYears,
    } as Omit<InsertAuditLogEntry, "id" | "entryHash" | "createdAt">);
    
    if (calculatedHash !== entry.entryHash) {
      issues.push(`Hash mismatch at entry ${entry.id}: stored hash doesn't match calculated hash - possible tampering detected`);
    }
    
    previousHash = entry.entryHash;
  }
  
  return {
    isValid: issues.length === 0,
    entriesChecked: entries.length,
    issues,
  };
}

// Repair hash chain by recalculating all hashes with canonical serialization
export async function repairHashChain(): Promise<{ repairedCount: number; error?: string }> {
  try {
    const entries = await db
      .select()
      .from(auditLogEntries)
      .orderBy(auditLogEntries.occurredAt);
    
    let previousHash: string | null = null;
    let repairedCount = 0;
    
    for (const entry of entries) {
      const newEntryHash = generateEntryHash({
        occurredAt: entry.occurredAt,
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: entry.previousValue as Record<string, unknown>,
        newValue: entry.newValue as Record<string, unknown>,
        description: entry.description,
        previousHash: previousHash,
        entryHash: "",
        isSensitive: entry.isSensitive,
        isCompliance: entry.isCompliance,
        retentionYears: entry.retentionYears,
      } as Omit<InsertAuditLogEntry, "id" | "entryHash" | "createdAt">);
      
      // Update if hash or previousHash changed
      if (entry.entryHash !== newEntryHash || entry.previousHash !== previousHash) {
        await db.update(auditLogEntries)
          .set({ 
            entryHash: newEntryHash,
            previousHash: previousHash,
          })
          .where(eq(auditLogEntries.id, entry.id));
        repairedCount++;
      }
      
      previousHash = newEntryHash;
    }
    
    return { repairedCount };
  } catch (error) {
    console.error("[AUDIT] Failed to repair hash chain:", error);
    return { repairedCount: 0, error: String(error) };
  }
}

// Create verification record
export async function createVerificationRecord(
  startEntryId: string,
  endEntryId: string,
  entriesCount: number,
  isValid: boolean,
  rootHash: string,
  issues: string[],
  verifiedBy?: string
): Promise<void> {
  await db.insert(auditHashChainVerifications).values({
    startEntryId,
    endEntryId,
    entriesCount,
    isValid,
    rootHash,
    verifiedAt: new Date(),
    verifiedBy,
    verificationMethod: "sha256_chain",
    issues: issues.length > 0 ? issues : null,
  });
}

// ============================================================================
// AUDIT LOG QUERIES
// ============================================================================

// Get audit log entries with filtering
export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  isSensitive?: boolean;
  isCompliance?: boolean;
}): Promise<{ entries: typeof auditLogEntries.$inferSelect[]; total: number }> {
  const {
    page = 1,
    limit = 50,
    actorId,
    entityType,
    entityId,
    action,
    startDate,
    endDate,
    isSensitive,
    isCompliance,
  } = options;
  
  const conditions = [];
  
  if (actorId) conditions.push(eq(auditLogEntries.actorId, actorId));
  if (entityType) conditions.push(eq(auditLogEntries.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogEntries.entityId, entityId));
  if (action) conditions.push(sql`${auditLogEntries.action}::text = ${action}`);
  if (startDate) conditions.push(gte(auditLogEntries.occurredAt, startDate));
  if (endDate) conditions.push(lte(auditLogEntries.occurredAt, endDate));
  if (isSensitive !== undefined) conditions.push(eq(auditLogEntries.isSensitive, isSensitive));
  if (isCompliance !== undefined) conditions.push(eq(auditLogEntries.isCompliance, isCompliance));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(auditLogEntries)
      .where(whereClause)
      .orderBy(desc(auditLogEntries.occurredAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogEntries)
      .where(whereClause),
  ]);
  
  return {
    entries,
    total: Number(countResult[0]?.count || 0),
  };
}

// Get audit statistics
export async function getAuditStats(): Promise<{
  totalEntries: number;
  todayEntries: number;
  sensitiveEntries: number;
  complianceEntries: number;
  lastVerification: Date | null;
  chainIntegrity: boolean;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [totalResult, todayResult, sensitiveResult, complianceResult, lastVerification] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(auditLogEntries),
    db.select({ count: sql<number>`count(*)` }).from(auditLogEntries).where(gte(auditLogEntries.occurredAt, today)),
    db.select({ count: sql<number>`count(*)` }).from(auditLogEntries).where(eq(auditLogEntries.isSensitive, true)),
    db.select({ count: sql<number>`count(*)` }).from(auditLogEntries).where(eq(auditLogEntries.isCompliance, true)),
    db.select().from(auditHashChainVerifications).orderBy(desc(auditHashChainVerifications.verifiedAt)).limit(1),
  ]);
  
  return {
    totalEntries: Number(totalResult[0]?.count || 0),
    todayEntries: Number(todayResult[0]?.count || 0),
    sensitiveEntries: Number(sensitiveResult[0]?.count || 0),
    complianceEntries: Number(complianceResult[0]?.count || 0),
    lastVerification: lastVerification.length > 0 ? lastVerification[0].verifiedAt : null,
    chainIntegrity: lastVerification.length > 0 ? lastVerification[0].isValid : true,
  };
}
