import { db } from "./db";
import {
  privacyPolicies,
  userConsents,
  gdprDataExports,
  gdprErasureRequests,
  users,
  trips,
  vehicleChecklists,
  chatMessages,
  type InsertPrivacyPolicy,
  type InsertUserConsent,
  type InsertGdprDataExport,
  type InsertGdprErasureRequest,
} from "../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { auditLog } from "./audit";
import crypto from "crypto";

// ============================================================================
// ENTERPRISE GDPR COMPLIANCE SYSTEM
// Compliant with GDPR Articles 12-23 (Rights of the Data Subject)
// ============================================================================

// ============================================================================
// PRIVACY POLICY MANAGEMENT
// ============================================================================

// Get current active privacy policy
export async function getCurrentPrivacyPolicy(): Promise<typeof privacyPolicies.$inferSelect | null> {
  const policies = await db
    .select()
    .from(privacyPolicies)
    .where(and(
      eq(privacyPolicies.isActive, true),
      sql`${privacyPolicies.effectiveAt} <= NOW()`
    ))
    .orderBy(desc(privacyPolicies.effectiveAt))
    .limit(1);
  
  return policies.length > 0 ? policies[0] : null;
}

// Get all privacy policies (for admin)
export async function getAllPrivacyPolicies(): Promise<typeof privacyPolicies.$inferSelect[]> {
  return await db
    .select()
    .from(privacyPolicies)
    .orderBy(desc(privacyPolicies.effectiveAt));
}

// Create a new privacy policy version
export async function createPrivacyPolicy(policy: Omit<InsertPrivacyPolicy, "contentHash">): Promise<typeof privacyPolicies.$inferSelect> {
  const contentHash = crypto.createHash("sha256").update(policy.content).digest("hex");
  
  const [created] = await db
    .insert(privacyPolicies)
    .values({
      ...policy,
      contentHash,
    })
    .returning();
  
  return created;
}

// ============================================================================
// USER CONSENT MANAGEMENT
// ============================================================================

// Get user's current consents
export async function getUserConsents(userId: string): Promise<typeof userConsents.$inferSelect[]> {
  return await db
    .select()
    .from(userConsents)
    .where(eq(userConsents.userId, userId))
    .orderBy(desc(userConsents.updatedAt));
}

// Check if user has granted a specific consent
export async function hasUserConsent(
  userId: string,
  consentType: "privacy_policy" | "terms_of_service" | "data_processing" | "marketing_communications" | "analytics_tracking" | "location_tracking"
): Promise<boolean> {
  const consents = await db
    .select()
    .from(userConsents)
    .where(and(
      eq(userConsents.userId, userId),
      eq(userConsents.consentType, consentType),
      eq(userConsents.status, "granted")
    ))
    .limit(1);
  
  return consents.length > 0;
}

// Check if user needs to accept new privacy policy
export async function needsPolicyAcceptance(userId: string): Promise<{
  needsAcceptance: boolean;
  currentPolicy: typeof privacyPolicies.$inferSelect | null;
  userConsent: typeof userConsents.$inferSelect | null;
}> {
  const currentPolicy = await getCurrentPrivacyPolicy();
  if (!currentPolicy) {
    return { needsAcceptance: false, currentPolicy: null, userConsent: null };
  }
  
  const userConsent = await db
    .select()
    .from(userConsents)
    .where(and(
      eq(userConsents.userId, userId),
      eq(userConsents.consentType, "privacy_policy"),
      eq(userConsents.policyVersion, currentPolicy.version),
      eq(userConsents.status, "granted")
    ))
    .limit(1);
  
  return {
    needsAcceptance: userConsent.length === 0 && currentPolicy.isRequired,
    currentPolicy,
    userConsent: userConsent.length > 0 ? userConsent[0] : null,
  };
}

