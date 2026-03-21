import { storage } from "./storage";
import type { Trip, FinancialProfile, FinancialParameter, StaffRoleCost, RevenueModel, Vehicle, Contract, ContractVehicle } from "@shared/schema";

// Hourly billing breakdown for Appalti (contract-based hourly assignments)
export interface HourlyBillingBreakdown {
  contractId: string;
  contractName: string;
  clientName: string;
  hourlyRate: number;
  hours: number;
  hourlyRevenue: number;
  isContractBased: true;
}

export interface TripCostBreakdown {
  vehicleCosts: {
    fuel: number;
    maintenance: number;
    insurance: number;
    total: number;
  };
  staffCosts: {
    byRole: { role: string; cost: number; hours: number }[];
    total: number;
    missingRoles?: string[]; // Roles that are not configured in financial profile
  };
  totalCost: number;
  warnings?: string[]; // Warnings about missing configuration
}

export interface TripRevenueBreakdown {
  contractName: string;
  baseFee: number;
  kmRevenue: number;
  timeRevenue: number;
  subtotal: number;
  minimumApplied: boolean;
  totalRevenue: number;
  billingType?: 'per_service' | 'hourly';
}

// Combined revenue that includes both per-service and hourly billing
export interface CombinedRevenueBreakdown {
  perServiceRevenue: TripRevenueBreakdown | null;
  hourlyRevenue: HourlyBillingBreakdown | null;
  totalRevenue: number;
}

export interface TripFinancials {
  tripId: string;
  cost: TripCostBreakdown;
  revenue: TripRevenueBreakdown | null; // Per-service billing (backward compatibility)
  hourlyRevenue: HourlyBillingBreakdown | null; // Hourly contract billing
  effectiveRevenue: number; // The actual revenue used (hourly if contract-based, per-service otherwise)
  billingType: 'per_service' | 'hourly'; // Indicates which billing model was used
  profit: number;
  profitMargin: number;
}

export interface FinancialSummary {
  periodStart: string;
  periodEnd: string;
  totalTrips: number;
  totalKm: number;
  totalMinutes: number;
  costs: {
    fuel: number;
    maintenance: number;
    insurance: number;
    staff: number;
    total: number;
  };
  revenue: {
    total: number;
    byContract: { contractName: string; amount: number; tripCount: number }[];
  };
  profit: number;
  profitMargin: number;
  averages: {
    costPerTrip: number;
    costPerKm: number;
    revenuePerTrip: number;
    revenuePerKm: number;
    profitPerTrip: number;
  };
}

function getParamValue(params: FinancialParameter[], key: string): number {
  const param = params.find(p => p.paramKey === key);
  return param?.paramValue ?? 0;
}

// ============================================================================
// BATCH CALCULATION (OPTIMIZED - Pre-loads all data once)
// ============================================================================

export interface PreloadedFinancialData {
  profile: FinancialProfile | null;
  params: FinancialParameter[];
  staffCosts: StaffRoleCost[];
  vehicles: Map<string, Vehicle>;
  contracts: Map<string, Contract>;
  contractVehicles: ContractVehicle[];
  revenueModels: RevenueModel[];
}

export async function preloadFinancialData(): Promise<PreloadedFinancialData> {
  const [profileResult, allVehicles, allContracts, allContractVehicles] = await Promise.all([
    storage.getDefaultFinancialProfile(),
    storage.getVehicles(),
    storage.getContracts(),
    storage.getContractVehicles(),
  ]);
  
  const profile = profileResult || null;
  
  let params: FinancialParameter[] = [];
  let staffCosts: StaffRoleCost[] = [];
  let revenueModels: RevenueModel[] = [];
  
  if (profile) {
    [params, staffCosts, revenueModels] = await Promise.all([
      storage.getFinancialParameters(profile.id),
      storage.getStaffRoleCosts(profile.id),
      storage.getRevenueModels(profile.id),
    ]);
  }
  
  const vehicles = new Map<string, Vehicle>();
  allVehicles.forEach(v => vehicles.set(v.id, v));
  
  const contracts = new Map<string, Contract>();
  allContracts.forEach(c => contracts.set(c.id, c));
  
  return {
    profile,
    params,
    staffCosts,
    vehicles,
    contracts,
    contractVehicles: allContractVehicles,
    revenueModels,
  };
}

