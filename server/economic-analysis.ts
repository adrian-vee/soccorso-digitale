import { storage } from "./storage";
import { 
  calculateTripCostBatch, 
  calculateCombinedRevenueBatch, 
  preloadFinancialData,
  TripCostBreakdown,
  PreloadedFinancialData
} from "./cost-calculator";
import type { Trip, Vehicle, Location, Contract } from "@shared/schema";

export interface EconomicFilters {
  dateFrom: string;
  dateTo: string;
  locationIds?: string[];
  contractIds?: string[];
  serviceTypes?: string[];
  vehicleIds?: string[];
  organizationId?: string;
}

export interface EconomicSummary {
  totalRevenue: number;
  totalCosts: number;
  netMargin: number;
  marginPercent: number;
  marginPerTrip: number;
  totalTrips: number;
  totalKm: number;
  totalHours: number;
  economicStatus: 'sustainable' | 'attention' | 'critical';
  periodComparison?: {
    previousMargin: number;
    deltaPercent: number;
  };
}

export interface TrendDataPoint {
  date: string;
  revenue: number;
  costs: number;
  margin: number;
}

export interface CostBreakdown {
  categories: {
    name: string;
    value: number;
    percent: number;
    color: string;
  }[];
  totals: {
    total: number;
    costPerKm: number;
    costPerHour: number;
    costPerTrip: number;
  };
}

export interface DimensionAnalysis {
  id: string;
  name: string;
  revenue: number;
  costs: number;
  margin: number;
  marginPercent: number;
  tripCount: number;
  km: number;
  hours: number;
  status: 'sustainable' | 'attention' | 'critical';
}

export interface SimulationParams {
  hourlyRate?: number;
  avgKmPerTrip?: number;
  avgHoursPerDay?: number;
}

export interface SimulationResult {
  estimatedMargin: number;
  breakEvenReached: boolean;
  deltaVsActual: number;
  deltaPercent: number;
}

export interface EconomicInsight {
  type: 'alert' | 'warning' | 'success';
  icon: string;
  title: string;
  description: string;
  value?: string;
}

function getEconomicStatus(marginPercent: number): 'sustainable' | 'attention' | 'critical' {
  if (marginPercent >= 10) return 'sustainable';
  if (marginPercent >= 0) return 'attention';
  return 'critical';
}

function parseFilters(query: any): EconomicFilters {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = now.toISOString().split('T')[0];
  
  return {
    dateFrom: query.dateFrom || defaultFrom,
    dateTo: query.dateTo || defaultTo,
    locationIds: query.locationIds ? (Array.isArray(query.locationIds) ? query.locationIds : [query.locationIds]) : undefined,
    contractIds: query.contractIds ? (Array.isArray(query.contractIds) ? query.contractIds : [query.contractIds]) : undefined,
    serviceTypes: query.serviceTypes ? (Array.isArray(query.serviceTypes) ? query.serviceTypes : [query.serviceTypes]) : undefined,
    vehicleIds: query.vehicleIds ? (Array.isArray(query.vehicleIds) ? query.vehicleIds : [query.vehicleIds]) : undefined,
    organizationId: query.organizationId || undefined,
  };
}

async function getFilteredTrips(filters: EconomicFilters): Promise<Trip[]> {
  return await storage.getTripsFiltered({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    vehicleIds: filters.vehicleIds,
    serviceTypes: filters.serviceTypes,
    organizationId: filters.organizationId,
  });
}

function filterTripsByLocation(
  trips: Trip[], 
  locationIds: string[], 
  data: PreloadedFinancialData
): Trip[] {
  if (!locationIds || locationIds.length === 0) return trips;
  
  return trips.filter(trip => {
    const vehicle = data.vehicles.get(trip.vehicleId);
    return vehicle?.locationId && locationIds.includes(vehicle.locationId);
  });
}

interface TripWithFinancials {
  trip: Trip;
  revenue: number;
  cost: TripCostBreakdown;
}

function calculateTripsFinancialsBatch(
  trips: Trip[], 
  data: PreloadedFinancialData
): TripWithFinancials[] {
  return trips.map(trip => {
    const cost = calculateTripCostBatch(trip, data);
    const revenueData = calculateCombinedRevenueBatch(trip, data);
    return {
      trip,
      revenue: revenueData.totalRevenue,
      cost,
    };
  });
}

function getPreviousPeriodFilters(filters: EconomicFilters): EconomicFilters {
  const fromDate = new Date(filters.dateFrom);
  const toDate = new Date(filters.dateTo);
  const periodLength = toDate.getTime() - fromDate.getTime();
  
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - periodLength);
  
  return {
    ...filters,
    dateFrom: prevFrom.toISOString().split('T')[0],
    dateTo: prevTo.toISOString().split('T')[0],
  };
}

