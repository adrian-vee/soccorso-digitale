import { sql, relations } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, timestamp, boolean, date, time, real, jsonb, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Organization status enum
export const orgStatusEnum = pgEnum("org_status", [
  "active",      // Organization is active and can use the system
  "trial",       // Organization is in trial period
  "suspended",   // Organization is temporarily suspended
  "inactive"     // Organization is deactivated
]);

// Organizations table - multi-tenant support
export const organizations = pgTable("organizations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  legalName: text("legal_name"),
  vatNumber: text("vat_number"),
  fiscalCode: text("fiscal_code"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  pec: text("pec"),
  website: text("website"),
  logoUrl: text("logo_url"),
  legalRepName: text("legal_rep_name"),
  legalRepRole: text("legal_rep_role"),
  legalRepSignature: text("legal_rep_signature"),
  defaultProtocolOperator: text("default_protocol_operator"),
  status: orgStatusEnum("status").default("trial").notNull(),
  maxVehicles: integer("max_vehicles").default(5),
  maxUsers: integer("max_users").default(20),
  trialEndsAt: timestamp("trial_ends_at"),
  notes: text("notes"),
  enabledModules: jsonb("enabled_modules").default(sql`'[]'::jsonb`),
  slaThresholdMinor: integer("sla_threshold_minor").default(30),
  slaThresholdMajor: integer("sla_threshold_major").default(60),
  isDemo: boolean("is_demo").default(false),
  demoExpiresAt: timestamp("demo_expires_at"),
  demoEmail: text("demo_email"),
  plan: text("plan").default("base"), // base | pro | enterprise
  nextRenewalAt: timestamp("next_renewal_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Integrity status enum for trip cryptographic signing
export const integrityStatusEnum = pgEnum("integrity_status", [
  "VALID",       // Hash matches, data not modified
  "BROKEN",      // Hash mismatch, data was modified after signing
  "NOT_SIGNED"   // Legacy or not yet signed
]);

// Users table - for authentication (supports both person and vehicle accounts)
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("crew"), // crew, admin, director, branch_manager, org_admin
  accountType: text("account_type").notNull().default("vehicle"), // person (admin) or vehicle (ambulance)
  vehicleId: varchar("vehicle_id"), // linked vehicle for vehicle accounts
  locationId: varchar("location_id"),
  organizationId: varchar("organization_id"), // tenant isolation
  customRoleId: varchar("custom_role_id"),
  authToken: text("auth_token"), // Token for mobile app authentication
  lastLoginAt: timestamp("last_login_at"),
  lastLogoutAt: timestamp("last_logout_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Locations/Sedi table
export const locations = pgTable("locations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  isPrimary: boolean("is_primary").default(false),
  organizationId: varchar("organization_id"), // tenant isolation
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameOrgUnique: uniqueIndex("locations_name_org_unique").on(table.name, table.organizationId),
}));

// User-Location assignments for branch managers (responsabili sede)
// Allows a user to manage one or multiple locations
export const userLocations = pgTable("user_locations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  locationId: varchar("location_id").notNull(),
  isPrimary: boolean("is_primary").default(true), // Primary sede for this manager
  canManageFleet: boolean("can_manage_fleet").default(true), // Parco macchine
  canManageShifts: boolean("can_manage_shifts").default(true), // Turnistica
  canManageInventory: boolean("can_manage_inventory").default(true), // Magazzino
  canManageEvents: boolean("can_manage_events").default(true), // Eventi speciali
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userLocationUnique: uniqueIndex("user_location_unique").on(table.userId, table.locationId),
}));

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text("code").notNull(), // e.g., "J 30", "J 63"
  licensePlate: text("license_plate"), // e.g., "FL929VM"
  model: text("model"), // e.g., "Fiat Ducato"
  vehicleType: text("vehicle_type").default("MSB"), // MSB = Base, MSI = Infermierizzato
  assignedTemplateId: varchar("assigned_template_id"), // Template inventario assegnato
  displacement: integer("displacement"), // cilindrata in cc
  kw: integer("kw"), // potenza in kW
  fuelType: text("fuel_type").default("Gasolio"), // Gasolio, Benzina, GPL, Metano, Elettrico
  locationId: varchar("location_id").notNull(),
  currentKm: integer("current_km").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  // GPS tracking fields
  latitude: text("latitude"),
  longitude: text("longitude"),
  lastLocationAt: timestamp("last_location_at"),
  isOnService: boolean("is_on_service").default(false),
  // Cost tracking fields for advanced statistics
  fuelConsumptionPer100km: real("fuel_consumption_per_100km"), // litri per 100km
  maintenanceCostPerKm: real("maintenance_cost_per_km"), // euro per km
  insuranceCostMonthly: real("insurance_cost_monthly"), // euro al mese
  driverHourlyCost: real("driver_hourly_cost"), // euro all'ora (legacy)
  // Hourly contract pricing (appalti)
  hourlyOperatingCost: real("hourly_operating_cost"), // costo operativo orario totale (veicolo + equipaggio)
  hourlyRevenueRate: real("hourly_revenue_rate"), // tariffa oraria di vendita per appalti
  defaultCrewType: text("default_crew_type").default("autista_soccorritore"), // tipo equipaggio predefinito
  // Maintenance tracking fields
  nextRevisionDate: date("next_revision_date"), // prossima revisione
  nextServiceDate: date("next_service_date"), // prossimo tagliando
  revisionKm: integer("revision_km"), // km alla prossima revisione
  maintenanceStatus: text("maintenance_status").default("ok"), // ok, warning, critical
  lastMaintenanceDate: date("last_maintenance_date"), // ultimo tagliando effettuato
  lastMaintenanceKm: integer("last_maintenance_km"), // km ultimo tagliando
  brand: text("brand"), // marca (es. Fiat, Mercedes)
  year: integer("year"), // anno immatricolazione
  // Contract/Assignment fields
  assignedContractName: text("assigned_contract_name"), // es. "ULSS 8 Berica", "ULSS 6 Euganea"
  assignedContractLogo: text("assigned_contract_logo"), // URL logo del contratto
  workScheduleStart: text("work_schedule_start"), // orario inizio turno, es. "07:00"
  workScheduleEnd: text("work_schedule_end"), // orario fine turno, es. "19:00"
  isAssignedToEvent: boolean("is_assigned_to_event").default(false), // se assegnato a evento sportivo
  eventName: text("event_name"), // nome evento sportivo se assegnato
  eventDate: date("event_date"), // data evento sportivo
  // Monthly scheduling fields
  natoName: text("nato_name"), // Nome NATO per turnistica (es. "Romeo 21", "India 21", "Sierra 1")
  scheduleRoles: text("schedule_roles").default("autista,soccorritore"), // Ruoli da mostrare: "autista,soccorritore" o "autista"
  scheduleShiftStart: text("schedule_shift_start"), // Orario inizio turno custom (es. "06:30") - DEPRECATED
  scheduleShiftEnd: text("schedule_shift_end"), // Orario fine turno custom (es. "14:00") - DEPRECATED
  scheduleShifts: text("schedule_shifts"), // JSON array di fasce orarie: [{"start":"07:00","end":"14:00"},{"start":"14:30","end":"22:00"}]
  scheduleDays: jsonb("schedule_days"), // Per-day config: {"1":{"active":true,"shifts":[{"start":"07:00","end":"19:00"}]},...} (0=Sun,1=Mon...6=Sat)
  scheduleColor: text("schedule_color"), // Colore sfondo nella griglia (es. "#FFFF00" giallo)
  scheduleEnabled: boolean("schedule_enabled").default(true), // Visibile nella turnistica mensile
  scheduleProfiles: jsonb("schedule_profiles"), // Multi-profile: [{id, natoName, shifts, roles, color, days, enabled}]
  isEmergency: boolean("is_emergency").default(false), // Mezzo di emergenza (118/SUEM)
  vehicleClass: text("vehicle_class").default("tipo_b"), // tipo_a = ambulanza tipo A (DM 553/1987), tipo_b = tipo B
  isReserve: boolean("is_reserve").default(false), // veicolo di riserva
  organizationId: varchar("organization_id"), // tenant isolation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Hospitals/Structures table
export const structures = pgTable("structures", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  type: text("type").notNull().default("ospedale"), // ospedale, altro
  phoneNumber: text("phone_number"), // numero telefono struttura
  accessCode: text("access_code"), // codice accesso cancello/citofono
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Structure-Department junction table (many-to-many)
export const structureDepartments = pgTable("structure_departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  structureId: varchar("structure_id").notNull(),
  departmentId: varchar("department_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Trips table - main data
export const trips = pgTable("trips", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  progressiveNumber: text("progressive_number").notNull(),
  vehicleId: varchar("vehicle_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Date and time
  serviceDate: date("service_date").notNull(),
  departureTime: time("departure_time"),
  returnTime: time("return_time"),
  
  // Patient info (optional)
  patientBirthYear: integer("patient_birth_year"),
  patientGender: text("patient_gender"), // M, F
  
  // Origin
  originType: text("origin_type").notNull(), // ospedale, domicilio, casa_di_riposo, sede, altro
  originStructureId: varchar("origin_structure_id"),
  originDepartmentId: varchar("origin_department_id"),
  originAddress: text("origin_address"),
  
  // Destination
  destinationType: text("destination_type").notNull(), // ospedale, domicilio, casa_di_riposo, sede, altro
  destinationStructureId: varchar("destination_structure_id"),
  destinationDepartmentId: varchar("destination_department_id"),
  destinationAddress: text("destination_address"),
  
  // Kilometers
  kmInitial: integer("km_initial").notNull(),
  kmFinal: integer("km_final").notNull(),
  kmTraveled: integer("km_traveled").notNull(),
  
  // Time
  durationMinutes: integer("duration_minutes"),
  
  // Service type
  serviceType: text("service_type"), // trasporto_programmato, dimissione, dialisi, disabili, visita, trasferimento
  
  // Emergency service with waypoints (multi-stop emergency service)
  isEmergencyService: boolean("is_emergency_service").default(false),
  totalWaypointKm: integer("total_waypoint_km"), // Total km calculated from all waypoints
  
  // Crew composition - tipo equipaggio
  crewType: text("crew_type").default("autista_soccorritore"), // autista_soccorritore, autista_infermiere
  
  // Flags
  isReturnTrip: boolean("is_return_trip").default(false).notNull(), // viaggio di rientro senza paziente
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Cryptographic integrity fields - for tamper-evident service records
  integrityHash: text("integrity_hash"),              // HMAC-SHA256 hash of canonical payload
  integritySignedAt: timestamp("integrity_signed_at"), // When the hash was generated
  integrityAlgorithm: text("integrity_algorithm"),     // Algorithm used (e.g., "HMAC-SHA256")
  integrityStatus: integrityStatusEnum("integrity_status").default("NOT_SIGNED"), // Current status
  
  // PDF hash for file integrity verification
  pdfHash: text("pdf_hash"),                          // SHA-256 hash of the generated PDF file
  pdfHashGeneratedAt: timestamp("pdf_hash_generated_at"), // When the PDF hash was generated
  
  scheduledDepartureTime: time("scheduled_departure_time"), // orario partenza programmato per calcolo SLA
  slaViolation: boolean("sla_violation").default(false), // violazione SLA
  slaViolationType: text("sla_violation_type"), // delay_60min, gps_gap, late_30min
  slaViolationMinutes: integer("sla_violation_minutes"), // minuti di ritardo

  organizationId: varchar("organization_id"), // tenant isolation
});

// Device Authorization - for documenting emergency device usage authorization
// When ambulance crews use sirens/lights on scheduled transports, medical personnel must authorize
export const deviceAuthorizerTypeEnum = pgEnum("device_authorizer_type", [
  "medico_bordo",      // Medico a bordo dell'ambulanza
  "infermiere_bordo",  // Infermiere a bordo dell'ambulanza
  "medico_reparto",    // Medico del reparto (disposizione)
  "centrale_operativa" // Centrale operativa (non richiede firma)
]);

export const tripDeviceAuthorizations = pgTable("trip_device_authorizations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().unique(), // One authorization per trip
  authorizerType: deviceAuthorizerTypeEnum("authorizer_type").notNull(),
  authorizerName: text("authorizer_name"), // Nome di chi autorizza (non richiesto per centrale)
  signatureData: text("signature_data"), // Base64 encoded PNG signature image
  signatureMimeType: text("signature_mime_type").default("image/png"),
  authorizedAt: timestamp("authorized_at").defaultNow().notNull(),
  notes: text("notes"), // Note aggiuntive sull'autorizzazione
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripDeviceAuthorizationsRelations = relations(tripDeviceAuthorizations, ({ one }) => ({
  trip: one(trips, {
    fields: [tripDeviceAuthorizations.tripId],
    references: [trips.id],
  }),
}));

// GPS Tracking Points for trips - stores real-time GPS coordinates during service
export const tripGpsPoints = pgTable("trip_gps_points", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id"), // Reference to the trip — nullable: punti pre-viaggio salvati con null, poi aggiornati a link-trip
  vehicleId: varchar("vehicle_id").notNull(), // Vehicle being tracked
  latitude: text("latitude").notNull(), // GPS latitude
  longitude: text("longitude").notNull(), // GPS longitude
  accuracy: real("accuracy"), // GPS accuracy in meters
  speed: real("speed"), // Speed in km/h
  heading: real("heading"), // Direction in degrees (0-360)
  altitude: real("altitude"), // Altitude in meters
  timestamp: timestamp("timestamp").defaultNow().notNull(), // When this point was recorded
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Active tracking sessions - tracks ongoing services
export const activeTrackingSessions = pgTable("active_tracking_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull().unique(), // One session per vehicle
  tripId: varchar("trip_id"), // Associated trip (if already created)
  userId: varchar("user_id").notNull(), // User who started tracking
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastUpdateAt: timestamp("last_update_at").defaultNow().notNull(),
  pointsCount: integer("points_count").default(0), // Number of GPS points collected
  isActive: boolean("is_active").default(true).notNull(),
});

// Relations for GPS tracking
export const tripGpsPointsRelations = relations(tripGpsPoints, ({ one }) => ({
  trip: one(trips, {
    fields: [tripGpsPoints.tripId],
    references: [trips.id],
  }),
  vehicle: one(vehicles, {
    fields: [tripGpsPoints.vehicleId],
    references: [vehicles.id],
  }),
}));

export const activeTrackingSessionsRelations = relations(activeTrackingSessions, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [activeTrackingSessions.vehicleId],
    references: [vehicles.id],
  }),
  trip: one(trips, {
    fields: [activeTrackingSessions.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [activeTrackingSessions.userId],
    references: [users.id],
  }),
}));

// Trip Waypoints - for emergency services with multiple stops
// Sede → Luogo Intervento → Destinazione Intermedia → Destinazione Finale
export const tripWaypoints = pgTable("trip_waypoints", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull(), // Reference to the trip
  waypointOrder: integer("waypoint_order").notNull(), // 1 = first stop, 2 = second stop, etc.
  waypointType: text("waypoint_type").notNull(), // luogo_intervento, destinazione_intermedia
  locationType: text("location_type").notNull(), // ospedale, domicilio, casa_di_riposo, sede, altro
  structureId: varchar("structure_id"), // If ospedale or casa_di_riposo
  departmentId: varchar("department_id"), // If ospedale
  address: text("address"), // Free text address
  latitude: text("latitude"), // Cached coordinates for km calculation
  longitude: text("longitude"),
  kmFromPrevious: integer("km_from_previous"), // Km from previous waypoint
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripWaypointsRelations = relations(tripWaypoints, ({ one }) => ({
  trip: one(trips, {
    fields: [tripWaypoints.tripId],
    references: [trips.id],
  }),
  structure: one(structures, {
    fields: [tripWaypoints.structureId],
    references: [structures.id],
  }),
  department: one(departments, {
    fields: [tripWaypoints.departmentId],
    references: [departments.id],
  }),
}));

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  location: one(locations, {
    fields: [vehicles.locationId],
    references: [locations.id],
  }),
  trips: many(trips),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  vehicles: many(vehicles),
  users: many(users),
}));

export const tripsRelations = relations(trips, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id],
  }),
  user: one(users, {
    fields: [trips.userId],
    references: [users.id],
  }),
  originStructure: one(structures, {
    fields: [trips.originStructureId],
    references: [structures.id],
  }),
  destinationStructure: one(structures, {
    fields: [trips.destinationStructureId],
    references: [structures.id],
  }),
  originDepartment: one(departments, {
    fields: [trips.originDepartmentId],
    references: [departments.id],
  }),
  destinationDepartment: one(departments, {
    fields: [trips.destinationDepartmentId],
    references: [departments.id],
  }),
}));

