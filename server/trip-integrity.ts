import crypto from "crypto";
import { db } from "./db";
import { trips, auditLogEntries } from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { createAuditEntry, getRequestContext } from "./audit";

// ============================================================================
// TRIP INTEGRITY SIGNING SYSTEM
// Implements HMAC-SHA256 cryptographic signing for tamper-evident service records
// Compliant with ISO 27001 requirements
// ============================================================================

const ALGORITHM = "HMAC-SHA256";

// Get the integrity secret from environment
function getIntegritySecret(): string {
  const secret = process.env.TRIP_INTEGRITY_SECRET;
  if (!secret) {
    throw new Error("TRIP_INTEGRITY_SECRET environment variable is required for trip integrity signing");
  }
  return secret;
}

// Fields to include in the canonical payload (fixed order, deterministic)
// ALL mutable trip fields must be included for tamper-evidence
const SIGNED_FIELDS = [
  "id",
  "progressiveNumber",
  "vehicleId",
  "userId",
  "serviceDate",
  "departureTime",
  "returnTime",
  "patientBirthYear",
  "patientGender",
  "originType",
  "originStructureId",
  "originDepartmentId",
  "originAddress",
  "destinationType",
  "destinationStructureId",
  "destinationDepartmentId",
  "destinationAddress",
  "kmInitial",
  "kmFinal",
  "kmTraveled",
  "durationMinutes",
  "serviceType",
  "crewType",
  "isReturnTrip",
  "notes",
  "createdAt",
] as const;

// Type for trip data needed for signing - includes ALL signed fields
export interface TripForSigning {
  id: string;
  progressiveNumber: string;
  vehicleId: string;
  userId: string;
  serviceDate: string;
  departureTime: string | null;
  returnTime: string | null;
  patientBirthYear: number | null;
  patientGender: string | null;
  originType: string;
  originStructureId: string | null;
  originDepartmentId: string | null;
  originAddress: string | null;
  destinationType: string;
  destinationStructureId: string | null;
  destinationDepartmentId: string | null;
  destinationAddress: string | null;
  kmInitial: number;
  kmFinal: number;
  kmTraveled: number;
  durationMinutes: number | null;
  serviceType: string | null;
  crewType: string | null;
  isReturnTrip: boolean;
  notes: string | null;
  createdAt: Date;
}

/**
 * Canonicalize a trip into a deterministic JSON string for signing.
 * The order of fields is fixed and consistent across all trips.
 */
export function canonicalizeTrip(trip: TripForSigning): string {
  const payload: Record<string, unknown> = {};
  
  for (const field of SIGNED_FIELDS) {
    let value = trip[field as keyof TripForSigning];
    
    // Convert Date to ISO string for consistency
    if (value instanceof Date) {
      value = value.toISOString();
    }
    
    // Convert undefined to null for consistency
    if (value === undefined) {
      value = null;
    }
    
    payload[field] = value;
  }
  
  return JSON.stringify(payload);
}

/**
 * Compute HMAC-SHA256 hash of a canonical trip payload
 */
export function computeTripHash(canonicalPayload: string): string {
  const secret = getIntegritySecret();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(canonicalPayload, "utf8");
  return hmac.digest("hex");
}

/**
 * Sign a trip and update the database with integrity fields.
 * Called when a trip is closed (has returnTime set).
 */