export async function getEconomicSummary(query: any): Promise<EconomicSummary> {
  const filters = parseFilters(query);
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalKm = 0;
  let totalMinutes = 0;
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    totalRevenue += revenue;
    totalCosts += cost.totalCost;
    totalKm += trip.kmTraveled || 0;
    totalMinutes += trip.durationMinutes || 0;
  }
  
  const netMargin = totalRevenue - totalCosts;
  const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
  const marginPerTrip = trips.length > 0 ? netMargin / trips.length : 0;
  const totalHours = totalMinutes / 60;
  
  const prevFilters = getPreviousPeriodFilters(filters);
  let prevTrips = await getFilteredTrips(prevFilters);
  if (filters.locationIds && filters.locationIds.length > 0) {
    prevTrips = filterTripsByLocation(prevTrips, filters.locationIds, financialData);
  }
  const prevFinancials = calculateTripsFinancialsBatch(prevTrips, financialData);
  
  let prevRevenue = 0, prevCosts = 0;
  for (const { revenue, cost } of prevFinancials) {
    prevRevenue += revenue;
    prevCosts += cost.totalCost;
  }
  const prevMargin = prevRevenue - prevCosts;
  const deltaPercent = prevMargin !== 0 ? ((netMargin - prevMargin) / Math.abs(prevMargin)) * 100 : 0;
  
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCosts: Math.round(totalCosts * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    marginPerTrip: Math.round(marginPerTrip * 100) / 100,
    totalTrips: trips.length,
    totalKm: Math.round(totalKm),
    totalHours: Math.round(totalHours * 10) / 10,
    economicStatus: getEconomicStatus(marginPercent),
    periodComparison: {
      previousMargin: Math.round(prevMargin * 100) / 100,
      deltaPercent: Math.round(deltaPercent * 10) / 10,
    },
  };
}

