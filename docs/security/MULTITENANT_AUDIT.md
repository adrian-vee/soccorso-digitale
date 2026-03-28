# Multi-Tenant Isolation Audit

**Date:** 2026-03-28
**Auditor:** ARES (Security Engineer) + VULCAN (Backend Engineer)
**Stack:** Express.js TypeScript, Drizzle ORM, PostgreSQL
**Scope:** All 15 route files in `server/routes/`

---

## Executive Summary

- **Route files audited:** 15 files (43,715 total lines)
- **DB queries analyzed:** ~180 distinct query locations
- **Critical issues found:** 10
- **Critical issues fixed:** 10
- **TypeScript errors introduced:** 0 (build passes clean)

---

## Authentication Role Hierarchy

| Role | Middleware | Org-scoped? | Notes |
|------|-----------|-------------|-------|
| `super_admin` | `requireSuperAdmin` | No — sees everything | Platform admin |
| `admin` | `requireAdmin` | Should be — was missing in some paths | Org-level admin |
| `director` | `requireAdmin` | Should be | Same as admin |
| `org_admin` | `requireAdmin` / `requireOrgAdmin` | Yes | Explicit org isolation |
| `branch_manager` | `requireAdminOrManager` | Yes | Location-filtered |
| `crew` / `operator` | `requireAuth` | Yes | Via organizationId on session |

**Critical Pattern Bug:** Many endpoints used `if (isOrgAdmin(req) && orgId)` as the org isolation check. This only catches the `org_admin` role. Users with `admin` or `director` role AND an `organizationId` set would fall through to the unfiltered global query. Fixed by changing to `if (orgId && !isFullAdmin(req))` where `isFullAdmin` returns true only for `super_admin`, `admin`, and `director` WITHOUT an org.

---

## Tables With `organizationId` (tenant-isolated)

| Table | organizationId | Notes |
|-------|---------------|-------|
| `organizations` | Primary key equiv. | Root entity |
| `users` | Yes | Per-org |
| `vehicles` | Yes | Per-org |
| `locations` | Yes | Per-org |
| `trips` | Yes | Per-org |
| `scheduled_services` | Yes | Per-org |
| `shift_instances` | Yes | Per-org |
| `shift_assignments` | Via shiftInstances | Inherited |
| `staff_members` | Yes | Per-org |
| `fuel_entries` | Yes | Per-org |
| `fuel_cards` | Yes | Per-org |
| `shift_logs` | Yes | Per-org |
| `checklist_template_items` | Yes | Per-org |
| `vehicle_documents` | Yes | Per-org |
| `sanitization_logs` | Yes | Per-org |
| `rescue_sheets` | Yes | Per-org |
| `handoffs` | Yes | Per-org |
| `announcements` | Yes | Per-org |
| `checklist_photos` | Via vehicleId→org | Inherited |

## Tables WITHOUT `organizationId` (global/shared)

| Table | Reason | Risk |
|-------|--------|------|
| `audit_logs` | No organizationId column | Mitigated: filtered by org's userIds |
| `structures` | Global hospital/POI catalog | OK — shared reference data |
| `departments` | Global department catalog | OK — shared reference data |
| `inventory_items` | Global item catalog | OK — shared reference data |
| `carbon_emission_factors` | Global config | OK |
| `fuel_prices` | Market price data | OK |

---

## Critical Issues Found and Fixed

### CRIT-01: `/api/gps/live` — Unfiltered trips + scheduledServices

**File:** `server/routes/fleet.routes.ts` (line ~955) and `server/routes/admin.routes.ts` (line ~1512)
**Endpoint:** `GET /api/gps/live`
**Auth:** `requireAuth` (any authenticated user)
**Issue:** `todayTrips` loaded from `trips` without org filter. `todayActiveServices` from `scheduledServices` without org filter. While vehicles were filtered per org, the trip/service data for ALL orgs was loaded and cross-org trip data was associated in-memory to org-scoped vehicles.
**Fix Applied:** Added `eq(trips.organizationId, orgId)` and `eq(scheduledServices.organizationId, orgId)` conditions when `orgId` is present, in both fleet.routes.ts and admin.routes.ts.

---

### CRIT-02: `/api/admin/export-data` — Full cross-org data export

**File:** `server/routes/admin.routes.ts` (line ~5249)
**Endpoint:** `GET /api/admin/export-data`
**Auth:** `requireAdmin` (includes `admin`, `org_admin`)
**Issue:** Exported ALL locations, vehicles, and users from ALL organizations with no org filter.
**Fix Applied:** Added org-scoped queries: `db.select().from(locations).where(eq(locations.organizationId, orgId))` etc. when `orgId` is set.

---

### CRIT-03: `/api/audit-logs` — Cross-org audit log exposure

**File:** `server/routes/admin.routes.ts` (line ~5234)
**Endpoint:** `GET /api/audit-logs`
**Auth:** `requireAdmin`
**Issue:** `auditLogs` table has no `organizationId` column. Any admin-role user could read audit logs from all organizations.
**Fix Applied:** When `orgId && !isFullAdmin(req)`, first fetch all user IDs for the org, then filter audit logs by those user IDs using `inArray(auditLogs.userId, orgUserIds)`.

---

### CRIT-04: `/api/branch-managers` — Cross-org user listing

**File:** `server/routes/admin.routes.ts` (line ~4909)
**Endpoint:** `GET /api/branch-managers`
**Auth:** `requireAdmin`
**Issue:** `storage.getAllBranchManagers()` returned branch managers from all orgs without filtering.
**Fix Applied:** Added post-fetch filter: `managers.filter(m => m.organizationId === orgId)` when `orgId` is set.

