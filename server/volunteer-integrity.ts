import crypto from "crypto";
import { db } from "./db";
import { volunteerRegistry } from "../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { createAuditEntry } from "./audit";

// ============================================================================
// VOLUNTEER REGISTRY INTEGRITY SIGNING SYSTEM
// Implements HMAC-SHA256 cryptographic signing for volunteer registry entries
// Art. 17 CTS - D.M. 6 ottobre 2021 compliance
// Ensures: integrity, authenticity, immutability, date certainty
// ============================================================================

const ALGORITHM = "HMAC-SHA256";

function getIntegritySecret(): string {
  const secret = process.env.TRIP_INTEGRITY_SECRET;
  if (!secret) {
    throw new Error("TRIP_INTEGRITY_SECRET environment variable is required for volunteer registry integrity signing");
  }
  return secret;
}

const SIGNED_FIELDS = [
  "id",
  "organizationId",
  "progressiveNumber",
  "firstName",
  "lastName",
  "fiscalCode",
  "birthDate",
  "birthPlace",
  "gender",
  "residenceAddress",
  "residenceCity",
  "residenceProvince",
  "residencePostalCode",
  "phone",
  "email",
  "volunteerType",
  "status",
  "startDate",
  "startSignatureConfirmed",
  "endDate",
  "endSignatureConfirmed",
  "endReason",
  "role",
  "createdAt",
] as const;

export interface VolunteerForSigning {
  id: string;
  organizationId: string;
  progressiveNumber: number;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  gender: string | null;
  residenceAddress: string | null;
  residenceCity: string | null;
  residenceProvince: string | null;
  residencePostalCode: string | null;
  phone: string | null;
  email: string | null;
  volunteerType: string;
  status: string;
  startDate: string;
  startSignatureConfirmed: boolean | null;
  endDate: string | null;
  endSignatureConfirmed: boolean | null;
  endReason: string | null;
  role: string | null;
  createdAt: Date;
}

export function canonicalizeVolunteer(volunteer: VolunteerForSigning): string {
  const payload: Record<string, unknown> = {};
  
  for (const field of SIGNED_FIELDS) {
    let value = volunteer[field as keyof VolunteerForSigning];
    
    if (value instanceof Date) {
      value = value.toISOString();
    }
    
    if (value === undefined) {
      value = null;
    }
    
    payload[field] = value;
  }
  
  return JSON.stringify(payload);
}

export function computeVolunteerHash(canonicalPayload: string): string {
  const secret = getIntegritySecret();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(canonicalPayload, "utf8");
  return hmac.digest("hex");
}

export async function signVolunteerEntry(volunteerId: string): Promise<{
  success: boolean;
  hash?: string;
  signedAt?: Date;
  error?: string;
}> {
  try {
    const [volunteer] = await db.select().from(volunteerRegistry).where(eq(volunteerRegistry.id, volunteerId));
    
    if (!volunteer) {
      return { success: false, error: "Volunteer entry not found" };
    }
    
    const volunteerForSigning: VolunteerForSigning = {
      id: volunteer.id,
      organizationId: volunteer.organizationId,
      progressiveNumber: volunteer.progressiveNumber,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      fiscalCode: volunteer.fiscalCode,
      birthDate: volunteer.birthDate,
      birthPlace: volunteer.birthPlace,
      gender: volunteer.gender,
      residenceAddress: volunteer.residenceAddress,
      residenceCity: volunteer.residenceCity,
      residenceProvince: volunteer.residenceProvince,
      residencePostalCode: volunteer.residencePostalCode,
      phone: volunteer.phone,
      email: volunteer.email,
      volunteerType: volunteer.volunteerType,
      status: volunteer.status,
      startDate: volunteer.startDate,
      startSignatureConfirmed: volunteer.startSignatureConfirmed,
      endDate: volunteer.endDate,
      endSignatureConfirmed: volunteer.endSignatureConfirmed,
      endReason: volunteer.endReason,
      role: volunteer.role,
      createdAt: volunteer.createdAt,
    };
    
    const canonicalPayload = canonicalizeVolunteer(volunteerForSigning);
    const hash = computeVolunteerHash(canonicalPayload);
    const signedAt = new Date();
    
    await db.update(volunteerRegistry)
      .set({
        integrityHash: hash,
        integritySignedAt: signedAt,
        integrityAlgorithm: ALGORITHM,
        integrityStatus: "VALID",
        updatedAt: new Date(),
      })
      .where(eq(volunteerRegistry.id, volunteerId));
    
    await createAuditEntry({
      action: "create",
      entityType: "volunteer_registry_integrity",
      entityId: volunteerId,
      entityName: `${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber})`,
      newValue: {
        integrityHash: hash.substring(0, 16) + "...",
        integrityAlgorithm: ALGORITHM,
        integrityStatus: "VALID",
      },
      description: `Firma crittografica generata per volontario ${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber})`,
      metadata: {
        organizationId: volunteer.organizationId,
        volunteerType: volunteer.volunteerType,
      },
      isCompliance: true,
    });
    
    return { success: true, hash, signedAt };
  } catch (error) {
    console.error("Error signing volunteer entry:", error);
    return { success: false, error: String(error) };
  }
}