// Grant consent
export async function grantConsent(
  userId: string,
  consentType: "privacy_policy" | "terms_of_service" | "data_processing" | "marketing_communications" | "analytics_tracking" | "location_tracking",
  options: {
    policyId?: string;
    policyVersion?: string;
    consentMethod: string;
    consentSource: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    consentText?: string;
  }
): Promise<typeof userConsents.$inferSelect> {
  const now = new Date();
  const consentChecksum = options.consentText 
    ? crypto.createHash("sha256").update(options.consentText).digest("hex")
    : undefined;
  
  // Check for existing consent of this type
  const existing = await db
    .select()
    .from(userConsents)
    .where(and(
      eq(userConsents.userId, userId),
      eq(userConsents.consentType, consentType)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing consent
    const [updated] = await db
      .update(userConsents)
      .set({
        status: "granted",
        policyId: options.policyId,
        policyVersion: options.policyVersion,
        grantedAt: now,
        revokedAt: null,
        consentMethod: options.consentMethod,
        consentSource: options.consentSource,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceId: options.deviceId,
        consentText: options.consentText,
        consentChecksum,
        updatedAt: now,
      })
      .where(eq(userConsents.id, existing[0].id))
      .returning();
    
    await auditLog.consentGranted(userId, consentType, options.policyVersion || "");
    return updated;
  }
  
  // Create new consent
  const [created] = await db
    .insert(userConsents)
    .values({
      userId,
      consentType,
      policyId: options.policyId,
      policyVersion: options.policyVersion,
      status: "granted",
      grantedAt: now,
      consentMethod: options.consentMethod,
      consentSource: options.consentSource,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      deviceId: options.deviceId,
      consentText: options.consentText,
      consentChecksum,
    })
    .returning();
  
  await auditLog.consentGranted(userId, consentType, options.policyVersion || "");
  return created;
}

// Revoke consent
export async function revokeConsent(
  userId: string,
  consentType: "privacy_policy" | "terms_of_service" | "data_processing" | "marketing_communications" | "analytics_tracking" | "location_tracking"
): Promise<boolean> {
  const now = new Date();
  
  const result = await db
    .update(userConsents)
    .set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(userConsents.userId, userId),
      eq(userConsents.consentType, consentType),
      eq(userConsents.status, "granted")
    ))
    .returning();
  
  if (result.length > 0) {
    await auditLog.consentRevoked(userId, consentType);
    return true;
  }
  
  return false;
}

// ============================================================================
// DATA EXPORT (Right to Access - Article 15)
// ============================================================================

// Request data export
export async function requestDataExport(
  userId: string,
  options: {
    requestMethod: string;
    requestIpAddress?: string;
    requestUserAgent?: string;
    exportFormat?: string;
    dataCategories?: string[];
  }
): Promise<typeof gdprDataExports.$inferSelect> {
  const now = new Date();
  const dueBy = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const [request] = await db
    .insert(gdprDataExports)
    .values({
      userId,
      requestType: "data_export",
      status: "pending",
      requestedAt: now,
      dueBy,
      requestMethod: options.requestMethod,
      requestIpAddress: options.requestIpAddress,
      requestUserAgent: options.requestUserAgent,
      exportFormat: options.exportFormat || "json",
      dataCategories: options.dataCategories || ["all"],
    })
    .returning();
  
  // Get user info for audit
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  await auditLog.dataExportRequested(userId, user?.name || userId, request.id);
  
  return request;
}