---

### CRIT-05: `/api/users` — isOrgAdmin-only pattern missing regular admin

**File:** `server/routes/admin.routes.ts` (line ~4888)
**Endpoint:** `GET /api/users`
**Auth:** `requireAdmin`
**Issue:** `if (isOrgAdmin(req) && orgId)` only filtered for `org_admin` role. Users with `admin` role AND an org fell through to the unfiltered `storage.getUsers()` returning all users from all orgs.
**Fix Applied:** Changed condition to `if (orgId && !isFullAdmin(req))` — correctly scopes both `admin` and `org_admin` roles with an org.

---

### CRIT-06: `/api/trips/:id` (trips.routes.ts) — No org check on single trip

**File:** `server/routes/trips.routes.ts` (line ~509)
**Endpoint:** `GET /api/trips/:id`
**Auth:** `requireAuth`
**Issue:** Any authenticated user could fetch any trip by ID, regardless of their organization.
**Fix Applied:** Added org check: if `orgId && trip.organizationId && trip.organizationId !== orgId` → return 403.

---

### CRIT-07: `/api/trips/:id` (admin.routes.ts) — No org check on single trip

**File:** `server/routes/admin.routes.ts` (line ~2656)
**Endpoint:** `GET /api/trips/:id`
**Auth:** `requireAuth`
**Issue:** Same as CRIT-06 — duplicate route definition in admin.routes.ts also lacked org check.
**Fix Applied:** Same pattern as CRIT-06.

---

### CRIT-08: `/api/trips-with-device-auth` — isOrgAdmin-only pattern

**File:** `server/routes/trips.routes.ts` and `server/routes/admin.routes.ts`
**Endpoint:** `GET /api/trips-with-device-auth`
**Auth:** `requireAdmin`
**Issue:** Used `isOrgAdmin(req) && orgId` — same pattern as CRIT-05, missing `admin` role with org.
**Fix Applied:** Changed to `orgId && !isFullAdmin(req)` in both files.

---

### CRIT-09: `/api/admin/vehicle-documents` and `/api/admin/sanitization-logs` — isOrgAdmin-only pattern

**File:** `server/routes/fleet.routes.ts`
**Endpoints:** `GET /api/admin/vehicle-documents`, `GET /api/admin/sanitization-logs`
**Auth:** `requireAdmin`
**Issue:** `if (isOrgAdmin(req) && orgId)` pattern — `admin` role users with an org fell through to global query.
**Fix Applied:** Changed to `if (orgId && !isFullAdmin(req))` in both endpoints.

---

### CRIT-10: `/api/shift-report/staff-pdf` and `/api/shift-report/staff-ics` — Cross-org staff data exposure

**File:** `server/routes/shifts.routes.ts`
**Endpoints:** `GET /api/shift-report/staff-pdf`, `GET /api/shift-report/staff-ics`
**Auth:** `requireAdmin`
**Issue:** No validation that `staffMemberId` belongs to the requesting admin's organization. An org admin could request shift reports for staff from any other org by guessing UUIDs. Additionally, `allVehicles` and `locationsList` were loaded without org filter.
**Fix Applied:** Added `if (orgId && !isFullAdmin(req) && staffMember.organizationId !== orgId) → 403`. Also added org filter to vehicle and location lookups.

---

### ADDITIONAL FIX: `/api/admin/realtime-availability` — Unfiltered shiftInstances

**File:** `server/routes/shifts.routes.ts`
**Endpoint:** `GET /api/admin/realtime-availability`
**Auth:** `requireAuth`
**Issue:** `todayInstances` loaded from `shiftInstances` without org filter. `allLocations`/`allVehicles` unfiltered.
**Fix Applied:** Added org filter to `shiftInstances` query and org-conditional filters to locations/vehicles.

---

## Recommended Middleware Pattern for Future Queries

```typescript
// Standard pattern for any multi-tenant query:
const orgId = getEffectiveOrgId(req);

// For full superadmins (super_admin, admin, director with no org):
if (isFullAdmin(req)) {
  // Can query all orgs OR use orgFilter query param
}

// For org-scoped users (org_admin, admin with org, branch_manager, crew):
if (orgId) {
  // ALWAYS add: .where(eq(table.organizationId, orgId))
}

// For single-resource access validation:
const resource = await storage.getResource(id);
if (orgId && resource.organizationId && resource.organizationId !== orgId) {
  return res.status(403).json({ error: "Accesso non autorizzato" });
}
```

---

## Recommendations

1. **Global middleware:** Consider adding a middleware that attaches `req.effectiveOrgId` on every authenticated request, so handlers never need to call `getEffectiveOrgId(req)` explicitly.

2. **Replace `isOrgAdmin` pattern:** Audit all remaining uses of `if (isOrgAdmin(req) && orgId)` and replace with `if (orgId && !isFullAdmin(req))` to catch all org-scoped roles uniformly.

3. **Add `organizationId` to `auditLogs`:** The lack of `organizationId` on the `audit_logs` table is a design debt. Adding it would allow direct SQL filtering instead of the two-query user ID filter approach.

4. **Row-level security (RLS):** For long-term robustness, consider implementing PostgreSQL Row Level Security policies at the database level to enforce tenant isolation as a second layer of defense.

5. **Integration tests:** Add tests that verify a user from Org A cannot access data from Org B via any endpoint.