export async function verifyVolunteerIntegrity(volunteerId: string): Promise<{
  valid?: boolean;
  status: "VALID" | "BROKEN" | "NOT_SIGNED";
  signedAt?: string;
  algorithm?: string;
  reason?: string;
  lastModifiedAt?: string;
}> {
  try {
    const [volunteer] = await db.select().from(volunteerRegistry).where(eq(volunteerRegistry.id, volunteerId));
    
    if (!volunteer) {
      return { status: "NOT_SIGNED", reason: "Volunteer entry not found" };
    }
    
    if (!volunteer.integrityHash || volunteer.integrityStatus === "NOT_SIGNED") {
      return { status: "NOT_SIGNED", reason: "Registrazione non ancora firmata" };
    }
    
    const volunteerForSigning: VolunteerForSigning = {
      id: volunteer.id,
      organizationId: volunteer.organizationId,
      progressiveNumber: volunteer.progressiveNumber,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      fiscalCode: volunteer.fiscalCode,
      birthDate: volunteer.birthDate,
      birthPlace: volunteer.birthPlace,
      gender: volunteer.gender,
      residenceAddress: volunteer.residenceAddress,
      residenceCity: volunteer.residenceCity,
      residenceProvince: volunteer.residenceProvince,
      residencePostalCode: volunteer.residencePostalCode,
      phone: volunteer.phone,
      email: volunteer.email,
      volunteerType: volunteer.volunteerType,
      status: volunteer.status,
      startDate: volunteer.startDate,
      startSignatureConfirmed: volunteer.startSignatureConfirmed,
      endDate: volunteer.endDate,
      endSignatureConfirmed: volunteer.endSignatureConfirmed,
      endReason: volunteer.endReason,
      role: volunteer.role,
      createdAt: volunteer.createdAt,
    };
    
    const canonicalPayload = canonicalizeVolunteer(volunteerForSigning);
    const currentHash = computeVolunteerHash(canonicalPayload);
    
    if (currentHash === volunteer.integrityHash) {
      await createAuditEntry({
        action: "read",
        entityType: "volunteer_registry_integrity_verification",
        entityId: volunteerId,
        entityName: `${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber})`,
        description: `Verifica integrita volontario ${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber}) - VALIDA`,
        isCompliance: true,
      });
      
      return {
        valid: true,
        status: "VALID",
        signedAt: volunteer.integritySignedAt?.toISOString(),
        algorithm: volunteer.integrityAlgorithm || ALGORITHM,
      };
    } else {
      await createAuditEntry({
        action: "update",
        entityType: "volunteer_registry_integrity_verification",
        entityId: volunteerId,
        entityName: `${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber})`,
        description: `Verifica integrita volontario ${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber}) - COMPROMESSA (hash mismatch)`,
        metadata: {
          storedHash: volunteer.integrityHash?.substring(0, 16) + "...",
          computedHash: currentHash.substring(0, 16) + "...",
        },
        isCompliance: true,
        isSensitive: true,
      });
      
      return {
        valid: false,
        status: "BROKEN",
        signedAt: volunteer.integritySignedAt?.toISOString(),
        algorithm: volunteer.integrityAlgorithm || ALGORITHM,
        reason: "Hash mismatch - dati modificati dopo la firma",
        lastModifiedAt: volunteer.updatedAt.toISOString(),
      };
    }
  } catch (error) {
    console.error("Error verifying volunteer integrity:", error);
    return { status: "NOT_SIGNED", reason: String(error) };
  }
}