export function calculateTripCostBatch(
  trip: Trip,
  data: PreloadedFinancialData
): TripCostBreakdown {
  if (!data.profile) {
    return {
      vehicleCosts: { fuel: 0, maintenance: 0, insurance: 0, total: 0 },
      staffCosts: { byRole: [], total: 0 },
      totalCost: 0,
    };
  }
  
  const kmTraveled = trip.kmTraveled || 0;
  const durationMinutes = trip.durationMinutes || 0;
  const durationHours = durationMinutes / 60;
  
  const vehicle = data.vehicles.get(trip.vehicleId);
  const fuelConsumption = vehicle?.fuelConsumptionPer100km || getParamValue(data.params, "fuel_consumption_per_100km") || 12;
  const fuelCostPerLiter = getParamValue(data.params, "fuel_cost_per_liter") || 1.6;
  const maintenancePerKm = vehicle?.maintenanceCostPerKm || getParamValue(data.params, "maintenance_per_km") || 0.08;
  const insuranceMonthly = vehicle?.insuranceCostMonthly || getParamValue(data.params, "insurance_monthly") || 400;
  
  const fuelCost = (kmTraveled / 100) * fuelConsumption * fuelCostPerLiter;
  const maintenanceCost = kmTraveled * maintenancePerKm;
  
  const insurancePerTrip = getParamValue(data.params, "insurance_per_trip");
  const insuranceDaily = getParamValue(data.params, "insurance_daily") || (insuranceMonthly / 30);
  let insuranceCostPerTrip: number;
  
  if (insurancePerTrip > 0) {
    insuranceCostPerTrip = insurancePerTrip;
  } else {
    const tripHoursFraction = Math.min(durationHours / 8, 1);
    insuranceCostPerTrip = insuranceDaily * (tripHoursFraction || 0.125);
  }
  
  const vehicleCostTotal = fuelCost + maintenanceCost + insuranceCostPerTrip;
  
  const staffCostDetails: { role: string; cost: number; hours: number }[] = [];
  let totalStaffCost = 0;
  
  const crewType = (trip as any).crewType || 'autista_soccorritore';
  
  const findRoleByKey = (roleKey: string) => {
    let role = data.staffCosts.find(s => s.roleKey === roleKey);
    if (role) return role;
    return data.staffCosts.find(s => s.roleName.toLowerCase() === roleKey.toLowerCase());
  };
  
  const addRoleCost = (role: typeof data.staffCosts[0] | undefined, displayName: string) => {
    if (!role) return;
    const hours = role.hoursPerTrip || durationHours || 1;
    const cost = role.hourlyCost * hours;
    staffCostDetails.push({ role: displayName, cost, hours });
    totalStaffCost += cost;
  };
  
  addRoleCost(findRoleByKey('autista'), 'Autista');
  if (crewType === 'autista_infermiere') {
    addRoleCost(findRoleByKey('infermiere'), 'Infermiere');
  } else {
    addRoleCost(findRoleByKey('soccorritore'), 'Soccorritore');
  }
  
  return {
    vehicleCosts: {
      fuel: Math.round(fuelCost * 100) / 100,
      maintenance: Math.round(maintenanceCost * 100) / 100,
      insurance: Math.round(insuranceCostPerTrip * 100) / 100,
      total: Math.round(vehicleCostTotal * 100) / 100,
    },
    staffCosts: {
      byRole: staffCostDetails.map(s => ({ ...s, cost: Math.round(s.cost * 100) / 100 })),
      total: Math.round(totalStaffCost * 100) / 100,
    },
    totalCost: Math.round((vehicleCostTotal + totalStaffCost) * 100) / 100,
  };
}