export async function signTrip(tripId: string): Promise<{
  success: boolean;
  hash?: string;
  signedAt?: Date;
  error?: string;
}> {
  try {
    // Fetch the trip
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
    
    if (!trip) {
      return { success: false, error: "Trip not found" };
    }
    
    // Check if already signed
    if (trip.integrityHash && trip.integrityStatus === "VALID") {
      return { 
        success: true, 
        hash: trip.integrityHash, 
        signedAt: trip.integritySignedAt || undefined 
      };
    }
    
    // Build trip data for signing - includes ALL signed fields
    const tripForSigning: TripForSigning = {
      id: trip.id,
      progressiveNumber: trip.progressiveNumber,
      vehicleId: trip.vehicleId,
      userId: trip.userId,
      serviceDate: trip.serviceDate,
      departureTime: trip.departureTime,
      returnTime: trip.returnTime,
      patientBirthYear: trip.patientBirthYear,
      patientGender: trip.patientGender,
      originType: trip.originType,
      originStructureId: trip.originStructureId,
      originDepartmentId: trip.originDepartmentId,
      originAddress: trip.originAddress,
      destinationType: trip.destinationType,
      destinationStructureId: trip.destinationStructureId,
      destinationDepartmentId: trip.destinationDepartmentId,
      destinationAddress: trip.destinationAddress,
      kmInitial: trip.kmInitial,
      kmFinal: trip.kmFinal,
      kmTraveled: trip.kmTraveled,
      durationMinutes: trip.durationMinutes,
      serviceType: trip.serviceType,
      crewType: trip.crewType,
      isReturnTrip: trip.isReturnTrip,
      notes: trip.notes,
      createdAt: trip.createdAt,
    };
    
    // Compute the hash
    const canonicalPayload = canonicalizeTrip(tripForSigning);
    const hash = computeTripHash(canonicalPayload);
    const signedAt = new Date();
    
    // Update the trip with integrity fields
    await db.update(trips)
      .set({
        integrityHash: hash,
        integritySignedAt: signedAt,
        integrityAlgorithm: ALGORITHM,
        integrityStatus: "VALID",
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));
    
    // Log to audit trail
    const context = getRequestContext();
    await createAuditEntry({
      action: "create",
      entityType: "trip_integrity",
      entityId: tripId,
      entityName: trip.progressiveNumber,
      newValue: {
        integrityHash: hash.substring(0, 16) + "...", // Truncated for security
        integrityAlgorithm: ALGORITHM,
        integrityStatus: "VALID",
      },
      description: `Cryptographic signature generated for trip ${trip.progressiveNumber}`,
      metadata: {
        vehicleId: trip.vehicleId,
        serviceDate: trip.serviceDate,
      },
      isCompliance: true,
    });
    
    return { success: true, hash, signedAt };
  } catch (error) {
    console.error("Error signing trip:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Verify the integrity of a trip.
 * Returns the current status and details.
 */
export async function verifyTripIntegrity(tripId: string): Promise<{
  status: "VALID" | "BROKEN" | "NOT_SIGNED";
  signedAt?: string;
  algorithm?: string;
  reason?: string;
  lastModifiedAt?: string;
}> {
  try {
    // Fetch the trip
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
    
    if (!trip) {
      return { status: "NOT_SIGNED", reason: "Trip not found" };
    }
    
    // Check if not signed
    if (!trip.integrityHash || trip.integrityStatus === "NOT_SIGNED") {
      return { status: "NOT_SIGNED", reason: "Trip has not been signed" };
    }
    
    // Build trip data for verification - includes ALL signed fields
    const tripForSigning: TripForSigning = {
      id: trip.id,
      progressiveNumber: trip.progressiveNumber,
      vehicleId: trip.vehicleId,
      userId: trip.userId,
      serviceDate: trip.serviceDate,
      departureTime: trip.departureTime,
      returnTime: trip.returnTime,
      patientBirthYear: trip.patientBirthYear,
      patientGender: trip.patientGender,
      originType: trip.originType,
      originStructureId: trip.originStructureId,
      originDepartmentId: trip.originDepartmentId,
      originAddress: trip.originAddress,
      destinationType: trip.destinationType,
      destinationStructureId: trip.destinationStructureId,
      destinationDepartmentId: trip.destinationDepartmentId,
      destinationAddress: trip.destinationAddress,
      kmInitial: trip.kmInitial,
      kmFinal: trip.kmFinal,
      kmTraveled: trip.kmTraveled,
      durationMinutes: trip.durationMinutes,
      serviceType: trip.serviceType,
      crewType: trip.crewType,
      isReturnTrip: trip.isReturnTrip,
      notes: trip.notes,
      createdAt: trip.createdAt,
    };
    
    // Compute current hash
    const canonicalPayload = canonicalizeTrip(tripForSigning);
    const currentHash = computeTripHash(canonicalPayload);
    
    // Compare hashes
    if (currentHash === trip.integrityHash) {
      // Log verification
      await createAuditEntry({
        action: "read",
        entityType: "trip_integrity_verification",
        entityId: tripId,
        entityName: trip.progressiveNumber,
        description: `Integrity verification performed for trip ${trip.progressiveNumber} - VALID`,
        isCompliance: true,
      });
      
      return {
        status: "VALID",
        signedAt: trip.integritySignedAt?.toISOString(),
        algorithm: trip.integrityAlgorithm || ALGORITHM,
      };
    } else {
      // Hash mismatch - integrity broken
      // Log the breach
      await createAuditEntry({
        action: "update",
        entityType: "trip_integrity_verification",
        entityId: tripId,
        entityName: trip.progressiveNumber,
        description: `Integrity verification performed for trip ${trip.progressiveNumber} - BROKEN (hash mismatch)`,
        metadata: {
          storedHash: trip.integrityHash?.substring(0, 16) + "...",
          computedHash: currentHash.substring(0, 16) + "...",
        },
        isCompliance: true,
        isSensitive: true,
      });
      
      return {
        status: "BROKEN",
        signedAt: trip.integritySignedAt?.toISOString(),
        algorithm: trip.integrityAlgorithm || ALGORITHM,
        reason: "Hash mismatch - data modified after signing",
        lastModifiedAt: trip.updatedAt.toISOString(),
      };
    }
  } catch (error) {
    console.error("Error verifying trip integrity:", error);
    return { status: "NOT_SIGNED", reason: String(error) };
  }
}

/**
 * Detect if a trip has been modified and update integrity status.
 * Called before any trip update.
 * SECURITY: Any modification to a signed trip invalidates the signature.
 * This is the safest approach to ensure tamper-evidence.
 */
export async function checkAndInvalidateIntegrity(tripId: string, modifiedFields: string[]): Promise<void> {
  try {
    // Fetch the trip
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
    
    if (!trip || !trip.integrityHash || trip.integrityStatus !== "VALID") {
      return; // Nothing to invalidate
    }
    
    // SECURITY: Any modification to a signed trip invalidates the signature
    // This is more conservative but guarantees tamper-evidence
    if (modifiedFields.length === 0) {
      return; // No fields being modified
    }
    
    // Identify which signed fields are being modified (for logging)
    const signedFieldsSet = new Set(SIGNED_FIELDS);
    const modifiedSignedFields = modifiedFields.filter(f => signedFieldsSet.has(f as typeof SIGNED_FIELDS[number]));
    
    // Invalidate the integrity for ANY modification (conservative approach)
    await db.update(trips)
      .set({
        integrityStatus: "BROKEN",
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));
    
    // Log to audit trail
    const context = getRequestContext();
    await createAuditEntry({
      action: "update",
      entityType: "trip_integrity",
      entityId: tripId,
      entityName: trip.progressiveNumber,
      previousValue: {
        integrityStatus: "VALID",
      },
      newValue: {
        integrityStatus: "BROKEN",
        modifiedFields: modifiedFields,
        signedFieldsModified: modifiedSignedFields,
      },
      description: `Trip integrity compromised: fields [${modifiedFields.join(", ")}] modified after signing`,
      metadata: {
        vehicleId: trip.vehicleId,
        serviceDate: trip.serviceDate,
        originalSignedAt: trip.integritySignedAt?.toISOString(),
      },
      isCompliance: true,
      isSensitive: true,
    });
    
    console.log(`Trip ${tripId} integrity invalidated. Modified fields: ${modifiedFields.join(", ")}`);
  } catch (error) {
    console.error("Error checking/invalidating trip integrity:", error);
  }
}

/**
 * Get integrity statistics for the compliance dashboard
 */
export async function getIntegrityStats(): Promise<{
  totalTrips: number;
  signedTrips: number;
  validTrips: number;
  brokenTrips: number;
  unsignedTrips: number;
}> {
  try {
    const allTrips = await db.select().from(trips);
    
    const stats = {
      totalTrips: allTrips.length,
      signedTrips: 0,
      validTrips: 0,
      brokenTrips: 0,
      unsignedTrips: 0,
    };
    
    for (const trip of allTrips) {
      if (trip.integrityStatus === "VALID") {
        stats.validTrips++;
        stats.signedTrips++;
      } else if (trip.integrityStatus === "BROKEN") {
        stats.brokenTrips++;
        stats.signedTrips++;
      } else {
        stats.unsignedTrips++;
      }
    }
    
    return stats;
  } catch (error) {
    console.error("Error getting integrity stats:", error);
    return {
      totalTrips: 0,
      signedTrips: 0,
      validTrips: 0,
      brokenTrips: 0,
      unsignedTrips: 0,
    };
  }
}

/**
 * Bulk sign all unsigned trips for a given organization.
 * Signs trips in batches for efficiency.
 */
export async function bulkSignTrips(organizationId: string): Promise<{
  signed: number;
  skipped: number;
  errors: number;
  total: number;
}> {
  const result = { signed: 0, skipped: 0, errors: 0, total: 0 };
  
  try {
    const secret = getIntegritySecret();
    
    const unsignedTrips = await db.select().from(trips)
      .where(
        sql`${trips.organizationId} = ${organizationId} AND (${trips.integrityStatus} = 'NOT_SIGNED' OR ${trips.integrityStatus} IS NULL OR ${trips.integrityStatus} = 'BROKEN')`
      );
    
    result.total = unsignedTrips.length;
    console.log(`[BULK SIGN] Found ${unsignedTrips.length} unsigned/broken trips for org ${organizationId}`);
    
    if (unsignedTrips.length === 0) {
      return result;
    }
    
    const batchSize = 100;
    for (let i = 0; i < unsignedTrips.length; i += batchSize) {
      const batch = unsignedTrips.slice(i, i + batchSize);
      
      for (const trip of batch) {
        try {
          const tripForSigning: TripForSigning = {
            id: trip.id,
            progressiveNumber: trip.progressiveNumber,
            vehicleId: trip.vehicleId,
            userId: trip.userId,
            serviceDate: trip.serviceDate,
            departureTime: trip.departureTime,
            returnTime: trip.returnTime,
            patientBirthYear: trip.patientBirthYear,
            patientGender: trip.patientGender,
            originType: trip.originType,
            originStructureId: trip.originStructureId,
            originDepartmentId: trip.originDepartmentId,
            originAddress: trip.originAddress,
            destinationType: trip.destinationType,
            destinationStructureId: trip.destinationStructureId,
            destinationDepartmentId: trip.destinationDepartmentId,
            destinationAddress: trip.destinationAddress,
            kmInitial: trip.kmInitial,
            kmFinal: trip.kmFinal,
            kmTraveled: trip.kmTraveled,
            durationMinutes: trip.durationMinutes,
            serviceType: trip.serviceType,
            crewType: trip.crewType,
            isReturnTrip: trip.isReturnTrip,
            notes: trip.notes,
            createdAt: trip.createdAt,
          };
          
          const canonicalPayload = canonicalizeTrip(tripForSigning);
          const hmac = crypto.createHmac("sha256", secret);
          hmac.update(canonicalPayload, "utf8");
          const hash = hmac.digest("hex");
          const signedAt = new Date();
          
          await db.update(trips)
            .set({
              integrityHash: hash,
              integritySignedAt: signedAt,
              integrityAlgorithm: ALGORITHM,
              integrityStatus: "VALID",
            })
            .where(eq(trips.id, trip.id));
          
          result.signed++;
        } catch (err) {
          result.errors++;
        }
      }
      
      console.log(`[BULK SIGN] Progress: ${Math.min(i + batchSize, unsignedTrips.length)}/${unsignedTrips.length}`);
    }
    
    console.log(`[BULK SIGN] Completed: ${result.signed} signed, ${result.skipped} skipped, ${result.errors} errors`);
    return result;
  } catch (error) {
    console.error("[BULK SIGN] Error:", error);
    return result;
  }
}
