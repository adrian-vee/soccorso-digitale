import {
  users,
  locations,
  userLocations,
  vehicles,
  structures,
  departments,
  structureDepartments,
  trips,
  tripDeviceAuthorizations,
  tripGpsPoints,
  activeTrackingSessions,
  auditLogs,
  announcements,
  announcementReads,
  financialProfiles,
  financialParameters,
  staffRolesCosts,
  revenueModels,
  contracts,
  contractVehicles,
  scheduledServices,
  checklistTemplateItems,
  vehicleChecklists,
  chatMessages,
  chatMessageReads,
  inventoryItems,
  vehicleInventory,
  vehicleInventoryTemplates,
  templateItems,
  vehicleTemplateAssignments,
  sportingEvents,
  eventInventoryLog,
  warehouseStock,
  inventoryUsage,
  inventoryReplenish,
  inventoryExpiryAlerts,
  barcodeProductCache,
  staffMembers,
  shiftTemplates,
  shiftInstances,
  shiftAssignments,
  staffAvailability,
  shiftSwapRequests,
  serviceEvents,
  eventAssignments,
  shiftActivityLogs,
  volunteerReimbursements,
  reimbursementShifts,
  locationDistances,
  handoffs,
  type User,
  type InsertUser,
  type Location,
  type InsertLocation,
  type UserLocation,
  type InsertUserLocation,
  type Vehicle,
  type InsertVehicle,
  type Structure,
  type InsertStructure,
  type Department,
  type InsertDepartment,
  type StructureDepartment,
  type InsertStructureDepartment,
  type Trip,
  type InsertTrip,
  type TripDeviceAuthorization,
  type InsertTripDeviceAuthorization,
  type AuditLog,
  type InsertAuditLog,
  type Announcement,
  type InsertAnnouncement,
  type AnnouncementRead,
  type InsertAnnouncementRead,
  type FinancialProfile,
  type InsertFinancialProfile,
  type FinancialParameter,
  type InsertFinancialParameter,
  type StaffRoleCost,
  type InsertStaffRoleCost,
  type RevenueModel,
  type InsertRevenueModel,
  type Contract,
  type InsertContract,
  type ContractVehicle,
  type InsertContractVehicle,
  type ScheduledService,
  type InsertScheduledService,
  type ChecklistTemplateItem,
  type InsertChecklistTemplateItem,
  type VehicleChecklist,
  type InsertVehicleChecklist,
  type ChatMessage,
  type InsertChatMessage,
  type ChatMessageRead,
  type InventoryItem,
  type InsertInventoryItem,
  type VehicleInventory,
  type InsertVehicleInventory,
  type WarehouseStock,
  type InsertWarehouseStock,
  type InventoryUsage,
  type InsertInventoryUsage,
  type InventoryReplenish,
  type InsertInventoryReplenish,
  type InventoryExpiryAlert,
  type VehicleInventoryTemplate,
  type InsertVehicleInventoryTemplate,
  type TemplateItem,
  type InsertTemplateItem,
  type VehicleTemplateAssignment,
  type InsertVehicleTemplateAssignment,
  type SportingEvent,
  type InsertSportingEvent,
  type EventInventoryLog,
  type InsertEventInventoryLog,
  type BarcodeProductCache,
  type InsertBarcodeProductCache,
  type StaffMember,
  type InsertStaffMember,
  type ShiftTemplate,
  type InsertShiftTemplate,
  type ShiftInstance,
  type InsertShiftInstance,
  type ShiftAssignment,
  type InsertShiftAssignment,
  type StaffAvailability,
  type InsertStaffAvailability,
  type ShiftSwapRequest,
  type InsertShiftSwapRequest,
  type ServiceEvent,
  type InsertServiceEvent,
  type EventAssignment,
  type InsertEventAssignment,
  type ShiftActivityLog,
  type InsertShiftActivityLog,
  type VolunteerReimbursement,
  type InsertVolunteerReimbursement,
  type ReimbursementShift,
  type InsertReimbursementShift,
  type LocationDistance,
  type InsertLocationDistance,
  type Handoff,
  type InsertHandoff,
  userSettings,
  scadenzeReports,
  expiryCorrectionRequests,
  type UserSettings,
  type InsertUserSettings,
  type ScadenzeReport,
  type InsertScadenzeReport,
  type ExpiryCorrectionRequest,
  type InsertExpiryCorrectionRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByToken(token: string): Promise<User | undefined>;
  updateUserToken(userId: string, token: string): Promise<void>;
  updateUserLastLogin(userId: string): Promise<void>;
  updateUserLastLogout(userId: string): Promise<void>;
  createUser(user: InsertUser): Promise<User>;
  
  // Locations
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;
  
  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehiclesByLocation(locationId: string): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;
  updateVehicleKm(id: string, km: number): Promise<Vehicle | undefined>;
  
  // Structures
  getStructures(): Promise<Structure[]>;
  getStructuresByType(type: string): Promise<Structure[]>;
  getStructureById(id: string): Promise<Structure | undefined>;
  createStructure(structure: InsertStructure): Promise<Structure>;
  updateStructure(id: string, data: Partial<InsertStructure>): Promise<Structure | undefined>;
  deleteStructure(id: string): Promise<boolean>;
  updateStructureCoords(id: string, lat: string, lon: string): Promise<Structure | undefined>;
  
  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartmentById(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  deleteDepartment(id: string): Promise<boolean>;
  
  // Structure-Departments (many-to-many)
  getStructureDepartments(structureId: string): Promise<Department[]>;
  addDepartmentToStructure(structureId: string, departmentId: string): Promise<StructureDepartment>;
  removeDepartmentFromStructure(structureId: string, departmentId: string): Promise<boolean>;
  
  // Trips
  getTrips(): Promise<Trip[]>;
  getTripsByVehicle(vehicleId: string): Promise<Trip[]>;
  getTripsByUser(userId: string): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  getLastTripByVehicle(vehicleId: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: string, trip: Partial<InsertTrip>): Promise<Trip | undefined>;
  deleteTrip(id: string): Promise<boolean>;
  getNextProgressiveNumber(vehicleId: string): Promise<string>;
  
  // Device Authorizations
  createDeviceAuthorization(auth: InsertTripDeviceAuthorization): Promise<TripDeviceAuthorization>;
  getDeviceAuthorizationByTrip(tripId: string): Promise<TripDeviceAuthorization | undefined>;
  getTripsWithDeviceAuth(): Promise<string[]>;
  
  // Audit logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Checklist Template Items
  getChecklistTemplateItems(organizationId?: string): Promise<ChecklistTemplateItem[]>;
  getActiveChecklistTemplateItems(organizationId?: string): Promise<ChecklistTemplateItem[]>;
  getChecklistTemplateItem(id: string): Promise<ChecklistTemplateItem | undefined>;
  createChecklistTemplateItem(item: InsertChecklistTemplateItem): Promise<ChecklistTemplateItem>;
  updateChecklistTemplateItem(id: string, data: Partial<InsertChecklistTemplateItem>): Promise<ChecklistTemplateItem | undefined>;
  deleteChecklistTemplateItem(id: string): Promise<boolean>;
  
  // Vehicle Checklists
  getVehicleChecklists(vehicleId: string, limit?: number): Promise<VehicleChecklist[]>;
  getVehicleChecklistById(id: string): Promise<VehicleChecklist | undefined>;
  getVehicleChecklistsByDateRange(vehicleId: string, startDate: string, endDate: string): Promise<VehicleChecklist[]>;
  getVehicleChecklistsForMonth(year: number, month: number, organizationId?: string): Promise<VehicleChecklist[]>;
  getVehicleChecklistsForOrg(organizationId: string, limit?: number): Promise<VehicleChecklist[]>;
  getTodayChecklistForVehicle(vehicleId: string): Promise<VehicleChecklist | undefined>;
  createVehicleChecklist(checklist: InsertVehicleChecklist): Promise<VehicleChecklist>;
  updateVehicleChecklist(id: string, updates: Partial<VehicleChecklist>): Promise<VehicleChecklist>;
  markChecklistReportSent(checklistIds: string[]): Promise<void>;
  
  // Chat Interna
  getChatMessages(limit?: number, before?: string): Promise<ChatMessage[]>;
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessage(id: string): Promise<boolean>;
  getUnreadCountForUser(userId: string): Promise<number>;
  markMessagesAsRead(userId: string, messageIds: string[]): Promise<void>;
  getMessageReaders(messageId: string): Promise<Array<{userId: string; vehicleCode: string | null; readAt: Date}>>;
  
  // Handoff Consegne
  getHandoffsForVehicle(vehicleId: string): Promise<Handoff[]>;
  getPendingHandoffForVehicle(vehicleId: string): Promise<Handoff | undefined>;
  createHandoff(handoff: InsertHandoff): Promise<Handoff>;
  markHandoffAsRead(id: string, userId: string, userName: string): Promise<Handoff>;
  archiveHandoff(id: string): Promise<void>;
  
  // Expiry Correction Requests
  createExpiryCorrectionRequest(request: InsertExpiryCorrectionRequest): Promise<ExpiryCorrectionRequest>;
  getExpiryCorrectionRequests(filters?: { status?: string; locationId?: string }): Promise<ExpiryCorrectionRequest[]>;
  updateExpiryCorrectionRequest(id: string, data: Partial<ExpiryCorrectionRequest>): Promise<ExpiryCorrectionRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.authToken, token));
    return user || undefined;
  }

  async updateUserToken(userId: string, token: string): Promise<void> {
    await db.update(users).set({ authToken: token }).where(eq(users.id, userId));
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserLastLogout(userId: string): Promise<void> {
    await db.update(users).set({ lastLogoutAt: new Date() }).where(eq(users.id, userId));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.name);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const [location] = await db.insert(locations).values(insertLocation).returning();
    return location;
  }

  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [location] = await db
      .update(locations)
      .set(data)
      .where(eq(locations.id, id))
      .returning();
    return location || undefined;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id)).returning();
    return result.length > 0;
  }

  // User-Location assignments (Branch Manager access)
  async getUserLocations(userId: string): Promise<(UserLocation & { location: Location })[]> {
    const results = await db
      .select({
        userLocation: userLocations,
        location: locations
      })
      .from(userLocations)
      .innerJoin(locations, eq(userLocations.locationId, locations.id))
      .where(eq(userLocations.userId, userId));
    return results.map(r => ({ ...r.userLocation, location: r.location }));
  }

  async getLocationManagers(locationId: string): Promise<(UserLocation & { user: User })[]> {
    const results = await db
      .select({
        userLocation: userLocations,
        user: users
      })
      .from(userLocations)
      .innerJoin(users, eq(userLocations.userId, users.id))
      .where(eq(userLocations.locationId, locationId));
    return results.map(r => ({ ...r.userLocation, user: r.user }));
  }

  async getAllBranchManagers(): Promise<(User & { assignedLocations: Location[] })[]> {
    const managers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'branch_manager'));
    
    const result = await Promise.all(managers.map(async (manager) => {
      const locs = await this.getUserLocations(manager.id);
      return { ...manager, assignedLocations: locs.map(l => l.location) };
    }));
    return result;
  }

  async createUserLocation(data: InsertUserLocation): Promise<UserLocation> {
    const [userLocation] = await db.insert(userLocations).values(data).returning();
    return userLocation;
  }

  async updateUserLocation(id: string, data: Partial<InsertUserLocation>): Promise<UserLocation | undefined> {
    const [userLocation] = await db
      .update(userLocations)
      .set(data)
      .where(eq(userLocations.id, id))
      .returning();
    return userLocation || undefined;
  }

  async deleteUserLocation(id: string): Promise<boolean> {
    const result = await db.delete(userLocations).where(eq(userLocations.id, id)).returning();
    return result.length > 0;
  }

  async deleteAllUserLocations(userId: string): Promise<boolean> {
    const result = await db.delete(userLocations).where(eq(userLocations.userId, userId)).returning();
    return result.length >= 0;
  }

  async canUserAccessLocation(userId: string, locationId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'director') return true;
    
    const [assignment] = await db
      .select()
      .from(userLocations)
      .where(and(
        eq(userLocations.userId, userId),
        eq(userLocations.locationId, locationId)
      ));
    return !!assignment;
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(vehicles.code);
  }

  async getVehiclesByLocation(locationId: string): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.locationId, locationId), eq(vehicles.isActive, true)))
      .orderBy(vehicles.code);
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .update(vehicles)
      .set(data)
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle || undefined;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const result = await db.delete(vehicles).where(eq(vehicles.id, id)).returning();
    return result.length > 0;
  }

  async updateVehicleKm(id: string, km: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .update(vehicles)
      .set({ currentKm: km })
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle || undefined;
  }

  async updateVehicleLocation(id: string, lat: string, lon: string, isOnService: boolean): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .update(vehicles)
      .set({ 
        latitude: lat, 
        longitude: lon, 
        lastLocationAt: new Date(),
        isOnService: isOnService
      })
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle || undefined;
  }

  async getVehiclesWithLocation(): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.isActive, true))
      .orderBy(vehicles.code);
  }

  // Structures
  async getStructures(): Promise<Structure[]> {
    return await db.select().from(structures).orderBy(structures.name);
  }

  async getStructuresByType(type: string): Promise<Structure[]> {
    return await db
      .select()
      .from(structures)
      .where(eq(structures.type, type))
      .orderBy(structures.name);
  }

  async getStructureById(id: string): Promise<Structure | undefined> {
    const [structure] = await db.select().from(structures).where(eq(structures.id, id));
    return structure || undefined;
  }

  async createStructure(insertStructure: InsertStructure): Promise<Structure> {
    const [structure] = await db.insert(structures).values(insertStructure).returning();
    return structure;
  }

  async updateStructure(id: string, data: Partial<InsertStructure>): Promise<Structure | undefined> {
    const [structure] = await db
      .update(structures)
      .set(data)
      .where(eq(structures.id, id))
      .returning();
    return structure || undefined;
  }

  async deleteStructure(id: string): Promise<boolean> {
    const result = await db.delete(structures).where(eq(structures.id, id));
    return true;
  }

  async updateStructureCoords(id: string, lat: string, lon: string): Promise<Structure | undefined> {
    const [structure] = await db
      .update(structures)
      .set({ latitude: lat, longitude: lon })
      .where(eq(structures.id, id))
      .returning();
    return structure || undefined;
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async getDepartmentById(id: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || undefined;
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const [department] = await db.insert(departments).values(insertDepartment).returning();
    return department;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await db.delete(structureDepartments).where(eq(structureDepartments.departmentId, id));
    await db.delete(departments).where(eq(departments.id, id));
    return true;
  }

  // Structure-Departments (many-to-many)
  async getStructureDepartments(structureId: string): Promise<Department[]> {
    const mappings = await db
      .select()
      .from(structureDepartments)
      .where(eq(structureDepartments.structureId, structureId));
    
    if (mappings.length === 0) return [];
    
    const departmentIds = mappings.map(m => m.departmentId);
    const allDepts = await db.select().from(departments).orderBy(departments.name);
    return allDepts.filter(d => departmentIds.includes(d.id));
  }

  async addDepartmentToStructure(structureId: string, departmentId: string): Promise<StructureDepartment> {
    // Check if mapping already exists to prevent duplicates
    const existing = await db
      .select()
      .from(structureDepartments)
      .where(
        and(
          eq(structureDepartments.structureId, structureId),
          eq(structureDepartments.departmentId, departmentId)
        )
      );
    
    if (existing.length > 0) {
      throw { code: '23505', message: 'Duplicate mapping' };
    }
    
    const [mapping] = await db
      .insert(structureDepartments)
      .values({ structureId, departmentId })
      .returning();
    return mapping;
  }

  async removeDepartmentFromStructure(structureId: string, departmentId: string): Promise<boolean> {
    const result = await db
      .delete(structureDepartments)
      .where(
        and(
          eq(structureDepartments.structureId, structureId),
          eq(structureDepartments.departmentId, departmentId)
        )
      )
      .returning();
    return result.length > 0;
  }

  // Trips
  async getTrips(): Promise<Trip[]> {
    return await db.select().from(trips).orderBy(desc(trips.createdAt)).limit(500);
  }

  async getTripsFiltered(filters: {
    dateFrom?: string;
    dateTo?: string;
    vehicleIds?: string[];
    serviceTypes?: string[];
    organizationId?: string;
  }): Promise<Trip[]> {
    const conditions = [];
    
    if (filters.dateFrom) {
      conditions.push(gte(trips.serviceDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(trips.serviceDate, filters.dateTo));
    }
    if (filters.vehicleIds && filters.vehicleIds.length > 0) {
      conditions.push(inArray(trips.vehicleId, filters.vehicleIds));
    }
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      conditions.push(inArray(trips.serviceType, filters.serviceTypes));
    }
    if (filters.organizationId) {
      conditions.push(eq(trips.organizationId, filters.organizationId));
    }
    
    if (conditions.length === 0) {
      return await db.select().from(trips).orderBy(desc(trips.serviceDate));
    }
    
    return await db
      .select()
      .from(trips)
      .where(and(...conditions))
      .orderBy(desc(trips.serviceDate));
  }

  async getTripsByVehicle(vehicleId: string): Promise<Trip[]> {
    return await db
      .select()
      .from(trips)
      .where(eq(trips.vehicleId, vehicleId))
      .orderBy(desc(trips.createdAt))
      .limit(500);
  }

  async getTripsByUser(userId: string): Promise<Trip[]> {
    return await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.createdAt))
      .limit(500);
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async getLastTripByVehicle(vehicleId: string): Promise<Trip | undefined> {
    const [trip] = await db
      .select()
      .from(trips)
      .where(eq(trips.vehicleId, vehicleId))
      .orderBy(desc(trips.createdAt))
      .limit(1);
    return trip || undefined;
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const [trip] = await db.insert(trips).values(insertTrip).returning();
    return trip;
  }

  async updateTrip(id: string, tripUpdate: Partial<InsertTrip>): Promise<Trip | undefined> {
    const [trip] = await db
      .update(trips)
      .set({ ...tripUpdate, updatedAt: new Date() })
      .where(eq(trips.id, id))
      .returning();
    return trip || undefined;
  }

  async deleteTrip(id: string): Promise<boolean> {
    const result = await db.delete(trips).where(eq(trips.id, id)).returning();
    return result.length > 0;
  }

  async getNextProgressiveNumber(vehicleId: string): Promise<string> {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) return "1";
    
    const vehicleTrips = await this.getTripsByVehicle(vehicleId);
    const nextNum = vehicleTrips.length + 1;
    
    // Format: vehicle sequence - total count (e.g., "1141-28716")
    return `${nextNum}`;
  }

  // Device Authorizations
  async createDeviceAuthorization(auth: InsertTripDeviceAuthorization): Promise<TripDeviceAuthorization> {
    const [authorization] = await db.insert(tripDeviceAuthorizations).values(auth).returning();
    return authorization;
  }

  async getDeviceAuthorizationByTrip(tripId: string): Promise<TripDeviceAuthorization | undefined> {
    const [authorization] = await db
      .select()
      .from(tripDeviceAuthorizations)
      .where(eq(tripDeviceAuthorizations.tripId, tripId));
    return authorization || undefined;
  }

  async getTripsWithDeviceAuth(): Promise<string[]> {
    const results = await db
      .select({ tripId: tripDeviceAuthorizations.tripId })
      .from(tripDeviceAuthorizations);
    return results.map(r => r.tripId);
  }

  // Audit logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(insertAuditLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(insertAuditLog).returning();
    return log;
  }

  // Announcements
  async getAnnouncements(): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.createdAt));
  }

  async getUnreadAnnouncementsForUser(userId: string, organizationId?: string | null): Promise<Announcement[]> {
    const conditions = [eq(announcements.isActive, true)];
    if (organizationId) {
      conditions.push(eq(announcements.organizationId, organizationId));
    }
    const allActive = await db
      .select()
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.createdAt));
    
    const userReads = await db
      .select()
      .from(announcementReads)
      .where(eq(announcementReads.userId, userId));
    
    const readAnnouncementIds = new Set(userReads.map(r => r.announcementId));
    
    return allActive.filter(a => {
      if (readAnnouncementIds.has(a.id)) return false;
      if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
      return true;
    });
  }

  async getAllAnnouncements(): Promise<(Announcement & { readCount: number })[]> {
    const allAnnouncements = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
    
    // Get read counts for each announcement
    const readCounts = await db
      .select({
        announcementId: announcementReads.announcementId,
        count: sql<number>`count(*)::int`,
      })
      .from(announcementReads)
      .groupBy(announcementReads.announcementId);
    
    const readCountMap = new Map(readCounts.map(r => [r.announcementId, r.count]));
    
    return allAnnouncements.map(a => ({
      ...a,
      readCount: readCountMap.get(a.id) || 0,
    }));
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement || undefined;
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [announcement] = await db.insert(announcements).values(data).returning();
    return announcement;
  }

  async updateAnnouncement(id: string, data: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [announcement] = await db
      .update(announcements)
      .set(data)
      .where(eq(announcements.id, id))
      .returning();
    return announcement || undefined;
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const result = await db.delete(announcements).where(eq(announcements.id, id)).returning();
    return result.length > 0;
  }

  // Announcement reads
  async getAnnouncementReads(announcementId: string): Promise<AnnouncementRead[]> {
    return await db
      .select()
      .from(announcementReads)
      .where(eq(announcementReads.announcementId, announcementId));
  }

  async getUserAnnouncementReads(userId: string): Promise<AnnouncementRead[]> {
    return await db
      .select()
      .from(announcementReads)
      .where(eq(announcementReads.userId, userId));
  }

  async markAnnouncementAsRead(announcementId: string, userId: string): Promise<AnnouncementRead> {
    // Check if already read
    const existing = await db
      .select()
      .from(announcementReads)
      .where(and(
        eq(announcementReads.announcementId, announcementId),
        eq(announcementReads.userId, userId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [read] = await db
      .insert(announcementReads)
      .values({ announcementId, userId })
      .returning();
    return read;
  }

  // Get all users for announcement read status
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  // Get all structure-department mappings for export
  async getAllStructureDepartments(): Promise<StructureDepartment[]> {
    return await db.select().from(structureDepartments);
  }

  // Upsert methods for data import
  async upsertLocation(data: Location): Promise<Location> {
    const [result] = await db
      .insert(locations)
      .values(data)
      .onConflictDoUpdate({
        target: locations.id,
        set: { name: data.name, address: data.address }
      })
      .returning();
    return result;
  }

  async upsertVehicle(data: Vehicle): Promise<Vehicle> {
    const [result] = await db
      .insert(vehicles)
      .values(data)
      .onConflictDoUpdate({
        target: vehicles.id,
        set: {
          code: data.code,
          licensePlate: data.licensePlate,
          model: data.model,
          displacement: data.displacement,
          kw: data.kw,
          fuelType: data.fuelType,
          locationId: data.locationId,
          currentKm: data.currentKm,
          isActive: data.isActive
        }
      })
      .returning();
    return result;
  }

  async upsertStructure(data: Structure): Promise<Structure> {
    const [result] = await db
      .insert(structures)
      .values(data)
      .onConflictDoUpdate({
        target: structures.id,
        set: {
          name: data.name,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          type: data.type,
          phoneNumber: data.phoneNumber,
          accessCode: data.accessCode
        }
      })
      .returning();
    return result;
  }

  async upsertDepartment(data: Department): Promise<Department> {
    const [result] = await db
      .insert(departments)
      .values(data)
      .onConflictDoUpdate({
        target: departments.id,
        set: { name: data.name }
      })
      .returning();
    return result;
  }

  async upsertStructureDepartment(data: StructureDepartment): Promise<StructureDepartment> {
    const [result] = await db
      .insert(structureDepartments)
      .values(data)
      .onConflictDoUpdate({
        target: structureDepartments.id,
        set: {
          structureId: data.structureId,
          departmentId: data.departmentId
        }
      })
      .returning();
    return result;
  }

  async upsertUser(data: User): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          password: data.password,
          name: data.name,
          role: data.role,
          locationId: data.locationId
        }
      })
      .returning();
    return result;
  }

  // Financial Profiles
  async getFinancialProfiles(): Promise<FinancialProfile[]> {
    return await db.select().from(financialProfiles).orderBy(desc(financialProfiles.createdAt));
  }

  async getFinancialProfile(id: string): Promise<FinancialProfile | undefined> {
    const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.id, id));
    return profile || undefined;
  }

  async getDefaultFinancialProfile(): Promise<FinancialProfile | undefined> {
    const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.isDefault, true));
    return profile || undefined;
  }

  async createFinancialProfile(data: InsertFinancialProfile): Promise<FinancialProfile> {
    if (data.isDefault) {
      await db.update(financialProfiles).set({ isDefault: false });
    }
    const [profile] = await db.insert(financialProfiles).values(data).returning();
    return profile;
  }

  async updateFinancialProfile(id: string, data: Partial<InsertFinancialProfile>): Promise<FinancialProfile | undefined> {
    if (data.isDefault) {
      await db.update(financialProfiles).set({ isDefault: false });
    }
    const [profile] = await db
      .update(financialProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(financialProfiles.id, id))
      .returning();
    return profile || undefined;
  }

  async deleteFinancialProfile(id: string): Promise<boolean> {
    await db.delete(financialParameters).where(eq(financialParameters.profileId, id));
    await db.delete(staffRolesCosts).where(eq(staffRolesCosts.profileId, id));
    await db.delete(revenueModels).where(eq(revenueModels.profileId, id));
    const result = await db.delete(financialProfiles).where(eq(financialProfiles.id, id)).returning();
    return result.length > 0;
  }

  // Financial Parameters
  async getFinancialParameters(profileId: string): Promise<FinancialParameter[]> {
    return await db
      .select()
      .from(financialParameters)
      .where(eq(financialParameters.profileId, profileId))
      .orderBy(financialParameters.paramKey);
  }

  async getFinancialParameter(id: string): Promise<FinancialParameter | undefined> {
    const [param] = await db.select().from(financialParameters).where(eq(financialParameters.id, id));
    return param || undefined;
  }

  async createFinancialParameter(data: InsertFinancialParameter): Promise<FinancialParameter> {
    const [param] = await db.insert(financialParameters).values(data).returning();
    return param;
  }

  async updateFinancialParameter(id: string, data: Partial<InsertFinancialParameter>): Promise<FinancialParameter | undefined> {
    const [param] = await db
      .update(financialParameters)
      .set(data)
      .where(eq(financialParameters.id, id))
      .returning();
    return param || undefined;
  }

  async deleteFinancialParameter(id: string): Promise<boolean> {
    const result = await db.delete(financialParameters).where(eq(financialParameters.id, id)).returning();
    return result.length > 0;
  }

  // Staff Role Costs
  async getStaffRoleCosts(profileId: string): Promise<StaffRoleCost[]> {
    return await db
      .select()
      .from(staffRolesCosts)
      .where(eq(staffRolesCosts.profileId, profileId))
      .orderBy(staffRolesCosts.roleName);
  }

  async getStaffRoleCost(id: string): Promise<StaffRoleCost | undefined> {
    const [cost] = await db.select().from(staffRolesCosts).where(eq(staffRolesCosts.id, id));
    return cost || undefined;
  }

  async createStaffRoleCost(data: InsertStaffRoleCost): Promise<StaffRoleCost> {
    const [cost] = await db.insert(staffRolesCosts).values(data).returning();
    return cost;
  }

  async updateStaffRoleCost(id: string, data: Partial<InsertStaffRoleCost>): Promise<StaffRoleCost | undefined> {
    const [cost] = await db
      .update(staffRolesCosts)
      .set(data)
      .where(eq(staffRolesCosts.id, id))
      .returning();
    return cost || undefined;
  }

  async deleteStaffRoleCost(id: string): Promise<boolean> {
    const result = await db.delete(staffRolesCosts).where(eq(staffRolesCosts.id, id)).returning();
    return result.length > 0;
  }

  // Revenue Models
  async getRevenueModels(profileId: string): Promise<RevenueModel[]> {
    return await db
      .select()
      .from(revenueModels)
      .where(eq(revenueModels.profileId, profileId))
      .orderBy(revenueModels.contractName);
  }

  async getRevenueModel(id: string): Promise<RevenueModel | undefined> {
    const [model] = await db.select().from(revenueModels).where(eq(revenueModels.id, id));
    return model || undefined;
  }

  async createRevenueModel(data: InsertRevenueModel): Promise<RevenueModel> {
    const [model] = await db.insert(revenueModels).values(data).returning();
    return model;
  }

  async updateRevenueModel(id: string, data: Partial<InsertRevenueModel>): Promise<RevenueModel | undefined> {
    const [model] = await db
      .update(revenueModels)
      .set(data)
      .where(eq(revenueModels.id, id))
      .returning();
    return model || undefined;
  }

  async deleteRevenueModel(id: string): Promise<boolean> {
    const result = await db.delete(revenueModels).where(eq(revenueModels.id, id)).returning();
    return result.length > 0;
  }

  // Contracts (Appalti)
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getActiveContracts(): Promise<Contract[]> {
    return await db
      .select()
      .from(contracts)
      .where(eq(contracts.isActive, true))
      .orderBy(contracts.name);
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(data).returning();
    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db
      .update(contracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return contract || undefined;
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  // Contract Vehicles
  async getContractVehicles(contractId: string): Promise<ContractVehicle[]> {
    return await db
      .select()
      .from(contractVehicles)
      .where(eq(contractVehicles.contractId, contractId));
  }

  async getVehicleContracts(vehicleId: string): Promise<ContractVehicle[]> {
    return await db
      .select()
      .from(contractVehicles)
      .where(eq(contractVehicles.vehicleId, vehicleId));
  }

  async addVehicleToContract(data: InsertContractVehicle): Promise<ContractVehicle> {
    const [cv] = await db.insert(contractVehicles).values(data).returning();
    return cv;
  }

  async updateContractVehicle(id: string, data: Partial<InsertContractVehicle>): Promise<ContractVehicle | undefined> {
    const [cv] = await db
      .update(contractVehicles)
      .set(data)
      .where(eq(contractVehicles.id, id))
      .returning();
    return cv || undefined;
  }

  async removeVehicleFromContract(id: string): Promise<boolean> {
    const result = await db.delete(contractVehicles).where(eq(contractVehicles.id, id)).returning();
    return result.length > 0;
  }

  // Scheduled Services
  async getScheduledServices(): Promise<ScheduledService[]> {
    return await db.select().from(scheduledServices).orderBy(desc(scheduledServices.serviceDate), scheduledServices.scheduledTime);
  }

  async getScheduledServicesByVehicle(vehicleId: string): Promise<ScheduledService[]> {
    return await db
      .select()
      .from(scheduledServices)
      .where(eq(scheduledServices.vehicleId, vehicleId))
      .orderBy(scheduledServices.serviceDate, scheduledServices.scheduledTime);
  }

  async getScheduledServicesByDate(date: string): Promise<ScheduledService[]> {
    return await db
      .select()
      .from(scheduledServices)
      .where(eq(scheduledServices.serviceDate, date))
      .orderBy(scheduledServices.scheduledTime);
  }

  async getScheduledServicesByVehicleAndDate(vehicleId: string, date: string): Promise<ScheduledService[]> {
    return await db
      .select()
      .from(scheduledServices)
      .where(and(
        eq(scheduledServices.vehicleId, vehicleId),
        eq(scheduledServices.serviceDate, date)
      ))
      .orderBy(scheduledServices.scheduledTime);
  }

  async getScheduledServicesByLocation(locationId: string): Promise<ScheduledService[]> {
    return await db
      .select()
      .from(scheduledServices)
      .where(eq(scheduledServices.locationId, locationId))
      .orderBy(desc(scheduledServices.serviceDate), scheduledServices.scheduledTime);
  }

  async getScheduledService(id: string): Promise<ScheduledService | undefined> {
    const [service] = await db.select().from(scheduledServices).where(eq(scheduledServices.id, id));
    return service || undefined;
  }

  async createScheduledService(service: InsertScheduledService): Promise<ScheduledService> {
    const [newService] = await db.insert(scheduledServices).values(service).returning();
    return newService;
  }

  async createScheduledServices(services: InsertScheduledService[]): Promise<ScheduledService[]> {
    if (services.length === 0) return [];
    const newServices = await db.insert(scheduledServices).values(services).returning();
    return newServices;
  }

  async updateScheduledService(id: string, data: Partial<InsertScheduledService>): Promise<ScheduledService | undefined> {
    const [updated] = await db
      .update(scheduledServices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scheduledServices.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteScheduledService(id: string): Promise<boolean> {
    const result = await db.delete(scheduledServices).where(eq(scheduledServices.id, id)).returning();
    return result.length > 0;
  }

  async deleteScheduledServicesByVehicleAndDate(vehicleId: string, date: string): Promise<number> {
    const result = await db
      .delete(scheduledServices)
      .where(and(
        eq(scheduledServices.vehicleId, vehicleId),
        eq(scheduledServices.serviceDate, date)
      ))
      .returning();
    return result.length;
  }

  // ============================================
  // CHECKLIST TEMPLATE ITEMS
  // ============================================
  
  async getChecklistTemplateItems(organizationId?: string): Promise<ChecklistTemplateItem[]> {
    const conditions = organizationId ? [eq(checklistTemplateItems.organizationId, organizationId)] : [];
    return await db
      .select()
      .from(checklistTemplateItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(checklistTemplateItems.category, checklistTemplateItems.sortOrder);
  }
  
  async getActiveChecklistTemplateItems(organizationId?: string): Promise<ChecklistTemplateItem[]> {
    const conditions: any[] = [eq(checklistTemplateItems.isActive, true)];
    if (organizationId) conditions.push(eq(checklistTemplateItems.organizationId, organizationId));
    return await db
      .select()
      .from(checklistTemplateItems)
      .where(and(...conditions))
      .orderBy(checklistTemplateItems.category, checklistTemplateItems.sortOrder);
  }
  
  async getChecklistTemplateItem(id: string): Promise<ChecklistTemplateItem | undefined> {
    const [item] = await db.select().from(checklistTemplateItems).where(eq(checklistTemplateItems.id, id));
    return item || undefined;
  }
  
  async createChecklistTemplateItem(item: InsertChecklistTemplateItem): Promise<ChecklistTemplateItem> {
    const [newItem] = await db.insert(checklistTemplateItems).values(item).returning();
    return newItem;
  }
  
  async updateChecklistTemplateItem(id: string, data: Partial<InsertChecklistTemplateItem>): Promise<ChecklistTemplateItem | undefined> {
    const [updated] = await db
      .update(checklistTemplateItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(checklistTemplateItems.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteChecklistTemplateItem(id: string): Promise<boolean> {
    const result = await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.id, id)).returning();
    return result.length > 0;
  }

  // ============================================
  // VEHICLE CHECKLISTS
  // ============================================
  
  async getVehicleChecklists(vehicleId: string, limit?: number): Promise<VehicleChecklist[]> {
    const query = db
      .select()
      .from(vehicleChecklists)
      .where(eq(vehicleChecklists.vehicleId, vehicleId))
      .orderBy(desc(vehicleChecklists.completedAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  
  async getVehicleChecklistById(id: string): Promise<VehicleChecklist | undefined> {
    const [checklist] = await db
      .select()
      .from(vehicleChecklists)
      .where(eq(vehicleChecklists.id, id));
    return checklist || undefined;
  }
  
  async getVehicleChecklistsByDateRange(vehicleId: string, startDate: string, endDate: string): Promise<VehicleChecklist[]> {
    return await db
      .select()
      .from(vehicleChecklists)
      .where(and(
        eq(vehicleChecklists.vehicleId, vehicleId),
        gte(vehicleChecklists.shiftDate, startDate),
        lte(vehicleChecklists.shiftDate, endDate)
      ))
      .orderBy(desc(vehicleChecklists.completedAt));
  }
  
  async getVehicleChecklistsForMonth(year: number, month: number, organizationId?: string): Promise<VehicleChecklist[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    const conditions: any[] = [
      gte(vehicleChecklists.shiftDate, startDate),
      lte(vehicleChecklists.shiftDate, endDate)
    ];
    if (organizationId) conditions.push(eq(vehicleChecklists.organizationId, organizationId));
    
    return await db
      .select()
      .from(vehicleChecklists)
      .where(and(...conditions))
      .orderBy(vehicleChecklists.shiftDate, vehicleChecklists.vehicleId);
  }
  
  async getVehicleChecklistsForOrg(organizationId: string, limit?: number): Promise<VehicleChecklist[]> {
    const query = db
      .select()
      .from(vehicleChecklists)
      .where(eq(vehicleChecklists.organizationId, organizationId))
      .orderBy(desc(vehicleChecklists.completedAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  
  async getTodayChecklistForVehicle(vehicleId: string): Promise<VehicleChecklist | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [checklist] = await db
      .select()
      .from(vehicleChecklists)
      .where(and(
        eq(vehicleChecklists.vehicleId, vehicleId),
        eq(vehicleChecklists.shiftDate, today)
      ));
    return checklist || undefined;
  }
  
  async createVehicleChecklist(checklist: InsertVehicleChecklist): Promise<VehicleChecklist> {
    const [newChecklist] = await db.insert(vehicleChecklists).values(checklist).returning();
    return newChecklist;
  }
  
  async updateVehicleChecklist(id: string, updates: Partial<VehicleChecklist>): Promise<VehicleChecklist> {
    const [updated] = await db
      .update(vehicleChecklists)
      .set(updates)
      .where(eq(vehicleChecklists.id, id))
      .returning();
    return updated;
  }
  
  async markChecklistReportSent(checklistIds: string[]): Promise<void> {
    if (checklistIds.length === 0) return;
    await db
      .update(vehicleChecklists)
      .set({ monthlyReportSent: true, monthlyReportSentAt: new Date() })
      .where(sql`${vehicleChecklists.id} = ANY(${checklistIds})`);
  }
  
  // Chat Interna
  async getChatMessages(limit: number = 100, before?: string): Promise<ChatMessage[]> {
    if (before) {
      const beforeMessage = await this.getChatMessage(before);
      if (beforeMessage) {
        return await db
          .select()
          .from(chatMessages)
          .where(lte(chatMessages.createdAt, beforeMessage.createdAt))
          .orderBy(desc(chatMessages.createdAt))
          .limit(limit);
      }
    }
    return await db
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }
  
  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message || undefined;
  }
  
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }
  
  async deleteChatMessage(id: string): Promise<boolean> {
    const result = await db.delete(chatMessages).where(eq(chatMessages.id, id));
    return true;
  }
  
  async getUnreadCountForUser(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${chatMessages} cm
      WHERE NOT EXISTS (
        SELECT 1 FROM ${chatMessageReads} cmr 
        WHERE cmr.message_id = cm.id AND cmr.user_id = ${userId}
      )
    `);
    return Number(result.rows[0]?.count || 0);
  }
  
  async markMessagesAsRead(userId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    for (const messageId of messageIds) {
      const existing = await db
        .select()
        .from(chatMessageReads)
        .where(and(
          eq(chatMessageReads.messageId, messageId),
          eq(chatMessageReads.userId, userId)
        ));
      if (existing.length === 0) {
        await db.insert(chatMessageReads).values({ messageId, userId });
      }
    }
  }
  
  async getMessageReaders(messageId: string): Promise<Array<{userId: string; vehicleCode: string | null; readAt: Date}>> {
    const result = await db.execute(sql`
      SELECT 
        cmr.user_id as "userId",
        cmr.read_at as "readAt",
        (
          SELECT v.code 
          FROM ${vehicles} v 
          INNER JOIN ${chatMessages} cm ON cm.sender_vehicle_id = v.id 
          WHERE cm.sender_id = cmr.user_id 
          ORDER BY cm.created_at DESC 
          LIMIT 1
        ) as "vehicleCode"
      FROM ${chatMessageReads} cmr
      WHERE cmr.message_id = ${messageId}
      ORDER BY cmr.read_at ASC
    `);
    return result.rows.map((row: any) => ({
      userId: row.userId,
      vehicleCode: row.vehicleCode || null,
      readAt: new Date(row.readAt)
    }));
  }

  // GPS Tracking
  async startTrackingSession(vehicleId: string, userId: string, tripId?: string) {
    // Delete any existing session for this vehicle
    await db.delete(activeTrackingSessions).where(eq(activeTrackingSessions.vehicleId, vehicleId));
    
    const [session] = await db.insert(activeTrackingSessions).values({
      vehicleId,
      userId,
      tripId: tripId || null,
      isActive: true,
      pointsCount: 0
    }).returning();
    return session;
  }
  
  async getActiveTrackingSession(vehicleId: string) {
    const [session] = await db
      .select()
      .from(activeTrackingSessions)
      .where(and(
        eq(activeTrackingSessions.vehicleId, vehicleId),
        eq(activeTrackingSessions.isActive, true)
      ));
    return session || null;
  }
  
  async getAllActiveTrackingSessions() {
    return await db
      .select()
      .from(activeTrackingSessions)
      .where(eq(activeTrackingSessions.isActive, true));
  }
  
  async updateTrackingSessionTrip(sessionId: string, tripId: string) {
    const [session] = await db
      .update(activeTrackingSessions)
      .set({ tripId, lastUpdateAt: new Date() })
      .where(eq(activeTrackingSessions.id, sessionId))
      .returning();
    return session;
  }
  
  async endTrackingSession(vehicleId: string) {
    const [session] = await db
      .update(activeTrackingSessions)
      .set({ isActive: false, lastUpdateAt: new Date() })
      .where(eq(activeTrackingSessions.vehicleId, vehicleId))
      .returning();
    return session;
  }
  
  async addGpsPoint(data: {
    tripId: string | null;   // P0-2: nullable per punti pre-viaggio
    vehicleId: string;
    latitude: string;
    longitude: string;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    timestamp?: Date;
  }) {
    const [point] = await db.insert(tripGpsPoints).values({
      tripId: data.tripId,
      vehicleId: data.vehicleId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy || null,
      speed: data.speed || null,
      heading: data.heading || null,
      altitude: data.altitude || null,
      timestamp: data.timestamp || new Date()
    }).returning();
    
    // Update session points count
    await db.execute(sql`
      UPDATE ${activeTrackingSessions} 
      SET points_count = points_count + 1, last_update_at = NOW()
      WHERE vehicle_id = ${data.vehicleId} AND is_active = true
    `);
    
    return point;
  }
  
  async addGpsPointsBatch(points: Array<{
    tripId: string | null;   // P0-2: nullable per punti pre-viaggio
    vehicleId: string;
    latitude: string;
    longitude: string;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    timestamp?: Date;
  }>) {
    if (points.length === 0) return [];
    
    const insertData = points.map(p => ({
      tripId: p.tripId,
      vehicleId: p.vehicleId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy || null,
      speed: p.speed || null,
      heading: p.heading || null,
      altitude: p.altitude || null,
      timestamp: p.timestamp || new Date()
    }));
    
    const inserted = await db.insert(tripGpsPoints).values(insertData).returning();
    
    // Update session points count
    const vehicleId = points[0].vehicleId;
    await db.execute(sql`
      UPDATE ${activeTrackingSessions} 
      SET points_count = points_count + ${points.length}, last_update_at = NOW()
      WHERE vehicle_id = ${vehicleId} AND is_active = true
    `);
    
    return inserted;
  }
  
  async getGpsPointsForTrip(tripId: string) {
    return await db
      .select()
      .from(tripGpsPoints)
      .where(eq(tripGpsPoints.tripId, tripId))
      .orderBy(tripGpsPoints.timestamp);
  }
  
  async getGpsPointsForVehicle(vehicleId: string, startDate?: Date, endDate?: Date) {
    let query = db
      .select()
      .from(tripGpsPoints)
      .where(eq(tripGpsPoints.vehicleId, vehicleId));
    
    if (startDate && endDate) {
      return await db
        .select()
        .from(tripGpsPoints)
        .where(and(
          eq(tripGpsPoints.vehicleId, vehicleId),
          gte(tripGpsPoints.timestamp, startDate),
          lte(tripGpsPoints.timestamp, endDate)
        ))
        .orderBy(tripGpsPoints.timestamp);
    }
    
    return await db
      .select()
      .from(tripGpsPoints)
      .where(eq(tripGpsPoints.vehicleId, vehicleId))
      .orderBy(desc(tripGpsPoints.timestamp))
      .limit(1000);
  }
  
  async getLatestGpsPointsForAllVehicles() {
    // Get latest point for each active vehicle
    const result = await db.execute(sql`
      SELECT DISTINCT ON (vehicle_id)
        id, trip_id, vehicle_id, latitude, longitude, 
        accuracy, speed, heading, altitude, timestamp
      FROM ${tripGpsPoints}
      ORDER BY vehicle_id, timestamp DESC
    `);
    return result.rows;
  }
  
  async deleteGpsPointsForTrip(tripId: string) {
    await db.delete(tripGpsPoints).where(eq(tripGpsPoints.tripId, tripId));
    return true;
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  // Inventory Items (catalog)
  async getInventoryItems() {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.isActive, true));
  }

  async getInventoryItemById(id: string) {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async getInventoryItemByBarcode(barcode: string) {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.barcode, barcode));
    return item;
  }

  async createInventoryItem(item: InsertInventoryItem) {
    const [created] = await db.insert(inventoryItems).values(item).returning();
    return created;
  }

  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>) {
    const [updated] = await db.update(inventoryItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated;
  }

  // Vehicle Inventory
  async getVehicleInventory(vehicleId: string) {
    return await db
      .select({
        inventory: vehicleInventory,
        item: inventoryItems
      })
      .from(vehicleInventory)
      .innerJoin(inventoryItems, eq(vehicleInventory.itemId, inventoryItems.id))
      .where(eq(vehicleInventory.vehicleId, vehicleId));
  }

  async getVehicleInventoryItem(vehicleId: string, itemId: string) {
    const [inv] = await db.select().from(vehicleInventory)
      .where(and(
        eq(vehicleInventory.vehicleId, vehicleId),
        eq(vehicleInventory.itemId, itemId)
      ));
    return inv;
  }

  async upsertVehicleInventory(data: InsertVehicleInventory) {
    const existing = await this.getVehicleInventoryItem(data.vehicleId, data.itemId);
    if (existing) {
      const [updated] = await db.update(vehicleInventory)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(vehicleInventory.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(vehicleInventory).values(data).returning();
      return created;
    }
  }

  async updateVehicleInventoryQuantity(vehicleId: string, itemId: string, quantityChange: number) {
    const existing = await this.getVehicleInventoryItem(vehicleId, itemId);
    if (existing) {
      const newQuantity = Math.max(0, existing.currentQuantity + quantityChange);
      const [updated] = await db.update(vehicleInventory)
        .set({ currentQuantity: newQuantity, updatedAt: new Date() })
        .where(eq(vehicleInventory.id, existing.id))
        .returning();
      return updated;
    }
    return null;
  }

  // Warehouse Stock
  async getWarehouseStock(locationId: string) {
    return await db
      .select({
        stock: warehouseStock,
        item: inventoryItems
      })
      .from(warehouseStock)
      .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
      .where(eq(warehouseStock.locationId, locationId));
  }

  async getWarehouseStockItem(locationId: string, itemId: string) {
    const [stock] = await db.select().from(warehouseStock)
      .where(and(
        eq(warehouseStock.locationId, locationId),
        eq(warehouseStock.itemId, itemId)
      ));
    return stock;
  }

  async upsertWarehouseStock(data: InsertWarehouseStock) {
    const existing = await this.getWarehouseStockItem(data.locationId, data.itemId);
    if (existing) {
      const [updated] = await db.update(warehouseStock)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(warehouseStock.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(warehouseStock).values(data).returning();
      return created;
    }
  }

  async updateWarehouseStockQuantity(locationId: string, itemId: string, quantityChange: number) {
    const existing = await this.getWarehouseStockItem(locationId, itemId);
    if (existing) {
      const newQuantity = Math.max(0, existing.quantity + quantityChange);
      const [updated] = await db.update(warehouseStock)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(warehouseStock.id, existing.id))
        .returning();
      return updated;
    }
    return null;
  }

  // Inventory Usage (log)
  async logInventoryUsage(data: InsertInventoryUsage) {
    const [log] = await db.insert(inventoryUsage).values(data).returning();
    // Also decrease vehicle inventory
    await this.updateVehicleInventoryQuantity(data.vehicleId, data.itemId, -(data.quantity || 1));
    return log;
  }

  async getInventoryUsageForVehicle(vehicleId: string, startDate?: Date, endDate?: Date) {
    if (startDate && endDate) {
      return await db
        .select({
          usage: inventoryUsage,
          item: inventoryItems
        })
        .from(inventoryUsage)
        .innerJoin(inventoryItems, eq(inventoryUsage.itemId, inventoryItems.id))
        .where(and(
          eq(inventoryUsage.vehicleId, vehicleId),
          gte(inventoryUsage.usedAt, startDate),
          lte(inventoryUsage.usedAt, endDate)
        ))
        .orderBy(desc(inventoryUsage.usedAt));
    }
    return await db
      .select({
        usage: inventoryUsage,
        item: inventoryItems
      })
      .from(inventoryUsage)
      .innerJoin(inventoryItems, eq(inventoryUsage.itemId, inventoryItems.id))
      .where(eq(inventoryUsage.vehicleId, vehicleId))
      .orderBy(desc(inventoryUsage.usedAt))
      .limit(50);
  }

  async getPendingReplenishments(vehicleId: string) {
    // Get items where current < required
    return await db
      .select({
        inventory: vehicleInventory,
        item: inventoryItems
      })
      .from(vehicleInventory)
      .innerJoin(inventoryItems, eq(vehicleInventory.itemId, inventoryItems.id))
      .where(and(
        eq(vehicleInventory.vehicleId, vehicleId),
        sql`${vehicleInventory.currentQuantity} < ${vehicleInventory.requiredQuantity}`
      ));
  }

  // Inventory Replenishment
  async logInventoryReplenish(data: InsertInventoryReplenish) {
    const [log] = await db.insert(inventoryReplenish).values(data).returning();
    const qty = data.quantity || 1;
    // Increase vehicle inventory
    await this.updateVehicleInventoryQuantity(data.vehicleId, data.itemId, qty);
    // Decrease warehouse stock
    await this.updateWarehouseStockQuantity(data.locationId, data.itemId, -qty);
    return log;
  }

  async getReplenishmentHistory(vehicleId: string, limit = 50) {
    return await db
      .select({
        replenish: inventoryReplenish,
        item: inventoryItems
      })
      .from(inventoryReplenish)
      .innerJoin(inventoryItems, eq(inventoryReplenish.itemId, inventoryItems.id))
      .where(eq(inventoryReplenish.vehicleId, vehicleId))
      .orderBy(desc(inventoryReplenish.replenishedAt))
      .limit(limit);
  }

  // Low stock alerts
  async getLowStockAlerts(locationId?: string) {
    if (locationId) {
      return await db
        .select({
          stock: warehouseStock,
          item: inventoryItems
        })
        .from(warehouseStock)
        .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
        .where(and(
          eq(warehouseStock.locationId, locationId),
          sql`${warehouseStock.quantity} <= ${warehouseStock.minStockLevel}`
        ));
    }
    return await db
      .select({
        stock: warehouseStock,
        item: inventoryItems
      })
      .from(warehouseStock)
      .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
      .where(sql`${warehouseStock.quantity} <= ${warehouseStock.minStockLevel}`);
  }

  // Expiring items
  async getExpiringItems(days: number = 30, locationId?: string) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    const conditions = [
      eq(inventoryItems.hasExpiry, true),
      sql`${(warehouseStock as any).expiryDate} IS NOT NULL`,
      sql`${(warehouseStock as any).expiryDate} <= ${futureDate.toISOString().split('T')[0]}`,
      sql`${warehouseStock.quantity} > 0`
    ];

    if (locationId) {
      conditions.push(eq(warehouseStock.locationId, locationId));
    }

    return await db
      .select({
        stock: warehouseStock,
        item: inventoryItems
      })
      .from(warehouseStock)
      .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
      .where(and(...conditions))
      .orderBy((warehouseStock as any).expiryDate);
  }

  // Inventory dashboard metrics
  async getInventoryDashboardMetrics() {
    const [
      totalItems,
      lowStockItems,
      templates,
      vehicleAssignments,
      activeEvents
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(inventoryItems).where(eq(inventoryItems.isActive, true)),
      db.select({ count: sql<number>`count(*)` })
        .from(warehouseStock)
        .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
        .where(sql`${warehouseStock.quantity} <= ${warehouseStock.minStockLevel}`),
      db.select({ count: sql<number>`count(*)` }).from(vehicleInventoryTemplates).where(eq(vehicleInventoryTemplates.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(vehicleTemplateAssignments).where(eq((vehicleTemplateAssignments as any).isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(sportingEvents).where(eq(sportingEvents.status, 'active'))
    ]);
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expiringItems = await db
      .select({ count: sql<number>`count(*)` })
      .from(warehouseStock)
      .innerJoin(inventoryItems, eq(warehouseStock.itemId, inventoryItems.id))
      .where(and(
        eq(inventoryItems.hasExpiry, true),
        sql`${(warehouseStock as any).expiryDate} IS NOT NULL`,
        sql`${(warehouseStock as any).expiryDate} <= ${futureDate.toISOString().split('T')[0]}`,
        sql`${warehouseStock.quantity} > 0`
      ));
    
    return {
      totalItems: Number(totalItems[0]?.count) || 0,
      lowStockCount: Number(lowStockItems[0]?.count) || 0,
      expiringCount: Number(expiringItems[0]?.count) || 0,
      templatesCount: Number(templates[0]?.count) || 0,
      vehiclesAssigned: Number(vehicleAssignments[0]?.count) || 0,
      activeEventsCount: Number(activeEvents[0]?.count) || 0
    };
  }

  // ============================================================================
  // INVENTORY TEMPLATES (MSB/MSI/EVENT)
  // ============================================================================

  async getInventoryTemplates(): Promise<VehicleInventoryTemplate[]> {
    return await db.select().from(vehicleInventoryTemplates)
      .where(eq(vehicleInventoryTemplates.isActive, true))
      .orderBy(vehicleInventoryTemplates.templateType, vehicleInventoryTemplates.name);
  }

  async getInventoryTemplatesByType(type: string): Promise<VehicleInventoryTemplate[]> {
    return await db.select().from(vehicleInventoryTemplates)
      .where(and(
        eq(vehicleInventoryTemplates.isActive, true),
        sql`${vehicleInventoryTemplates.templateType} = ${type}`
      ))
      .orderBy(vehicleInventoryTemplates.name);
  }

  async getInventoryTemplateById(id: string): Promise<VehicleInventoryTemplate | undefined> {
    const [template] = await db.select().from(vehicleInventoryTemplates)
      .where(eq(vehicleInventoryTemplates.id, id));
    return template;
  }

  async createInventoryTemplate(data: InsertVehicleInventoryTemplate): Promise<VehicleInventoryTemplate> {
    const [template] = await db.insert(vehicleInventoryTemplates).values(data).returning();
    return template;
  }

  async updateInventoryTemplate(id: string, data: Partial<InsertVehicleInventoryTemplate>): Promise<VehicleInventoryTemplate | undefined> {
    const [updated] = await db.update(vehicleInventoryTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicleInventoryTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryTemplate(id: string): Promise<boolean> {
    const [deleted] = await db.update(vehicleInventoryTemplates)
      .set({ isActive: false })
      .where(eq(vehicleInventoryTemplates.id, id))
      .returning();
    return !!deleted;
  }

  // Template Items
  async getTemplateItems(templateId: string): Promise<(TemplateItem & { item: typeof inventoryItems.$inferSelect })[]> {
    const items = await db.select({
      templateItem: templateItems,
      item: inventoryItems
    })
    .from(templateItems)
    .innerJoin(inventoryItems, eq(templateItems.itemId, inventoryItems.id))
    .where(eq(templateItems.templateId, templateId))
    .orderBy(templateItems.sortOrder);
    
    return items.map(r => ({ ...r.templateItem, item: r.item }));
  }

  async addTemplateItem(data: InsertTemplateItem): Promise<TemplateItem> {
    const [item] = await db.insert(templateItems).values(data).returning();
    return item;
  }

  async updateTemplateItem(id: string, data: Partial<InsertTemplateItem>): Promise<TemplateItem | undefined> {
    const [updated] = await db.update(templateItems)
      .set(data)
      .where(eq(templateItems.id, id))
      .returning();
    return updated;
  }

  async removeTemplateItem(id: string): Promise<boolean> {
    const result = await db.delete(templateItems).where(eq(templateItems.id, id)).returning();
    return result.length > 0;
  }

  // Vehicle Template Assignments
  async getVehicleTemplateAssignment(vehicleId: string): Promise<VehicleTemplateAssignment | undefined> {
    const [assignment] = await db.select().from(vehicleTemplateAssignments)
      .where(and(
        eq(vehicleTemplateAssignments.vehicleId, vehicleId),
        eq(vehicleTemplateAssignments.status, "active")
      ));
    return assignment;
  }

  async assignTemplateToVehicle(data: InsertVehicleTemplateAssignment): Promise<VehicleTemplateAssignment> {
    // Deactivate previous assignment
    await db.update(vehicleTemplateAssignments)
      .set({ status: "inactive" })
      .where(eq(vehicleTemplateAssignments.vehicleId, data.vehicleId));
    // Create new assignment
    const [assignment] = await db.insert(vehicleTemplateAssignments).values(data).returning();
    // Update vehicle's assignedTemplateId
    await db.update(vehicles)
      .set({ assignedTemplateId: data.templateId })
      .where(eq(vehicles.id, data.vehicleId));
    return assignment;
  }

  async getVehiclesWithTemplates() {
    return await db.select({
      vehicle: vehicles,
      template: vehicleInventoryTemplates
    })
    .from(vehicles)
    .leftJoin(vehicleInventoryTemplates, eq(vehicles.assignedTemplateId, vehicleInventoryTemplates.id))
    .where(eq(vehicles.isActive, true))
    .orderBy(vehicles.code);
  }

  // ============================================================================
  // SPORTING EVENTS
  // ============================================================================

  async getSportingEvents(): Promise<any[]> {
    const events = await db.select().from(sportingEvents)
      .orderBy(desc(sportingEvents.startDate));
    
    const eventsWithAssignments = await Promise.all(events.map(async (event) => {
      const assignments = await db.select({
        id: eventAssignments.id,
        staffMemberId: eventAssignments.staffMemberId,
        vehicleId: eventAssignments.vehicleId,
        assignedRole: eventAssignments.assignedRole,
        status: eventAssignments.status,
        staffFirstName: staffMembers.firstName,
        staffLastName: staffMembers.lastName,
        staffPrimaryRole: staffMembers.primaryRole
      })
        .from(eventAssignments)
        .leftJoin(staffMembers, eq(eventAssignments.staffMemberId, staffMembers.id))
        .where(eq(eventAssignments.eventId, event.id));
      
      return { ...event, assignments };
    }));
    
    return eventsWithAssignments;
  }

  async getUpcomingSportingEvents(): Promise<SportingEvent[]> {
    const today = new Date().toISOString().split('T')[0];
    return await db.select().from(sportingEvents)
      .where(gte(sportingEvents.startDate, today))
      .orderBy(sportingEvents.startDate);
  }

  async getVehicleActiveEvent(vehicleId: string): Promise<SportingEvent | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [event] = await db.select().from(sportingEvents)
      .where(
        and(
          eq(sportingEvents.vehicleId, vehicleId),
          gte(sportingEvents.endDate, today),
          inArray(sportingEvents.status, ["scheduled", "active"])
        )
      )
      .orderBy(sportingEvents.startDate)
      .limit(1);
    return event;
  }

  async getSportingEventById(id: string): Promise<any | undefined> {
    const [event] = await db.select().from(sportingEvents)
      .where(eq(sportingEvents.id, id));
    
    if (!event) return undefined;
    
    const assignments = await db.select({
      id: eventAssignments.id,
      staffMemberId: eventAssignments.staffMemberId,
      vehicleId: eventAssignments.vehicleId,
      assignedRole: eventAssignments.assignedRole,
      status: eventAssignments.status,
      staffFirstName: staffMembers.firstName,
      staffLastName: staffMembers.lastName,
      staffPrimaryRole: staffMembers.primaryRole
    })
      .from(eventAssignments)
      .leftJoin(staffMembers, eq(eventAssignments.staffMemberId, staffMembers.id))
      .where(eq(eventAssignments.eventId, event.id));
    
    return { ...event, assignments };
  }

  async createSportingEvent(data: InsertSportingEvent): Promise<SportingEvent> {
    const [event] = await db.insert(sportingEvents).values(data).returning();
    return event;
  }

  async updateSportingEvent(id: string, data: Partial<InsertSportingEvent>): Promise<SportingEvent | undefined> {
    const [updated] = await db.update(sportingEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sportingEvents.id, id))
      .returning();
    return updated;
  }

  async deleteSportingEvent(id: string): Promise<boolean> {
    const result = await db.delete(sportingEvents).where(eq(sportingEvents.id, id)).returning();
    return result.length > 0;
  }

  // Event Inventory Log
  async getEventInventory(eventId: string) {
    return await db.select({
      log: eventInventoryLog,
      item: inventoryItems
    })
    .from(eventInventoryLog)
    .innerJoin(inventoryItems, eq(eventInventoryLog.itemId, inventoryItems.id))
    .where(eq(eventInventoryLog.eventId, eventId))
    .orderBy(eventInventoryLog.checkedOutAt);
  }

  async checkoutEventInventory(data: InsertEventInventoryLog): Promise<EventInventoryLog> {
    const [log] = await db.insert(eventInventoryLog).values({
      ...data,
      status: "checked_out",
      checkedOutAt: new Date()
    }).returning();
    return log;
  }

  async checkinEventInventory(logId: string, data: { quantityReturned: number; quantityUsed?: number; varianceReason?: string; checkedInBy: string }): Promise<EventInventoryLog | undefined> {
    const [updated] = await db.update(eventInventoryLog)
      .set({
        quantityReturned: data.quantityReturned,
        quantityUsed: data.quantityUsed || 0,
        varianceReason: data.varianceReason,
        checkedInAt: new Date(),
        checkedInBy: data.checkedInBy,
        status: data.quantityReturned > 0 ? "returned" : "partial_return",
        updatedAt: new Date()
      })
      .where(eq(eventInventoryLog.id, logId))
      .returning();
    return updated;
  }

  async getEventInventoryStats() {
    // Get summary of event inventory usage
    const events = await db.select({
      event: sportingEvents,
      totalItems: sql<number>`COUNT(DISTINCT ${eventInventoryLog.itemId})`,
      totalOut: sql<number>`COALESCE(SUM(${eventInventoryLog.quantityOut}), 0)`,
      totalReturned: sql<number>`COALESCE(SUM(${eventInventoryLog.quantityReturned}), 0)`,
      totalUsed: sql<number>`COALESCE(SUM(${eventInventoryLog.quantityUsed}), 0)`
    })
    .from(sportingEvents)
    .leftJoin(eventInventoryLog, eq(sportingEvents.id, eventInventoryLog.eventId))
    .groupBy(sportingEvents.id)
    .orderBy(desc(sportingEvents.startDate))
    .limit(20);
    return events;
  }

  // Barcode Product Cache functions
  async getBarcodeProductCache(barcode: string): Promise<BarcodeProductCache | undefined> {
    const [cached] = await db.select().from(barcodeProductCache).where(eq(barcodeProductCache.barcode, barcode));
    return cached;
  }

  async upsertBarcodeProductCache(data: InsertBarcodeProductCache): Promise<BarcodeProductCache> {
    const existing = await this.getBarcodeProductCache(data.barcode);
    if (existing) {
      const [updated] = await db.update(barcodeProductCache)
        .set({
          ...data,
          lookupCount: (existing.lookupCount || 0) + 1,
          lastLookupAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(barcodeProductCache.barcode, data.barcode))
        .returning();
      return updated;
    }
    const [created] = await db.insert(barcodeProductCache).values(data).returning();
    return created;
  }

  async incrementBarcodeLookupCount(barcode: string): Promise<void> {
    await db.update(barcodeProductCache)
      .set({
        lookupCount: sql`${barcodeProductCache.lookupCount} + 1`,
        lastLookupAt: new Date()
      })
      .where(eq(barcodeProductCache.barcode, barcode));
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(data: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db.insert(userSettings).values(data).returning();
    return settings;
  }

  async updateUserSettings(userId: string, data: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    // First check if settings exist
    const existing = await this.getUserSettings(userId);
    if (!existing) {
      // Create with defaults merged with provided data
      return await this.createUserSettings({
        userId,
        notificationsEnabled: true,
        soundEnabled: true,
        vibrationEnabled: true,
        checklistReminderEnabled: true,
        checklistReminderTime: "07:00",
        expiryAlertsEnabled: true,
        scadenzeReminderEnabled: true,
        ...data,
      } as InsertUserSettings);
    }
    const [updated] = await db.update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated;
  }

  // Scadenze Reports
  async getScadenzeReport(vehicleId: string, month: number, year: number): Promise<ScadenzeReport | undefined> {
    const [report] = await db.select().from(scadenzeReports)
      .where(and(
        eq(scadenzeReports.vehicleId, vehicleId),
        eq(scadenzeReports.reportMonth, month),
        eq(scadenzeReports.reportYear, year)
      ));
    return report;
  }

  async getScadenzeReportById(id: string): Promise<ScadenzeReport | undefined> {
    const [report] = await db.select().from(scadenzeReports).where(eq(scadenzeReports.id, id));
    return report;
  }

  async createScadenzeReport(data: InsertScadenzeReport): Promise<ScadenzeReport> {
    const [report] = await db.insert(scadenzeReports).values(data).returning();
    return report;
  }

  async getScadenzeReports(filters?: { month?: number; year?: number; locationId?: string }): Promise<ScadenzeReport[]> {
    let query = db.select().from(scadenzeReports);
    
    const conditions = [];
    if (filters?.month) conditions.push(eq(scadenzeReports.reportMonth, filters.month));
    if (filters?.year) conditions.push(eq(scadenzeReports.reportYear, filters.year));
    if (filters?.locationId) conditions.push(eq(scadenzeReports.locationId, filters.locationId));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return await query.orderBy(desc(scadenzeReports.completedAt));
  }

  // ============================================================================
  // STAFF SCHEDULING & SHIFT MANAGEMENT
  // ============================================================================

  // Staff Members
  async getStaffMembers(filters?: { locationId?: string; isActive?: boolean }): Promise<StaffMember[]> {
    const conditions = [];
    if (filters?.locationId) conditions.push(eq(staffMembers.locationId, filters.locationId));
    if (filters?.isActive !== undefined) conditions.push(eq(staffMembers.isActive, filters.isActive));
    
    let query = db.select().from(staffMembers);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(staffMembers.lastName, staffMembers.firstName);
  }

  async getStaffMemberById(id: string): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
    return member;
  }

  async getStaffMemberByUserId(userId: string): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staffMembers).where(eq(staffMembers.userId, userId));
    return member;
  }

  async createStaffMember(data: InsertStaffMember): Promise<StaffMember> {
    const [member] = await db.insert(staffMembers).values(data).returning();
    return member;
  }

  async updateStaffMember(id: string, data: Partial<InsertStaffMember>): Promise<StaffMember | undefined> {
    const [member] = await db.update(staffMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning();
    return member;
  }

  async deleteStaffMember(id: string): Promise<boolean> {
    const result = await db.delete(staffMembers).where(eq(staffMembers.id, id));
    return true;
  }

  // Shift Templates
  async getShiftTemplates(filters?: { locationId?: string; vehicleId?: string; isActive?: boolean; organizationId?: string }): Promise<ShiftTemplate[]> {
    const conditions = [];
    if (filters?.organizationId) conditions.push(eq(shiftTemplates.organizationId, filters.organizationId));
    if (filters?.locationId) conditions.push(eq(shiftTemplates.locationId, filters.locationId));
    if (filters?.vehicleId) conditions.push(eq(shiftTemplates.vehicleId, filters.vehicleId));
    if (filters?.isActive !== undefined) conditions.push(eq(shiftTemplates.isActive, filters.isActive));
    
    let query = db.select().from(shiftTemplates);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(shiftTemplates.name);
  }

  async getShiftTemplateById(id: string): Promise<ShiftTemplate | undefined> {
    const [template] = await db.select().from(shiftTemplates).where(eq(shiftTemplates.id, id));
    return template;
  }

  async createShiftTemplate(data: InsertShiftTemplate): Promise<ShiftTemplate> {
    const [template] = await db.insert(shiftTemplates).values(data).returning();
    return template;
  }

  async updateShiftTemplate(id: string, data: Partial<InsertShiftTemplate>): Promise<ShiftTemplate | undefined> {
    const [template] = await db.update(shiftTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning();
    return template;
  }

  async deleteShiftTemplate(id: string): Promise<boolean> {
    await db.delete(shiftTemplates).where(eq(shiftTemplates.id, id));
    return true;
  }

  // Shift Instances
  async getShiftInstances(filters?: { 
    locationId?: string; 
    vehicleId?: string; 
    dateFrom?: string; 
    dateTo?: string;
    status?: string;
    organizationId?: string;
  }): Promise<ShiftInstance[]> {
    const conditions = [];
    if (filters?.organizationId) conditions.push(eq(shiftInstances.organizationId, filters.organizationId));
    if (filters?.locationId) conditions.push(eq(shiftInstances.locationId, filters.locationId));
    if (filters?.vehicleId) conditions.push(eq(shiftInstances.vehicleId, filters.vehicleId));
    if (filters?.dateFrom) conditions.push(gte(shiftInstances.shiftDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(shiftInstances.shiftDate, filters.dateTo));
    if (filters?.status) conditions.push(eq(shiftInstances.status, filters.status as any));
    
    let query = db.select().from(shiftInstances);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(shiftInstances.shiftDate, shiftInstances.startTime);
  }

  async getShiftInstanceById(id: string): Promise<ShiftInstance | undefined> {
    const [instance] = await db.select().from(shiftInstances).where(eq(shiftInstances.id, id));
    return instance;
  }

  async createShiftInstance(data: InsertShiftInstance): Promise<ShiftInstance> {
    const [instance] = await db.insert(shiftInstances).values(data).returning();
    return instance;
  }

  async updateShiftInstance(id: string, data: Partial<InsertShiftInstance>): Promise<ShiftInstance | undefined> {
    const [instance] = await db.update(shiftInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftInstances.id, id))
      .returning();
    return instance;
  }

  async deleteShiftInstance(id: string): Promise<boolean> {
    await db.delete(shiftAssignments).where(eq(shiftAssignments.shiftInstanceId, id));
    await db.delete(shiftInstances).where(eq(shiftInstances.id, id));
    return true;
  }

  async generateShiftInstancesFromTemplate(templateId: string, dateFrom: string, dateTo: string): Promise<ShiftInstance[]> {
    const template = await this.getShiftTemplateById(templateId);
    if (!template) throw new Error("Template non trovato");

    const instances: ShiftInstance[] = [];
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const recurrenceDays = (template.recurrenceDays as number[]) || [0, 1, 2, 3, 4, 5, 6];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (recurrenceDays.includes(dayOfWeek)) {
        const existing = await db.select().from(shiftInstances).where(
          and(
            eq(shiftInstances.templateId, templateId),
            eq(shiftInstances.shiftDate, d.toISOString().split('T')[0])
          )
        );
        
        if (existing.length === 0) {
          const instance = await this.createShiftInstance({
            templateId,
            locationId: template.locationId,
            vehicleId: template.vehicleId || undefined,
            shiftDate: d.toISOString().split('T')[0],
            startTime: template.startTime,
            endTime: template.endTime,
            requiredRoles: template.requiredRoles as Record<string, unknown>,
            minStaff: template.minStaff || 2,
            maxStaff: template.maxStaff || 3,
            status: "draft",
            allowSelfSignup: true,
            organizationId: template.organizationId,
          });
          instances.push(instance);
        }
      }
    }
    return instances;
  }

  // Shift Assignments
  async getShiftAssignments(filters?: { 
    shiftInstanceId?: string; 
    staffMemberId?: string;
    status?: string;
  }): Promise<ShiftAssignment[]> {
    const conditions = [];
    if (filters?.shiftInstanceId) conditions.push(eq(shiftAssignments.shiftInstanceId, filters.shiftInstanceId));
    if (filters?.staffMemberId) conditions.push(eq(shiftAssignments.staffMemberId, filters.staffMemberId));
    if (filters?.status) conditions.push(eq(shiftAssignments.status, filters.status as any));
    
    let query = db.select().from(shiftAssignments);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(desc(shiftAssignments.assignedAt));
  }

  async getShiftAssignmentById(id: string): Promise<ShiftAssignment | undefined> {
    const [assignment] = await db.select().from(shiftAssignments).where(eq(shiftAssignments.id, id));
    return assignment;
  }

  async createShiftAssignment(data: InsertShiftAssignment): Promise<ShiftAssignment> {
    const [assignment] = await db.insert(shiftAssignments).values(data).returning();
    return assignment;
  }

  async updateShiftAssignment(id: string, data: Partial<InsertShiftAssignment>): Promise<ShiftAssignment | undefined> {
    const [assignment] = await db.update(shiftAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftAssignments.id, id))
      .returning();
    return assignment;
  }

  async deleteShiftAssignment(id: string): Promise<boolean> {
    await db.delete(shiftAssignments).where(eq(shiftAssignments.id, id));
    return true;
  }

  async selfSignupForShift(shiftInstanceId: string, staffMemberId: string, role: string): Promise<ShiftAssignment> {
    const shift = await this.getShiftInstanceById(shiftInstanceId);
    if (!shift) throw new Error("Turno non trovato");
    if (!shift.allowSelfSignup) throw new Error("Auto-iscrizione non consentita per questo turno");
    if (shift.status !== "open" && shift.status !== "draft") throw new Error("Turno non disponibile per iscrizioni");

    const existingAssignments = await this.getShiftAssignments({ shiftInstanceId });
    if (existingAssignments.length >= (shift.maxStaff || 3)) {
      throw new Error("Turno al completo");
    }

    const alreadyAssigned = existingAssignments.find(a => a.staffMemberId === staffMemberId);
    if (alreadyAssigned) throw new Error("Sei già iscritto a questo turno");

    return await this.createShiftAssignment({
      shiftInstanceId,
      staffMemberId,
      assignedRole: role as any,
      status: "self_assigned",
    });
  }

  async checkInShiftAssignment(id: string): Promise<ShiftAssignment | undefined> {
    const assignment = await this.getShiftAssignmentById(id);
    if (!assignment) throw new Error("Assegnazione non trovata");
    if (assignment.checkedInAt) throw new Error("Check-in già effettuato");

    const [updated] = await db.update(shiftAssignments)
      .set({ 
        checkedInAt: new Date(),
        status: "checked_in" as any,
        updatedAt: new Date()
      })
      .where(eq(shiftAssignments.id, id))
      .returning();
    return updated;
  }

  async checkOutShiftAssignment(id: string): Promise<ShiftAssignment | undefined> {
    const assignment = await this.getShiftAssignmentById(id);
    if (!assignment) throw new Error("Assegnazione non trovata");
    if (!assignment.checkedInAt) throw new Error("Effettua prima il check-in");
    if (assignment.checkedOutAt) throw new Error("Check-out già effettuato");

    const [updated] = await db.update(shiftAssignments)
      .set({ 
        checkedOutAt: new Date(),
        status: "completed" as any,
        updatedAt: new Date()
      })
      .where(eq(shiftAssignments.id, id))
      .returning();
    return updated;
  }

  // Staff Availability
  async getStaffAvailability(staffMemberId: string, dateFrom?: string, dateTo?: string): Promise<StaffAvailability[]> {
    const conditions = [eq(staffAvailability.staffMemberId, staffMemberId)];
    if (dateFrom) conditions.push(gte(staffAvailability.dateEnd, dateFrom));
    if (dateTo) conditions.push(lte(staffAvailability.dateStart, dateTo));
    
    return await db.select().from(staffAvailability)
      .where(and(...conditions))
      .orderBy(staffAvailability.dateStart);
  }

  async createStaffAvailability(data: InsertStaffAvailability): Promise<StaffAvailability> {
    const [availability] = await db.insert(staffAvailability).values(data).returning();
    return availability;
  }

  async updateStaffAvailability(id: string, data: Partial<InsertStaffAvailability>): Promise<StaffAvailability | undefined> {
    const [availability] = await db.update(staffAvailability)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffAvailability.id, id))
      .returning();
    return availability;
  }

  async deleteStaffAvailability(id: string): Promise<boolean> {
    await db.delete(staffAvailability).where(eq(staffAvailability.id, id));
    return true;
  }

  // Shift Swap Requests
  async getShiftSwapRequests(filters?: { 
    requesterId?: string; 
    targetStaffId?: string;
    status?: string;
  }): Promise<ShiftSwapRequest[]> {
    const conditions = [];
    if (filters?.requesterId) conditions.push(eq(shiftSwapRequests.requesterId, filters.requesterId));
    if (filters?.targetStaffId) conditions.push(eq(shiftSwapRequests.targetStaffId, filters.targetStaffId));
    if (filters?.status) conditions.push(eq(shiftSwapRequests.status, filters.status as any));
    
    let query = db.select().from(shiftSwapRequests);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(desc(shiftSwapRequests.createdAt));
  }

  async getShiftSwapRequestById(id: string): Promise<ShiftSwapRequest | undefined> {
    const [request] = await db.select().from(shiftSwapRequests).where(eq(shiftSwapRequests.id, id));
    return request;
  }

  async createShiftSwapRequest(data: InsertShiftSwapRequest): Promise<ShiftSwapRequest> {
    const [request] = await db.insert(shiftSwapRequests).values(data).returning();
    return request;
  }

  async updateShiftSwapRequest(id: string, data: Partial<InsertShiftSwapRequest>): Promise<ShiftSwapRequest | undefined> {
    const [request] = await db.update(shiftSwapRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftSwapRequests.id, id))
      .returning();
    return request;
  }

  // Service Events (for staff scheduling)
  async getServiceEvents(filters?: { 
    locationId?: string; 
    dateFrom?: string; 
    dateTo?: string;
    status?: string;
    eventType?: string;
  }): Promise<ServiceEvent[]> {
    const conditions = [];
    if (filters?.locationId) conditions.push(eq(serviceEvents.locationId, filters.locationId));
    if (filters?.dateFrom) conditions.push(gte(serviceEvents.eventDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(serviceEvents.eventDate, filters.dateTo));
    if (filters?.status) conditions.push(eq(serviceEvents.status, filters.status as any));
    if (filters?.eventType) conditions.push(eq(serviceEvents.eventType, filters.eventType as any));
    
    let query = db.select().from(serviceEvents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(serviceEvents.eventDate, serviceEvents.startTime);
  }

  async getServiceEventById(id: string): Promise<ServiceEvent | undefined> {
    const [event] = await db.select().from(serviceEvents).where(eq(serviceEvents.id, id));
    return event;
  }

  async createServiceEvent(data: InsertServiceEvent): Promise<ServiceEvent> {
    const [event] = await db.insert(serviceEvents).values(data).returning();
    return event;
  }

  async updateServiceEvent(id: string, data: Partial<InsertServiceEvent>): Promise<ServiceEvent | undefined> {
    const [event] = await db.update(serviceEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceEvents.id, id))
      .returning();
    return event;
  }

  async deleteServiceEvent(id: string): Promise<boolean> {
    await db.delete(serviceEvents).where(eq(serviceEvents.id, id));
    return true;
  }

  // Event Assignments
  async getEventAssignments(filters?: { 
    eventId?: string; 
    staffMemberId?: string;
    status?: string;
  }): Promise<EventAssignment[]> {
    const conditions = [];
    if (filters?.eventId) conditions.push(eq(eventAssignments.eventId, filters.eventId));
    if (filters?.staffMemberId) conditions.push(eq(eventAssignments.staffMemberId, filters.staffMemberId));
    if (filters?.status) conditions.push(eq(eventAssignments.status, filters.status as any));
    
    let query = db.select().from(eventAssignments);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(desc(eventAssignments.assignedAt));
  }

  async getEventAssignmentById(id: string): Promise<EventAssignment | undefined> {
    const [assignment] = await db.select().from(eventAssignments).where(eq(eventAssignments.id, id));
    return assignment;
  }

  async createEventAssignment(data: InsertEventAssignment): Promise<EventAssignment> {
    const [assignment] = await db.insert(eventAssignments).values(data).returning();
    return assignment;
  }

  async updateEventAssignment(id: string, data: Partial<InsertEventAssignment>): Promise<EventAssignment | undefined> {
    const [assignment] = await db.update(eventAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eventAssignments.id, id))
      .returning();
    return assignment;
  }

  async deleteEventAssignment(id: string): Promise<boolean> {
    await db.delete(eventAssignments).where(eq(eventAssignments.id, id));
    return true;
  }

  // Shift Activity Logs
  async createShiftActivityLog(data: InsertShiftActivityLog): Promise<ShiftActivityLog> {
    const [log] = await db.insert(shiftActivityLogs).values(data).returning();
    return log;
  }

  async getShiftActivityLogs(filters?: { 
    entityType?: string; 
    entityId?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ShiftActivityLog[]> {
    const conditions = [];
    if (filters?.entityType) conditions.push(eq(shiftActivityLogs.entityType, filters.entityType as any));
    if (filters?.entityId) conditions.push(eq(shiftActivityLogs.entityId, filters.entityId));
    if (filters?.actorId) conditions.push(eq(shiftActivityLogs.actorId, filters.actorId));
    if (filters?.dateFrom) conditions.push(gte(shiftActivityLogs.createdAt, new Date(filters.dateFrom)));
    if (filters?.dateTo) conditions.push(lte(shiftActivityLogs.createdAt, new Date(filters.dateTo)));
    
    let query = db.select().from(shiftActivityLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query.orderBy(desc(shiftActivityLogs.createdAt));
  }

  // Open/uncovered shifts
  async getOpenShifts(filters?: { 
    locationId?: string; 
    dateFrom?: string; 
    dateTo?: string;
    organizationId?: string;
  }): Promise<(ShiftInstance & { assignmentCount: number })[]> {
    const conditions = [eq(shiftInstances.allowSelfSignup, true)];
    if (filters?.organizationId) conditions.push(eq(shiftInstances.organizationId, filters.organizationId));
    if (filters?.locationId) conditions.push(eq(shiftInstances.locationId, filters.locationId));
    if (filters?.dateFrom) conditions.push(gte(shiftInstances.shiftDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(shiftInstances.shiftDate, filters.dateTo));
    
    const shifts = await db.select().from(shiftInstances)
      .where(and(...conditions))
      .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);

    const results: (ShiftInstance & { assignmentCount: number })[] = [];
    for (const shift of shifts) {
      const assignments = await this.getShiftAssignments({ shiftInstanceId: shift.id });
      const activeAssignments = assignments.filter(a => 
        a.status !== "cancelled" && a.status !== "declined"
      );
      if (activeAssignments.length < (shift.minStaff || 2)) {
        results.push({ ...shift, assignmentCount: activeAssignments.length });
      }
    }
    return results;
  }
  // ============================================================================
  // VOLUNTEER REIMBURSEMENT SYSTEM
  // ============================================================================

  // Location distances
  async getLocationDistances(): Promise<LocationDistance[]> {
    return await db.select().from(locationDistances).orderBy(locationDistances.locationName);
  }

  async upsertLocationDistance(data: { 
    locationId: string; 
    locationName: string; 
    defaultDistanceKm: number 
  }): Promise<LocationDistance> {
    const existing = await db.select().from(locationDistances)
      .where(eq(locationDistances.locationId, data.locationId))
      .limit(1);
    
    if (existing[0]) {
      const [updated] = await db.update(locationDistances)
        .set({ 
          locationName: data.locationName, 
          defaultDistanceKm: data.defaultDistanceKm,
          updatedAt: new Date()
        })
        .where(eq(locationDistances.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(locationDistances).values({
        locationId: data.locationId,
        locationName: data.locationName,
        defaultDistanceKm: data.defaultDistanceKm,
      }).returning();
      return created;
    }
  }


  // Reimbursements
  async createReimbursement(
    data: Omit<InsertVolunteerReimbursement, 'id'>,
    shiftsData: Omit<InsertReimbursementShift, 'id' | 'reimbursementId'>[]
  ): Promise<VolunteerReimbursement & { shifts: ReimbursementShift[] }> {
    const [reimbursement] = await db.insert(volunteerReimbursements).values(data).returning();
    
    const shifts: ReimbursementShift[] = [];
    for (const shift of shiftsData) {
      const [created] = await db.insert(reimbursementShifts).values({
        ...shift,
        reimbursementId: reimbursement.id,
      }).returning();
      shifts.push(created);
    }
    
    return { ...reimbursement, shifts };
  }

  async getReimbursements(filters?: {
    month?: number;
    year?: number;
    staffMemberId?: string;
    status?: string;
  }): Promise<(VolunteerReimbursement & { volunteer?: { firstName: string; lastName: string } })[]> {
    const conditions = [];
    if (filters?.month) conditions.push(eq(volunteerReimbursements.month, filters.month));
    if (filters?.year) conditions.push(eq(volunteerReimbursements.year, filters.year));
    if (filters?.staffMemberId) conditions.push(eq(volunteerReimbursements.staffMemberId, filters.staffMemberId));
    if (filters?.status) conditions.push(eq(volunteerReimbursements.status, filters.status as any));
    
    let query = db.select().from(volunteerReimbursements);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const results = await query.orderBy(desc(volunteerReimbursements.createdAt));
    
    // Get volunteer names
    const enriched = [];
    for (const r of results) {
      const [volunteer] = await db.select({ firstName: staffMembers.firstName, lastName: staffMembers.lastName })
        .from(staffMembers)
        .where(eq(staffMembers.id, r.staffMemberId))
        .limit(1);
      enriched.push({ ...r, volunteer });
    }
    return enriched;
  }

  async getReimbursementWithShifts(id: string): Promise<(VolunteerReimbursement & { shifts: ReimbursementShift[] }) | null> {
    const [reimbursement] = await db.select().from(volunteerReimbursements)
      .where(eq(volunteerReimbursements.id, id))
      .limit(1);
    
    if (!reimbursement) return null;
    
    const shifts = await db.select().from(reimbursementShifts)
      .where(eq(reimbursementShifts.reimbursementId, id))
      .orderBy(reimbursementShifts.shiftDate);
    
    return { ...reimbursement, shifts };
  }

  async updateReimbursementStatus(id: string, status: string): Promise<VolunteerReimbursement> {
    const [updated] = await db.update(volunteerReimbursements)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(volunteerReimbursements.id, id))
      .returning();
    return updated;
  }

  async signReimbursement(id: string, signatureData: string, clientIp: string): Promise<VolunteerReimbursement> {
    const [updated] = await db.update(volunteerReimbursements)
      .set({ 
        signatureData, 
        signedAt: new Date(),
        signedFromIp: clientIp,
        status: 'signed' as any,
        updatedAt: new Date()
      })
      .where(eq(volunteerReimbursements.id, id))
      .returning();
    return updated;
  }

  async approveReimbursement(id: string, approvedBy: string): Promise<VolunteerReimbursement> {
    const [updated] = await db.update(volunteerReimbursements)
      .set({ 
        approvedBy, 
        approvedAt: new Date(),
        status: 'approved' as any,
        updatedAt: new Date()
      })
      .where(eq(volunteerReimbursements.id, id))
      .returning();
    return updated;
  }

  async deleteReimbursement(id: string): Promise<void> {
    await db.delete(reimbursementShifts).where(eq(reimbursementShifts.reimbursementId, id));
    await db.delete(volunteerReimbursements).where(eq(volunteerReimbursements.id, id));
  }

  // Handoff Consegne
  async getHandoffsForVehicle(vehicleId: string): Promise<Handoff[]> {
    return await db.select().from(handoffs)
      .where(eq(handoffs.vehicleId, vehicleId))
      .orderBy(desc(handoffs.createdAt));
  }

  async getPendingHandoffForVehicle(vehicleId: string): Promise<Handoff | undefined> {
    const [handoff] = await db.select().from(handoffs)
      .where(and(
        eq(handoffs.vehicleId, vehicleId),
        eq(handoffs.status, "pending")
      ))
      .orderBy(desc(handoffs.createdAt))
      .limit(1);
    return handoff || undefined;
  }

  async createHandoff(handoff: InsertHandoff): Promise<Handoff> {
    // Archive any pending handoffs for this vehicle first
    await db.update(handoffs)
      .set({ status: "archived" })
      .where(and(
        eq(handoffs.vehicleId, handoff.vehicleId),
        eq(handoffs.status, "pending")
      ));
    
    const [created] = await db.insert(handoffs).values({
      ...handoff,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }).returning();
    return created;
  }

  async markHandoffAsRead(id: string, userId: string, userName: string): Promise<Handoff> {
    const [updated] = await db.update(handoffs)
      .set({ 
        status: "read",
        readByUserId: userId,
        readByName: userName,
        readAt: new Date()
      })
      .where(eq(handoffs.id, id))
      .returning();
    return updated;
  }

  async archiveHandoff(id: string): Promise<void> {
    await db.update(handoffs)
      .set({ status: "archived" })
      .where(eq(handoffs.id, id));
  }

  // Expiry Correction Requests
  async createExpiryCorrectionRequest(request: InsertExpiryCorrectionRequest): Promise<ExpiryCorrectionRequest> {
    const [created] = await db.insert(expiryCorrectionRequests).values(request).returning();
    return created;
  }

  async getExpiryCorrectionRequests(filters?: { status?: string; locationId?: string }): Promise<ExpiryCorrectionRequest[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(expiryCorrectionRequests.status, filters.status));
    }
    if (filters?.locationId) {
      conditions.push(eq(expiryCorrectionRequests.locationId, filters.locationId));
    }
    
    if (conditions.length > 0) {
      return db.select()
        .from(expiryCorrectionRequests)
        .where(and(...conditions))
        .orderBy(desc(expiryCorrectionRequests.createdAt));
    }
    return db.select()
      .from(expiryCorrectionRequests)
      .orderBy(desc(expiryCorrectionRequests.createdAt));
  }

  async updateExpiryCorrectionRequest(id: string, data: Partial<ExpiryCorrectionRequest>): Promise<ExpiryCorrectionRequest | undefined> {
    const [updated] = await db.update(expiryCorrectionRequests)
      .set(data)
      .where(eq(expiryCorrectionRequests.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