export const structureDepartmentsRelations = relations(structureDepartments, ({ one }) => ({
  structure: one(structures, {
    fields: [structureDepartments.structureId],
    references: [structures.id],
  }),
  department: one(departments, {
    fields: [structureDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const structuresRelations = relations(structures, ({ many }) => ({
  structureDepartments: many(structureDepartments),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  structureDepartments: many(structureDepartments),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  locationId: true,
  organizationId: true,
});

export const insertLocationSchema = createInsertSchema(locations).pick({
  name: true,
  address: true,
  phone: true,
  email: true,
  organizationId: true,
});

export const insertUserLocationSchema = createInsertSchema(userLocations).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).pick({
  code: true,
  licensePlate: true,
  model: true,
  displacement: true,
  kw: true,
  fuelType: true,
  locationId: true,
  currentKm: true,
  fuelConsumptionPer100km: true,
  maintenanceCostPerKm: true,
  insuranceCostMonthly: true,
  driverHourlyCost: true,
  hourlyOperatingCost: true,
  hourlyRevenueRate: true,
  defaultCrewType: true,
  assignedContractName: true,
  assignedContractLogo: true,
  workScheduleStart: true,
  workScheduleEnd: true,
  isAssignedToEvent: true,
  eventName: true,
  eventDate: true,
  organizationId: true,
});

export const insertStructureSchema = createInsertSchema(structures).pick({
  name: true,
  address: true,
  type: true,
  phoneNumber: true,
  accessCode: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
});

export const insertStructureDepartmentSchema = createInsertSchema(structureDepartments).pick({
  structureId: true,
  departmentId: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientBirthYear: z.number().nullable().optional(),
  patientGender: z.string().nullable().optional(),
  departureTime: z.string().nullable().optional(),
  returnTime: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  originStructureId: z.string().nullable().optional(),
  originDepartmentId: z.string().nullable().optional(),
  originAddress: z.string().nullable().optional(),
  destinationStructureId: z.string().nullable().optional(),
  destinationDepartmentId: z.string().nullable().optional(),
  destinationAddress: z.string().nullable().optional(),
  serviceType: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GPS tracking schemas
export const insertTripGpsPointSchema = createInsertSchema(tripGpsPoints).omit({
  id: true,
  createdAt: true,
});

export const insertActiveTrackingSessionSchema = createInsertSchema(activeTrackingSessions).omit({
  id: true,
  startedAt: true,
  lastUpdateAt: true,
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // create, update, delete
  entityType: text("entity_type").notNull(), // trip, vehicle, structure, etc
  entityId: varchar("entity_id").notNull(),
  userId: varchar("user_id"),
  userName: text("user_name"),
  changes: text("changes"), // JSON string of old/new values
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Announcements table - comunicazioni admin
export const announcements = pgTable("announcements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("normal"), // normal, high, urgent
  createdById: varchar("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  expiresAt: timestamp("expires_at"), // optional expiry date
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Announcement reads table - tracciamento letture
export const announcementReads = pgTable("announcement_reads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull(),
  userId: varchar("user_id").notNull(),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export const insertAnnouncementReadSchema = createInsertSchema(announcementReads).omit({
  id: true,
  readAt: true,
});

// ========================================
// FINANCIAL CONFIGURATION TABLES
// ========================================

// Financial Profiles - profili di configurazione finanziaria
export const financialProfiles = pgTable("financial_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Financial Parameters - parametri finanziari configurabili
export const financialParameters = pgTable("financial_parameters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  paramKey: text("param_key").notNull(), // fuel_cost_per_liter, maintenance_per_km, insurance_monthly, etc
  paramValue: real("param_value").notNull(),
  unit: text("unit"), // euro, euro/km, euro/litro, etc
  description: text("description"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Staff role key enum - canonical identifiers for crew roles
export const staffRoleKeyEnum = pgEnum('staff_role_key', [
  'autista',      // Driver
  'soccorritore', // Rescuer
  'infermiere',   // Nurse
  'medico',       // Doctor
  'coordinatore', // Coordinator
]);

// Staff Roles Costs - costi personale per ruolo
export const staffRolesCosts = pgTable("staff_roles_costs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  roleKey: staffRoleKeyEnum("role_key"), // Canonical role identifier (enforced enum)
  roleName: text("role_name").notNull(), // Display name - should match roleKey but kept for backward compat
  hourlyCost: real("hourly_cost").notNull(), // costo orario in euro
  hoursPerTrip: real("hours_per_trip"), // ore medie per viaggio
  monthlyFixedCost: real("monthly_fixed_cost"), // costo fisso mensile (stipendio base)
  description: text("description"),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revenue Models - modelli di ricavo per tipo contratto/servizio (legacy - per viaggio)
export const revenueModels = pgTable("revenue_models", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  contractName: text("contract_name").notNull(), // ASL, privato, convenzione, etc
  tripType: text("trip_type"), // emergenza, trasporto_programmato, dialisi, etc
  baseFee: real("base_fee").notNull(), // tariffa base in euro
  perKmRate: real("per_km_rate"), // tariffa per km
  perMinuteRate: real("per_minute_rate"), // tariffa per minuto
  minimumFee: real("minimum_fee"), // tariffa minima
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// CONTRACTS (APPALTI) - Hourly vehicle rental
// ========================================

// Contracts/Appalti - contratti con tariffe orarie per veicolo
export const contracts = pgTable("contracts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nome appalto (es. "SUEM 118 Verona", "ASL Dialisi")
  clientName: text("client_name").notNull(), // Cliente (es. "ULSS 9 Scaligera")
  description: text("description"),
  // Contract period
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  // SLA requirements
  requiredVehicles: integer("required_vehicles"), // numero ambulanze richieste
  requiredHoursPerDay: real("required_hours_per_day"), // ore/giorno da coprire
  // Default pricing (can be overridden per vehicle)
  defaultHourlyRate: real("default_hourly_rate"), // tariffa oraria default
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Contract-Vehicle assignments with specific hourly rates
export const contractVehicles = pgTable("contract_vehicles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull(),
  vehicleId: varchar("vehicle_id").notNull(),
  // Override pricing for this specific vehicle in this contract
  hourlyRate: real("hourly_rate"), // tariffa oraria specifica (null = usa default contratto)
  // Scheduling
  hoursPerWeek: real("hours_per_week"), // ore settimanali assegnate
  crewType: text("crew_type").default("autista_soccorritore"), // tipo equipaggio
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations for financial tables
export const financialProfilesRelations = relations(financialProfiles, ({ many }) => ({
  parameters: many(financialParameters),
  staffCosts: many(staffRolesCosts),
  revenueModels: many(revenueModels),
}));

export const financialParametersRelations = relations(financialParameters, ({ one }) => ({
  profile: one(financialProfiles, {
    fields: [financialParameters.profileId],
    references: [financialProfiles.id],
  }),
}));

export const staffRolesCostsRelations = relations(staffRolesCosts, ({ one }) => ({
  profile: one(financialProfiles, {
    fields: [staffRolesCosts.profileId],
    references: [financialProfiles.id],
  }),
}));

export const revenueModelsRelations = relations(revenueModels, ({ one }) => ({
  profile: one(financialProfiles, {
    fields: [revenueModels.profileId],
    references: [financialProfiles.id],
  }),
}));

// Scheduled Services table - for PDF-imported daily services
export const scheduledServices = pgTable("scheduled_services", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  vehicleId: varchar("vehicle_id"),
  locationId: varchar("location_id"),
  
  progressiveCode: text("progressive_code"),
  serviceDate: date("service_date").notNull(),
  scheduledTime: text("scheduled_time"),
  
  patientName: text("patient_name"),
  patientNameExpiresAt: timestamp("patient_name_expires_at"),
  patientCondition: text("patient_condition"),
  patientWeight: integer("patient_weight"),
  patientPhone: text("patient_phone"),
  patientNotes: text("patient_notes"),
  gender: text("gender"),
  
  originName: text("origin_name"),
  originAddress: text("origin_address"),
  originCity: text("origin_city"),
  originProvince: text("origin_province"),
  originFloor: text("origin_floor"),
  originBell: text("origin_bell"),
  originLat: numeric("origin_lat"),
  originLng: numeric("origin_lng"),
  
  destinationName: text("destination_name"),
  destinationAddress: text("destination_address"),
  destinationCity: text("destination_city"),
  destinationProvince: text("destination_province"),
  destinationFloor: text("destination_floor"),
  destinationPhone: text("destination_phone"),
  destinationLat: numeric("destination_lat"),
  destinationLng: numeric("destination_lng"),
  
  serviceType: text("service_type"),
  estimatedKm: real("estimated_km"),
  kmEstimated: integer("km_estimated"),
  precautions: text("precautions"),
  transportMode: text("transport_mode"),
  notes: text("notes"),
  additionalPersonnel: text("additional_personnel"),
  
  status: text("status").default("scheduled").notNull(),
  locationMatchStatus: text("location_match_status").default("auto"),
  isCancelled: boolean("is_cancelled").default(false),
  
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  startGpsLat: numeric("start_gps_lat"),
  startGpsLng: numeric("start_gps_lng"),
  endGpsLat: numeric("end_gps_lat"),
  endGpsLng: numeric("end_gps_lng"),
  kmStart: integer("km_start"),
  kmEnd: integer("km_end"),
  isEmptyTrip: boolean("is_empty_trip").default(false),
  suspendReason: text("suspend_reason"),
  cancelReason: text("cancel_reason"),
  
  linkedTripId: varchar("linked_trip_id"),
  
  sourcePdfName: text("source_pdf_name"),
  importSource: text("import_source").default("pdf_manual"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scheduledServicesRelations = relations(scheduledServices, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [scheduledServices.vehicleId],
    references: [vehicles.id],
  }),
  location: one(locations, {
    fields: [scheduledServices.locationId],
    references: [locations.id],
  }),
  linkedTrip: one(trips, {
    fields: [scheduledServices.linkedTripId],
    references: [trips.id],
  }),
  uploader: one(users, {
    fields: [scheduledServices.uploadedBy],
    references: [users.id],
  }),
}));

export const insertScheduledServiceSchema = createInsertSchema(scheduledServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  uploadedAt: true,
});

// Insert schemas for financial tables
export const insertFinancialProfileSchema = createInsertSchema(financialProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFinancialParameterSchema = createInsertSchema(financialParameters).omit({
  id: true,
  createdAt: true,
});

export const insertStaffRoleCostSchema = createInsertSchema(staffRolesCosts).omit({
  id: true,
  createdAt: true,
});

export const insertRevenueModelSchema = createInsertSchema(revenueModels).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for contracts
export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractVehicleSchema = createInsertSchema(contractVehicles).omit({
  id: true,
  createdAt: true,
});

// Types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type UserLocation = typeof userLocations.$inferSelect;
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Structure = typeof structures.$inferSelect;
export type InsertStructure = z.infer<typeof insertStructureSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type StructureDepartment = typeof structureDepartments.$inferSelect;
export type InsertStructureDepartment = z.infer<typeof insertStructureDepartmentSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type InsertAnnouncementRead = z.infer<typeof insertAnnouncementReadSchema>;
export type FinancialProfile = typeof financialProfiles.$inferSelect;
export type InsertFinancialProfile = z.infer<typeof insertFinancialProfileSchema>;
export type FinancialParameter = typeof financialParameters.$inferSelect;
export type InsertFinancialParameter = z.infer<typeof insertFinancialParameterSchema>;
export type StaffRoleCost = typeof staffRolesCosts.$inferSelect;
export type InsertStaffRoleCost = z.infer<typeof insertStaffRoleCostSchema>;
export type RevenueModel = typeof revenueModels.$inferSelect;
export type InsertRevenueModel = z.infer<typeof insertRevenueModelSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractVehicle = typeof contractVehicles.$inferSelect;
export type InsertContractVehicle = z.infer<typeof insertContractVehicleSchema>;
export type ScheduledService = typeof scheduledServices.$inferSelect;
export type InsertScheduledService = z.infer<typeof insertScheduledServiceSchema>;

// ============================================
// CHECKLIST PRE-PARTENZA
// ============================================

// Template items for checklist (managed by admin)
// Zone types: CONTROLLI_AUTISTA, MATERIALE_ZAINO, MATERIALE_AMBULANZA, MATERIALE_VARIO
export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  category: text("category").notNull(),            // Main zone (Controlli Autista, Materiale Zaino, etc.)
  subZone: text("sub_zone"),                       // Sub-zone (Parametri, Scomparto 1, etc.)
  description: text("description"),
  quantity: integer("quantity").default(1),        // Required quantity
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  hasExpiry: boolean("has_expiry").default(false), // Has expiration date?
  expiryDate: date("expiry_date"),                 // Current expiration date
  expiryAlertDays: integer("expiry_alert_days").default(30), // Days before expiry to alert
  zoneColor: text("zone_color"),                   // Color code for zone (#FFA500, #00A651, etc.)
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Completed checklists (submitted by crew)
export const vehicleChecklists = pgTable("vehicle_checklists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  locationId: varchar("location_id"),
  
  // Crew signature
  submittedById: varchar("submitted_by_id").notNull(),
  submittedByName: text("submitted_by_name").notNull(),
  
  // Timing
  shiftDate: date("shift_date").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  
  // Checklist data (JSON array of item responses)
  items: jsonb("items").notNull(), // [{itemId, label, category, checked, notes}]
  
  // Anomalies and notes
  hasAnomalies: boolean("has_anomalies").default(false),
  anomalyDescription: text("anomaly_description"),
  generalNotes: text("general_notes"),
  
  // PDF report tracking
  monthlyReportSent: boolean("monthly_report_sent").default(false),
  monthlyReportSentAt: timestamp("monthly_report_sent_at"),
  
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const vehicleChecklistsRelations = relations(vehicleChecklists, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleChecklists.vehicleId],
    references: [vehicles.id],
  }),
  location: one(locations, {
    fields: [vehicleChecklists.locationId],
    references: [locations.id],
  }),
  submittedBy: one(users, {
    fields: [vehicleChecklists.submittedById],
    references: [users.id],
  }),
}));

export const insertChecklistTemplateItemSchema = createInsertSchema(checklistTemplateItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleChecklistSchema = createInsertSchema(vehicleChecklists).omit({
  id: true,
  createdAt: true,
  monthlyReportSent: true,
  monthlyReportSentAt: true,
});

export type ChecklistTemplateItem = typeof checklistTemplateItems.$inferSelect;
export type InsertChecklistTemplateItem = z.infer<typeof insertChecklistTemplateItemSchema>;
export type VehicleChecklist = typeof vehicleChecklists.$inferSelect;
export type InsertVehicleChecklist = z.infer<typeof insertVehicleChecklistSchema>;

// Checklist photo reports (crew photos of damage, issues, etc.)
export const checklistPhotos = pgTable("checklist_photos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  locationId: varchar("location_id"),
  checklistId: varchar("checklist_id"),
  submittedById: varchar("submitted_by_id").notNull(),
  submittedByName: text("submitted_by_name").notNull(),
  description: text("description"),
  photoData: text("photo_data").notNull(),
  photoMimeType: text("photo_mime_type").default("image/jpeg"),
  isRead: boolean("is_read").default(false),
  isResolved: boolean("is_resolved").default(false),
  resolvedByName: text("resolved_by_name"),
  resolvedAt: timestamp("resolved_at"),
  resolvedNotes: text("resolved_notes"),
  readByName: text("read_by_name"),
  readAt: timestamp("read_at"),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const checklistPhotosRelations = relations(checklistPhotos, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [checklistPhotos.vehicleId],
    references: [vehicles.id],
  }),
  submittedBy: one(users, {
    fields: [checklistPhotos.submittedById],
    references: [users.id],
  }),
}));

export type ChecklistPhoto = typeof checklistPhotos.$inferSelect;

export const photoReportMessages = pgTable("photo_report_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  photoReportId: varchar("photo_report_id").notNull(),
  senderType: text("sender_type").notNull(),
  senderName: text("sender_name").notNull(),
  senderId: varchar("sender_id").notNull(),
  message: text("message").notNull(),
  isReadByCrew: boolean("is_read_by_crew").default(false),
  isReadByAdmin: boolean("is_read_by_admin").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const photoReportMessagesRelations = relations(photoReportMessages, ({ one }) => ({
  photoReport: one(checklistPhotos, {
    fields: [photoReportMessages.photoReportId],
    references: [checklistPhotos.id],
  }),
}));

export type PhotoReportMessage = typeof photoReportMessages.$inferSelect;

// Expiry correction requests from crew to coordinator
export const expiryCorrectionRequests = pgTable("expiry_correction_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull(),              // Reference to checklist_template_items
  itemLabel: text("item_label").notNull(),           // Cached item name
  vehicleId: varchar("vehicle_id").notNull(),        // Vehicle where issue was found
  vehicleCode: text("vehicle_code").notNull(),       // Cached vehicle code
  locationId: varchar("location_id"),
  requestedById: varchar("requested_by_id").notNull(),
  requestedByName: text("requested_by_name").notNull(),
  currentExpiryDate: date("current_expiry_date"),    // What the system shows
  suggestedExpiryDate: date("suggested_expiry_date"), // What crew thinks it should be
  notes: text("notes"),                               // Explanation
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  resolvedById: varchar("resolved_by_id"),
  resolvedByName: text("resolved_by_name"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExpiryCorrectionRequestSchema = createInsertSchema(expiryCorrectionRequests).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type ExpiryCorrectionRequest = typeof expiryCorrectionRequests.$inferSelect;
export type InsertExpiryCorrectionRequest = z.infer<typeof insertExpiryCorrectionRequestSchema>;

// Material Restoration History - tracks when expired materials are restored
export const materialRestorations = pgTable("material_restorations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull(),
  itemLabel: text("item_label").notNull(),
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  oldExpiryDate: date("old_expiry_date"),
  newExpiryDate: date("new_expiry_date").notNull(),
  restoredById: varchar("restored_by_id"),
  restoredByName: text("restored_by_name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMaterialRestorationSchema = createInsertSchema(materialRestorations).omit({
  id: true,
  createdAt: true,
});

export type MaterialRestoration = typeof materialRestorations.$inferSelect;
export type InsertMaterialRestoration = z.infer<typeof insertMaterialRestorationSchema>;

// Chat Interna - Global chat for all vehicles and locations
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Sender info
  senderId: varchar("sender_id").notNull(), // user id
  senderName: text("sender_name").notNull(),
  senderVehicleId: varchar("sender_vehicle_id"), // optional: vehicle if sent from mobile
  senderVehicleCode: text("sender_vehicle_code"), // e.g., "J 30"
  senderLocationId: varchar("sender_location_id"), // sender's location
  senderLocationName: text("sender_location_name"),
  
  // Message content
  message: text("message").notNull(),
  messageType: text("message_type").default("text").notNull(), // text, image, alert, system
  
  // Priority/importance
  isPriority: boolean("is_priority").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [chatMessages.senderVehicleId],
    references: [vehicles.id],
  }),
  location: one(locations, {
    fields: [chatMessages.senderLocationId],
    references: [locations.id],
  }),
}));

// Track read status per user
export const chatMessageReads = pgTable("chat_message_reads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull(),
  userId: varchar("user_id").notNull(),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export const chatMessageReadsRelations = relations(chatMessageReads, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatMessageReads.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [chatMessageReads.userId],
    references: [users.id],
  }),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessageRead = typeof chatMessageReads.$inferSelect;

// ============================================================================
// ENTERPRISE COMPLIANCE SYSTEM - AUDIT TRAIL & GDPR
// ============================================================================

// Enum for audit action types
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "read", 
  "update",
  "delete",
  "login",
  "logout",
  "export",
  "consent_granted",
  "consent_revoked",
  "data_export_requested",
  "data_erasure_requested",
  "password_change",
  "role_change",
  "vehicle_access",
  "trip_submit",
  "checklist_submit",
  "chat_message",
]);

// Enum for actor types
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "vehicle", 
  "system",
  "admin",
]);

// Enum for consent types
export const consentTypeEnum = pgEnum("consent_type", [
  "privacy_policy",
  "terms_of_service",
  "data_processing",
  "marketing_communications",
  "analytics_tracking",
  "location_tracking",
]);

// Enum for consent status
export const consentStatusEnum = pgEnum("consent_status", [
  "granted",
  "revoked",
  "pending",
  "expired",
]);

// Enum for GDPR request status
export const gdprRequestStatusEnum = pgEnum("gdpr_request_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// Enum for GDPR request types
export const gdprRequestTypeEnum = pgEnum("gdpr_request_type", [
  "data_export",
  "data_erasure",
  "data_rectification",
  "processing_restriction",
]);

// ============================================================================
// AUDIT TRAIL TABLES
// ============================================================================

// Main audit log entries table - immutable append-only log
export const auditLogEntries = pgTable("audit_log_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Timestamp with high precision
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  
  // Actor information
  actorType: auditActorTypeEnum("actor_type").notNull(),
  actorId: varchar("actor_id"), // user id, vehicle id, or null for system
  actorName: text("actor_name"), // readable name at time of action
  actorEmail: text("actor_email"), // email at time of action
  
  // Session and device info
  sessionId: varchar("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceInfo: text("device_info"), // mobile device info
  
  // Location context
  locationId: varchar("location_id"),
  locationName: text("location_name"),
  vehicleId: varchar("vehicle_id"),
  vehicleCode: text("vehicle_code"),
  
  // Action details
  action: auditActionEnum("action").notNull(),
  entityType: text("entity_type").notNull(), // user, trip, vehicle, checklist, etc.
  entityId: varchar("entity_id"), // ID of affected entity
  entityName: text("entity_name"), // readable name of affected entity
  
  // Change tracking
  previousValue: jsonb("previous_value"), // JSON of previous state
  newValue: jsonb("new_value"), // JSON of new state
  changedFields: jsonb("changed_fields"), // array of field names that changed
  
  // Additional context
  description: text("description"), // human-readable description
  metadata: jsonb("metadata"), // additional context data
  
  // Integrity
  entryHash: text("entry_hash").notNull(), // SHA-256 hash of entry
  previousHash: text("previous_hash"), // hash of previous entry (chain)
  
  // Compliance flags
  isSensitive: boolean("is_sensitive").default(false), // PII/sensitive data access
  isCompliance: boolean("is_compliance").default(false), // compliance-related action
  retentionYears: integer("retention_years").default(10), // how long to keep
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Hash chain verification table - stores periodic chain integrity proofs
export const auditHashChainVerifications = pgTable("audit_hash_chain_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Range of entries verified
  startEntryId: varchar("start_entry_id").notNull(),
  endEntryId: varchar("end_entry_id").notNull(),
  entriesCount: integer("entries_count").notNull(),
  
  // Verification result
  isValid: boolean("is_valid").notNull(),
  rootHash: text("root_hash").notNull(), // Merkle root of all entries in range
  
  // Verification metadata
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  verifiedBy: varchar("verified_by"), // system or admin user id
  verificationMethod: text("verification_method").default("sha256_chain"),
  
  // Any issues found
  issues: jsonb("issues"), // array of any integrity issues
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit retention policies
export const auditRetentionPolicies = pgTable("audit_retention_policies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // What this policy applies to
  entityType: text("entity_type"), // null = all entities
  actionType: text("action_type"), // null = all actions
  
  // Retention settings
  retentionYears: integer("retention_years").notNull().default(10),
  archiveAfterYears: integer("archive_after_years").default(5),
  
  // Legal basis
  legalBasis: text("legal_basis"), // GDPR article, regulation, etc.
  regulatoryRequirement: text("regulatory_requirement"),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// GDPR COMPLIANCE TABLES
// ============================================================================

// Privacy policies with versioning
export const privacyPolicies = pgTable("privacy_policies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  version: text("version").notNull().unique(), // e.g., "1.0", "1.1", "2.0"
  title: text("title").notNull(),
  
  // Content
  content: text("content").notNull(), // full policy text (markdown)
  contentHash: text("content_hash").notNull(), // SHA-256 of content for integrity
  summary: text("summary"), // short summary for users
  
  // Dates
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  // Languages
  language: text("language").default("it").notNull(), // ISO 639-1 code
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isRequired: boolean("is_required").default(true).notNull(), // must accept to use app
  
  // Legal
  legalBasis: text("legal_basis"), // GDPR article reference
  dataProcessingPurposes: jsonb("data_processing_purposes"), // array of purposes
  dataCategories: jsonb("data_categories"), // what data is collected
  dataRetentionPeriod: text("data_retention_period"),
  thirdPartyRecipients: jsonb("third_party_recipients"), // who data is shared with
  
  // Metadata
  publishedBy: varchar("published_by"),
  approvedBy: varchar("approved_by"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User consents - tracks all consent decisions
export const userConsents = pgTable("user_consents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull(),
  
  // What they're consenting to
  consentType: consentTypeEnum("consent_type").notNull(),
  policyId: varchar("policy_id"), // reference to privacy_policies
  policyVersion: text("policy_version"),
  
  // Consent status
  status: consentStatusEnum("status").notNull(),
  
  // When consent was given/revoked
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  // How consent was obtained
  consentMethod: text("consent_method").notNull(), // app_checkbox, explicit_action, implied
  consentSource: text("consent_source").notNull(), // mobile_app, web_admin, api
  
  // Device/session info at time of consent
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceId: text("device_id"),
  
  // Audit trail
  consentText: text("consent_text"), // exact text user agreed to
  consentChecksum: text("consent_checksum"), // hash of consent text
  
  // Additional metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// GDPR data access/export requests (Right to Access - Article 15)
export const gdprDataExports = pgTable("gdpr_data_exports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull(),
  
  // Request details
  requestType: gdprRequestTypeEnum("request_type").notNull().default("data_export"),
  status: gdprRequestStatusEnum("status").notNull().default("pending"),
  
  // Timing (GDPR requires response within 30 days)
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dueBy: timestamp("due_by", { withTimezone: true }).notNull(), // 30 days from request
  
  // Request metadata
  requestMethod: text("request_method").notNull(), // mobile_app, email, written
  requestIpAddress: text("request_ip_address"),
  requestUserAgent: text("request_user_agent"),
  
  // Identity verification
  identityVerified: boolean("identity_verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: varchar("verified_by"),
  verificationMethod: text("verification_method"),
  
  // Export details
  dataCategories: jsonb("data_categories"), // what data to include
  exportFormat: text("export_format").default("json"), // json, csv, pdf
  
  // Generated export
  exportFilePath: text("export_file_path"),
  exportFileHash: text("export_file_hash"), // SHA-256 for integrity
  exportFileSize: integer("export_file_size"),
  exportGeneratedAt: timestamp("export_generated_at", { withTimezone: true }),
  
  // Download access
  downloadToken: text("download_token"), // secure token for download
  downloadTokenExpiresAt: timestamp("download_token_expires_at", { withTimezone: true }),
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true }),
  
  // Processing info
  processedBy: varchar("processed_by"),
  processingNotes: text("processing_notes"),
  errorMessage: text("error_message"),
  
  // Audit
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// GDPR erasure requests (Right to Erasure - Article 17)
export const gdprErasureRequests = pgTable("gdpr_erasure_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull(),
  
  // Person identity (for vehicle-based accounts where user != person)
  requesterFullName: text("requester_full_name"), // Nome e cognome della persona che richiede
  
  // Request details
  status: gdprRequestStatusEnum("status").notNull().default("pending"),
  erasureScope: text("erasure_scope").notNull().default("full"), // full, partial
  
  // Timing
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dueBy: timestamp("due_by", { withTimezone: true }).notNull(),
  
  // Request metadata
  requestMethod: text("request_method").notNull(),
  requestReason: text("request_reason"),
  requestIpAddress: text("request_ip_address"),
  
  // Identity verification
  identityVerified: boolean("identity_verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: varchar("verified_by"),
  
  // What to erase
  dataCategoriesToErase: jsonb("data_categories_to_erase"),
  excludedCategories: jsonb("excluded_categories"), // data that must be retained
  retentionReasons: jsonb("retention_reasons"), // legal reasons for keeping some data
  
  // Anonymization instead of deletion (for audit trail integrity)
  useAnonymization: boolean("use_anonymization").default(true),
  anonymizationMap: jsonb("anonymization_map"), // encrypted mapping for reversibility
  
  // Processing
  processedBy: varchar("processed_by"),
  processingNotes: text("processing_notes"),
  errorMessage: text("error_message"),
  
  // Confirmation
  confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
  confirmationMethod: text("confirmation_method"),
  
  // Audit trail (kept even after erasure)
  erasureLog: jsonb("erasure_log"), // what was erased/anonymized
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Processing Agreements (DPA) tracking
export const dataProcessingAgreements = pgTable("data_processing_agreements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Third party info
  processorName: text("processor_name").notNull(),
  processorType: text("processor_type").notNull(), // cloud_provider, analytics, etc.
  processorContact: text("processor_contact"),
  processorAddress: text("processor_address"),
  processorCountry: text("processor_country"),
  
  // Agreement details
  agreementNumber: text("agreement_number"),
  agreementDate: date("agreement_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  renewalDate: date("renewal_date"),
  
  // What data is shared
  dataCategories: jsonb("data_categories").notNull(),
  processingPurposes: jsonb("processing_purposes").notNull(),
  
  // Legal basis
  legalBasis: text("legal_basis"),
  transferMechanism: text("transfer_mechanism"), // SCCs, adequacy decision, etc.
  
  // Documents
  documentPath: text("document_path"),
  documentHash: text("document_hash"),
  
  // Status
  status: text("status").default("active").notNull(), // active, expired, terminated
  
  // Compliance checks
  lastAuditDate: date("last_audit_date"),
  nextAuditDate: date("next_audit_date"),
  auditNotes: text("audit_notes"),
  
  // Sub-processors
  hasSubProcessors: boolean("has_sub_processors").default(false),
  subProcessors: jsonb("sub_processors"), // list of sub-processors
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Security incidents (for breach notification)
export const securityIncidents = pgTable("security_incidents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Incident classification
  incidentType: text("incident_type").notNull(), // data_breach, unauthorized_access, etc.
  severity: text("severity").notNull(), // low, medium, high, critical
  
  // Detection
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  detectedBy: varchar("detected_by"),
  detectionMethod: text("detection_method"),
  
  // Description
  title: text("title").notNull(),
  description: text("description").notNull(),
  affectedSystems: jsonb("affected_systems"),
  affectedDataCategories: jsonb("affected_data_categories"),
  
  // Impact assessment
  affectedUsersCount: integer("affected_users_count"),
  affectedUsersNotified: boolean("affected_users_notified").default(false),
  usersNotifiedAt: timestamp("users_notified_at", { withTimezone: true }),
  
  // Data Protection Authority notification (required within 72 hours for breaches)
  dpaNotificationRequired: boolean("dpa_notification_required").default(false),
  dpaNotifiedAt: timestamp("dpa_notified_at", { withTimezone: true }),
  dpaNotificationReference: text("dpa_notification_reference"),
  
  // Resolution
  status: text("status").default("open").notNull(), // open, investigating, contained, resolved
  containedAt: timestamp("contained_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  
  // Root cause and remediation
  rootCause: text("root_cause"),
  remediationSteps: jsonb("remediation_steps"),
  preventiveMeasures: jsonb("preventive_measures"),
  
  // Documentation
  incidentReportPath: text("incident_report_path"),
  
  // Assigned personnel
  assignedTo: varchar("assigned_to"),
  reviewedBy: varchar("reviewed_by"),
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// COMPLIANCE RELATIONS
// ============================================================================

export const auditLogEntriesRelations = relations(auditLogEntries, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogEntries.actorId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [auditLogEntries.locationId],
    references: [locations.id],
  }),
  vehicle: one(vehicles, {
    fields: [auditLogEntries.vehicleId],
    references: [vehicles.id],
  }),
}));

export const userConsentsRelations = relations(userConsents, ({ one }) => ({
  user: one(users, {
    fields: [userConsents.userId],
    references: [users.id],
  }),
  policy: one(privacyPolicies, {
    fields: [userConsents.policyId],
    references: [privacyPolicies.id],
  }),
}));

export const gdprDataExportsRelations = relations(gdprDataExports, ({ one }) => ({
  user: one(users, {
    fields: [gdprDataExports.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [gdprDataExports.processedBy],
    references: [users.id],
  }),
}));

export const gdprErasureRequestsRelations = relations(gdprErasureRequests, ({ one }) => ({
  user: one(users, {
    fields: [gdprErasureRequests.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [gdprErasureRequests.processedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// COMPLIANCE SCHEMAS AND TYPES
// ============================================================================

export const insertAuditLogEntrySchema = createInsertSchema(auditLogEntries).omit({
  id: true,
  createdAt: true,
});

export const insertPrivacyPolicySchema = createInsertSchema(privacyPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprDataExportSchema = createInsertSchema(gdprDataExports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprErasureRequestSchema = createInsertSchema(gdprErasureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecurityIncidentSchema = createInsertSchema(securityIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AuditLogEntry = typeof auditLogEntries.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogEntrySchema>;
export type AuditHashChainVerification = typeof auditHashChainVerifications.$inferSelect;
export type AuditRetentionPolicy = typeof auditRetentionPolicies.$inferSelect;
export type PrivacyPolicy = typeof privacyPolicies.$inferSelect;
export type InsertPrivacyPolicy = z.infer<typeof insertPrivacyPolicySchema>;
export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;
export type GdprDataExport = typeof gdprDataExports.$inferSelect;
export type InsertGdprDataExport = z.infer<typeof insertGdprDataExportSchema>;
export type GdprErasureRequest = typeof gdprErasureRequests.$inferSelect;
export type InsertGdprErasureRequest = z.infer<typeof insertGdprErasureRequestSchema>;
export type DataProcessingAgreement = typeof dataProcessingAgreements.$inferSelect;
export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type InsertSecurityIncident = z.infer<typeof insertSecurityIncidentSchema>;

// ============================================================================
// SLA MONITORING & UPTIME TRACKING
// ============================================================================

export const slaMetricTypeEnum = pgEnum("sla_metric_type", [
  "uptime",
  "response_time",
  "error_rate",
  "throughput",
  "availability",
]);

export const slaMetrics = pgTable("sla_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricType: slaMetricTypeEnum("metric_type").notNull(),
  serviceName: text("service_name").notNull(), // api, database, frontend
  value: real("value").notNull(), // valore numerico della metrica
  unit: text("unit").notNull(), // ms, percent, count
  period: text("period").notNull(), // hourly, daily, weekly, monthly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  metadata: jsonb("metadata"), // dati aggiuntivi
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const healthCheckStatusEnum = pgEnum("health_check_status", [
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
]);

export const healthCheckLogs = pgTable("health_check_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(), // api, database, cache, external
  endpoint: text("endpoint"), // endpoint controllato
  status: healthCheckStatusEnum("status").notNull(),
  responseTimeMs: integer("response_time_ms"), // tempo risposta in ms
  statusCode: integer("status_code"), // HTTP status code
  errorMessage: text("error_message"), // messaggio errore se fallito
  metadata: jsonb("metadata"), // dati aggiuntivi (headers, body)
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const slaTargets = pgTable("sla_targets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(),
  metricType: slaMetricTypeEnum("metric_type").notNull(),
  targetValue: real("target_value").notNull(), // valore target (es. 99.9 per uptime)
  warningThreshold: real("warning_threshold"), // soglia warning
  criticalThreshold: real("critical_threshold"), // soglia critica
  period: text("period").notNull().default("monthly"), // periodo di valutazione
  isActive: boolean("is_active").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const slaBreaches = pgTable("sla_breaches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slaTargetId: varchar("sla_target_id").notNull(),
  serviceName: text("service_name").notNull(),
  metricType: slaMetricTypeEnum("metric_type").notNull(),
  targetValue: real("target_value").notNull(),
  actualValue: real("actual_value").notNull(),
  breachSeverity: text("breach_severity").notNull(), // warning, critical
  period: text("period").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// SLA CONFIGURATIONS (flexible per-contract SLA metrics)
// ============================================================================

export const slaConfigurations = pgTable("sla_configurations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  contractRef: varchar("contract_ref"),
  contractName: varchar("contract_name").notNull().default("Contratto Standard"),
  metricKey: varchar("metric_key").notNull(),
  metricCategory: varchar("metric_category").notNull().default("operative"),
  metricLabel: varchar("metric_label").notNull(),
  thresholdValue: real("threshold_value").notNull(),
  thresholdUnit: varchar("threshold_unit").notNull().default("minutes"),
  severity: varchar("severity").notNull().default("minor"),
  penaltyType: varchar("penalty_type").notNull().default("none"),
  penaltyValue: real("penalty_value").default(0),
  active: boolean("active").default(true),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SlaConfiguration = typeof slaConfigurations.$inferSelect;

// ============================================================================
// BACKUP & DISASTER RECOVERY
// ============================================================================

export const backupTypeEnum = pgEnum("backup_type", [
  "full",
  "incremental",
  "differential",
  "snapshot",
]);

export const backupStatusEnum = pgEnum("backup_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "verified",
  "expired",
]);

export const systemBackups = pgTable("system_backups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  backupType: backupTypeEnum("backup_type").notNull(),
  status: backupStatusEnum("status").notNull().default("pending"),
  sourceName: text("source_name").notNull(), // database, files, config
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileSizeBytes: integer("file_size_bytes"),
  checksum: text("checksum"), // SHA-256 del backup
  encryptionKey: text("encryption_key"), // riferimento alla chiave (non la chiave stessa)
  isEncrypted: boolean("is_encrypted").default(true).notNull(),
  retentionDays: integer("retention_days").default(30).notNull(),
  expiresAt: timestamp("expires_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // tabelle incluse, record count, etc.
  verifiedAt: timestamp("verified_at"),
  verificationResult: text("verification_result"),
  createdBy: varchar("created_by"), // system o user id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const backupPolicies = pgTable("backup_policies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sourceName: text("source_name").notNull(), // database, files
  backupType: backupTypeEnum("backup_type").notNull(),
  scheduleType: text("schedule_type").notNull(), // hourly, daily, weekly, monthly
  scheduleCron: text("schedule_cron"), // espressione cron
  retentionDays: integer("retention_days").notNull().default(30),
  retentionCopies: integer("retention_copies").default(7), // numero minimo copie
  isEncrypted: boolean("is_encrypted").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recoveryTests = pgTable("recovery_tests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  backupId: varchar("backup_id").notNull(),
  testType: text("test_type").notNull(), // restore_verify, integrity_check, full_restore
  status: text("status").notNull(), // pending, running, passed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  resultSummary: text("result_summary"),
  resultDetails: jsonb("result_details"),
  testedBy: varchar("tested_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const slaBreachesRelations = relations(slaBreaches, ({ one }) => ({
  slaTarget: one(slaTargets, {
    fields: [slaBreaches.slaTargetId],
    references: [slaTargets.id],
  }),
}));

export const recoveryTestsRelations = relations(recoveryTests, ({ one }) => ({
  backup: one(systemBackups, {
    fields: [recoveryTests.backupId],
    references: [systemBackups.id],
  }),
}));

// Schemas and Types
export const insertSlaMetricSchema = createInsertSchema(slaMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertHealthCheckLogSchema = createInsertSchema(healthCheckLogs).omit({
  id: true,
  checkedAt: true,
});

export const insertSlaTargetSchema = createInsertSchema(slaTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemBackupSchema = createInsertSchema(systemBackups).omit({
  id: true,
  createdAt: true,
});

export const insertBackupPolicySchema = createInsertSchema(backupPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SlaMetric = typeof slaMetrics.$inferSelect;
export type InsertSlaMetric = z.infer<typeof insertSlaMetricSchema>;
export type HealthCheckLog = typeof healthCheckLogs.$inferSelect;
export type InsertHealthCheckLog = z.infer<typeof insertHealthCheckLogSchema>;
export type SlaTarget = typeof slaTargets.$inferSelect;
export type InsertSlaTarget = z.infer<typeof insertSlaTargetSchema>;
export type SlaBreach = typeof slaBreaches.$inferSelect;
export type SystemBackup = typeof systemBackups.$inferSelect;
export type InsertSystemBackup = z.infer<typeof insertSystemBackupSchema>;
export type BackupPolicy = typeof backupPolicies.$inferSelect;
export type InsertBackupPolicy = z.infer<typeof insertBackupPolicySchema>;
export type RecoveryTest = typeof recoveryTests.$inferSelect;

// ============================================================================
// INVENTORY MANAGEMENT SYSTEM
// Sistema Gestione Inventario Ambulanza & Magazzino
// ============================================================================

// Enum for vehicle type (MSB/MSI)
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "MSB",   // Mezzo di Soccorso Base
  "MSI"    // Mezzo di Soccorso Infermierizzato
]);

// Enum for inventory template type
export const templateTypeEnum = pgEnum("template_type", [
  "MSB",     // Template per ambulanze base
  "MSI",     // Template per ambulanze infermierizzate
  "EVENT"    // Template per eventi sportivi
]);

// Enum for inventory item categories
export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "presidi",           // Presidi sanitari (barella, carrozzina, etc.)
  "farmaci",           // Farmaci e soluzioni
  "medicazione",       // Materiale per medicazione
  "rianimazione",      // Attrezzature rianimazione (DAE, etc.)
  "immobilizzazione",  // Collari, tavole spinali, etc.
  "protezione",        // DPI, guanti, mascherine
  "fluidi",            // Fisiologiche, ringer, etc.
  "strumentazione",    // Sfigmomanometri, saturimetri, etc.
  "altro"              // Altro materiale
]);

// Enum for inventory item status
export const inventoryStatusEnum = pgEnum("inventory_status", [
  "disponibile",
  "in_uso",
  "scaduto",
  "danneggiato",
  "da_ordinare"
]);

// Master catalog of inventory items
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),                    // Nome articolo
  description: text("description"),                 // Descrizione dettagliata
  category: inventoryCategoryEnum("category").notNull(),
  sku: text("sku"),                                 // Codice articolo interno
  barcode: text("barcode"),                         // Codice a barre/QR
  unit: text("unit").notNull().default("pz"),       // Unità di misura (pz, ml, conf, etc.)
  minStockLevel: integer("min_stock_level").default(5),  // Soglia minima alert
  hasExpiry: boolean("has_expiry").default(false),  // Ha scadenza?
  expiryAlertDays: integer("expiry_alert_days").default(30), // Giorni preavviso scadenza
  expiryDate: date("expiry_date"),                   // Data scadenza corrente del lotto
  isActive: boolean("is_active").default(true).notNull(),
  imageUrl: text("image_url"),                      // Foto articolo
  notes: text("notes"),                             // Note aggiuntive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Standard inventory template for vehicle types (MSB, MSI, EVENT)
export const vehicleInventoryTemplates = pgTable("vehicle_inventory_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),                    // Nome template (es. "MSB Standard", "MSI Completo")
  description: text("description"),
  templateType: templateTypeEnum("template_type").notNull().default("MSB"),
  version: integer("version").default(1),          // Versione template per tracking modifiche
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Items in each template with required quantities
export const templateItems = pgTable("template_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  itemId: varchar("item_id").notNull(),
  requiredQuantity: integer("required_quantity").notNull().default(1),
  minQuantity: integer("min_quantity").default(1),   // Minimo per partenza
  isEssential: boolean("is_essential").default(true), // Obbligatorio per partenza
  sortOrder: integer("sort_order").default(0),       // Ordinamento visualizzazione
  notes: text("notes"),                              // Note specifiche template
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vehicle template assignment - associa template a veicoli
export const vehicleTemplateAssignments = pgTable("vehicle_template_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  templateId: varchar("template_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  status: text("status").default("active"),          // active, inactive
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// SPORTING EVENTS INVENTORY MANAGEMENT
// Gestione Inventario Eventi Sportivi
// ============================================================================

// Sporting events tracking
export const sportingEvents = pgTable("sporting_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),                      // Nome evento (es. "Partita Juventus-Milan")
  eventType: text("event_type").notNull(),           // calcio, basket, ciclismo, maratona, etc.
  location: text("location").notNull(),              // Luogo evento
  address: text("address"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  expectedAttendees: integer("expected_attendees"),  // Partecipanti previsti
  vehicleId: varchar("vehicle_id"),                  // Veicolo assegnato
  coordinatorId: varchar("coordinator_id"),          // Responsabile evento
  templateId: varchar("template_id"),                // Template inventario evento
  status: text("status").default("planned"),         // planned, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Event inventory checkout/checkin log
export const eventInventoryLog = pgTable("event_inventory_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  itemId: varchar("item_id").notNull(),
  quantityOut: integer("quantity_out").notNull().default(0),    // Uscito dal magazzino
  quantityReturned: integer("quantity_returned").default(0),    // Rientrato
  quantityUsed: integer("quantity_used").default(0),            // Usato (non rientra)
  varianceReason: text("variance_reason"),                      // Motivazione differenza
  checkedOutAt: timestamp("checked_out_at"),
  checkedOutBy: varchar("checked_out_by"),
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: varchar("checked_in_by"),
  expiryDate: date("expiry_date"),
  lotNumber: text("lot_number"),
  barcodeScanData: text("barcode_scan_data"),
  status: text("status").default("checked_out"),                // checked_out, partial_return, returned
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Current inventory on each vehicle
export const vehicleInventory = pgTable("vehicle_inventory", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  itemId: varchar("item_id").notNull(),
  currentQuantity: integer("current_quantity").notNull().default(0),
  requiredQuantity: integer("required_quantity").notNull().default(1),
  expiryDate: date("expiry_date"),                 // Data scadenza se applicabile
  lotNumber: text("lot_number"),                   // Numero lotto
  lastCheckedAt: timestamp("last_checked_at"),     // Ultima verifica
  lastCheckedBy: varchar("last_checked_by"),       // Chi ha verificato
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Warehouse stock per location
export const warehouseStock = pgTable("warehouse_stock", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  itemId: varchar("item_id").notNull(),
  quantity: integer("quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").default(10), // Soglia riordino magazzino
  shelfLocation: text("shelf_location"),           // Posizione scaffale (es. "A-3-2")
  lastRestockedAt: timestamp("last_restocked_at"),
  lastRestockedBy: varchar("last_restocked_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Log of inventory usage during shifts
export const inventoryUsage = pgTable("inventory_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  itemId: varchar("item_id").notNull(),
  userId: varchar("user_id").notNull(),            // Chi ha usato
  tripId: varchar("trip_id"),                      // Viaggio associato (opzionale)
  quantity: integer("quantity").notNull().default(1),
  reason: text("reason"),                          // Motivo utilizzo
  usedAt: timestamp("used_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Log of replenishment from warehouse
export const inventoryReplenish = pgTable("inventory_replenish", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  itemId: varchar("item_id").notNull(),
  warehouseStockId: varchar("warehouse_stock_id"), // Da quale magazzino
  locationId: varchar("location_id").notNull(),
  userId: varchar("user_id").notNull(),            // Chi ha ripristinato
  quantity: integer("quantity").notNull().default(1),
  barcodeScanData: text("barcode_scan_data"),      // Dati scansione barcode
  expiryDate: date("expiry_date"),                 // Scadenza nuovo materiale
  lotNumber: text("lot_number"),                   // Lotto nuovo materiale
  replenishedAt: timestamp("replenished_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Expiry alerts tracking
export const inventoryExpiryAlerts = pgTable("inventory_expiry_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleInventoryId: varchar("vehicle_inventory_id"),
  warehouseStockId: varchar("warehouse_stock_id"),
  itemId: varchar("item_id").notNull(),
  expiryDate: date("expiry_date").notNull(),
  alertType: text("alert_type").notNull(),         // warning, critical, expired
  isAcknowledged: boolean("is_acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for inventory
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInventorySchema = createInsertSchema(vehicleInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarehouseStockSchema = createInsertSchema(warehouseStock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryUsageSchema = createInsertSchema(inventoryUsage).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryReplenishSchema = createInsertSchema(inventoryReplenish).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for template assignment
export const insertVehicleTemplateAssignmentSchema = createInsertSchema(vehicleTemplateAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleInventoryTemplateSchema = createInsertSchema(vehicleInventoryTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateItemSchema = createInsertSchema(templateItems).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for sporting events
export const insertSportingEventSchema = createInsertSchema(sportingEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventInventoryLogSchema = createInsertSchema(eventInventoryLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types for inventory
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type VehicleInventory = typeof vehicleInventory.$inferSelect;
export type InsertVehicleInventory = z.infer<typeof insertVehicleInventorySchema>;
export type WarehouseStock = typeof warehouseStock.$inferSelect;
export type InsertWarehouseStock = z.infer<typeof insertWarehouseStockSchema>;
export type InventoryUsage = typeof inventoryUsage.$inferSelect;
export type InsertInventoryUsage = z.infer<typeof insertInventoryUsageSchema>;
export type InventoryReplenish = typeof inventoryReplenish.$inferSelect;
export type InsertInventoryReplenish = z.infer<typeof insertInventoryReplenishSchema>;
export type VehicleInventoryTemplate = typeof vehicleInventoryTemplates.$inferSelect;
export type InsertVehicleInventoryTemplate = z.infer<typeof insertVehicleInventoryTemplateSchema>;
export type TemplateItem = typeof templateItems.$inferSelect;
export type InsertTemplateItem = z.infer<typeof insertTemplateItemSchema>;
export type VehicleTemplateAssignment = typeof vehicleTemplateAssignments.$inferSelect;
export type InsertVehicleTemplateAssignment = z.infer<typeof insertVehicleTemplateAssignmentSchema>;
export type InventoryExpiryAlert = typeof inventoryExpiryAlerts.$inferSelect;

// TypeScript types for sporting events
export type SportingEvent = typeof sportingEvents.$inferSelect;
export type InsertSportingEvent = z.infer<typeof insertSportingEventSchema>;
export type EventInventoryLog = typeof eventInventoryLog.$inferSelect;
export type InsertEventInventoryLog = z.infer<typeof insertEventInventoryLogSchema>;

// ============================================================================
// BARCODE PRODUCT CACHE
// Cache per lookup automatico prodotti da codici a barre
// ============================================================================

export const barcodeProductCache = pgTable("barcode_product_cache", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  barcode: text("barcode").notNull().unique(),       // Codice a barre EAN/UPC
  source: text("source").notNull(),                  // openfoodfacts, gs1, internal, manual
  productName: text("product_name"),                 // Nome prodotto
  description: text("description"),                   // Descrizione
  brand: text("brand"),                              // Marca
  manufacturer: text("manufacturer"),                // Produttore
  quantityPerPackage: integer("quantity_per_package"), // Pezzi per confezione
  packageSize: text("package_size"),                 // Dimensione confezione (es. "500ml")
  defaultUnit: text("default_unit"),                 // Unità default (pz, ml, conf)
  category: text("category"),                        // Categoria prodotto
  imageUrl: text("image_url"),                       // URL immagine
  hasExpiry: boolean("has_expiry").default(false),   // Tipicamente ha scadenza?
  defaultExpiryDays: integer("default_expiry_days"), // Giorni tipici di scadenza
  ingredients: text("ingredients"),                  // Ingredienti/composizione
  rawPayload: jsonb("raw_payload"),                  // Payload grezzo dall'API
  isVerified: boolean("is_verified").default(false), // Verificato manualmente
  lookupCount: integer("lookup_count").default(1),   // Numero di volte cercato
  lastLookupAt: timestamp("last_lookup_at").defaultNow(),
  expiresAt: timestamp("expires_at"),                // Quando rinnovare cache
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBarcodeProductCacheSchema = createInsertSchema(barcodeProductCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BarcodeProductCache = typeof barcodeProductCache.$inferSelect;
export type InsertBarcodeProductCache = z.infer<typeof insertBarcodeProductCacheSchema>;

// ============================================================================
// DATA QUALITY SYSTEM
// Sistema completo per monitoraggio qualità del dato
// ============================================================================

// Enum per stato anomalia
export const anomalyStatusEnum = pgEnum("anomaly_status", ["open", "resolved", "validated", "ignored"]);

// Enum per tipo anomalia  
export const anomalyTypeEnum = pgEnum("anomaly_type", [
  "km_invalid",           // km_finali < km_iniziali
  "time_invalid",         // ora_arrivo <= ora_partenza
  "duration_mismatch",    // durata incompatibile con km
  "no_departure",         // rientro senza partenza
  "overlap",              // sovrapposizione viaggi stesso veicolo
  "location_mismatch",    // veicolo non coerente con sede
  "km_regression",        // km regressivi nel tempo per veicolo
  "km_implausible",       // km fuori soglia ragionevole
  "duration_implausible", // durata fuori soglia
  "missing_required",     // campi obbligatori mancanti
  "late_entry"            // inserimento tardivo
]);

// Enum per entità monitorate
export const monitoredEntityEnum = pgEnum("monitored_entity", [
  "trip",
  "vehicle", 
  "user",
  "structure",
  "location"
]);

// Enum per stato tempestività
export const timelinessStatusEnum = pgEnum("timeliness_status", [
  "realtime",    // < 5 minuti
  "timely",      // 5-30 minuti
  "delayed",     // 30min - 2 ore
  "late"         // > 2 ore
]);

// Tabella anomalie rilevate
export const dataQualityAnomalies = pgTable("data_quality_anomalies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  entityType: monitoredEntityEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  anomalyType: anomalyTypeEnum("anomaly_type").notNull(),
  status: anomalyStatusEnum("status").default("open").notNull(),
  severity: text("severity").default("warning").notNull(), // info, warning, critical
  description: text("description").notNull(),
  details: jsonb("details"), // dettagli specifici dell'anomalia
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabella score qualità per record
export const dataQualityScores = pgTable("data_quality_scores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  entityType: monitoredEntityEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  completenessScore: integer("completeness_score").default(100), // 0-100
  coherenceScore: integer("coherence_score").default(100),       // 0-100
  timelinessScore: integer("timeliness_score").default(100),     // 0-100
  accuracyScore: integer("accuracy_score").default(100),         // 0-100
  overallScore: integer("overall_score").default(100),           // 0-100
  missingFields: jsonb("missing_fields"),     // array di campi mancanti
  timelinessStatus: timelinessStatusEnum("timeliness_status"),
  delayMinutes: integer("delay_minutes"),     // minuti di ritardo inserimento
  lastAnalyzedAt: timestamp("last_analyzed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabella storico score aggregati (snapshot giornalieri)
export const dataQualityHistory = pgTable("data_quality_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  snapshotDate: date("snapshot_date").notNull(),
  entityType: monitoredEntityEnum("entity_type"), // null = globale
  locationId: varchar("location_id"),             // null = tutte le sedi
  totalRecords: integer("total_records").default(0),
  completeRecords: integer("complete_records").default(0),
  incompleteRecords: integer("incomplete_records").default(0),
  anomalyCount: integer("anomaly_count").default(0),
  avgCompletenessScore: integer("avg_completeness_score"),
  avgCoherenceScore: integer("avg_coherence_score"),
  avgTimelinessScore: integer("avg_timeliness_score"),
  avgAccuracyScore: integer("avg_accuracy_score"),
  avgOverallScore: integer("avg_overall_score"),
  realtimePercent: integer("realtime_percent"),   // % inserimenti realtime
  latePercent: integer("late_percent"),           // % inserimenti tardivi
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Configurazione soglie qualità
export const dataQualityConfig = pgTable("data_quality_config", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  configKey: text("config_key").notNull().unique(),
  configValue: jsonb("config_value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas
export const insertDataQualityAnomalySchema = createInsertSchema(dataQualityAnomalies).omit({
  id: true,
  createdAt: true,
});

export const insertDataQualityScoreSchema = createInsertSchema(dataQualityScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataQualityHistorySchema = createInsertSchema(dataQualityHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDataQualityConfigSchema = createInsertSchema(dataQualityConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Device Authorization schemas
export const insertTripDeviceAuthorizationSchema = createInsertSchema(tripDeviceAuthorizations).omit({
  id: true,
  createdAt: true,
}).extend({
  authorizerName: z.string().nullable().optional(),
  signatureData: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// User Settings - notification preferences and app settings
export const userSettings = pgTable("user_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  // Notification settings
  notificationsEnabled: boolean("notifications_enabled").default(true),
  soundEnabled: boolean("sound_enabled").default(true),
  vibrationEnabled: boolean("vibration_enabled").default(true),
  checklistReminderEnabled: boolean("checklist_reminder_enabled").default(true),
  checklistReminderTime: text("checklist_reminder_time").default("07:00"), // HH:mm format
  expiryAlertsEnabled: boolean("expiry_alerts_enabled").default(true),
  scadenzeReminderEnabled: boolean("scadenze_reminder_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Scadenze (Material Expiry Reports) - monthly inventory expiry checks on the 25th
export const scadenzeReports = pgTable("scadenze_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  locationId: varchar("location_id").notNull(),
  submittedByUserId: varchar("submitted_by_user_id").notNull(),
  submittedByName: text("submitted_by_name").notNull(),
  reportMonth: integer("report_month").notNull(), // 1-12
  reportYear: integer("report_year").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  // Summary fields
  totalItemsChecked: integer("total_items_checked").default(0),
  expiredItemsCount: integer("expired_items_count").default(0),
  expiringItemsCount: integer("expiring_items_count").default(0), // expiring within 30 days
  // Items detail stored as JSON
  items: jsonb("items").notNull(), // Array of { itemId, itemName, quantity, expiryDate, status: 'ok'|'expiring'|'expired' }
  notes: text("notes"),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for user settings
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScadenzeReportSchema = createInsertSchema(scadenzeReports).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for user settings and scadenze
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type ScadenzeReport = typeof scadenzeReports.$inferSelect;
export type InsertScadenzeReport = z.infer<typeof insertScadenzeReportSchema>;

// TypeScript types
export type DataQualityAnomaly = typeof dataQualityAnomalies.$inferSelect;
export type InsertDataQualityAnomaly = z.infer<typeof insertDataQualityAnomalySchema>;
export type DataQualityScore = typeof dataQualityScores.$inferSelect;
export type InsertDataQualityScore = z.infer<typeof insertDataQualityScoreSchema>;
export type DataQualityHistory = typeof dataQualityHistory.$inferSelect;
export type InsertDataQualityHistory = z.infer<typeof insertDataQualityHistorySchema>;
export type DataQualityConfig = typeof dataQualityConfig.$inferSelect;
export type InsertDataQualityConfig = z.infer<typeof insertDataQualityConfigSchema>;
export type TripDeviceAuthorization = typeof tripDeviceAuthorizations.$inferSelect;
export type InsertTripDeviceAuthorization = z.infer<typeof insertTripDeviceAuthorizationSchema>;

// ============================================================================
// STAFF SCHEDULING / SHIFT MANAGEMENT SYSTEM
// Sistema completo per la gestione turni del personale
// ============================================================================

// Enum per stato turno
export const shiftStatusEnum = pgEnum("shift_status", [
  "draft",      // Bozza - non visibile al personale
  "open",       // Aperto - disponibile per auto-iscrizione
  "published",  // Pubblicato - visibile e modificabile
  "confirmed",  // Confermato - personale assegnato
  "in_progress", // In corso
  "completed",  // Completato
  "cancelled"   // Cancellato
]);

// Enum per tipo di ruolo nel turno
export const shiftRoleEnum = pgEnum("shift_role", [
  "autista",        // Autista
  "soccorritore",   // Soccorritore
  "infermiere",     // Infermiere
  "medico",         // Medico
  "coordinatore"    // Coordinatore
]);

// Enum per stato assegnazione
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned",      // Assegnato da admin
  "self_assigned", // Auto-iscrizione
  "pending",       // In attesa di conferma
  "confirmed",     // Confermato
  "declined",      // Rifiutato
  "swapped",       // Scambiato con altro
  "cancelled"      // Cancellato
]);

// Enum per stato richiesta scambio
export const swapRequestStatusEnum = pgEnum("swap_request_status", [
  "pending",       // In attesa
  "accepted",      // Accettato dal collega
  "rejected",      // Rifiutato dal collega
  "approved",      // Approvato da admin
  "denied",        // Negato da admin
  "completed",     // Scambio completato
  "cancelled",     // Annullato
  "expired"        // Scaduto
]);

// Enum per tipo evento/servizio
export const serviceEventTypeEnum = pgEnum("service_event_type", [
  "sporting_event",   // Evento sportivo
  "cultural_event",   // Evento culturale
  "medical_support",  // Assistenza sanitaria
  "emergency_cover",  // Copertura emergenza
  "training",         // Formazione
  "meeting",          // Riunione
  "other"             // Altro
]);

// Staff Members - membri del personale (diverso da users che sono account login)
export const staffMembers = pgTable("staff_members", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique(), // Collegamento opzionale ad account utente - unico per garantire 1:1 mapping
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fiscalCode: text("fiscal_code"), // Codice fiscale
  email: text("email"),
  phone: text("phone"),
  locationId: varchar("location_id").notNull(), // Sede principale
  // Indirizzo domicilio (per calcolo rimborsi km)
  homeAddress: text("home_address"), // Via, numero civico
  homeCity: text("home_city"),
  homeProvince: text("home_province"),
  homePostalCode: text("home_postal_code"),
  homeDistanceKm: real("home_distance_km"), // Distanza preimpostata dal domicilio alla sede principale
  // Dati bancari per rimborsi
  iban: text("iban"), // IBAN per bonifici rimborsi
  // Ruoli e qualifiche
  primaryRole: shiftRoleEnum("primary_role").notNull(),
  secondaryRoles: jsonb("secondary_roles"), // Array di ruoli secondari
  qualifications: jsonb("qualifications"), // Array di qualifiche (BLS, BLSD, autista emergenza, etc)
  qualificationExpiries: jsonb("qualification_expiries"), // {qualification: date}
  // Disponibilità e limiti
  maxHoursPerWeek: integer("max_hours_per_week").default(40),
  maxHoursPerMonth: integer("max_hours_per_month").default(160),
  maxConsecutiveDays: integer("max_consecutive_days").default(6),
  minRestDaysPerWeek: integer("min_rest_days_per_week").default(1),
  preferredShiftType: text("preferred_shift_type").default("any"), // morning, afternoon, night, any
  availableDays: jsonb("available_days"), // [0,1,2,3,4,5,6] - days of week available
  preferredVehicleIds: jsonb("preferred_vehicle_ids"), // Array di veicoli preferiti
  excludedVehicleIds: jsonb("excluded_vehicle_ids"), // Array di veicoli esclusi (non assegnare a questi)
  unavailableDates: jsonb("unavailable_dates"), // Array di date non disponibili
  // Contratto
  contractType: text("contract_type"), // full_time, part_time, volunteer
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  // Stato
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Shift Templates - template turni ricorrenti per veicolo/sede
export const shiftTemplates = pgTable("shift_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // es. "Turno Mattina J30"
  locationId: varchar("location_id").notNull(),
  vehicleId: varchar("vehicle_id"), // Opzionale - se null vale per tutta la sede
  // Orari
  startTime: time("start_time").notNull(), // es. "07:00"
  endTime: time("end_time").notNull(), // es. "19:00"
  durationHours: real("duration_hours"), // Durata calcolata o override
  // Equipaggio richiesto
  crewType: text("crew_type").default("autista_soccorritore"), // Tipo equipaggio
  requiredRoles: jsonb("required_roles").notNull(), // [{role: "autista", count: 1}, {role: "soccorritore", count: 1}]
  minStaff: integer("min_staff").default(2), // Minimo personale richiesto
  maxStaff: integer("max_staff").default(3), // Massimo personale
  // Ricorrenza
  isRecurring: boolean("is_recurring").default(true),
  recurrencePattern: text("recurrence_pattern").default("daily"), // daily, weekly, custom
  recurrenceDays: jsonb("recurrence_days"), // [0,1,2,3,4] = Lun-Ven (0=Domenica)
  // Requisiti qualifiche
  requiredQualifications: jsonb("required_qualifications"), // Array qualifiche necessarie
  // Stato
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Shift Instances - istanze turno generate (per data specifica)
export const shiftInstances = pgTable("shift_instances", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar("template_id"), // Collegamento al template (null se creato manualmente)
  locationId: varchar("location_id").notNull(),
  vehicleId: varchar("vehicle_id"), // Veicolo assegnato
  // Data e orari
  shiftDate: date("shift_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  actualStartTime: time("actual_start_time"), // Ora effettiva inizio
  actualEndTime: time("actual_end_time"), // Ora effettiva fine
  // Equipaggio
  crewType: text("crew_type").default("autista_soccorritore"),
  requiredRoles: jsonb("required_roles").notNull(),
  minStaff: integer("min_staff").default(2),
  maxStaff: integer("max_staff").default(3),
  currentStaffCount: integer("current_staff_count").default(0), // Conteggio attuale
  // Stato
  status: shiftStatusEnum("status").default("draft").notNull(),
  isCovered: boolean("is_covered").default(false), // True se requisiti minimi soddisfatti
  coveragePercent: integer("coverage_percent").default(0), // % copertura
  allowSelfSignup: boolean("allow_self_signup").default(true), // Permetti auto-iscrizione
  // Eventuale collegamento ad evento
  profileId: varchar("profile_id"), // ID profilo turno del veicolo (per multi-profilo)
  eventId: varchar("event_id"), // Collegamento a service_events
  // Note e override
  notes: text("notes"),
  isManualOverride: boolean("is_manual_override").default(false), // Se modificato manualmente
  overrideReason: text("override_reason"),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Shift Assignments - assegnazioni personale ai turni
export const shiftAssignments = pgTable("shift_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  shiftInstanceId: varchar("shift_instance_id").notNull(),
  staffMemberId: varchar("staff_member_id").notNull(),
  // Ruolo assegnato
  assignedRole: shiftRoleEnum("assigned_role").notNull(),
  roleSlotIndex: integer("role_slot_index").default(0), // Per posizioni multiple stesso ruolo
  // Stato
  status: assignmentStatusEnum("status").default("assigned").notNull(),
  // Chi ha assegnato
  assignedBy: varchar("assigned_by"), // Admin che ha assegnato (null se auto-iscrizione)
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  // Conferme
  confirmedAt: timestamp("confirmed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  // Check-in/out
  checkedInAt: timestamp("checked_in_at"),
  checkedOutAt: timestamp("checked_out_at"),
  checkedInBy: varchar("checked_in_by"),
  // Ore effettive
  actualHoursWorked: real("actual_hours_worked"),
  overtimeHours: real("overtime_hours").default(0),
  // Note
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueShiftStaff: uniqueIndex("shift_assignments_shift_staff_unique").on(table.shiftInstanceId, table.staffMemberId),
}));

// Staff Availability - disponibilità dichiarata dal personale
export const staffAvailability = pgTable("staff_availability", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  // Periodo disponibilità
  dateStart: date("date_start").notNull(),
  dateEnd: date("date_end").notNull(),
  // Fasce orarie (null = tutto il giorno)
  timeStart: time("time_start"),
  timeEnd: time("time_end"),
  // Tipo
  availabilityType: text("availability_type").notNull(), // available, unavailable, preferred, limited
  // Ricorrenza settimanale
  isRecurring: boolean("is_recurring").default(false),
  recurrenceDays: jsonb("recurrence_days"), // [1,2,3,4,5] = Lun-Ven
  // Motivo (per indisponibilità)
  reason: text("reason"),
  // Stato
  isApproved: boolean("is_approved").default(true), // Approvato da admin
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  // Note
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shift Swap Requests - richieste scambio turno
export const shiftSwapRequests = pgTable("shift_swap_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Chi richiede
  requesterId: varchar("requester_id").notNull(), // Staff member che vuole scambiare
  requesterAssignmentId: varchar("requester_assignment_id").notNull(), // Turno da cedere
  // Chi riceve la richiesta
  targetStaffId: varchar("target_staff_id"), // null = aperto a tutti
  targetAssignmentId: varchar("target_assignment_id"), // Turno offerto in cambio (opzionale)
  // Tipo scambio
  swapType: text("swap_type").notNull(), // direct_swap (scambio), give_away (cedo), take_over (prendo)
  // Stato
  status: swapRequestStatusEnum("status").default("pending").notNull(),
  // Risposte
  respondedBy: varchar("responded_by"),
  respondedAt: timestamp("responded_at"),
  responseNote: text("response_note"),
  // Approvazione admin
  adminApprovedBy: varchar("admin_approved_by"),
  adminApprovedAt: timestamp("admin_approved_at"),
  adminNote: text("admin_note"),
  // Scadenza
  expiresAt: timestamp("expires_at"),
  // Motivo richiesta
  reason: text("reason"),
  // Note
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Service Events - eventi/assistenze/manifestazioni
export const serviceEvents = pgTable("service_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  eventType: serviceEventTypeEnum("event_type").notNull(),
  description: text("description"),
  // Location
  locationId: varchar("location_id").notNull(), // Sede organizzatrice
  eventAddress: text("event_address"), // Indirizzo evento
  eventCity: text("event_city"),
  coordinates: jsonb("coordinates"), // {lat, lng}
  // Date e orari
  eventDate: date("event_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  setupTime: time("setup_time"), // Orario arrivo per preparazione
  // Risorse necessarie
  vehiclesRequired: integer("vehicles_required").default(1),
  staffRequired: integer("staff_required").default(2),
  requiredRoles: jsonb("required_roles"), // [{role: "infermiere", count: 1}]
  requiredQualifications: jsonb("required_qualifications"),
  // Veicoli assegnati
  assignedVehicleIds: jsonb("assigned_vehicle_ids"), // Array di vehicleId
  // Cliente/Organizzatore
  clientName: text("client_name"),
  clientContact: text("client_contact"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  // Contratto
  contractReference: text("contract_reference"),
  estimatedRevenue: real("estimated_revenue"),
  actualRevenue: real("actual_revenue"),
  // Stato
  status: text("status").default("planned").notNull(), // planned, confirmed, in_progress, completed, cancelled
  isCovered: boolean("is_covered").default(false),
  // Note
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Note interne non visibili a tutti
  // Creazione
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Event Assignments - assegnazioni personale agli eventi
export const eventAssignments = pgTable("event_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  staffMemberId: varchar("staff_member_id").notNull(),
  vehicleId: varchar("vehicle_id"), // Veicolo assegnato (opzionale)
  // Ruolo
  assignedRole: shiftRoleEnum("assigned_role").notNull(),
  // Stato
  status: assignmentStatusEnum("status").default("assigned").notNull(),
  // Orari specifici (override evento)
  startTime: time("start_time"),
  endTime: time("end_time"),
  // Check-in/out
  checkedInAt: timestamp("checked_in_at"),
  checkedOutAt: timestamp("checked_out_at"),
  // Ore effettive
  actualHoursWorked: real("actual_hours_worked"),
  // Assegnazione
  assignedBy: varchar("assigned_by"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
  // Note
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueEventStaff: uniqueIndex("event_assignments_event_staff_unique").on(table.eventId, table.staffMemberId),
}));

// Shift Activity Logs - log attività turni per audit
export const shiftActivityLogs = pgTable("shift_activity_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Entità interessata
  entityType: text("entity_type").notNull(), // shift_instance, assignment, swap_request, event
  entityId: varchar("entity_id").notNull(),
  // Azione
  action: text("action").notNull(), // created, updated, published, assigned, confirmed, cancelled, etc.
  // Attore
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  // Dettagli
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  description: text("description"),
  // Metadati
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shift Audit Log - audit log for shift-related operations
export const shiftAuditLog = pgTable("shift_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  shiftInstanceId: varchar("shift_instance_id"),
  locationId: varchar("location_id"),
  locationName: text("location_name"),
  vehicleCode: text("vehicle_code"),
  shiftDate: text("shift_date"),
  staffMemberName: text("staff_member_name"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  description: text("description").notNull(),
  organizationId: varchar("organization_id"),
});

export const insertShiftAuditLogSchema = createInsertSchema(shiftAuditLog).omit({ id: true, createdAt: true });
export type ShiftAuditLog = typeof shiftAuditLog.$inferSelect;
export type InsertShiftAuditLog = typeof shiftAuditLog.$inferInsert;

// ============================================================================
// SHIFT MANAGEMENT RELATIONS
// ============================================================================

export const staffMembersRelations = relations(staffMembers, ({ one, many }) => ({
  user: one(users, {
    fields: [staffMembers.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [staffMembers.locationId],
    references: [locations.id],
  }),
  assignments: many(shiftAssignments),
  availability: many(staffAvailability),
  eventAssignments: many(eventAssignments),
}));

export const shiftTemplatesRelations = relations(shiftTemplates, ({ one, many }) => ({
  location: one(locations, {
    fields: [shiftTemplates.locationId],
    references: [locations.id],
  }),
  vehicle: one(vehicles, {
    fields: [shiftTemplates.vehicleId],
    references: [vehicles.id],
  }),
  instances: many(shiftInstances),
}));

export const shiftInstancesRelations = relations(shiftInstances, ({ one, many }) => ({
  template: one(shiftTemplates, {
    fields: [shiftInstances.templateId],
    references: [shiftTemplates.id],
  }),
  location: one(locations, {
    fields: [shiftInstances.locationId],
    references: [locations.id],
  }),
  vehicle: one(vehicles, {
    fields: [shiftInstances.vehicleId],
    references: [vehicles.id],
  }),
  event: one(serviceEvents, {
    fields: [shiftInstances.eventId],
    references: [serviceEvents.id],
  }),
  assignments: many(shiftAssignments),
}));

export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one }) => ({
  shiftInstance: one(shiftInstances, {
    fields: [shiftAssignments.shiftInstanceId],
    references: [shiftInstances.id],
  }),
  staffMember: one(staffMembers, {
    fields: [shiftAssignments.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffAvailabilityRelations = relations(staffAvailability, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffAvailability.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const shiftSwapRequestsRelations = relations(shiftSwapRequests, ({ one }) => ({
  requester: one(staffMembers, {
    fields: [shiftSwapRequests.requesterId],
    references: [staffMembers.id],
  }),
  targetStaff: one(staffMembers, {
    fields: [shiftSwapRequests.targetStaffId],
    references: [staffMembers.id],
  }),
  requesterAssignment: one(shiftAssignments, {
    fields: [shiftSwapRequests.requesterAssignmentId],
    references: [shiftAssignments.id],
  }),
  targetAssignment: one(shiftAssignments, {
    fields: [shiftSwapRequests.targetAssignmentId],
    references: [shiftAssignments.id],
  }),
}));

export const serviceEventsRelations = relations(serviceEvents, ({ one, many }) => ({
  location: one(locations, {
    fields: [serviceEvents.locationId],
    references: [locations.id],
  }),
  assignments: many(eventAssignments),
}));

export const eventAssignmentsRelations = relations(eventAssignments, ({ one }) => ({
  event: one(serviceEvents, {
    fields: [eventAssignments.eventId],
    references: [serviceEvents.id],
  }),
  staffMember: one(staffMembers, {
    fields: [eventAssignments.staffMemberId],
    references: [staffMembers.id],
  }),
  vehicle: one(vehicles, {
    fields: [eventAssignments.vehicleId],
    references: [vehicles.id],
  }),
}));

// ============================================================================
// SHIFT MANAGEMENT SCHEMAS
// ============================================================================

export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftTemplateSchema = createInsertSchema(shiftTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftInstanceSchema = createInsertSchema(shiftInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftAssignmentSchema = createInsertSchema(shiftAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffAvailabilitySchema = createInsertSchema(staffAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftSwapRequestSchema = createInsertSchema(shiftSwapRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceEventSchema = createInsertSchema(serviceEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventAssignmentSchema = createInsertSchema(eventAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShiftActivityLogSchema = createInsertSchema(shiftActivityLogs).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// VOLUNTEER REIMBURSEMENT SYSTEM
// ============================================================================

// Enum per stato rimborso
export const reimbursementStatusEnum = pgEnum("reimbursement_status", [
  "draft",           // Bozza, in preparazione
  "pending_signature", // Inviato al volontario per firma
  "signed",          // Firmato dal volontario
  "approved",        // Approvato dal responsabile
  "paid",            // Pagato
  "cancelled"        // Annullato
]);

// Rimborsi Volontari - riepilogo mensile
export const volunteerReimbursements = pgTable("volunteer_reimbursements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(), // Volontario
  locationId: varchar("location_id").notNull(), // Sede principale
  
  // Periodo
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  
  // Totali calcolati
  totalAmount: real("total_amount").notNull(), // Importo totale inserito dal responsabile
  totalShifts: integer("total_shifts").notNull(), // Numero turni
  totalHours: real("total_hours").notNull(), // Ore totali lavorate
  totalKm: real("total_km").notNull(), // Km totali calcolati
  totalMeals: integer("total_meals").notNull(), // Numero pasti
  
  // Tariffe usate (calcolate dal sistema)
  avgKmRate: real("avg_km_rate"), // Tariffa media €/km
  mealAllowance: real("meal_allowance").default(12.50), // Importo pasto singolo
  
  // Stato e workflow
  status: reimbursementStatusEnum("status").default("draft").notNull(),
  
  // Firma digitale
  signatureData: text("signature_data"), // Base64 firma PNG
  signedAt: timestamp("signed_at"),
  signedFromIp: text("signed_from_ip"),
  
  // Approvazione
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  // Pagamento
  paidAt: timestamp("paid_at"),
  paymentReference: text("payment_reference"), // Riferimento bonifico
  
  // PDF generato
  pdfPath: text("pdf_path"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  
  // Note
  notes: text("notes"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Dettagli turni per rimborso
export const reimbursementShifts = pgTable("reimbursement_shifts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reimbursementId: varchar("reimbursement_id").notNull(),
  
  // Data e orari turno
  shiftDate: date("shift_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  hoursWorked: real("hours_worked").notNull(),
  
  // Sede del turno
  locationId: varchar("location_id").notNull(),
  locationName: text("location_name").notNull(), // Denormalizzato per PDF
  
  // Calcoli km
  kmDistance: real("km_distance").notNull(), // Km percorsi (sede-casa e ritorno)
  kmRate: real("km_rate").notNull(), // Tariffa €/km per questo turno
  kmAmount: real("km_amount").notNull(), // Importo rimborso km
  
  // Pasto
  hasMeal: boolean("has_meal").default(true).notNull(),
  mealAmount: real("meal_amount").notNull(), // Importo pasto
  
  // Totale turno
  totalAmount: real("total_amount").notNull(), // km + pasto
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Distanze sedi per calcoli km (configurazione admin)
export const locationDistances = pgTable("location_distances", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull().unique(),
  locationName: text("location_name").notNull(),
  
  // Distanza standard dalla residenza tipo (km andata)
  defaultDistanceKm: real("default_distance_km").notNull(),
  
  // Override per singoli volontari se necessario
  customDistances: jsonb("custom_distances"), // {staffMemberId: kmDistance}
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const volunteerReimbursementsRelations = relations(volunteerReimbursements, ({ one, many }) => ({
  staffMember: one(staffMembers, {
    fields: [volunteerReimbursements.staffMemberId],
    references: [staffMembers.id],
  }),
  location: one(locations, {
    fields: [volunteerReimbursements.locationId],
    references: [locations.id],
  }),
  shifts: many(reimbursementShifts),
}));

export const reimbursementShiftsRelations = relations(reimbursementShifts, ({ one }) => ({
  reimbursement: one(volunteerReimbursements, {
    fields: [reimbursementShifts.reimbursementId],
    references: [volunteerReimbursements.id],
  }),
  location: one(locations, {
    fields: [reimbursementShifts.locationId],
    references: [locations.id],
  }),
}));

export const locationDistancesRelations = relations(locationDistances, ({ one }) => ({
  location: one(locations, {
    fields: [locationDistances.locationId],
    references: [locations.id],
  }),
}));

// Insert schemas
export const insertVolunteerReimbursementSchema = createInsertSchema(volunteerReimbursements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReimbursementShiftSchema = createInsertSchema(reimbursementShifts).omit({
  id: true,
  createdAt: true,
});

export const insertLocationDistanceSchema = createInsertSchema(locationDistances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SHIFT MANAGEMENT TYPES
// ============================================================================

export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;
export type ShiftInstance = typeof shiftInstances.$inferSelect;
export type InsertShiftInstance = z.infer<typeof insertShiftInstanceSchema>;
export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type InsertShiftAssignment = z.infer<typeof insertShiftAssignmentSchema>;
export type StaffAvailability = typeof staffAvailability.$inferSelect;
export type InsertStaffAvailability = z.infer<typeof insertStaffAvailabilitySchema>;
export type ShiftSwapRequest = typeof shiftSwapRequests.$inferSelect;
export type InsertShiftSwapRequest = z.infer<typeof insertShiftSwapRequestSchema>;
export type ServiceEvent = typeof serviceEvents.$inferSelect;
export type InsertServiceEvent = z.infer<typeof insertServiceEventSchema>;
export type EventAssignment = typeof eventAssignments.$inferSelect;
export type InsertEventAssignment = z.infer<typeof insertEventAssignmentSchema>;
export type ShiftActivityLog = typeof shiftActivityLogs.$inferSelect;
export type InsertShiftActivityLog = z.infer<typeof insertShiftActivityLogSchema>;

// ============================================================================
// VOLUNTEER REIMBURSEMENT TYPES
// ============================================================================

export type VolunteerReimbursement = typeof volunteerReimbursements.$inferSelect;
export type InsertVolunteerReimbursement = z.infer<typeof insertVolunteerReimbursementSchema>;
export type ReimbursementShift = typeof reimbursementShifts.$inferSelect;
export type InsertReimbursementShift = z.infer<typeof insertReimbursementShiftSchema>;
export type LocationDistance = typeof locationDistances.$inferSelect;
export type InsertLocationDistance = z.infer<typeof insertLocationDistanceSchema>;

// ============================================================================
// ESG DASHBOARD & SUSTAINABILITY SYSTEM
// ============================================================================

// Carbon Footprint per viaggio - calcolo automatico CO2
export const tripCarbonFootprint = pgTable("trip_carbon_footprint", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().unique(),
  vehicleId: varchar("vehicle_id").notNull(),
  
  // Dati viaggio
  kmTraveled: real("km_traveled").notNull(),
  fuelType: text("fuel_type").notNull(), // Gasolio, Benzina, GPL, Metano, Elettrico
  
  // Emissioni calcolate (kg CO2)
  co2EmittedKg: real("co2_emitted_kg").notNull(),
  co2PerKm: real("co2_per_km").notNull(), // g CO2/km
  
  // Risparmio rispetto ad alternativa (auto privata)
  co2IfPrivateCar: real("co2_if_private_car").notNull(),
  co2SavedKg: real("co2_saved_kg").notNull(), // Risparmio effettivo
  
  // Calcolo efficienza
  occupancyFactor: real("occupancy_factor").default(1.0), // Pazienti trasportati
  efficiencyScore: real("efficiency_score"), // 0-100
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Configurazione fattori emissione per tipo carburante
export const carbonEmissionFactors = pgTable("carbon_emission_factors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fuelType: text("fuel_type").notNull().unique(),
  
  // Fattori di emissione (g CO2 per km)
  gCo2PerKm: real("g_co2_per_km").notNull(),
  gCo2PerLiter: real("g_co2_per_liter"), // Per calcolo da consumo
  
  // Riferimento auto privata media
  privateCarGCo2PerKm: real("private_car_g_co2_per_km").default(120), // Media auto privata
  
  // Fonte e validità
  source: text("source"), // Es. "ISPRA 2024"
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Obiettivi sostenibilità
export const sustainabilityGoals = pgTable("sustainability_goals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  
  // Obiettivi ambientali
  targetCo2ReductionPercent: real("target_co2_reduction_percent"), // % riduzione vs anno precedente
  targetKmEfficiencyImprovement: real("target_km_efficiency_improvement"),
  targetElectricFleetPercent: real("target_electric_fleet_percent"),
  
  // Obiettivi sociali
  targetVolunteerHours: integer("target_volunteer_hours"),
  targetTrainingHours: integer("target_training_hours"),
  targetPatientSatisfaction: real("target_patient_satisfaction"), // 1-5 scale
  
  // Obiettivi governance
  targetAuditCompliancePercent: real("target_audit_compliance_percent"),
  targetDataQualityScore: real("target_data_quality_score"),
  
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Snapshot ESG mensile per reporting
export const esgMonthlySnapshots = pgTable("esg_monthly_snapshots", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  
  // === ENVIRONMENTAL ===
  totalKmTraveled: real("total_km_traveled").notNull(),
  totalCo2EmittedKg: real("total_co2_emitted_kg").notNull(),
  totalCo2SavedKg: real("total_co2_saved_kg").notNull(),
  avgCo2PerKm: real("avg_co2_per_km"),
  electricKmPercent: real("electric_km_percent"),
  fuelConsumptionLiters: real("fuel_consumption_liters"),
  
  // === SOCIAL ===
  totalServicesCompleted: integer("total_services_completed").notNull(),
  totalPatientsServed: integer("total_patients_served"),
  totalVolunteerHours: real("total_volunteer_hours"),
  activeVolunteers: integer("active_volunteers"),
  newVolunteersRecruited: integer("new_volunteers_recruited"),
  trainingHoursDelivered: real("training_hours_delivered"),
  avgPatientSatisfaction: real("avg_patient_satisfaction"),
  communityEventsParticipated: integer("community_events_participated"),
  
  // === GOVERNANCE ===
  auditLogsGenerated: integer("audit_logs_generated"),
  complianceScore: real("compliance_score"), // 0-100
  dataQualityScore: real("data_quality_score"), // 0-100
  gdprRequestsProcessed: integer("gdpr_requests_processed"),
  incidentsReported: integer("incidents_reported"),
  incidentsResolved: integer("incidents_resolved"),
  
  // Punteggi aggregati
  environmentalScore: real("environmental_score"), // 0-100
  socialScore: real("social_score"), // 0-100
  governanceScore: real("governance_score"), // 0-100
  overallEsgScore: real("overall_esg_score"), // Media ponderata
  
  // Metadati
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  generatedBy: varchar("generated_by"),
});

// ============================================================================
// BURNOUT PREVENTION SYSTEM
// ============================================================================

// Enum per livello rischio burnout
export const burnoutRiskLevelEnum = pgEnum("burnout_risk_level", [
  "low",      // Verde - sotto soglie
  "moderate", // Giallo - avvicina soglie
  "high",     // Arancione - supera soglie
  "critical"  // Rosso - intervento urgente
]);

// Configurazione soglie burnout
export const burnoutThresholds = pgTable("burnout_thresholds", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Soglie ore lavorative
  maxHoursPerDay: real("max_hours_per_day").default(10).notNull(),
  maxHoursPerWeek: real("max_hours_per_week").default(48).notNull(),
  maxHoursPerMonth: real("max_hours_per_month").default(180).notNull(),
  maxConsecutiveDays: integer("max_consecutive_days").default(6).notNull(),
  
  // Soglie turni notturni
  maxNightShiftsPerWeek: integer("max_night_shifts_per_week").default(3),
  maxNightShiftsPerMonth: integer("max_night_shifts_per_month").default(8),
  
  // Soglie riposo obbligatorio
  minRestHoursBetweenShifts: real("min_rest_hours_between_shifts").default(11).notNull(),
  minDaysOffPerMonth: integer("min_days_off_per_month").default(4).notNull(),
  
  // Pesi per calcolo rischio
  weightHoursExcess: real("weight_hours_excess").default(0.4),
  weightConsecutiveDays: real("weight_consecutive_days").default(0.3),
  weightNightShifts: real("weight_night_shifts").default(0.2),
  weightRestDeficit: real("weight_rest_deficit").default(0.1),
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Monitoraggio ore per operatore
export const operatorWorkload = pgTable("operator_workload", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  
  // Periodo
  weekStartDate: date("week_start_date").notNull(),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  
  // Ore lavorate
  hoursWorkedMon: real("hours_worked_mon").default(0),
  hoursWorkedTue: real("hours_worked_tue").default(0),
  hoursWorkedWed: real("hours_worked_wed").default(0),
  hoursWorkedThu: real("hours_worked_thu").default(0),
  hoursWorkedFri: real("hours_worked_fri").default(0),
  hoursWorkedSat: real("hours_worked_sat").default(0),
  hoursWorkedSun: real("hours_worked_sun").default(0),
  totalHoursWeek: real("total_hours_week").default(0).notNull(),
  
  // Turni notturni (22:00-06:00)
  nightShiftsCount: integer("night_shifts_count").default(0),
  
  // Giorni consecutivi lavorati
  consecutiveDaysWorked: integer("consecutive_days_worked").default(0),
  
  // Risposo tra turni (ore minime effettive)
  minRestBetweenShifts: real("min_rest_between_shifts"),
  
  // Calcolo rischio
  riskLevel: burnoutRiskLevelEnum("risk_level").default("low"),
  riskScore: real("risk_score").default(0), // 0-100
  riskFactors: jsonb("risk_factors"), // Dettaglio fattori contribuenti
  
  // Alert generato
  alertSent: boolean("alert_sent").default(false),
  alertSentAt: timestamp("alert_sent_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Check-in benessere periodico
export const wellnessCheckins = pgTable("wellness_checkins", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  
  // Data check-in
  checkinDate: date("checkin_date").notNull(),
  
  // Scala 1-5 per vari indicatori
  energyLevel: integer("energy_level"), // 1=esausto, 5=energico
  stressLevel: integer("stress_level"), // 1=molto stressato, 5=rilassato
  sleepQuality: integer("sleep_quality"), // 1=pessima, 5=ottima
  workLifeBalance: integer("work_life_balance"), // 1=pessimo, 5=ottimo
  teamSupport: integer("team_support"), // 1=isolato, 5=ben supportato
  jobSatisfaction: integer("job_satisfaction"), // 1=insoddisfatto, 5=molto soddisfatto
  
  // Punteggio aggregato
  overallWellnessScore: real("overall_wellness_score"), // Media ponderata 0-100
  
  // Note libere (opzionale)
  notes: text("notes"),
  needsSupport: boolean("needs_support").default(false),
  
  // Privacy
  isAnonymous: boolean("is_anonymous").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alert burnout generati
export const burnoutAlerts = pgTable("burnout_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  
  // Tipo alert
  alertType: text("alert_type").notNull(), // hours_exceeded, consecutive_days, night_shifts, rest_deficit, low_wellness
  riskLevel: burnoutRiskLevelEnum("risk_level").notNull(),
  
  // Dettagli
  title: text("title").notNull(),
  description: text("description").notNull(),
  triggeredValue: real("triggered_value"), // Valore che ha scatenato l'alert
  thresholdValue: real("threshold_value"), // Soglia superata
  
  // Periodo riferimento
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  
  // Gestione alert
  isRead: boolean("is_read").default(false),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  
  // Azioni suggerite
  suggestedActions: jsonb("suggested_actions"), // Array di azioni suggerite
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations per Carbon Footprint
export const tripCarbonFootprintRelations = relations(tripCarbonFootprint, ({ one }) => ({
  trip: one(trips, {
    fields: [tripCarbonFootprint.tripId],
    references: [trips.id],
  }),
  vehicle: one(vehicles, {
    fields: [tripCarbonFootprint.vehicleId],
    references: [vehicles.id],
  }),
}));

// Relations per Burnout
export const operatorWorkloadRelations = relations(operatorWorkload, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [operatorWorkload.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const wellnessCheckinsRelations = relations(wellnessCheckins, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [wellnessCheckins.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const burnoutAlertsRelations = relations(burnoutAlerts, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [burnoutAlerts.staffMemberId],
    references: [staffMembers.id],
  }),
}));

// Insert schemas ESG
export const insertTripCarbonFootprintSchema = createInsertSchema(tripCarbonFootprint).omit({
  id: true,
  createdAt: true,
});

export const insertCarbonEmissionFactorSchema = createInsertSchema(carbonEmissionFactors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSustainabilityGoalSchema = createInsertSchema(sustainabilityGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEsgMonthlySnapshotSchema = createInsertSchema(esgMonthlySnapshots).omit({
  id: true,
  generatedAt: true,
});

// Insert schemas Burnout Prevention
export const insertBurnoutThresholdsSchema = createInsertSchema(burnoutThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperatorWorkloadSchema = createInsertSchema(operatorWorkload).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWellnessCheckinSchema = createInsertSchema(wellnessCheckins).omit({
  id: true,
  createdAt: true,
});

export const insertBurnoutAlertSchema = createInsertSchema(burnoutAlerts).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// ESG & BURNOUT PREVENTION TYPES
// ============================================================================

export type TripCarbonFootprint = typeof tripCarbonFootprint.$inferSelect;
export type InsertTripCarbonFootprint = z.infer<typeof insertTripCarbonFootprintSchema>;
export type CarbonEmissionFactor = typeof carbonEmissionFactors.$inferSelect;
export type InsertCarbonEmissionFactor = z.infer<typeof insertCarbonEmissionFactorSchema>;
export type SustainabilityGoal = typeof sustainabilityGoals.$inferSelect;
export type InsertSustainabilityGoal = z.infer<typeof insertSustainabilityGoalSchema>;
export type EsgMonthlySnapshot = typeof esgMonthlySnapshots.$inferSelect;
export type InsertEsgMonthlySnapshot = z.infer<typeof insertEsgMonthlySnapshotSchema>;
export type BurnoutThresholds = typeof burnoutThresholds.$inferSelect;
export type InsertBurnoutThresholds = z.infer<typeof insertBurnoutThresholdsSchema>;
export type OperatorWorkload = typeof operatorWorkload.$inferSelect;
export type InsertOperatorWorkload = z.infer<typeof insertOperatorWorkloadSchema>;
export type WellnessCheckin = typeof wellnessCheckins.$inferSelect;
export type InsertWellnessCheckin = z.infer<typeof insertWellnessCheckinSchema>;
export type BurnoutAlert = typeof burnoutAlerts.$inferSelect;
export type InsertBurnoutAlert = z.infer<typeof insertBurnoutAlertSchema>;

// ============================================================================
// PARTNER PROGRAM SYSTEM
// ============================================================================

// Partner status enum
export const partnerStatusEnum = pgEnum("partner_status", [
  "pending",     // Richiesta in attesa di approvazione
  "approved",    // Partner approvato e attivo
  "rejected",    // Richiesta rifiutata
  "suspended",   // Partner sospeso temporaneamente
  "inactive"     // Partner non più attivo
]);

// Partner tier enum (livelli di partnership)
export const partnerTierEnum = pgEnum("partner_tier", [
  "bronze",      // Partner base
  "silver",      // Partner intermedio
  "gold",        // Partner premium
  "platinum"     // Partner strategico
]);

// Partner category enum
export const partnerCategoryEnum = pgEnum("partner_category", [
  "ristorazione",      // Ristoranti, bar, pizzerie
  "commercio",         // Negozi, supermercati
  "servizi",           // Servizi vari (parrucchieri, estetisti, etc.)
  "salute",            // Farmacie, studi medici, palestre
  "tempo_libero",      // Cinema, teatro, sport
  "viaggi",            // Agenzie viaggio, hotel
  "auto",              // Officine, autolavaggi, distributori
  "casa",              // Arredamento, elettrodomestici
  "tecnologia",        // Elettronica, informatica
  "formazione",        // Corsi, scuole
  "altro"              // Altro
]);

// Partner table - Aziende convenzionate
export const partners = pgTable("partners", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Informazioni aziendali
  companyName: text("company_name").notNull(),
  vatNumber: text("vat_number"), // Partita IVA
  fiscalCode: text("fiscal_code"), // Codice fiscale
  category: text("category").notNull().default("altro"),
  
  // Contatti
  contactName: text("contact_name").notNull(), // Nome referente
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  
  // Indirizzo
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  
  // Branding
  logoUrl: text("logo_url"),
  description: text("description"), // Descrizione attività
  
  // Convenzione
  discountType: text("discount_type").default("percentage"), // percentage, fixed, service, gift
  discountValue: text("discount_value"), // es. "10%" o "€5" o descrizione servizio
  discountDescription: text("discount_description"), // Descrizione completa del vantaggio
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  
  // Stato e livello
  status: text("status").notNull().default("pending"),
  tier: text("tier").notNull().default("bronze"),
  
  // Statistiche
  totalVerifications: integer("total_verifications").default(0), // Quante verifiche QR ricevute
  averageRating: real("average_rating"), // Rating medio (1-5)
  totalReviews: integer("total_reviews").default(0),
  
  // Metadati
  notes: text("notes"), // Note interne
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Partner requests - Richieste dal form pubblico
export const partnerRequests = pgTable("partner_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Dati dal form
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  
  // Stato richiesta
  status: text("status").notNull().default("pending"), // pending, contacted, approved, rejected
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"),
  processingNotes: text("processing_notes"),
  
  // Collegamento a partner (se approvato)
  partnerId: varchar("partner_id"),
  
  // Metadati
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Partner verifications - Log delle verifiche QR
export const partnerVerifications = pgTable("partner_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  partnerId: varchar("partner_id").notNull(),
  staffMemberId: varchar("staff_member_id"), // Se identificabile
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  
  // Metadati verifica
  verificationMethod: text("verification_method").default("qr"), // qr, manual, api
  deviceInfo: text("device_info"),
});

// Partner reviews - Recensioni degli operatori
export const partnerReviews = pgTable("partner_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  partnerId: varchar("partner_id").notNull(),
  staffMemberId: varchar("staff_member_id"),
  userId: varchar("user_id"),
  
  rating: integer("rating").notNull(), // 1-5 stelle
  comment: text("comment"),
  
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const partnersRelations = relations(partners, ({ many }) => ({
  verifications: many(partnerVerifications),
  reviews: many(partnerReviews),
}));

export const partnerVerificationsRelations = relations(partnerVerifications, ({ one }) => ({
  partner: one(partners, {
    fields: [partnerVerifications.partnerId],
    references: [partners.id],
  }),
  staffMember: one(staffMembers, {
    fields: [partnerVerifications.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const partnerReviewsRelations = relations(partnerReviews, ({ one }) => ({
  partner: one(partners, {
    fields: [partnerReviews.partnerId],
    references: [partners.id],
  }),
  staffMember: one(staffMembers, {
    fields: [partnerReviews.staffMemberId],
    references: [staffMembers.id],
  }),
}));

// Insert schemas Partner
export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalVerifications: true,
  averageRating: true,
  totalReviews: true,
});

export const insertPartnerRequestSchema = createInsertSchema(partnerRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertPartnerVerificationSchema = createInsertSchema(partnerVerifications).omit({
  id: true,
  verifiedAt: true,
});

export const insertPartnerReviewSchema = createInsertSchema(partnerReviews).omit({
  id: true,
  createdAt: true,
});

// Types Partner
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type PartnerRequest = typeof partnerRequests.$inferSelect;
export type InsertPartnerRequest = z.infer<typeof insertPartnerRequestSchema>;
export type PartnerVerification = typeof partnerVerifications.$inferSelect;
export type InsertPartnerVerification = z.infer<typeof insertPartnerVerificationSchema>;
export type PartnerReview = typeof partnerReviews.$inferSelect;
export type InsertPartnerReview = z.infer<typeof insertPartnerReviewSchema>;

// ============================================================================
// EUROPA-NEXUS STAFF APP - Tabelle per gestione personale
// ============================================================================

// Enum per stato benessere check-in
export const staffWellnessStateEnum = pgEnum("staff_wellness_state", [
  "stanco",
  "ok", 
  "carico"
]);

// Check-in benessere giornaliero dello staff
export const staffWellnessCheckins = pgTable("staff_wellness_checkins", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  date: date("date").notNull(),
  state: staffWellnessStateEnum("state").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sessioni di respirazione/mindfulness
export const staffBreathingSessions = pgTable("staff_breathing_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  completed: boolean("completed").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Karma scambi turni - traccia favori dati/ricevuti
export const staffShiftKarma = pgTable("staff_shift_karma", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull().unique(),
  favorsGiven: integer("favors_given").default(0).notNull(),
  favorsReceived: integer("favors_received").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Milestone personali raggiunte
export const staffMilestoneTypeEnum = pgEnum("staff_milestone_type", [
  "turni_100",
  "turni_500",
  "anniversario_1",
  "anniversario_5",
  "primo_scambio",
  "aiuto_collega"
]);

export const staffMilestones = pgTable("staff_milestones", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  type: staffMilestoneTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  celebrated: boolean("celebrated").default(false).notNull(),
});

// Convenzioni partner per il personale
export const staffConvenzioni = pgTable("staff_convenzioni", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // ristorazione, sport_fitness, salute, tempo_libero
  city: text("city").notNull(),
  discount: text("discount").notNull(), // es. "15%", "10 euro", "2x1"
  isActive: boolean("is_active").default(true).notNull(),
  reason: text("reason"), // perché questa convenzione
  contactInfo: text("contact_info"),
  validUntil: date("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Corsi di formazione
export const staffTrainingCourses = pgTable("staff_training_courses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // obbligatorio, raccomandato, opzionale
  durationHours: integer("duration_hours").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  location: text("location"),
  maxParticipants: integer("max_participants"),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

// Iscrizioni corsi
export const staffCourseEnrollments = pgTable("staff_course_enrollments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  staffMemberId: varchar("staff_member_id").notNull(),
  status: text("status").notNull().default("iscritto"), // iscritto, completato, annullato
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Pillole formative (micro-learning)
export const staffTrainingPills = pgTable("staff_training_pills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // tecniche_soccorso, comunicazione, sicurezza
  title: text("title").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  scenario: text("scenario"), // situazione di esempio
  reason: text("reason"), // perché è importante
  tip: text("tip"), // consiglio pratico
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documenti personali con scadenza
export const staffDocuments = pgTable("staff_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  staffMemberId: varchar("staff_member_id").notNull(),
  type: text("type").notNull(), // patente_guida, blsd, patente_c, carta_identita
  name: text("name").notNull(),
  number: text("number"), // numero documento
  expiryDate: date("expiry_date"),
  status: text("status").notNull().default("valido"), // valido, in_scadenza, scaduto
  fileUrl: text("file_url"), // URL file caricato
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for staff app tables
export const staffWellnessCheckinsRelations = relations(staffWellnessCheckins, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffWellnessCheckins.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffBreathingSessionsRelations = relations(staffBreathingSessions, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffBreathingSessions.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffShiftKarmaRelations = relations(staffShiftKarma, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffShiftKarma.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffMilestonesRelations = relations(staffMilestones, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffMilestones.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffDocumentsRelations = relations(staffDocuments, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffDocuments.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const staffCourseEnrollmentsRelations = relations(staffCourseEnrollments, ({ one }) => ({
  course: one(staffTrainingCourses, {
    fields: [staffCourseEnrollments.courseId],
    references: [staffTrainingCourses.id],
  }),
  staffMember: one(staffMembers, {
    fields: [staffCourseEnrollments.staffMemberId],
    references: [staffMembers.id],
  }),
}));

// Insert schemas for staff app
export const insertStaffWellnessCheckinSchema = createInsertSchema(staffWellnessCheckins).omit({
  id: true,
  createdAt: true,
});

export const insertStaffBreathingSessionSchema = createInsertSchema(staffBreathingSessions).omit({
  id: true,
  createdAt: true,
});

export const insertStaffConvenzioneSchema = createInsertSchema(staffConvenzioni).omit({
  id: true,
  createdAt: true,
});

export const insertStaffTrainingCourseSchema = createInsertSchema(staffTrainingCourses).omit({
  id: true,
  createdAt: true,
});

export const insertStaffTrainingPillSchema = createInsertSchema(staffTrainingPills).omit({
  id: true,
  createdAt: true,
});

export const insertStaffDocumentSchema = createInsertSchema(staffDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for staff app
export type StaffWellnessCheckin = typeof staffWellnessCheckins.$inferSelect;
export type InsertStaffWellnessCheckin = z.infer<typeof insertStaffWellnessCheckinSchema>;
export type StaffBreathingSession = typeof staffBreathingSessions.$inferSelect;
export type InsertStaffBreathingSession = z.infer<typeof insertStaffBreathingSessionSchema>;
export type StaffShiftKarma = typeof staffShiftKarma.$inferSelect;
export type StaffMilestone = typeof staffMilestones.$inferSelect;
export type StaffConvenzione = typeof staffConvenzioni.$inferSelect;
export type InsertStaffConvenzione = z.infer<typeof insertStaffConvenzioneSchema>;
export type StaffTrainingCourse = typeof staffTrainingCourses.$inferSelect;
export type InsertStaffTrainingCourse = z.infer<typeof insertStaffTrainingCourseSchema>;
export type StaffTrainingPill = typeof staffTrainingPills.$inferSelect;
export type InsertStaffTrainingPill = z.infer<typeof insertStaffTrainingPillSchema>;
export type StaffDocument = typeof staffDocuments.$inferSelect;
export type InsertStaffDocument = z.infer<typeof insertStaffDocumentSchema>;

// ============================================================================
// STAFF CONFIDENTIALITY AGREEMENTS - Impegno alla Riservatezza
// ============================================================================
// Sistema di firma digitale per l'impegno alla riservatezza del personale
// Conforme a GDPR (Regolamento UE 2016/679), D.Lgs. 196/2003 e D.Lgs. 101/2018

export const staffConfidentialityAgreements = pgTable("staff_confidentiality_agreements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Informazioni del firmatario
  userId: varchar("user_id"), // Se collegato a un utente autenticato
  firstName: text("first_name").notNull(), // Nome
  lastName: text("last_name").notNull(), // Cognome
  fiscalCode: text("fiscal_code"), // Codice fiscale (opzionale ma consigliato)
  email: text("email"), // Email per comunicazioni
  phone: text("phone"), // Telefono
  
  // Tipo di rapporto con l'organizzazione
  staffType: text("staff_type").notNull(), // dipendente, collaboratore, volontario
  role: text("role"), // Ruolo specifico (autista, soccorritore, etc.)
  locationId: varchar("location_id"), // Sede di appartenenza
  
  // Dati della firma
  agreementVersion: text("agreement_version").notNull().default("1.0"), // Versione del documento
  agreementText: text("agreement_text").notNull(), // Testo completo dell'accordo firmato
  agreementHash: text("agreement_hash").notNull(), // SHA-256 del testo per integrità
  
  // Checkbox di accettazione (tutte obbligatorie)
  acceptedTerms: boolean("accepted_terms").notNull().default(false), // Accettazione termini generali
  acceptedGdpr: boolean("accepted_gdpr").notNull().default(false), // Accettazione informativa GDPR
  acceptedNoDisclosure: boolean("accepted_no_disclosure").notNull().default(false), // Impegno a non divulgare
  acceptedNoPhotos: boolean("accepted_no_photos").notNull().default(false), // Divieto foto/screenshot
  acceptedDataProtection: boolean("accepted_data_protection").notNull().default(false), // Protezione dati pazienti
  
  // Firma digitale
  signatureDataUrl: text("signature_data_url").notNull(), // Immagine firma in base64 (data URL)
  signatureTimestamp: timestamp("signature_timestamp").notNull().defaultNow(), // Timestamp firma
  
  // Metadati di verifica
  ipAddress: text("ip_address"), // IP del dispositivo
  userAgent: text("user_agent"), // Browser/App info
  deviceId: text("device_id"), // Identificativo dispositivo
  
  // Stato e audit
  isValid: boolean("is_valid").notNull().default(true), // Se l'accordo è ancora valido
  revokedAt: timestamp("revoked_at"), // Data revoca (se revocato)
  revokedReason: text("revoked_reason"), // Motivo revoca
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schema per accordi di riservatezza
export const insertStaffConfidentialityAgreementSchema = createInsertSchema(staffConfidentialityAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  signatureTimestamp: true,
});

// Types per accordi di riservatezza
export type StaffConfidentialityAgreement = typeof staffConfidentialityAgreements.$inferSelect;
export type InsertStaffConfidentialityAgreement = z.infer<typeof insertStaffConfidentialityAgreementSchema>;

// ============================================
// SERVIZI ASSEGNATI (da PDF centrale)
// ============================================

// Stato del servizio assegnato
export const serviceAssignmentStatusEnum = pgEnum("service_assignment_status", [
  "pending",       // In attesa di essere eseguito
  "in_progress",   // In corso
  "completed",     // Completato
  "cancelled",     // Annullato
  "rescheduled"    // Riprogrammato
]);

// Tipo di servizio
export const serviceTypeEnum = pgEnum("service_type", [
  "dimissione",       // Dimissione ospedaliera
  "visita",           // Visita medica
  "trasferimento",    // Trasferimento tra strutture
  "dialisi",          // Trasporto dialisi
  "coronarografia",   // Coronarografia
  "radioterapia",     // Radioterapia
  "chemioterapia",    // Chemioterapia
  "riabilitazione",   // Riabilitazione
  "day_hospital",     // Day hospital
  "altro"             // Altro
]);

// Tabella servizi assegnati
export const serviceAssignments = pgTable("service_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Identificativo progressivo del servizio (dal PDF)
  progressiveNumber: text("progressive_number"),
  
  // Assegnazione
  vehicleId: varchar("vehicle_id"), // Ambulanza assegnata
  locationId: varchar("location_id"), // Sede di riferimento (Verona/Vicenza)
  assignedBy: varchar("assigned_by"), // Chi ha assegnato (userId)
  
  // Data e orari
  serviceDate: date("service_date").notNull(), // Data del servizio
  pickupTime: time("pickup_time"), // Orario previsto di partenza
  appointmentTime: time("appointment_time"), // Orario appuntamento
  estimatedReturnTime: time("estimated_return_time"), // Orario stimato rientro
  
  // Paziente
  patientName: text("patient_name"), // Nome paziente (criptato)
  patientPhone: text("patient_phone"), // Telefono paziente
  patientNotes: text("patient_notes"), // Note sul paziente (es. barella, carrozzina)
  
  // Partenza
  departureType: text("departure_type"), // domicilio, ospedale, casa_riposo, etc
  departureAddress: text("departure_address"), // Indirizzo partenza
  departureCity: text("departure_city"), // Città partenza
  departureStructureId: varchar("departure_structure_id"), // ID struttura se ospedale/CDR
  departureDepartment: text("departure_department"), // Reparto partenza
  
  // Destinazione
  destinationType: text("destination_type"), // ospedale, ambulatorio, etc
  destinationAddress: text("destination_address"), // Indirizzo destinazione
  destinationCity: text("destination_city"), // Città destinazione
  destinationStructureId: varchar("destination_structure_id"), // ID struttura se ospedale
  destinationDepartment: text("destination_department"), // Reparto destinazione
  
  // Tipo servizio
  serviceType: text("service_type").default("altro"), // Tipo servizio
  isRoundTrip: boolean("is_round_trip").default(false), // Andata e ritorno?
  needsWheelchair: boolean("needs_wheelchair").default(false), // Serve carrozzina?
  needsStretcher: boolean("needs_stretcher").default(false), // Serve barella?
  needsOxygen: boolean("needs_oxygen").default(false), // Serve ossigeno?
  
  // Dati estratti da PDF
  pdfFileName: text("pdf_file_name"), // Nome file PDF originale
  pdfUploadedAt: timestamp("pdf_uploaded_at"), // Quando è stato caricato
  extractedData: jsonb("extracted_data"), // Dati grezzi estratti dal PDF
  
  // Collegamento a viaggio effettuato
  tripId: varchar("trip_id"), // ID del viaggio se completato
  
  // Stato
  status: text("status").default("pending").notNull(),
  completedAt: timestamp("completed_at"),
  cancelledReason: text("cancelled_reason"),
  
  // Note
  centralNotes: text("central_notes"), // Note dalla centrale
  crewNotes: text("crew_notes"), // Note dell'equipaggio
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schema per servizi assegnati
export const insertServiceAssignmentSchema = createInsertSchema(serviceAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types per servizi assegnati
export type ServiceAssignment = typeof serviceAssignments.$inferSelect;
export type InsertServiceAssignment = z.infer<typeof insertServiceAssignmentSchema>;

// ============================================================================
// HANDOFF CONSEGNE - Sistema passaggio consegne tra equipaggi
// ============================================================================

export const handoffStatusEnum = pgEnum("handoff_status", [
  "pending",    // In attesa di essere letto
  "read",       // Letto dall'equipaggio successivo
  "archived"    // Archiviato
]);

export const handoffs = pgTable("handoffs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Veicolo
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  locationId: varchar("location_id"),
  
  // Chi ha creato (equipaggio uscente)
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  shiftType: text("shift_type"), // "mattina", "pomeriggio", "notte"
  
  // Stato veicolo
  fuelLevel: integer("fuel_level"), // 0-100 percentuale
  currentKm: integer("current_km"),
  vehicleCondition: text("vehicle_condition").default("ok"), // "ok", "warning", "critical"
  
  // Anomalie e note
  hasAnomalies: boolean("has_anomalies").default(false),
  anomalies: jsonb("anomalies").$type<string[]>(), // Lista anomalie
  notes: text("notes"), // Note libere
  
  // Nuovo sistema messaggi semplificato
  message: text("message"), // Messaggio principale della consegna
  priority: text("priority").default("normal"), // urgent, normal, low
  category: text("category").default("general"), // general, maintenance, equipment, patient, safety
  kmAtHandoff: integer("km_at_handoff"), // Km al momento della consegna
  
  // Materiali
  materialsUsed: jsonb("materials_used").$type<{ item: string; quantity: number }[]>(),
  materialsNeeded: jsonb("materials_needed").$type<string[]>(),
  
  // Stato lettura
  status: text("status").default("pending").notNull(),
  readByUserId: varchar("read_by_user_id"),
  readByName: text("read_by_name"),
  readAt: timestamp("read_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Scade dopo 24h
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertHandoffSchema = createInsertSchema(handoffs).omit({
  id: true,
  createdAt: true,
  status: true,
  readByUserId: true,
  readByName: true,
  readAt: true,
});

export type Handoff = typeof handoffs.$inferSelect;
export type InsertHandoff = z.infer<typeof insertHandoffSchema>;

export const soccorsoLiveReports = pgTable("soccorso_live_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  vehicleCode: text("vehicle_code"),
  locationName: text("location_name"),
  mode: text("mode"),
  serviceData: jsonb("service_data").notNull(),
  routeData: jsonb("route_data"),
  totalKm: real("total_km"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SoccorsoLiveReport = typeof soccorsoLiveReports.$inferSelect;

// ============================================================
// FUEL CARDS (Tessere Carburante) - Wallet digitale
// ============================================================
export const fuelCards = pgTable("fuel_cards", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  cardNumber: text("card_number").notNull(),
  cardPin: text("card_pin"),
  provider: text("provider").notNull().default("LORO"),
  holderName: text("holder_name"),
  expiryDate: date("expiry_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertFuelCardSchema = createInsertSchema(fuelCards).omit({
  id: true,
  createdAt: true,
});

export type FuelCard = typeof fuelCards.$inferSelect;
export type InsertFuelCard = z.infer<typeof insertFuelCardSchema>;

// ============================================================
// FUEL ENTRIES (Rifornimenti) - Registro carburante
// ============================================================
export const fuelEntries = pgTable("fuel_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  fuelCardId: varchar("fuel_card_id"),
  date: date("date").notNull(),
  time: time("time"),
  stationName: text("station_name"),
  stationAddress: text("station_address"),
  liters: real("liters").notNull(),
  pricePerLiter: real("price_per_liter"),
  totalCost: real("total_cost"),
  kmAtRefuel: integer("km_at_refuel"),
  fuelType: text("fuel_type").default("Gasolio"),
  isSelfService: boolean("is_self_service").default(true),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertFuelEntrySchema = createInsertSchema(fuelEntries).omit({
  id: true,
  createdAt: true,
});

export type FuelEntry = typeof fuelEntries.$inferSelect;
export type InsertFuelEntry = z.infer<typeof insertFuelEntrySchema>;

// ============================================================
// SHIFT LOGS (Diario di Bordo) - Eventi turno
// ============================================================
export const shiftLogs = pgTable("shift_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  userId: varchar("user_id").notNull(),
  shiftDate: date("shift_date").notNull(),
  eventType: text("event_type").notNull(),
  eventTime: time("event_time").notNull(),
  kmReading: integer("km_reading"),
  description: text("description"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertShiftLogSchema = createInsertSchema(shiftLogs).omit({
  id: true,
  createdAt: true,
});

export type ShiftLog = typeof shiftLogs.$inferSelect;
export type InsertShiftLog = z.infer<typeof insertShiftLogSchema>;

// ============================================================
// FUEL PRICES (Prezzi Carburante) - Aggiornamento automatico
// ============================================================
export const fuelPrices = pgTable("fuel_prices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  province: text("province").notNull(),
  fuelType: text("fuel_type").notNull().default("Gasolio"),
  selfServicePrice: real("self_service_price"),
  fullServicePrice: real("full_service_price"),
  brandName: text("brand_name"),
  stationName: text("station_name"),
  stationAddress: text("station_address"),
  date: date("date").notNull(),
  source: text("source").default("MIMIT"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type FuelPrice = typeof fuelPrices.$inferSelect;

// ============================================================
// VEHICLE DOCUMENTS (Documenti Veicolo)
// ============================================================
export const documentTypeEnum = pgEnum("document_type", [
  "libretto",
  "assicurazione",
  "revisione",
  "bollo",
  "autorizzazione_sanitaria",
  "altro",
]);

export const vehicleDocuments = pgTable("vehicle_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  documentLabel: text("document_label").notNull(),
  expiryDate: date("expiry_date"),
  issueDate: date("issue_date"),
  documentNumber: text("document_number"),
  notes: text("notes"),
  photoBase64: text("photo_base64"),
  uploadedByName: text("uploaded_by_name").notNull(),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertVehicleDocumentSchema = createInsertSchema(vehicleDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VehicleDocument = typeof vehicleDocuments.$inferSelect;
export type InsertVehicleDocument = z.infer<typeof insertVehicleDocumentSchema>;

// ============================================================
// SANITIZATION LOGS (Registro Sanificazioni)
// ============================================================
export const sanitizationTypeEnum = pgEnum("sanitization_type", [
  "ordinaria",
  "straordinaria",
  "infettivo",
]);

export const sanitizationLogs = pgTable("sanitization_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  sanitizationType: sanitizationTypeEnum("sanitization_type").notNull(),
  operatorName: text("operator_name").notNull(),
  operatorUserId: varchar("operator_user_id").notNull(),
  notes: text("notes"),
  productsUsed: text("products_used"),
  tripId: varchar("trip_id"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertSanitizationLogSchema = createInsertSchema(sanitizationLogs).omit({
  id: true,
  createdAt: true,
});

export type SanitizationLog = typeof sanitizationLogs.$inferSelect;
export type InsertSanitizationLog = z.infer<typeof insertSanitizationLogSchema>;

// ============================================================================
// SCHEDA DI SOCCORSO - Digital Emergency Care Sheet
// Faithful digital reproduction of the official Italian paper form
// ============================================================================

export const rescueSheetDispatchCodeEnum = pgEnum("rescue_sheet_dispatch_code", [
  "C",  // Codice C (bianco)
  "B",  // Codice B (verde)
  "V",  // Codice V (giallo)
  "G",  // Codice G (arancione)
  "R"   // Codice R (rosso)
]);

export const rescueSheetMissionCodeEnum = pgEnum("rescue_sheet_mission_code", [
  "0", "1", "2", "3", "4"
]);

export const rescueSheets = pgTable("rescue_sheets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  progressiveNumber: text("progressive_number").notNull(),
  vehicleId: varchar("vehicle_id").notNull(),
  vehicleCode: text("vehicle_code").notNull(),
  userId: varchar("user_id").notNull(),
  locationId: varchar("location_id"),
  
  sheetDate: date("sheet_date").notNull(),
  dispatchCode: text("dispatch_code"),
  
  oraAttivazione: text("ora_attivazione"),
  inizioMissione: text("inizio_missione"),
  arrivoPosto: text("arrivo_posto"),
  partenzaPosto: text("partenza_posto"),
  arrivoRv: text("arrivo_rv"),
  partenzaDaRv: text("partenza_da_rv"),
  arrivoInH: text("arrivo_in_h"),
  operativoFine1: text("operativo_fine_1"),
  inBaseFine2: text("in_base_fine_2"),
  
  sospeso: boolean("sospeso").default(false),
  nonReperito: boolean("non_reperito").default(false),
  siAllontana: boolean("si_allontana").default(false),
  rientraInEli: boolean("rientra_in_eli").default(false),
  rendezVousIdroambulanza: boolean("rendez_vous_idroambulanza").default(false),
  
  luogoComune: text("luogo_comune"),
  luogoVia: text("luogo_via"),
  luogoProv: text("luogo_prov"),
  luogoNr: text("luogo_nr"),
  luogoRiferimenti: text("luogo_riferimenti"),
  coinvolti: integer("coinvolti"),
  idemResidenza: boolean("idem_residenza").default(false),
  
  pazienteCognome: text("paziente_cognome"),
  pazienteNome: text("paziente_nome"),
  pazienteSesso: text("paziente_sesso"),
  pazienteEtaAnni: integer("paziente_eta_anni"),
  pazienteEtaMesi: integer("paziente_eta_mesi"),
  pazienteEtaGiorni: integer("paziente_eta_giorni"),
  pazienteNatoIl: text("paziente_nato_il"),
  pazienteCf: text("paziente_cf"),
  
  residenzaComune: text("residenza_comune"),
  residenzaVia: text("residenza_via"),
  residenzaNr: text("residenza_nr"),
  residenzaProv: text("residenza_prov"),
  residenzaStatoEstero: text("residenza_stato_estero"),
  cittadinanzaIta: boolean("cittadinanza_ita").default(true),
  pazienteEmail: text("paziente_email"),
  
  giaSulPosto: jsonb("gia_sul_posto"),
  
  codiceMissione: text("codice_missione"),
  destinazionePs: boolean("destinazione_ps").default(false),
  
  equipaggio: jsonb("equipaggio"),
  
  eventoMedico: jsonb("evento_medico"),
  eventoTraumatico: jsonb("evento_traumatico"),
  eventoInfortunio: boolean("evento_infortunio").default(false),
  eventoIntossicazione: boolean("evento_intossicazione").default(false),
  
  luogoEvento: text("luogo_evento"),
  
  presentiSulPosto: jsonb("presenti_sul_posto"),
  
  allertamentoMsa: text("allertamento_msa"),
  
  rinvenimento: text("rinvenimento"),
  rinvenimentoLaterale: text("rinvenimento_laterale"),
  rinvenimentoNote: text("rinvenimento_note"),
  
  valutazioneA: jsonb("valutazione_a"),
  valutazioneB: jsonb("valutazione_b"),
  valutazioneC: jsonb("valutazione_c"),
  valutazioneD: jsonb("valutazione_d"),
  valutazioneE: jsonb("valutazione_e"),
  
  parametriVitali: jsonb("parametri_vitali"),
  
  altriSegniSintomi: jsonb("altri_segni_sintomi"),
  
  rcp: jsonb("rcp"),
  
  prestazioni: jsonb("prestazioni"),
  presidi: jsonb("presidi"),
  
  dinamicaTrauma: jsonb("dinamica_trauma"),
  
  rifiutoTrasporto: boolean("rifiuto_trasporto").default(false),
  rifiutoTrattamento: boolean("rifiuto_trattamento").default(false),
  firmaRifiuto: text("firma_rifiuto"),
  
  note: text("note"),
  
  consegnaPsNome: text("consegna_ps_nome"),
  consegnaPsTipo: text("consegna_ps_tipo"),
  consegnaPsOre: text("consegna_ps_ore"),
  consegnaPsFirma: text("consegna_ps_firma"),
  
  firmaCompilatore: text("firma_compilatore"),
  
  status: text("status").default("draft").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  organizationId: varchar("organization_id").notNull().default('croce-europa-default'),
});

export const insertRescueSheetSchema = createInsertSchema(rescueSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RescueSheet = typeof rescueSheets.$inferSelect;
export type InsertRescueSheet = z.infer<typeof insertRescueSheetSchema>;

export const demoRequestStatusEnum = pgEnum("demo_request_status", [
  "pending",
  "approved",
  "rejected"
]);

export const demoRequests = pgTable("demo_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationName: text("organization_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  city: text("city"),
  province: text("province"),
  vehicleCount: integer("vehicle_count"),
  notes: text("notes"),
  status: demoRequestStatusEnum("status").default("pending").notNull(),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
});

export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;

// =============================================
// BOOKING HUB - Transport Booking Platform
// =============================================

export const hubClientTypeEnum = pgEnum("hub_client_type", [
  "private",     // Private individual
  "facility"     // Healthcare facility (RSA, clinic, hospital, ambulatory)
]);

export const hubBookingStatusEnum = pgEnum("hub_booking_status", [
  "pending",       // Waiting for org admin approval
  "confirmed",     // Approved by org admin
  "assigned",      // Vehicle/crew assigned
  "in_transit",    // Crew on the way to pickup
  "patient_aboard", // Patient picked up
  "completed",     // Transport completed
  "cancelled",     // Cancelled by client or org
  "rejected"       // Rejected by org admin
]);

export const hubConventionStatusEnum = pgEnum("hub_convention_status", [
  "pending",    // Waiting for approval
  "active",     // Active convention
  "expired",    // Convention expired
  "suspended"   // Temporarily suspended
]);

export const hubClients = pgTable("hub_clients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  clientType: hubClientTypeEnum("client_type").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  phone: text("phone"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  fiscalCode: text("fiscal_code"),
  facilityName: text("facility_name"),
  facilityType: text("facility_type"),
  facilityVatNumber: text("facility_vat_number"),
  facilityAddress: text("facility_address"),
  facilityCity: text("facility_city"),
  facilityProvince: text("facility_province"),
  facilityPostalCode: text("facility_postal_code"),
  facilityContactPerson: text("facility_contact_person"),
  facilityPhone: text("facility_phone"),
  facilityEmail: text("facility_email"),
  isActive: boolean("is_active").default(true).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHubClientSchema = createInsertSchema(hubClients).omit({
  id: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export type HubClient = typeof hubClients.$inferSelect;
export type InsertHubClient = z.infer<typeof insertHubClientSchema>;

export const hubConventions = pgTable("hub_conventions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: hubConventionStatusEnum("status").default("pending").notNull(),
  hourlyRate: real("hourly_rate"),
  perTripRate: real("per_trip_rate"),
  monthlyFlatRate: real("monthly_flat_rate"),
  maxTripsPerMonth: integer("max_trips_per_month"),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  terms: text("terms"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHubConventionSchema = createInsertSchema(hubConventions).omit({
  id: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type HubConvention = typeof hubConventions.$inferSelect;
export type InsertHubConvention = z.infer<typeof insertHubConventionSchema>;

export const hubAvailabilitySlots = pgTable("hub_availability_slots", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  maxBookings: integer("max_bookings").default(3).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  locationId: varchar("location_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHubAvailabilitySlotSchema = createInsertSchema(hubAvailabilitySlots).omit({
  id: true,
  isActive: true,
  createdAt: true,
});

export type HubAvailabilitySlot = typeof hubAvailabilitySlots.$inferSelect;
export type InsertHubAvailabilitySlot = z.infer<typeof insertHubAvailabilitySlotSchema>;

export const hubAvailabilityOverrides = pgTable("hub_availability_overrides", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  date: date("date").notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  maxBookings: integer("max_bookings"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHubAvailabilityOverrideSchema = createInsertSchema(hubAvailabilityOverrides).omit({
  id: true,
  createdAt: true,
});

export type HubAvailabilityOverride = typeof hubAvailabilityOverrides.$inferSelect;
export type InsertHubAvailabilityOverride = z.infer<typeof insertHubAvailabilityOverrideSchema>;

export const hubServicePricing = pgTable("hub_service_pricing", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  serviceType: text("service_type").notNull(),
  serviceName: text("service_name").notNull(),
  serviceDescription: text("service_description"),
  baseFee: real("base_fee").default(25).notNull(),
  perKmRate: real("per_km_rate").default(0.90).notNull(),
  nightSupplement: real("night_supplement").default(0),
  holidaySupplement: real("holiday_supplement").default(0),
  waitingTimeRate: real("waiting_time_rate").default(0),
  stretcherSupplement: real("stretcher_supplement").default(0),
  wheelchairSupplement: real("wheelchair_supplement").default(0),
  oxygenSupplement: real("oxygen_supplement").default(0),
  medicalStaffSupplement: real("medical_staff_supplement").default(0),
  roundTripDiscount: real("round_trip_discount").default(0),
  minimumCharge: real("minimum_charge").default(50),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHubServicePricingSchema = createInsertSchema(hubServicePricing).omit({
  id: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export type HubServicePricing = typeof hubServicePricing.$inferSelect;
export type InsertHubServicePricing = z.infer<typeof insertHubServicePricingSchema>;

export const hubBookings = pgTable("hub_bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  clientId: varchar("client_id").notNull(),
  conventionId: varchar("convention_id"),
  bookingNumber: text("booking_number").notNull(),
  status: hubBookingStatusEnum("status").default("pending").notNull(),
  requestedDate: date("requested_date").notNull(),
  requestedTimeStart: time("requested_time_start").notNull(),
  requestedTimeEnd: time("requested_time_end"),
  serviceType: text("service_type").notNull(),
  patientFirstName: text("patient_first_name"),
  patientLastName: text("patient_last_name"),
  patientFiscalCode: text("patient_fiscal_code"),
  patientPhone: text("patient_phone"),
  patientGender: text("patient_gender"),
  patientBirthYear: integer("patient_birth_year"),
  patientNotes: text("patient_notes"),
  pickupAddress: text("pickup_address").notNull(),
  pickupCity: text("pickup_city"),
  pickupNotes: text("pickup_notes"),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffCity: text("dropoff_city"),
  dropoffNotes: text("dropoff_notes"),
  needsWheelchair: boolean("needs_wheelchair").default(false),
  needsStretcher: boolean("needs_stretcher").default(false),
  needsOxygen: boolean("needs_oxygen").default(false),
  roundTrip: boolean("round_trip").default(false),
  returnTime: time("return_time"),
  estimatedKm: real("estimated_km"),
  estimatedCost: real("estimated_cost"),
  finalCost: real("final_cost"),
  assignedVehicleId: varchar("assigned_vehicle_id"),
  assignedBy: varchar("assigned_by"),
  assignedAt: timestamp("assigned_at"),
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  patientAboardAt: timestamp("patient_aboard_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  rejectReason: text("reject_reason"),
  adminNotes: text("admin_notes"),
  clientNotes: text("client_notes"),
  transportReason: text("transport_reason"),
  transportDetails: text("transport_details"),
  patientBirthDate: text("patient_birth_date"),
  companionFirstName: text("companion_first_name"),
  companionLastName: text("companion_last_name"),
  companionPhone: text("companion_phone"),
  floorAssistance: boolean("floor_assistance").default(false),
  weightSupplement: text("weight_supplement"),
  estimatedDuration: integer("estimated_duration"),
  invoiceRequested: boolean("invoice_requested").default(false),
  invoiceData: text("invoice_data"),
  actualKm: real("actual_km"),
  tripId: integer("trip_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHubBookingSchema = createInsertSchema(hubBookings).omit({
  id: true,
  bookingNumber: true,
  status: true,
  estimatedKm: true,
  estimatedCost: true,
  finalCost: true,
  assignedVehicleId: true,
  assignedBy: true,
  assignedAt: true,
  confirmedAt: true,
  startedAt: true,
  patientAboardAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  rejectReason: true,
  adminNotes: true,
  tripId: true,
  createdAt: true,
  updatedAt: true,
});

export type HubBooking = typeof hubBookings.$inferSelect;
export type InsertHubBooking = z.infer<typeof insertHubBookingSchema>;

export const hubNotifications = pgTable("hub_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  recipientType: text("recipient_type").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  bookingId: varchar("booking_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  sentViaEmail: boolean("sent_via_email").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type HubNotification = typeof hubNotifications.$inferSelect;

export const hubDiscountCodes = pgTable("hub_discount_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // 'percentage', 'fixed', 'per_km'
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  minKm: numeric("min_km", { precision: 10, scale: 1 }),
  maxKm: numeric("max_km", { precision: 10, scale: 1 }),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0).notNull(),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type HubDiscountCode = typeof hubDiscountCodes.$inferSelect;

export const tenderMonitors = pgTable("tender_monitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  cpvCode: text("cpv_code"),
  cigCode: text("cig_code"),
  stationeName: text("statione_name"),
  estimatedValue: real("estimated_value"),
  deadline: timestamp("deadline"),
  publicationDate: timestamp("publication_date"),
  region: text("region"),
  province: text("province"),
  serviceType: text("service_type"),
  status: text("status").notNull().default("new"),
  requiredVehicles: integer("required_vehicles"),
  requiredPersonnel: integer("required_personnel"),
  durationMonths: integer("duration_months"),
  notes: text("notes"),
  priority: text("priority").default("medium"),
  assignedTo: varchar("assigned_to"),
  isAutoDetected: boolean("is_auto_detected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TenderMonitor = typeof tenderMonitors.$inferSelect;

export const tenderSimulations = pgTable("tender_simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  tenderId: varchar("tender_id"),
  name: text("name").notNull(),
  vehiclesCount: integer("vehicles_count").notNull().default(1),
  personnelCount: integer("personnel_count").notNull().default(2),
  hoursPerDay: real("hours_per_day").notNull().default(12),
  daysPerMonth: integer("days_per_month").notNull().default(30),
  durationMonths: integer("duration_months").notNull().default(12),
  fuelCostMonthly: real("fuel_cost_monthly"),
  personnelCostMonthly: real("personnel_cost_monthly"),
  vehicleCostMonthly: real("vehicle_cost_monthly"),
  insuranceCostMonthly: real("insurance_cost_monthly"),
  maintenanceCostMonthly: real("maintenance_cost_monthly"),
  overheadCostMonthly: real("overhead_cost_monthly"),
  totalCostMonthly: real("total_cost_monthly"),
  marginPercent: real("margin_percent").default(15),
  proposedMonthlyPrice: real("proposed_monthly_price"),
  proposedTotalPrice: real("proposed_total_price"),
  pricePerHour: real("price_per_hour"),
  pricePerKm: real("price_per_km"),
  marketAvgPrice: real("market_avg_price"),
  competitivenessScore: real("competitiveness_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TenderSimulation = typeof tenderSimulations.$inferSelect;

export const orgScoreCards = pgTable("org_score_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  totalTripsLast12m: integer("total_trips_last_12m").default(0),
  avgResponseTimeMin: real("avg_response_time_min"),
  fleetSize: integer("fleet_size").default(0),
  activePersonnel: integer("active_personnel").default(0),
  coverageAreaKm2: real("coverage_area_km2"),
  totalKmLast12m: real("total_km_last_12m"),
  operationalScore: real("operational_score").default(0),
  complianceScore: real("compliance_score").default(0),
  sustainabilityScore: real("sustainability_score").default(0),
  financialScore: real("financial_score").default(0),
  overallScore: real("overall_score").default(0),
  hasIso9001: boolean("has_iso_9001").default(false),
  hasIso45001: boolean("has_iso_45001").default(false),
  hasIso14001: boolean("has_iso_14001").default(false),
  lastCalculatedAt: timestamp("last_calculated_at"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrgScoreCard = typeof orgScoreCards.$inferSelect;

export const saasMetrics = pgTable("saas_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricDate: date("metric_date").notNull(),
  mrr: real("mrr").default(0),
  arr: real("arr").default(0),
  newMrr: real("new_mrr").default(0),
  churnedMrr: real("churned_mrr").default(0),
  expansionMrr: real("expansion_mrr").default(0),
  totalOrgs: integer("total_orgs").default(0),
  activeOrgs: integer("active_orgs").default(0),
  trialOrgs: integer("trial_orgs").default(0),
  churnedOrgs: integer("churned_orgs").default(0),
  newOrgsThisMonth: integer("new_orgs_this_month").default(0),
  totalTripsAllOrgs: integer("total_trips_all_orgs").default(0),
  totalUsersAllOrgs: integer("total_users_all_orgs").default(0),
  totalVehiclesAllOrgs: integer("total_vehicles_all_orgs").default(0),
  avgTripsPerOrg: real("avg_trips_per_org"),
  avgHealthScore: real("avg_health_score"),
  atRiskOrgs: integer("at_risk_orgs").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SaasMetric = typeof saasMetrics.$inferSelect;

export const orgHealthScores = pgTable("org_health_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  loginFrequency: real("login_frequency").default(0),
  tripsPerWeek: real("trips_per_week").default(0),
  featureAdoption: real("feature_adoption").default(0),
  dataCompleteness: real("data_completeness").default(0),
  lastActiveAt: timestamp("last_active_at"),
  daysSinceLastLogin: integer("days_since_last_login"),
  supportTickets: integer("support_tickets").default(0),
  healthScore: real("health_score").default(0),
  riskLevel: text("risk_level").default("healthy"),
  trend: text("trend").default("stable"),
  recommendedAction: text("recommended_action"),
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrgHealthScore = typeof orgHealthScores.$inferSelect;

export const revenueForecasts = pgTable("revenue_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  forecastMonth: date("forecast_month").notNull(),
  projectedRevenue: real("projected_revenue"),
  projectedCosts: real("projected_costs"),
  projectedProfit: real("projected_profit"),
  projectedTrips: integer("projected_trips"),
  projectedKm: real("projected_km"),
  confidenceLevel: real("confidence_level"),
  forecastModel: text("forecast_model").default("linear"),
  actualRevenue: real("actual_revenue"),
  actualCosts: real("actual_costs"),
  actualProfit: real("actual_profit"),
  actualTrips: integer("actual_trips"),
  revenueVariance: real("revenue_variance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RevenueForecast = typeof revenueForecasts.$inferSelect;

export const predictiveAlerts = pgTable("predictive_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  predictedDate: timestamp("predicted_date"),
  confidence: real("confidence"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  suggestedAction: text("suggested_action"),
  status: text("status").notNull().default("active"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PredictiveAlert = typeof predictiveAlerts.$inferSelect;

export const benchmarks = pgTable("benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricDate: date("metric_date").notNull(),
  metricType: text("metric_type").notNull(),
  avgValue: real("avg_value"),
  medianValue: real("median_value"),
  p25Value: real("p25_value"),
  p75Value: real("p75_value"),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  sampleSize: integer("sample_size"),
  region: text("region"),
  orgSizeCategory: text("org_size_category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Benchmark = typeof benchmarks.$inferSelect;

// ============================================================================
// REGISTRO VOLONTARI ELETTRONICO (Electronic Volunteer Registry)
// Art. 17 Codice del Terzo Settore - D.M. 6 ottobre 2021
// Implements HMAC-SHA256 integrity signing for legal compliance
// ============================================================================

export const volunteerTypeEnum = pgEnum("volunteer_type", [
  "continuativo",   // Regular/continuous volunteer (legally required)
  "occasionale"     // Occasional volunteer (optional but recommended)
]);

export const volunteerStatusEnum = pgEnum("volunteer_status", [
  "active",       // Currently active volunteer
  "suspended",    // Temporarily suspended
  "terminated"    // Ended volunteering (has endDate)
]);

export const volunteerRegistry = pgTable("volunteer_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  progressiveNumber: integer("progressive_number").notNull(),
  
  // Personal data (Art. 17 CTS requirements)
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fiscalCode: text("fiscal_code"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  gender: text("gender"),
  
  // Residence/Domicile
  residenceAddress: text("residence_address"),
  residenceCity: text("city"),
  residenceProvince: text("province"),
  residencePostalCode: text("postal_code"),
  
  // Contact info
  phone: text("phone"),
  email: text("email"),
  
  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  
  // Volunteer type and dates (core registry fields)
  volunteerType: volunteerTypeEnum("volunteer_type").default("continuativo").notNull(),
  status: volunteerStatusEnum("volunteer_status").default("active").notNull(),
  startDate: date("start_date").notNull(),
  startSignatureConfirmed: boolean("start_signature_confirmed").default(false),
  startSignatureDate: timestamp("start_signature_date"),
  endDate: date("end_date"),
  endSignatureConfirmed: boolean("end_signature_confirmed").default(false),
  endSignatureDate: timestamp("end_signature_date"),
  endReason: text("end_reason"),
  
  // Insurance info
  insuranceNotified: boolean("insurance_notified").default(false),
  insuranceNotifiedDate: date("insurance_notified_date"),
  insurancePolicyNumber: text("insurance_policy_number"),
  
  // Role and qualifications
  role: text("role"),
  qualifications: text("qualifications"),
  trainingCompleted: jsonb("training_completed").default(sql`'[]'::jsonb`),
  
  // Notes
  notes: text("notes"),
  
  // Cryptographic integrity (HMAC-SHA256)
  integrityHash: text("integrity_hash"),
  integritySignedAt: timestamp("integrity_signed_at"),
  integrityAlgorithm: text("integrity_algorithm"),
  integrityStatus: text("integrity_status").default("NOT_SIGNED"),
  
  // Audit
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVolunteerRegistrySchema = createInsertSchema(volunteerRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  integrityHash: true,
  integritySignedAt: true,
  integrityAlgorithm: true,
  integrityStatus: true,
});

export type VolunteerRegistryEntry = typeof volunteerRegistry.$inferSelect;
export type InsertVolunteerRegistryEntry = z.infer<typeof insertVolunteerRegistrySchema>;

// Volunteer Signature Requests - Digital signature workflow
export const signatureStatusEnum = pgEnum("signature_status", [
  "draft",          // Created but not sent
  "sent",           // Email sent to volunteer
  "viewed",         // Volunteer opened the signing page
  "volunteer_signed", // Volunteer has signed
  "org_signed",     // Organization has signed
  "completed",      // Both parties signed
  "expired",        // Link expired
  "cancelled"       // Cancelled by admin
]);

export const volunteerSignatures = pgTable("volunteer_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  volunteerId: varchar("volunteer_id").notNull(),
  
  token: varchar("token").notNull().unique(),
  status: signatureStatusEnum("status").default("draft").notNull(),
  
  documentType: text("document_type").default("registrazione_volontario").notNull(),
  documentTitle: text("document_title").notNull(),
  documentContent: text("document_content"),
  documentAttachments: jsonb("document_attachments").default([]),
  
  volunteerEmail: text("volunteer_email").notNull(),
  volunteerName: text("volunteer_name").notNull(),
  
  volunteerSignatureData: text("volunteer_signature_data"),
  volunteerSignedAt: timestamp("volunteer_signed_at"),
  volunteerSignedIp: text("volunteer_signed_ip"),
  
  orgSignatureData: text("org_signature_data"),
  orgSignedAt: timestamp("org_signed_at"),
  orgSignedBy: varchar("org_signed_by"),
  orgSignerName: text("org_signer_name"),
  
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  expiresAt: timestamp("expires_at"),
  
  protocolNumber: integer("protocol_number"),
  protocolYear: integer("protocol_year"),
  protocolDate: timestamp("protocol_date"),
  protocolOperator: varchar("protocol_operator"),
  protocolOperatorName: text("protocol_operator_name"),
  protocolType: text("protocol_type").default("uscita"),
  documentHash: text("document_hash"),
  protocolCancelled: boolean("protocol_cancelled").default(false),
  protocolCancelDate: timestamp("protocol_cancel_date"),
  protocolCancelReason: text("protocol_cancel_reason"),
  protocolCancelOperator: varchar("protocol_cancel_operator"),

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization Document Templates - reusable document templates for signature
export const orgDocumentTemplates = pgTable("org_document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("regolamento"),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  attachments: jsonb("attachments").default([]),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Structure Requests - pending structures/departments submitted by crew from mobile app
export const structureRequestStatusEnum = pgEnum("structure_request_status", [
  "pending",
  "approved", 
  "rejected"
]);

export const structureRequests = pgTable("structure_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  type: text("type").notNull(), // "structure" or "department"
  name: text("name").notNull(),
  address: text("address"), // only for structures
  structureType: text("structure_type"), // ospedale, casa_di_riposo, ambulatorio, etc.
  parentStructureId: varchar("parent_structure_id"), // for department requests - which structure
  submittedByUserId: varchar("submitted_by_user_id"),
  submittedByName: text("submitted_by_name"),
  vehicleCode: text("vehicle_code"),
  status: structureRequestStatusEnum("status").default("pending").notNull(),
  resolvedStructureId: varchar("resolved_structure_id"), // ID of created structure/department after approval
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStructureRequestSchema = createInsertSchema(structureRequests).omit({
  id: true,
  createdAt: true,
});

export type StructureRequest = typeof structureRequests.$inferSelect;

// Marketplace Items (modules, services, licenses, add-ons)
export const premiumModules = pgTable("premium_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  category: text("category").notNull().default("modulo"), // modulo, servizio, licenza, addon, pacchetto
  icon: text("icon").default("package"), // feather icon name
  badgeText: text("badge_text"), // e.g. "NUOVO", "POPOLARE", "BEST SELLER"
  badgeColor: text("badge_color"), // e.g. "#00A651", "#f59e0b"
  priceMonthly: integer("price_monthly").notNull().default(0), // cents
  priceYearly: integer("price_yearly").notNull().default(0), // cents
  priceOneTime: integer("price_one_time"), // cents, for one-time purchases (licenses, services)
  billingType: text("billing_type").notNull().default("recurring"), // recurring, one_time, custom
  trialDays: integer("trial_days").default(0),
  maxUsers: integer("max_users"), // for license-based items
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  stripeProductId: text("stripe_product_id"),
  features: jsonb("features").default(sql`'[]'::jsonb`),
  requirements: jsonb("requirements").default(sql`'[]'::jsonb`), // prerequisite module keys
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PremiumModule = typeof premiumModules.$inferSelect;

// Organization Subscriptions
export const orgSubscriptions = pgTable("org_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  moduleKey: text("module_key").notNull(),
  moduleName: text("module_name"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").notNull().default("active"), // active, cancelled, past_due, trialing, trial_expired
  billingPeriod: text("billing_period").default("monthly"), // monthly, yearly
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  amount: integer("amount").default(0), // price in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrgSubscription = typeof orgSubscriptions.$inferSelect;

// Payment History
export const paymentHistory = pgTable("payment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  invoiceNumber: text("invoice_number"),
  amount: integer("amount").notNull(), // cents
  currency: text("currency").default("eur").notNull(),
  status: text("status").notNull(), // succeeded, failed, pending, refunded
  description: text("description"),
  moduleKey: text("module_key"),
  moduleName: text("module_name"),
  billingPeriod: text("billing_period"),
  orgName: text("org_name"),
  orgVatNumber: text("org_vat_number"),
  orgAddress: text("org_address"),
  orgFiscalCode: text("org_fiscal_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaymentRecord = typeof paymentHistory.$inferSelect;

// Manual invoices table — for superadmin-issued invoices outside Stripe
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("paid"), // paid | pending | cancelled
  invoiceDate: date("invoice_date").defaultNow().notNull(),
  paymentMethod: text("payment_method").default("manual"), // manual | stripe
  stripeInvoiceId: text("stripe_invoice_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export type Invoice = typeof invoices.$inferSelect;

export const insertVolunteerSignatureSchema = createInsertSchema(volunteerSignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VolunteerSignature = typeof volunteerSignatures.$inferSelect;

// =============================================
// Custom Roles & Access Management
// =============================================

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked"
]);

export const orgCustomRoles = pgTable("org_custom_roles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`).notNull(),
  color: text("color").default("#6B7280"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameOrgUnique: uniqueIndex("custom_role_name_org_unique").on(table.name, table.organizationId),
}));

export type OrgCustomRole = typeof orgCustomRoles.$inferSelect;

export const orgUserInvitations = pgTable("org_user_invitations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  customRoleId: varchar("custom_role_id"),
  standardRole: text("standard_role"),
  email: text("email").notNull(),
  name: text("name").notNull(),
  temporaryPassword: text("temporary_password").notNull(),
  status: invitationStatusEnum("status").default("pending").notNull(),
  invitedBy: varchar("invited_by"),
  userId: varchar("user_id"),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrgUserInvitation = typeof orgUserInvitations.$inferSelect;

export const orgAccessLogs = pgTable("org_access_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name"),
  action: text("action").notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrgAccessLog = typeof orgAccessLogs.$inferSelect;

// Monitoring Tokens - for external CUT/ULSS portal access
export const monitoringTokens = pgTable("monitoring_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  token: varchar("token").notNull().unique(),
  name: text("name").notNull().default("Portale CUT"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0),
});

export type MonitoringToken = typeof monitoringTokens.$inferSelect;

// PDF Location Mappings - cache for resolving PDF text to DB structures
export const pdfLocationMappings = pgTable("pdf_location_mappings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  pdfText: text("pdf_text").notNull(),
  locationType: text("location_type").notNull(),
  resolvedName: text("resolved_name"),
  resolvedAddress: text("resolved_address"),
  resolvedCity: text("resolved_city"),
  resolvedLat: numeric("resolved_lat"),
  resolvedLng: numeric("resolved_lng"),
  linkedEntityId: text("linked_entity_id"),
  linkedEntityType: text("linked_entity_type"),
  useAsText: boolean("use_as_text").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PdfLocationMapping = typeof pdfLocationMappings.$inferSelect;

// ============================================================
// PROVIDER INFRASTRUCTURE TABLES
// ============================================================

/** Generic API response cache (L2 persistent cache) */
export const apiCache = pgTable("api_cache", {
  id: varchar("id", { length: 255 }).primaryKey(),
  category: text("category").notNull(),        // geo, weather, traffic, etc.
  key: text("key").notNull(),                   // cache key
  data: jsonb("data").notNull(),                // cached response
  source: text("source").notNull(),             // provider name
  hitCount: integer("hit_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  organizationId: text("organization_id"),
});
export type ApiCacheEntry = typeof apiCache.$inferSelect;

/** Alert severity enum */
export const alertSeverityEnum = pgEnum("alert_severity", ["green", "yellow", "orange", "red"]);

/** Emergency alerts from Protezione Civile */
export const emergencyAlerts = pgTable("emergency_alerts", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),                 // meteo, idro, idrogeo, etc.
  severity: alertSeverityEnum("severity").notNull(),
  region: text("region").notNull(),
  zones: jsonb("zones").default([]),
  description: text("description"),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  source: text("source").notNull(),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type EmergencyAlertRecord = typeof emergencyAlerts.$inferSelect;

/** Italian national/regional holidays */
export const holidays = pgTable("holidays", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  localName: text("local_name").notNull(),      // Italian name
  name: text("name").notNull(),                 // English name
  countryCode: text("country_code").default("IT"),
  fixed: boolean("fixed").default(true),
  global: boolean("global").default(true),
  types: jsonb("types").default([]),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type HolidayRecord = typeof holidays.$inferSelect;

/** SMS notification channel enum */
export const smsStatusEnum = pgEnum("sms_status", ["queued", "sent", "delivered", "failed", "expired"]);

/** SMS delivery log */
export const smsLog = pgTable("sms_log", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name"),
  message: text("message").notNull(),
  provider: text("provider").notNull(),         // brevo, twilio, etc.
  status: smsStatusEnum("status").default("queued"),
  externalId: text("external_id"),              // provider's message ID
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  cost: real("cost"),                           // cost in EUR
  templateName: text("template_name"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SmsLogEntry = typeof smsLog.$inferSelect;

/** Notification channel preference enum */
export const notificationChannelEnum = pgEnum("notification_channel", ["push", "sms", "email", "telegram"]);

/** User notification preferences */
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  enabled: boolean("enabled").default(true),
  // Notification types this channel applies to
  shiftReminders: boolean("shift_reminders").default(true),
  tripUpdates: boolean("trip_updates").default(true),
  emergencyAlerts: boolean("emergency_alerts").default(true),
  systemNotifications: boolean("system_notifications").default(true),
  marketingComms: boolean("marketing_comms").default(false),
  // Channel-specific config
  telegramChatId: text("telegram_chat_id"),
  preferredLanguage: text("preferred_language").default("it"),
  quietHoursStart: time("quiet_hours_start"),  // e.g. 22:00
  quietHoursEnd: time("quiet_hours_end"),      // e.g. 07:00
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

/** SSN (Servizio Sanitario Nazionale) structures */
export const ssnStructures = pgTable("ssn_structures", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  codiceStruttura: text("codice_struttura"),     // Ministry code
  denominazione: text("denominazione").notNull(),
  tipologia: text("tipologia"),                   // ospedale, RSA, ambulatorio, etc.
  indirizzo: text("indirizzo"),
  comune: text("comune"),
  provincia: text("provincia"),
  regione: text("regione"),
  cap: text("cap"),
  lat: real("lat"),
  lon: real("lon"),
  telefono: text("telefono"),
  email: text("email"),
  website: text("website"),
  lastSyncedAt: timestamp("last_synced_at"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SsnStructureRecord = typeof ssnStructures.$inferSelect;

/** Isochrone zones — areas reachable within X minutes */
export const isochroneZones = pgTable("isochrone_zones", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  locationId: integer("location_id"),            // FK to locations
  centerLat: real("center_lat").notNull(),
  centerLon: real("center_lon").notNull(),
  minutesRange: integer("minutes_range").notNull(),  // e.g. 15, 30, 60
  profile: text("profile").default("driving-car"),   // ORS profile
  polygon: jsonb("polygon"),                          // GeoJSON polygon
  calculatedAt: timestamp("calculated_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  provider: text("provider").default("openrouteservice"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type IsochroneZoneRecord = typeof isochroneZones.$inferSelect;

// ============================================================================
// PDF TEMPLATE MAPPING — Multi-org PDF column configuration
// ============================================================================

export const pdfTemplates = pgTable("pdf_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull().default("Template Principale"),
  // columnMapping: { mappings: [{ pdf_column_index, pdf_column_name, system_field, transform }] }
  columnMapping: jsonb("column_mapping").notNull().default({}),
  skipHeaderRows: integer("skip_header_rows").default(1),
  skipFooterRows: integer("skip_footer_rows").default(0),
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  timeFormat: text("time_format").default("HH:mm"),
  sampleHeaders: jsonb("sample_headers").default([]),
  sampleRow: jsonb("sample_row").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by"),
});

export type PdfTemplate = typeof pdfTemplates.$inferSelect;
export type InsertPdfTemplate = typeof pdfTemplates.$inferInsert;