export function calculateCombinedRevenueBatch(
  trip: Trip,
  data: PreloadedFinancialData
): CombinedRevenueBreakdown {
  // Check for hourly contract billing first
  const vehicle = data.vehicles.get(trip.vehicleId);
  if (vehicle) {
    const contractVehicle = data.contractVehicles.find(cv => cv.vehicleId === vehicle.id && cv.isActive);
    if (contractVehicle) {
      const contract = data.contracts.get(contractVehicle.contractId);
      // Use defaultHourlyRate from contract schema
      if (contract && contract.defaultHourlyRate && contract.defaultHourlyRate > 0) {
        const durationMinutes = trip.durationMinutes || 0;
        const hours = durationMinutes / 60;
        const hourlyRevenue = hours * contract.defaultHourlyRate;
        
        return {
          perServiceRevenue: null,
          hourlyRevenue: {
            contractId: contract.id,
            contractName: contract.name,
            clientName: contract.clientName || contract.name,
            hourlyRate: contract.defaultHourlyRate,
            hours: Math.round(hours * 100) / 100,
            hourlyRevenue: Math.round(hourlyRevenue * 100) / 100,
            isContractBased: true,
          },
          totalRevenue: Math.round(hourlyRevenue * 100) / 100,
        };
      }
    }
  }
  
  // Per-service billing from revenue model
  let model = data.revenueModels.find(m => m.tripType === trip.serviceType && m.isActive);
  if (!model) model = data.revenueModels.find(m => !m.tripType && m.isActive);
  if (!model) model = data.revenueModels.find(m => m.isActive);
  
  if (!model) {
    return { perServiceRevenue: null, hourlyRevenue: null, totalRevenue: 0 };
  }
  
  const kmTraveled = trip.kmTraveled || 0;
  const durationMinutes = trip.durationMinutes || 0;
  
  const baseFee = model.baseFee || 0;
  // Use perKmRate and perMinuteRate from schema (convert minutes to hours)
  const kmRevenue = kmTraveled * (model.perKmRate || 0);
  const timeRevenue = durationMinutes * (model.perMinuteRate || 0);
  let subtotal = baseFee + kmRevenue + timeRevenue;
  
  const minimumFee = model.minimumFee || 0;
  const minimumApplied = subtotal < minimumFee;
  const totalRevenue = Math.max(subtotal, minimumFee);
  
  return {
    perServiceRevenue: {
      contractName: model.contractName || 'Standard',
      baseFee: Math.round(baseFee * 100) / 100,
      kmRevenue: Math.round(kmRevenue * 100) / 100,
      timeRevenue: Math.round(timeRevenue * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      minimumApplied,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    hourlyRevenue: null,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

export async function calculateTripCost(
  trip: Trip,
  profileId?: string
): Promise<TripCostBreakdown> {
  let profile: FinancialProfile | undefined;
  
  if (profileId) {
    profile = await storage.getFinancialProfile(profileId);
  } else {
    profile = await storage.getDefaultFinancialProfile();
  }
  
  if (!profile) {
    return {
      vehicleCosts: { fuel: 0, maintenance: 0, insurance: 0, total: 0 },
      staffCosts: { byRole: [], total: 0 },
      totalCost: 0,
    };
  }
  
  const params = await storage.getFinancialParameters(profile.id);
  const staffCosts = await storage.getStaffRoleCosts(profile.id);
  
  const kmTraveled = trip.kmTraveled || 0;
  const durationMinutes = trip.durationMinutes || 0;
  const durationHours = durationMinutes / 60;
  
  const vehicle = await storage.getVehicle(trip.vehicleId);
  const fuelConsumption = vehicle?.fuelConsumptionPer100km || getParamValue(params, "fuel_consumption_per_100km") || 12;
  const fuelCostPerLiter = getParamValue(params, "fuel_cost_per_liter") || 1.6;
  const maintenancePerKm = vehicle?.maintenanceCostPerKm || getParamValue(params, "maintenance_per_km") || 0.08;
  const insuranceMonthly = vehicle?.insuranceCostMonthly || getParamValue(params, "insurance_monthly") || 400;
  
  const fuelCost = (kmTraveled / 100) * fuelConsumption * fuelCostPerLiter;
  const maintenanceCost = kmTraveled * maintenancePerKm;
  
  // Insurance calculation: use insurance_per_trip if configured, 
  // otherwise prorate monthly insurance based on trip duration (hours / total daily hours)
  const insurancePerTrip = getParamValue(params, "insurance_per_trip");
  const insuranceDaily = getParamValue(params, "insurance_daily") || (insuranceMonthly / 30);
  let insuranceCostPerTrip: number;
  
  if (insurancePerTrip > 0) {
    // Use configured per-trip rate
    insuranceCostPerTrip = insurancePerTrip;
  } else {
    // Prorate daily insurance based on trip duration (assume 8-hour workday)
    const tripHoursFraction = Math.min(durationHours / 8, 1); // Cap at 1 day
    insuranceCostPerTrip = insuranceDaily * (tripHoursFraction || 0.125); // Default: 1/8 of day if no duration
  }
  
  const vehicleCostTotal = fuelCost + maintenanceCost + insuranceCostPerTrip;
  
  const staffCostDetails: { role: string; cost: number; hours: number }[] = [];
  let totalStaffCost = 0;
  const missingRoles: string[] = []; // Track unconfigured roles for warnings
  
  // Get crew type from trip - determines which staff roles to include in cost
  // autista_soccorritore = Driver + Rescuer (2 separate people)
  // autista_infermiere = Driver + Nurse (2 separate people)
  const crewType = (trip as any).crewType || 'autista_soccorritore';
  
  // Find role by canonical roleKey (exact match using enum)
  // The roleKey is an enforced enum: autista, soccorritore, infermiere, medico, coordinatore
  // Each role represents ONE crew member with their individual hourly cost
  const findRoleByKey = (roleKey: string): typeof staffCosts[0] | undefined => {
    // First try to match by roleKey (preferred - enforced enum)
    let role = staffCosts.find(s => s.roleKey === roleKey);
    if (role) return role;
    // Fallback to roleName for backward compatibility with existing data
    return staffCosts.find(s => s.roleName.toLowerCase() === roleKey.toLowerCase());
  };
  
  // Helper to add a role's cost to the breakdown
  const addRoleCost = (role: typeof staffCosts[0] | undefined, roleKey: string, displayName: string) => {
    if (!role) {
      missingRoles.push(roleKey);
      // Add placeholder entry with zero cost to show the role should exist
      staffCostDetails.push({
        role: `${displayName} (non configurato)`,
        cost: 0,
        hours: durationHours || 1,
      });
      console.warn(`[CostCalculator] Missing staff role configuration: ${roleKey} - Trip ${trip.id} will have incomplete staff costs`);
      return false;
    }
    
    const hours = role.hoursPerTrip || durationHours || 1;
    const cost = role.hourlyCost * hours;
    staffCostDetails.push({
      role: displayName,
      cost,
      hours,
    });
    totalStaffCost += cost;
    return true;
  };
  
  // Ambulance crews require 2 staff members:
  // Crew Type A (autista_soccorritore): autista + soccorritore
  // Crew Type B (autista_infermiere): autista + infermiere
  // Each role must be configured separately in the financial profile
  
  // Add driver cost (autista - required for all crew types)
  const driverRole = findRoleByKey('autista');
  addRoleCost(driverRole, 'autista', 'Autista');
  
  // Add second crew member based on crew type
  if (crewType === 'autista_infermiere') {
    const nurseRole = findRoleByKey('infermiere');
    addRoleCost(nurseRole, 'infermiere', 'Infermiere');
  } else {
    const rescuerRole = findRoleByKey('soccorritore');
    addRoleCost(rescuerRole, 'soccorritore', 'Soccorritore');
  }
  
  return {
    vehicleCosts: {
      fuel: Math.round(fuelCost * 100) / 100,
      maintenance: Math.round(maintenanceCost * 100) / 100,
      insurance: Math.round(insuranceCostPerTrip * 100) / 100,
      total: Math.round(vehicleCostTotal * 100) / 100,
    },
    staffCosts: {
      byRole: staffCostDetails.map(s => ({
        ...s,
        cost: Math.round(s.cost * 100) / 100,
      })),
      total: Math.round(totalStaffCost * 100) / 100,
      missingRoles: missingRoles.length > 0 ? missingRoles : undefined,
    },
    totalCost: Math.round((vehicleCostTotal + totalStaffCost) * 100) / 100,
    warnings: missingRoles.length > 0 ? [`Ruoli non configurati: ${missingRoles.join(', ')}`] : undefined,
  };
}

export async function calculateTripRevenue(
  trip: Trip,
  profileId?: string
): Promise<TripRevenueBreakdown | null> {
  let profile: FinancialProfile | undefined;
  
  if (profileId) {
    profile = await storage.getFinancialProfile(profileId);
  } else {
    profile = await storage.getDefaultFinancialProfile();
  }
  
  if (!profile) {
    return null;
  }
  
  const revenueModels = await storage.getRevenueModels(profile.id);
  
  let model = revenueModels.find(m => 
    m.tripType === trip.serviceType && m.isActive
  );
  
  if (!model) {
    model = revenueModels.find(m => !m.tripType && m.isActive);
  }
  
  if (!model) {
    model = revenueModels.find(m => m.isActive);
  }
  
  if (!model) {
    return null;
  }
  
  const kmTraveled = trip.kmTraveled || 0;
  const durationMinutes = trip.durationMinutes || 0;
  
  const baseFee = model.baseFee || 0;
  const kmRevenue = kmTraveled * (model.perKmRate || 0);
  const timeRevenue = durationMinutes * (model.perMinuteRate || 0);
  
  const subtotal = baseFee + kmRevenue + timeRevenue;
  const minimumFee = model.minimumFee || 0;
  const minimumApplied = subtotal < minimumFee;
  const totalRevenue = minimumApplied ? minimumFee : subtotal;
  
  return {
    contractName: model.contractName,
    baseFee: Math.round(baseFee * 100) / 100,
    kmRevenue: Math.round(kmRevenue * 100) / 100,
    timeRevenue: Math.round(timeRevenue * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    minimumApplied,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    billingType: 'per_service' as const,
  };
}

/**
 * Calculate hourly-based revenue for a trip if the vehicle is assigned to an appalto (contract).
 * This billing model is used when vehicles are assigned to contracts with hourly rates.
 */
export async function calculateHourlyRevenue(
  trip: Trip
): Promise<HourlyBillingBreakdown | null> {
  // Get the vehicle's contract assignments
  const vehicleContracts = await storage.getVehicleContracts(trip.vehicleId);
  
  // Find active contract that applies to this trip's date
  const activeContract = vehicleContracts.find(cv => {
    if (!cv.isActive) return false;
    // If contract has date range, check if trip falls within it
    if (cv.startDate && trip.serviceDate < cv.startDate) return false;
    if (cv.endDate && trip.serviceDate > cv.endDate) return false;
    return true;
  });
  
  if (!activeContract) {
    return null;
  }
  
  // Get the parent contract details
  const contract = await storage.getContract(activeContract.contractId);
  if (!contract || !contract.isActive) {
    return null;
  }
  
  // Calculate hours from trip duration (convert minutes to hours)
  // For contract billing, use a minimum of 1 hour if no duration recorded
  const durationMinutes = trip.durationMinutes || 0;
  const calculatedHours = durationMinutes / 60;
  const MINIMUM_BILLABLE_HOURS = 1; // Minimum 1 hour for contract billing
  const hours = calculatedHours > 0 ? calculatedHours : MINIMUM_BILLABLE_HOURS;
  
  // Use contract vehicle's specific hourly rate, or fall back to contract's default
  const hourlyRate = activeContract.hourlyRate ?? contract.defaultHourlyRate ?? 0;
  const hourlyRevenue = hours * hourlyRate;
  
  return {
    contractId: contract.id,
    contractName: contract.name,
    clientName: contract.clientName,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    hours: Math.round(hours * 100) / 100,
    hourlyRevenue: Math.round(hourlyRevenue * 100) / 100,
    isContractBased: true,
  };
}

/**
 * Calculate combined revenue for a trip, considering both per-service and hourly billing.
 * Hourly billing (appalti) takes precedence if the vehicle is assigned to an active contract.
 */
export async function calculateCombinedRevenue(
  trip: Trip,
  profileId?: string
): Promise<CombinedRevenueBreakdown> {
  // First check for hourly billing (appalti contracts)
  const hourlyRevenue = await calculateHourlyRevenue(trip);
  
  // Also calculate per-service revenue (traditional model)
  const perServiceRevenue = await calculateTripRevenue(trip, profileId);
  
  // If vehicle is assigned to a contract (appalto), use hourly billing
  // Otherwise, use per-service billing
  const totalRevenue = hourlyRevenue 
    ? hourlyRevenue.hourlyRevenue 
    : (perServiceRevenue?.totalRevenue || 0);
  
  return {
    perServiceRevenue,
    hourlyRevenue,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

export async function calculateTripFinancials(
  tripId: string,
  profileId?: string
): Promise<TripFinancials | null> {
  const trip = await storage.getTrip(tripId);
  if (!trip) {
    return null;
  }
  
  const cost = await calculateTripCost(trip, profileId);
  
  // Calculate both per-service and hourly revenue
  const combinedRevenue = await calculateCombinedRevenue(trip, profileId);
  let revenue = combinedRevenue.perServiceRevenue;
  const hourlyRevenue = combinedRevenue.hourlyRevenue;
  
  // Use hourly revenue if vehicle is on a contract, otherwise use per-service
  const effectiveRevenue = combinedRevenue.totalRevenue;
  const profit = effectiveRevenue - cost.totalCost;
  const profitMargin = effectiveRevenue > 0 ? (profit / effectiveRevenue) * 100 : 0;
  
  // Determine which billing type was used
  const billingType = hourlyRevenue ? 'hourly' as const : 'per_service' as const;
  
  // For backward compatibility: when hourly billing is used, populate revenue.totalRevenue
  // so legacy consumers still get the correct effective revenue value
  // All component values are set coherently so baseFee + kmRevenue + timeRevenue = subtotal = totalRevenue
  if (hourlyRevenue) {
    // Create a coherent revenue breakdown for hourly billing
    revenue = {
      contractName: hourlyRevenue.contractName,
      baseFee: 0, // Hourly billing has no base fee
      kmRevenue: 0, // Hourly billing has no per-km charge
      timeRevenue: hourlyRevenue.hourlyRevenue, // All revenue is time-based (hourly)
      subtotal: hourlyRevenue.hourlyRevenue,
      minimumApplied: false,
      totalRevenue: hourlyRevenue.hourlyRevenue,
      billingType: 'hourly',
    };
  }
  
  return {
    tripId,
    cost,
    revenue,
    hourlyRevenue,
    effectiveRevenue: Math.round(effectiveRevenue * 100) / 100,
    billingType,
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}

export async function calculateFinancialSummary(
  dateFrom: string,
  dateTo: string,
  profileId?: string,
  vehicleId?: string,
  locationId?: string
): Promise<FinancialSummary> {
  let profile: FinancialProfile | undefined;
  
  if (profileId) {
    profile = await storage.getFinancialProfile(profileId);
  } else {
    profile = await storage.getDefaultFinancialProfile();
  }
  
  let allTrips = await storage.getTrips();
  
  allTrips = allTrips.filter(trip => {
    const tripDate = trip.serviceDate;
    return tripDate >= dateFrom && tripDate <= dateTo;
  });
  
  if (vehicleId) {
    allTrips = allTrips.filter(trip => trip.vehicleId === vehicleId);
  }
  
  if (locationId) {
    const vehicles = await storage.getVehiclesByLocation(locationId);
    const vehicleIds = new Set(vehicles.map(v => v.id));
    allTrips = allTrips.filter(trip => vehicleIds.has(trip.vehicleId));
  }
  
  let totalFuelCost = 0;
  let totalMaintenanceCost = 0;
  let totalInsuranceCost = 0;
  let totalStaffCost = 0;
  let totalRevenue = 0;
  let totalKm = 0;
  let totalMinutes = 0;
  
  const revenueByContract: Map<string, { amount: number; tripCount: number }> = new Map();
  
  for (const trip of allTrips) {
    const cost = await calculateTripCost(trip, profile?.id);
    const combinedRevenue = await calculateCombinedRevenue(trip, profile?.id);
    
    totalFuelCost += cost.vehicleCosts.fuel;
    totalMaintenanceCost += cost.vehicleCosts.maintenance;
    totalInsuranceCost += cost.vehicleCosts.insurance;
    totalStaffCost += cost.staffCosts.total;
    
    // Use effective revenue (hourly if contract-based, per-service otherwise)
    totalRevenue += combinedRevenue.totalRevenue;
    
    // Track revenue by contract/billing source
    if (combinedRevenue.hourlyRevenue) {
      // Hourly billing from appalto contract - use contract name directly
      const contractName = combinedRevenue.hourlyRevenue.contractName;
      const existing = revenueByContract.get(contractName) || { amount: 0, tripCount: 0 };
      existing.amount += combinedRevenue.hourlyRevenue.hourlyRevenue;
      existing.tripCount += 1;
      revenueByContract.set(contractName, existing);
    } else if (combinedRevenue.perServiceRevenue) {
      // Per-service billing from revenue model
      const existing = revenueByContract.get(combinedRevenue.perServiceRevenue.contractName) || { amount: 0, tripCount: 0 };
      existing.amount += combinedRevenue.perServiceRevenue.totalRevenue;
      existing.tripCount += 1;
      revenueByContract.set(combinedRevenue.perServiceRevenue.contractName, existing);
    }
    
    totalKm += trip.kmTraveled || 0;
    totalMinutes += trip.durationMinutes || 0;
  }
  
  const totalCost = totalFuelCost + totalMaintenanceCost + totalInsuranceCost + totalStaffCost;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  
  const tripCount = allTrips.length;
  
  return {
    periodStart: dateFrom,
    periodEnd: dateTo,
    totalTrips: tripCount,
    totalKm: Math.round(totalKm),
    totalMinutes: Math.round(totalMinutes),
    costs: {
      fuel: Math.round(totalFuelCost * 100) / 100,
      maintenance: Math.round(totalMaintenanceCost * 100) / 100,
      insurance: Math.round(totalInsuranceCost * 100) / 100,
      staff: Math.round(totalStaffCost * 100) / 100,
      total: Math.round(totalCost * 100) / 100,
    },
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
      byContract: Array.from(revenueByContract.entries()).map(([contractName, data]) => ({
        contractName,
        amount: Math.round(data.amount * 100) / 100,
        tripCount: data.tripCount,
      })),
    },
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    averages: {
      costPerTrip: tripCount > 0 ? Math.round((totalCost / tripCount) * 100) / 100 : 0,
      costPerKm: totalKm > 0 ? Math.round((totalCost / totalKm) * 100) / 100 : 0,
      revenuePerTrip: tripCount > 0 ? Math.round((totalRevenue / tripCount) * 100) / 100 : 0,
      revenuePerKm: totalKm > 0 ? Math.round((totalRevenue / totalKm) * 100) / 100 : 0,
      profitPerTrip: tripCount > 0 ? Math.round((profit / tripCount) * 100) / 100 : 0,
    },
  };
}