export async function getEconomicTrends(query: any): Promise<TrendDataPoint[]> {
  const filters = parseFilters(query);
  const granularity = query.granularity || 'day';
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  
  const grouped = new Map<string, { revenue: number; costs: number }>();
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    if (!trip.serviceDate) continue;
    
    let key: string;
    const date = new Date(trip.serviceDate);
    
    if (granularity === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (granularity === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      key = trip.serviceDate;
    }
    
    const existing = grouped.get(key) || { revenue: 0, costs: 0 };
    existing.revenue += revenue;
    existing.costs += cost.totalCost;
    grouped.set(key, existing);
  }
  
  const results: TrendDataPoint[] = [];
  for (const [date, data] of grouped) {
    results.push({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      costs: Math.round(data.costs * 100) / 100,
      margin: Math.round((data.revenue - data.costs) * 100) / 100,
    });
  }
  
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCostBreakdown(query: any): Promise<CostBreakdown> {
  const filters = parseFilters(query);
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  
  let fuelTotal = 0;
  let maintenanceTotal = 0;
  let insuranceTotal = 0;
  let staffTotal = 0;
  let totalKm = 0;
  let totalMinutes = 0;
  
  for (const { trip, cost } of tripsWithFinancials) {
    fuelTotal += cost.vehicleCosts.fuel;
    maintenanceTotal += cost.vehicleCosts.maintenance;
    insuranceTotal += cost.vehicleCosts.insurance;
    staffTotal += cost.staffCosts.total;
    totalKm += trip.kmTraveled || 0;
    totalMinutes += trip.durationMinutes || 0;
  }
  
  const grandTotal = fuelTotal + maintenanceTotal + insuranceTotal + staffTotal;
  const totalHours = totalMinutes / 60;
  
  const categories = [
    { name: 'Personale', value: staffTotal, color: '#3B82F6' },
    { name: 'Carburante', value: fuelTotal, color: '#10B981' },
    { name: 'Manutenzione', value: maintenanceTotal, color: '#F59E0B' },
    { name: 'Assicurazione', value: insuranceTotal, color: '#8B5CF6' },
  ].map(cat => ({
    ...cat,
    value: Math.round(cat.value * 100) / 100,
    percent: grandTotal > 0 ? Math.round((cat.value / grandTotal) * 1000) / 10 : 0,
  }));
  
  return {
    categories,
    totals: {
      total: Math.round(grandTotal * 100) / 100,
      costPerKm: totalKm > 0 ? Math.round((grandTotal / totalKm) * 100) / 100 : 0,
      costPerHour: totalHours > 0 ? Math.round((grandTotal / totalHours) * 100) / 100 : 0,
      costPerTrip: trips.length > 0 ? Math.round((grandTotal / trips.length) * 100) / 100 : 0,
    },
  };
}

export async function getAnalysisByDimension(query: any): Promise<DimensionAnalysis[]> {
  const filters = parseFilters(query);
  const dimension = query.dimension || 'contract';
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  const locations = await storage.getLocations();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  
  // Use pre-loaded data from financialData
  const vehicleMap = financialData.vehicles;
  
  const locationMap = new Map<string, Location>();
  locations.forEach(l => locationMap.set(l.id, l));
  
  const contractMap = financialData.contracts;
  
  const grouped = new Map<string, {
    name: string;
    revenue: number;
    costs: number;
    tripCount: number;
    km: number;
    minutes: number;
  }>();
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    let key: string;
    let name: string;
    
    switch (dimension) {
      case 'vehicle':
        key = trip.vehicleId;
        name = vehicleMap.get(trip.vehicleId)?.code || `Veicolo ${trip.vehicleId.substring(0, 8)}`;
        break;
      case 'location':
        const vehicle = vehicleMap.get(trip.vehicleId);
        key = vehicle?.locationId || 'unknown';
        name = vehicle?.locationId ? (locationMap.get(vehicle.locationId)?.name || 'Sede sconosciuta') : 'Sede sconosciuta';
        break;
      case 'service':
        key = trip.serviceType || 'unknown';
        name = trip.serviceType || 'Tipo non specificato';
        break;
      case 'contract':
      default:
        key = 'general';
        name = 'Servizi Generali';
        break;
    }
    
    const existing = grouped.get(key) || { name, revenue: 0, costs: 0, tripCount: 0, km: 0, minutes: 0 };
    existing.revenue += revenue;
    existing.costs += cost.totalCost;
    existing.tripCount += 1;
    existing.km += trip.kmTraveled || 0;
    existing.minutes += trip.durationMinutes || 0;
    grouped.set(key, existing);
  }
  
  const results: DimensionAnalysis[] = [];
  for (const [id, data] of grouped) {
    const margin = data.revenue - data.costs;
    const marginPercent = data.revenue > 0 ? (margin / data.revenue) * 100 : 0;
    
    results.push({
      id,
      name: data.name,
      revenue: Math.round(data.revenue * 100) / 100,
      costs: Math.round(data.costs * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10,
      tripCount: data.tripCount,
      km: Math.round(data.km),
      hours: Math.round(data.minutes / 60 * 10) / 10,
      status: getEconomicStatus(marginPercent),
    });
  }
  
  return results.sort((a, b) => b.revenue - a.revenue);
}

export async function simulateScenario(query: any, params: SimulationParams): Promise<SimulationResult> {
  const filters = parseFilters(query);
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  
  let actualRevenue = 0;
  let actualCosts = 0;
  let totalKm = 0;
  let totalMinutes = 0;
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    actualRevenue += revenue;
    actualCosts += cost.totalCost;
    totalKm += trip.kmTraveled || 0;
    totalMinutes += trip.durationMinutes || 0;
  }
  
  const actualMargin = actualRevenue - actualCosts;
  const tripCount = trips.length;
  
  let estimatedRevenue = actualRevenue;
  let estimatedCosts = actualCosts;
  
  if (params.hourlyRate !== undefined && tripCount > 0) {
    const avgHours = totalMinutes / 60 / tripCount;
    estimatedRevenue = tripCount * avgHours * params.hourlyRate;
  }
  
  if (params.avgKmPerTrip !== undefined && tripCount > 0) {
    const currentAvgKm = totalKm / tripCount;
    const kmRatio = params.avgKmPerTrip / currentAvgKm;
    const fuelCostRatio = 0.3;
    estimatedCosts = actualCosts * (1 + (kmRatio - 1) * fuelCostRatio);
  }
  
  const estimatedMargin = estimatedRevenue - estimatedCosts;
  const deltaVsActual = estimatedMargin - actualMargin;
  const deltaPercent = actualMargin !== 0 ? (deltaVsActual / Math.abs(actualMargin)) * 100 : 0;
  
  return {
    estimatedMargin: Math.round(estimatedMargin * 100) / 100,
    breakEvenReached: estimatedMargin >= 0,
    deltaVsActual: Math.round(deltaVsActual * 100) / 100,
    deltaPercent: Math.round(deltaPercent * 10) / 10,
  };
}