export async function checkAndInvalidateVolunteerIntegrity(volunteerId: string, modifiedFields: string[]): Promise<void> {
  try {
    const [volunteer] = await db.select().from(volunteerRegistry).where(eq(volunteerRegistry.id, volunteerId));
    
    if (!volunteer || !volunteer.integrityHash || volunteer.integrityStatus !== "VALID") {
      return;
    }
    
    if (modifiedFields.length === 0) {
      return;
    }
    
    const signedFieldsSet = new Set(SIGNED_FIELDS);
    const modifiedSignedFields = modifiedFields.filter(f => signedFieldsSet.has(f as typeof SIGNED_FIELDS[number]));
    
    if (modifiedSignedFields.length === 0) {
      return;
    }
    
    await db.update(volunteerRegistry)
      .set({
        integrityStatus: "BROKEN",
        updatedAt: new Date(),
      })
      .where(eq(volunteerRegistry.id, volunteerId));
    
    await createAuditEntry({
      action: "update",
      entityType: "volunteer_registry_integrity",
      entityId: volunteerId,
      entityName: `${volunteer.lastName} ${volunteer.firstName} (#${volunteer.progressiveNumber})`,
      previousValue: { integrityStatus: "VALID" },
      newValue: {
        integrityStatus: "BROKEN",
        modifiedFields: modifiedFields,
        signedFieldsModified: modifiedSignedFields,
      },
      description: `Integrita registro volontario compromessa: campi [${modifiedFields.join(", ")}] modificati dopo firma`,
      metadata: {
        organizationId: volunteer.organizationId,
        originalSignedAt: volunteer.integritySignedAt?.toISOString(),
      },
      isCompliance: true,
      isSensitive: true,
    });
    
    console.log(`Volunteer ${volunteerId} integrity invalidated. Modified fields: ${modifiedFields.join(", ")}`);
  } catch (error) {
    console.error("Error checking/invalidating volunteer integrity:", error);
  }
}

export async function bulkSignVolunteers(organizationId: string): Promise<{
  signed: number;
  skipped: number;
  errors: number;
  total: number;
}> {
  const result = { signed: 0, skipped: 0, errors: 0, total: 0 };
  
  try {
    const secret = getIntegritySecret();
    
    const unsigned = await db.select().from(volunteerRegistry)
      .where(
        sql`${volunteerRegistry.organizationId} = ${organizationId} AND (${volunteerRegistry.integrityStatus} = 'NOT_SIGNED' OR ${volunteerRegistry.integrityStatus} IS NULL OR ${volunteerRegistry.integrityStatus} = 'BROKEN')`
      );
    
    result.total = unsigned.length;
    
    for (const volunteer of unsigned) {
      try {
        const volunteerForSigning: VolunteerForSigning = {
          id: volunteer.id,
          organizationId: volunteer.organizationId,
          progressiveNumber: volunteer.progressiveNumber,
          firstName: volunteer.firstName,
          lastName: volunteer.lastName,
          fiscalCode: volunteer.fiscalCode,
          birthDate: volunteer.birthDate,
          birthPlace: volunteer.birthPlace,
          gender: volunteer.gender,
          residenceAddress: volunteer.residenceAddress,
          residenceCity: volunteer.residenceCity,
          residenceProvince: volunteer.residenceProvince,
          residencePostalCode: volunteer.residencePostalCode,
          phone: volunteer.phone,
          email: volunteer.email,
          volunteerType: volunteer.volunteerType,
          status: volunteer.status,
          startDate: volunteer.startDate,
          startSignatureConfirmed: volunteer.startSignatureConfirmed,
          endDate: volunteer.endDate,
          endSignatureConfirmed: volunteer.endSignatureConfirmed,
          endReason: volunteer.endReason,
          role: volunteer.role,
          createdAt: volunteer.createdAt,
        };
        
        const canonicalPayload = canonicalizeVolunteer(volunteerForSigning);
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(canonicalPayload, "utf8");
        const hash = hmac.digest("hex");
        const signedAt = new Date();
        
        await db.update(volunteerRegistry)
          .set({
            integrityHash: hash,
            integritySignedAt: signedAt,
            integrityAlgorithm: ALGORITHM,
            integrityStatus: "VALID",
          })
          .where(eq(volunteerRegistry.id, volunteer.id));
        
        result.signed++;
      } catch (err) {
        result.errors++;
      }
    }
    
    console.log(`[VOLUNTEER BULK SIGN] Completed: ${result.signed} signed, ${result.errors} errors`);
    return result;
  } catch (error) {
    console.error("[VOLUNTEER BULK SIGN] Error:", error);
    return result;
  }
}

export async function getVolunteerIntegrityStats(organizationId: string): Promise<{
  total: number;
  signed: number;
  valid: number;
  broken: number;
  unsigned: number;
}> {
  try {
    const all = await db.select().from(volunteerRegistry)
      .where(eq(volunteerRegistry.organizationId, organizationId));
    
    const stats = { total: all.length, signed: 0, valid: 0, broken: 0, unsigned: 0 };
    
    for (const v of all) {
      if (v.integrityStatus === "VALID") { stats.valid++; stats.signed++; }
      else if (v.integrityStatus === "BROKEN") { stats.broken++; stats.signed++; }
      else { stats.unsigned++; }
    }
    
    return stats;
  } catch (error) {
    console.error("Error getting volunteer integrity stats:", error);
    return { total: 0, signed: 0, valid: 0, broken: 0, unsigned: 0 };
  }
}