// Generate data export (background job would call this)
export async function generateDataExport(requestId: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const [request] = await db
    .select()
    .from(gdprDataExports)
    .where(eq(gdprDataExports.id, requestId));
  
  if (!request) {
    return { success: false, error: "Request not found" };
  }
  
  const userId = request.userId;
  
  try {
    // Update status to processing
    await db
      .update(gdprDataExports)
      .set({ status: "processing", acknowledgedAt: new Date() })
      .where(eq(gdprDataExports.id, requestId));
    
    // Collect all user data
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const userTrips = await db.select().from(trips).where(eq(trips.userId, userId));
    const userChecklists = await db.select().from(vehicleChecklists).where(eq(vehicleChecklists.submittedById, userId));
    const userMessages = await db.select().from(chatMessages).where(eq(chatMessages.senderId, userId));
    const consents = await getUserConsents(userId);
    
    const exportData = {
      exportInfo: {
        generatedAt: new Date().toISOString(),
        requestId,
        userId,
        format: "JSON (GDPR Article 15 compliant)",
      },
      personalData: {
        name: user?.name,
        email: user?.email,
        role: user?.role,
        locationId: user?.locationId,
        createdAt: user?.createdAt,
      },
      consents: consents.map(c => ({
        type: c.consentType,
        status: c.status,
        grantedAt: c.grantedAt,
        revokedAt: c.revokedAt,
      })),
      trips: userTrips.map(t => ({
        id: t.id,
        progressiveNumber: t.progressiveNumber,
        serviceDate: t.serviceDate,
        kmTraveled: t.kmTraveled,
        serviceType: t.serviceType,
        createdAt: t.createdAt,
      })),
      checklists: userChecklists.map(c => ({
        id: c.id,
        vehicleId: c.vehicleId,
        shiftDate: c.shiftDate,
        hasAnomalies: c.hasAnomalies,
        completedAt: c.completedAt,
      })),
      chatMessages: userMessages.map(m => ({
        id: m.id,
        message: m.message,
        createdAt: m.createdAt,
      })),
      dataProcessingInfo: {
        purposes: [
          "Transport service management",
          "Regulatory compliance (UTIF, ASL)",
          "Vehicle and fleet tracking",
          "Internal communication",
        ],
        legalBasis: "Legitimate interest and contractual necessity",
        retention: "Trip data: 10 years (regulatory requirement). Personal data: account lifetime + 5 years.",
        recipients: ["Internal staff only", "ASL inspectors (upon request)"],
      },
    };
    
    // Generate download token
    const downloadToken = crypto.randomBytes(32).toString("hex");
    const downloadExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Update request with export data
    await db
      .update(gdprDataExports)
      .set({
        status: "completed",
        completedAt: new Date(),
        exportGeneratedAt: new Date(),
        downloadToken,
        downloadTokenExpiresAt: downloadExpiry,
        updatedAt: new Date(),
      })
      .where(eq(gdprDataExports.id, requestId));
    
    return { success: true, data: exportData };
  } catch (error) {
    await db
      .update(gdprDataExports)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(gdprDataExports.id, requestId));
    
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Get user's data export requests
export async function getUserDataExports(userId: string): Promise<typeof gdprDataExports.$inferSelect[]> {
  return await db
    .select()
    .from(gdprDataExports)
    .where(eq(gdprDataExports.userId, userId))
    .orderBy(desc(gdprDataExports.requestedAt));
}

// Get all pending data export requests (for admin)
export async function getPendingDataExports(): Promise<typeof gdprDataExports.$inferSelect[]> {
  return await db
    .select()
    .from(gdprDataExports)
    .where(eq(gdprDataExports.status, "pending"))
    .orderBy(gdprDataExports.requestedAt);
}

// ============================================================================
// DATA ERASURE (Right to Erasure - Article 17)
// ============================================================================

// Request data erasure
export async function requestDataErasure(
  userId: string,
  options: {
    requestMethod: string;
    requestReason?: string;
    requestIpAddress?: string;
    erasureScope?: string;
  }
): Promise<typeof gdprErasureRequests.$inferSelect> {
  const now = new Date();
  const dueBy = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const [request] = await db
    .insert(gdprErasureRequests)
    .values({
      userId,
      status: "pending",
      erasureScope: options.erasureScope || "full",
      requestedAt: now,
      dueBy,
      requestMethod: options.requestMethod,
      requestReason: options.requestReason,
      requestIpAddress: options.requestIpAddress,
      useAnonymization: true, // Always anonymize instead of delete for audit integrity
      excludedCategories: ["audit_logs", "regulatory_data"], // Data we must retain
      retentionReasons: {
        audit_logs: "Required for regulatory compliance and security auditing (10 years)",
        regulatory_data: "Trip records required by ASL regulations (10 years)",
      },
    })
    .returning();
  
  // Get user info for audit
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  await auditLog.dataErasureRequested(userId, user?.name || userId, request.id);
  
  return request;
}

// Process data erasure (anonymization approach for audit trail integrity)
export async function processDataErasure(requestId: string, processedBy: string): Promise<{
  success: boolean;
  anonymizedRecords: number;
  retainedRecords: number;
  error?: string;
}> {
  const [request] = await db
    .select()
    .from(gdprErasureRequests)
    .where(eq(gdprErasureRequests.id, requestId));
  
  if (!request) {
    return { success: false, anonymizedRecords: 0, retainedRecords: 0, error: "Request not found" };
  }
  
  const userId = request.userId;
  
  try {
    // Update status to processing
    await db
      .update(gdprErasureRequests)
      .set({ status: "processing", scheduledAt: new Date() })
      .where(eq(gdprErasureRequests.id, requestId));
    
    // Generate anonymous ID for this user
    const anonymousId = `ANON_${crypto.randomBytes(8).toString("hex")}`;
    const anonymousEmail = `${anonymousId}@anonymized.local`;
    const anonymousName = "Utente Anonimizzato";
    
    // Store anonymization mapping (encrypted in real implementation)
    const anonymizationMap = {
      originalId: userId,
      anonymousId,
      anonymizedAt: new Date().toISOString(),
    };
    
    // Anonymize user record
    await db
      .update(users)
      .set({
        email: anonymousEmail,
        name: anonymousName,
        password: crypto.randomBytes(32).toString("hex"), // Invalidate login
        authToken: null,
      })
      .where(eq(users.id, userId));
    
    // Anonymize chat messages (keep for context but remove identifying info)
    await db
      .update(chatMessages)
      .set({
        senderName: anonymousName,
      })
      .where(eq(chatMessages.senderId, userId));
    
    // Anonymize checklists
    await db
      .update(vehicleChecklists)
      .set({
        submittedByName: anonymousName,
      })
      .where(eq(vehicleChecklists.submittedById, userId));
    
    // Revoke all consents
    await db
      .update(userConsents)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        notes: "Revoked due to erasure request",
      })
      .where(eq(userConsents.userId, userId));
    
    // Count records
    const tripCount = await db.select({ count: sql<number>`count(*)` }).from(trips).where(eq(trips.userId, userId));
    const retainedRecords = Number(tripCount[0]?.count || 0); // Trips retained for regulatory compliance
    
    // Update erasure request
    await db
      .update(gdprErasureRequests)
      .set({
        status: "completed",
        completedAt: new Date(),
        processedBy,
        anonymizationMap,
        erasureLog: {
          userAnonymized: true,
          messagesAnonymized: true,
          checklistsAnonymized: true,
          consentsRevoked: true,
          tripsRetained: retainedRecords,
          retentionReason: "ASL regulatory requirement - 10 year retention",
        },
        confirmationSentAt: new Date(),
        confirmationMethod: "system",
        updatedAt: new Date(),
      })
      .where(eq(gdprErasureRequests.id, requestId));
    
    return {
      success: true,
      anonymizedRecords: 3, // user, messages, checklists
      retainedRecords,
    };
  } catch (error) {
    await db
      .update(gdprErasureRequests)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(gdprErasureRequests.id, requestId));
    
    return {
      success: false,
      anonymizedRecords: 0,
      retainedRecords: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get user's erasure requests
export async function getUserErasureRequests(userId: string): Promise<typeof gdprErasureRequests.$inferSelect[]> {
  return await db
    .select()
    .from(gdprErasureRequests)
    .where(eq(gdprErasureRequests.userId, userId))
    .orderBy(desc(gdprErasureRequests.requestedAt));
}

// Get all pending erasure requests (for admin)
export async function getPendingErasureRequests(): Promise<typeof gdprErasureRequests.$inferSelect[]> {
  return await db
    .select()
    .from(gdprErasureRequests)
    .where(eq(gdprErasureRequests.status, "pending"))
    .orderBy(gdprErasureRequests.requestedAt);
}

// ============================================================================
// GDPR STATISTICS (for admin dashboard)
// ============================================================================

export async function getGdprStats(): Promise<{
  totalConsents: number;
  activeConsents: number;
  revokedConsents: number;
  pendingExportRequests: number;
  pendingErasureRequests: number;
  completedExports: number;
  completedErasures: number;
  usersWithoutConsent: number;
}> {
  const [
    totalConsents,
    activeConsents,
    revokedConsents,
    pendingExports,
    pendingErasures,
    completedExports,
    completedErasures,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(userConsents),
    db.select({ count: sql<number>`count(*)` }).from(userConsents).where(eq(userConsents.status, "granted")),
    db.select({ count: sql<number>`count(*)` }).from(userConsents).where(eq(userConsents.status, "revoked")),
    db.select({ count: sql<number>`count(*)` }).from(gdprDataExports).where(eq(gdprDataExports.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(gdprErasureRequests).where(eq(gdprErasureRequests.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(gdprDataExports).where(eq(gdprDataExports.status, "completed")),
    db.select({ count: sql<number>`count(*)` }).from(gdprErasureRequests).where(eq(gdprErasureRequests.status, "completed")),
  ]);
  
  // Get users without privacy policy consent
  const currentPolicy = await getCurrentPrivacyPolicy();
  let usersWithoutConsent = 0;
  
  if (currentPolicy) {
    const allUsers = await db.select({ id: users.id }).from(users);
    const usersWithConsent = await db
      .select({ userId: userConsents.userId })
      .from(userConsents)
      .where(and(
        eq(userConsents.consentType, "privacy_policy"),
        eq(userConsents.policyVersion, currentPolicy.version),
        eq(userConsents.status, "granted")
      ));
    
    const consentedUserIds = new Set(usersWithConsent.map(u => u.userId));
    usersWithoutConsent = allUsers.filter(u => !consentedUserIds.has(u.id)).length;
  }
  
  return {
    totalConsents: Number(totalConsents[0]?.count || 0),
    activeConsents: Number(activeConsents[0]?.count || 0),
    revokedConsents: Number(revokedConsents[0]?.count || 0),
    pendingExportRequests: Number(pendingExports[0]?.count || 0),
    pendingErasureRequests: Number(pendingErasures[0]?.count || 0),
    completedExports: Number(completedExports[0]?.count || 0),
    completedErasures: Number(completedErasures[0]?.count || 0),
    usersWithoutConsent,
  };
}

// ============================================================================
// ERASURE BY PERSON NAME (for vehicle-based accounts)
// When accounts are shared (e.g., one account per ambulance), personal data
// is identified by name in checklist submissions, not by userId.
// ============================================================================

// Request data erasure by person name
export async function requestDataErasureByName(
  userId: string, // The vehicle account making the request
  requesterFullName: string, // The actual person's name (Nome Cognome)
  options: {
    requestMethod: string;
    requestReason?: string;
    requestIpAddress?: string;
  }
): Promise<typeof gdprErasureRequests.$inferSelect> {
  const now = new Date();
  const dueBy = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const [request] = await db
    .insert(gdprErasureRequests)
    .values({
      userId,
      requesterFullName: requesterFullName.trim(),
      status: "pending",
      erasureScope: "personal_name", // Scope is name-based, not account-based
      requestedAt: now,
      dueBy,
      requestMethod: options.requestMethod,
      requestReason: options.requestReason,
      requestIpAddress: options.requestIpAddress,
      useAnonymization: true,
      dataCategoriesToErase: ["checklist_names"],
      excludedCategories: ["audit_logs", "regulatory_data"],
      retentionReasons: {
        audit_logs: "Required for regulatory compliance (10 years)",
        regulatory_data: "Trip records required by ASL regulations",
      },
    })
    .returning();
  
  await auditLog.dataErasureRequested(userId, requesterFullName, request.id);
  
  return request;
}

// Search for records containing a person's name
export async function findRecordsByPersonName(fullName: string): Promise<{
  checklistCount: number;
  chatMessageCount: number;
}> {
  const searchName = fullName.trim().toLowerCase();
  
  // Search in checklists (submittedByName field)
  const checklists = await db
    .select()
    .from(vehicleChecklists)
    .where(sql`LOWER(${vehicleChecklists.submittedByName}) LIKE ${`%${searchName}%`}`);
  
  // Search in chat messages (senderName field)
  const messages = await db
    .select()
    .from(chatMessages)
    .where(sql`LOWER(${chatMessages.senderName}) LIKE ${`%${searchName}%`}`);
  
  return {
    checklistCount: checklists.length,
    chatMessageCount: messages.length,
  };
}

// Process erasure by person name (anonymize matching records)
export async function processErasureByName(requestId: string, processedBy: string): Promise<{
  success: boolean;
  anonymizedChecklists: number;
  anonymizedMessages: number;
  error?: string;
}> {
  const [request] = await db
    .select()
    .from(gdprErasureRequests)
    .where(eq(gdprErasureRequests.id, requestId));
  
  if (!request) {
    return { success: false, anonymizedChecklists: 0, anonymizedMessages: 0, error: "Richiesta non trovata" };
  }
  
  if (!request.requesterFullName) {
    return { success: false, anonymizedChecklists: 0, anonymizedMessages: 0, error: "Nome richiedente non specificato" };
  }
  
  const searchName = request.requesterFullName.trim().toLowerCase();
  const anonymizedName = "GDPR-ANONIMO";
  
  try {
    // Update status to processing
    await db
      .update(gdprErasureRequests)
      .set({ status: "processing", scheduledAt: new Date() })
      .where(eq(gdprErasureRequests.id, requestId));
    
    // Find and anonymize checklists with matching name
    const checklistsToAnonymize = await db
      .select({ id: vehicleChecklists.id, submittedByName: vehicleChecklists.submittedByName })
      .from(vehicleChecklists)
      .where(sql`LOWER(${vehicleChecklists.submittedByName}) LIKE ${`%${searchName}%`}`);
    
    for (const checklist of checklistsToAnonymize) {
      await db
        .update(vehicleChecklists)
        .set({ submittedByName: anonymizedName })
        .where(eq(vehicleChecklists.id, checklist.id));
    }
    
    // Find and anonymize chat messages with matching name
    const messagesToAnonymize = await db
      .select({ id: chatMessages.id, senderName: chatMessages.senderName })
      .from(chatMessages)
      .where(sql`LOWER(${chatMessages.senderName}) LIKE ${`%${searchName}%`}`);
    
    for (const message of messagesToAnonymize) {
      await db
        .update(chatMessages)
        .set({ senderName: anonymizedName })
        .where(eq(chatMessages.id, message.id));
    }
    
    // Build erasure log
    const erasureLog = {
      searchedName: request.requesterFullName,
      checklistsAnonymized: checklistsToAnonymize.map(c => ({
        id: c.id,
        originalName: c.submittedByName,
      })),
      messagesAnonymized: messagesToAnonymize.map(m => ({
        id: m.id,
        originalName: m.senderName,
      })),
      anonymizedTo: anonymizedName,
      processedAt: new Date().toISOString(),
    };
    
    // Update erasure request
    await db
      .update(gdprErasureRequests)
      .set({
        status: "completed",
        completedAt: new Date(),
        processedBy,
        erasureLog,
        confirmationSentAt: new Date(),
        confirmationMethod: "system",
        updatedAt: new Date(),
      })
      .where(eq(gdprErasureRequests.id, requestId));
    
    return {
      success: true,
      anonymizedChecklists: checklistsToAnonymize.length,
      anonymizedMessages: messagesToAnonymize.length,
    };
  } catch (error) {
    await db
      .update(gdprErasureRequests)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Errore sconosciuto",
        updatedAt: new Date(),
      })
      .where(eq(gdprErasureRequests.id, requestId));
    
    return {
      success: false,
      anonymizedChecklists: 0,
      anonymizedMessages: 0,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}