export async function getEconomicInsights(query: any): Promise<EconomicInsight[]> {
  const filters = parseFilters(query);
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  const insights: EconomicInsight[] = [];
  
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalKm = 0;
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    totalRevenue += revenue;
    totalCosts += cost.totalCost;
    totalKm += trip.kmTraveled || 0;
  }
  
  const netMargin = totalRevenue - totalCosts;
  const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
  const costPerKm = totalKm > 0 ? totalCosts / totalKm : 0;
  
  if (netMargin < 0) {
    insights.push({
      type: 'alert',
      icon: 'alert-triangle',
      title: 'Margine Negativo',
      description: `Il margine netto e in perdita di ${Math.abs(netMargin).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} nel periodo selezionato.`,
      value: `${marginPercent.toFixed(1)}%`,
    });
  }
  
  if (costPerKm > 1.5) {
    insights.push({
      type: 'warning',
      icon: 'trending-up',
      title: 'Costo/Km Elevato',
      description: `Il costo medio per km (${costPerKm.toFixed(2)} EUR) supera la soglia ottimale.`,
      value: `${costPerKm.toFixed(2)} EUR/km`,
    });
  }
  
  if (marginPercent >= 15) {
    insights.push({
      type: 'success',
      icon: 'check-circle',
      title: 'Margine Sostenibile',
      description: `Ottima performance economica con margine del ${marginPercent.toFixed(1)}%.`,
      value: `+${marginPercent.toFixed(1)}%`,
    });
  }
  
  if (trips.length > 0) {
    const avgRevenuePerTrip = totalRevenue / trips.length;
    insights.push({
      type: 'success',
      icon: 'bar-chart-2',
      title: 'Volume Servizi',
      description: `${trips.length} servizi effettuati con ricavo medio di ${avgRevenuePerTrip.toFixed(2)} EUR/servizio.`,
      value: `${trips.length} servizi`,
    });
  }
  
  return insights;
}

export interface TopPerformer {
  id: string;
  name: string;
  revenue: number;
  margin: number;
  marginPercent: number;
  tripCount: number;
}

export async function getTopPerformers(query: any): Promise<{ vehicles: TopPerformer[]; services: TopPerformer[] }> {
  const filters = parseFilters(query);
  
  // Pre-load all financial data once (OPTIMIZED)
  const financialData = await preloadFinancialData();
  
  let trips = await getFilteredTrips(filters);
  
  if (filters.locationIds && filters.locationIds.length > 0) {
    trips = filterTripsByLocation(trips, filters.locationIds, financialData);
  }
  
  const tripsWithFinancials = calculateTripsFinancialsBatch(trips, financialData);
  const vehicleMap = new Map(Array.from(financialData.vehicles.entries()).map(([id, v]) => [id, v.code || v.licensePlate || id]));
  
  const byVehicle = new Map<string, { revenue: number; costs: number; tripCount: number }>();
  const byService = new Map<string, { revenue: number; costs: number; tripCount: number }>();
  
  for (const { trip, revenue, cost } of tripsWithFinancials) {
    const vKey = trip.vehicleId;
    const sKey = trip.serviceType || 'ordinario';
    
    if (!byVehicle.has(vKey)) byVehicle.set(vKey, { revenue: 0, costs: 0, tripCount: 0 });
    if (!byService.has(sKey)) byService.set(sKey, { revenue: 0, costs: 0, tripCount: 0 });
    
    const v = byVehicle.get(vKey)!;
    v.revenue += revenue;
    v.costs += cost.totalCost;
    v.tripCount++;
    
    const s = byService.get(sKey)!;
    s.revenue += revenue;
    s.costs += cost.totalCost;
    s.tripCount++;
  }
  
  const serviceLabels: Record<string, string> = {
    ordinario: 'Ordinario', urgente: 'Urgente', dialisi: 'Dialisi',
    dimissione: 'Dimissione', trasferimento: 'Trasferimento', emergenza: 'Emergenza'
  };
  
  const vehiclePerformers: TopPerformer[] = Array.from(byVehicle.entries())
    .map(([id, data]) => ({
      id,
      name: vehicleMap.get(id) || id,
      revenue: Math.round(data.revenue * 100) / 100,
      margin: Math.round((data.revenue - data.costs) * 100) / 100,
      marginPercent: data.revenue > 0 ? Math.round(((data.revenue - data.costs) / data.revenue) * 1000) / 10 : 0,
      tripCount: data.tripCount,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);
  
  const servicePerformers: TopPerformer[] = Array.from(byService.entries())
    .map(([id, data]) => ({
      id,
      name: serviceLabels[id] || id,
      revenue: Math.round(data.revenue * 100) / 100,
      margin: Math.round((data.revenue - data.costs) * 100) / 100,
      marginPercent: data.revenue > 0 ? Math.round(((data.revenue - data.costs) / data.revenue) * 1000) / 10 : 0,
      tripCount: data.tripCount,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);
  
  return { vehicles: vehiclePerformers, services: servicePerformers };
}

export { parseFilters, getFilteredTrips, filterTripsByLocation, calculateTripsFinancialsBatch };
