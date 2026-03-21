import { db } from "./db";
import { vehicles, trips, locations } from "@shared/schema";
import { eq } from "drizzle-orm";

// WordPress vehicles data
const wpVehicles = [
  { id: 1, sigla: 'J 71', targa: 'GH425RD', marca: 'PEUGEOT', modello: 'BOXER', alimentazione: 'Gasolio', default_start_km: 158242, kw: 110, sede: 'Verona' },
  { id: 5, sigla: 'ROMEO 21', targa: 'FG100YX', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 464368, kw: 0, sede: 'Legnago' },
  { id: 6, sigla: 'J 54', targa: 'FM009GB', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 457722, kw: 110, sede: 'Legnago' },
  { id: 7, sigla: 'J 55', targa: 'FM010GB', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 468046, kw: 110, sede: 'Legnago' },
  { id: 8, sigla: 'J 46', targa: 'FX170LT', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 292918, kw: 0, sede: 'Cologna Veneta' },
  { id: 9, sigla: 'J 56', targa: 'FR781NC', marca: 'VOLKSWAGEN', modello: 'T6', alimentazione: 'Gasolio', default_start_km: 295455, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 10, sigla: 'J 58', targa: 'FN888AH', marca: 'VOLKSWAGEN', modello: 'T6', alimentazione: 'Gasolio', default_start_km: 275014, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 11, sigla: 'J 59', targa: 'GH925JL', marca: 'PEUGEOT', modello: 'BOXER', alimentazione: 'Gasolio', default_start_km: 265618, kw: 0, sede: 'Cologna Veneta' },
  { id: 12, sigla: 'J 60', targa: 'GN887TV', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 115777, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 13, sigla: 'J 61', targa: 'GN885TV', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 150325, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 14, sigla: 'J 63', targa: 'FN735DE', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 310793, kw: 0, sede: 'Verona' },
  { id: 15, sigla: 'J 67', targa: 'FX656TT', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 241702, kw: 0, sede: 'Cologna Veneta' },
  { id: 16, sigla: 'J 68', targa: 'FL054VT', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 265261, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 17, sigla: 'J 69', targa: 'FG775TR', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 201282, kw: 0, sede: 'Cologna Veneta' },
  { id: 18, sigla: 'J 72', targa: 'FP014TX', marca: 'Fiat', modello: 'Talento', alimentazione: 'Gasolio', default_start_km: 101570, kw: 0, sede: 'Montecchio Maggiore' },
  { id: 19, sigla: 'J 64', targa: 'GR528XY', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 118074, kw: 0, sede: 'Nogara' },
  { id: 20, sigla: 'J 65', targa: 'GR526XY', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 70932, kw: 0, sede: 'Legnago' },
  { id: 21, sigla: 'J 66', targa: 'GR527XY', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 64114, kw: 0, sede: 'Cologna Veneta' },
  { id: 22, sigla: 'J 49', targa: 'FX171LT', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 509386, kw: 0, sede: 'Cologna Veneta' },
  { id: 24, sigla: 'J 52', targa: 'BY993AL', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 302142, kw: 0, sede: 'Legnago' },
  { id: 25, sigla: 'J 50', targa: 'BY995AL', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 0, kw: 0, sede: 'Legnago' },
  { id: 26, sigla: 'J 70', targa: 'FJ757LL', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 457005, kw: 0, sede: 'Legnago' },
  { id: 27, sigla: 'J 30', targa: 'FL929VM', marca: 'Fiat', modello: 'Ducato', alimentazione: 'Gasolio', default_start_km: 417945, kw: 0, sede: 'Montecchio Maggiore' },
];

// WordPress services data (unique by progressive number)
const wpServizi = [
  { vehicle_name: 'ROMEO 21', service_date: '2025-10-27', progressive: '25U077494' },
  { vehicle_name: 'ROMEO 21', service_date: '2025-10-27', progressive: '25U077726' },
  { vehicle_name: 'ROMEO 21', service_date: '2025-10-27', progressive: '25U070667' },
  { vehicle_name: 'ROMEO 21', service_date: '2025-10-27', progressive: '25U078276' },
  { vehicle_name: 'ROMEO 21', service_date: '2025-10-27', progressive: '25U078230' },
  { vehicle_name: 'BRAVO 21', service_date: '2025-10-27', progressive: '25B077494' },
  { vehicle_name: 'BRAVO 21', service_date: '2025-10-27', progressive: '25B077726' },
  { vehicle_name: 'BRAVO 21', service_date: '2025-10-27', progressive: '25B070667' },
  { vehicle_name: 'BRAVO 21', service_date: '2025-10-27', progressive: '25B078276' },
  { vehicle_name: 'BRAVO 21', service_date: '2025-10-27', progressive: '25B078230' },
];

async function migrate() {
  console.log("Starting WordPress data migration...");
  
  // Get all locations
  const allLocations = await db.select().from(locations);
  const locationMap: Record<string, string> = {};
  
  for (const loc of allLocations) {
    // Normalize name for matching
    const normalizedName = loc.name.toUpperCase();
    locationMap[normalizedName] = loc.id;
    // Also try partial match
    if (normalizedName.includes("VERONA")) locationMap["VERONA"] = loc.id;
    if (normalizedName.includes("LEGNAGO")) locationMap["LEGNAGO"] = loc.id;
    if (normalizedName.includes("COLOGNA")) locationMap["COLOGNA VENETA"] = loc.id;
    if (normalizedName.includes("MONTECCHIO")) locationMap["MONTECCHIO MAGGIORE"] = loc.id;
    if (normalizedName.includes("NOGARA")) locationMap["NOGARA"] = loc.id;
  }
  
  console.log("Location mapping:", locationMap);
  
  // Get existing vehicles
  const existingVehicles = await db.select().from(vehicles);
  const vehicleByCode: Record<string, string> = {};
  const vehicleByPlate: Record<string, string> = {};
  
  for (const v of existingVehicles) {
    vehicleByCode[v.code] = v.id;
    if (v.licensePlate) vehicleByPlate[v.licensePlate] = v.id;
  }
  
  console.log("Existing vehicles by code:", Object.keys(vehicleByCode));
  
  // Import vehicles
  let vehiclesCreated = 0;
  let vehiclesUpdated = 0;
  const wpVehicleIdToNewId: Record<number, string> = {};
  const vehicleNameToId: Record<string, string> = {};
  
  for (const wpVehicle of wpVehicles) {
    const locationId = locationMap[wpVehicle.sede.toUpperCase()];
    if (!locationId) {
      console.warn(`Location not found for: ${wpVehicle.sede}`);
      continue;
    }
    
    // Check if vehicle exists by code or plate
    let existingId = vehicleByCode[wpVehicle.sigla] || vehicleByPlate[wpVehicle.targa];
    
    if (existingId) {
      // Update existing vehicle with WordPress data
      await db.update(vehicles)
        .set({
          licensePlate: wpVehicle.targa,
          model: `${wpVehicle.marca} ${wpVehicle.modello}`,
          kw: wpVehicle.kw || null,
          fuelType: wpVehicle.alimentazione,
          currentKm: wpVehicle.default_start_km,
          locationId: locationId,
        })
        .where(eq(vehicles.id, existingId));
      
      wpVehicleIdToNewId[wpVehicle.id] = existingId;
      vehicleNameToId[wpVehicle.sigla] = existingId;
      vehiclesUpdated++;
      console.log(`Updated vehicle: ${wpVehicle.sigla}`);
    } else {
      // Create new vehicle
      const [newVehicle] = await db.insert(vehicles)
        .values({
          code: wpVehicle.sigla,
          licensePlate: wpVehicle.targa,
          model: `${wpVehicle.marca} ${wpVehicle.modello}`,
          kw: wpVehicle.kw || null,
          fuelType: wpVehicle.alimentazione,
          currentKm: wpVehicle.default_start_km,
          locationId: locationId,
          isActive: true,
        })
        .returning();
      
      wpVehicleIdToNewId[wpVehicle.id] = newVehicle.id;
      vehicleNameToId[wpVehicle.sigla] = newVehicle.id;
      vehiclesCreated++;
      console.log(`Created vehicle: ${wpVehicle.sigla}`);
    }
  }
  
  console.log(`\nVehicles: ${vehiclesCreated} created, ${vehiclesUpdated} updated`);
  
  // Import services
  let servicesCreated = 0;
  let servicesSkipped = 0;
  
  // Get a system user for service creation
  const systemUserId = "system-import";
  
  for (const servizio of wpServizi) {
    const vehicleId = vehicleNameToId[servizio.vehicle_name];
    
    if (!vehicleId) {
      console.warn(`Vehicle not found: ${servizio.vehicle_name}`);
      servicesSkipped++;
      continue;
    }
    
    // Check if trip with this progressive already exists
    const existingTrips = await db.select().from(trips)
      .where(eq(trips.progressiveNumber, servizio.progressive));
    
    if (existingTrips.length > 0) {
      console.log(`Trip already exists: ${servizio.progressive}`);
      servicesSkipped++;
      continue;
    }
    
    // Create trip with minimal data (we don't have km/time from WordPress)
    await db.insert(trips).values({
      progressiveNumber: servizio.progressive,
      vehicleId: vehicleId,
      userId: systemUserId,
      serviceDate: servizio.service_date,
      originType: "altro",
      originAddress: "Importato da WordPress",
      destinationType: "altro",
      destinationAddress: "Importato da WordPress",
      kmInitial: 0,
      kmFinal: 0,
      kmTraveled: 0,
      notes: "Servizio importato dal sistema WordPress precedente",
    });
    
    servicesCreated++;
    console.log(`Created trip: ${servizio.progressive}`);
  }
  
  console.log(`\nTrips: ${servicesCreated} created, ${servicesSkipped} skipped`);
  console.log("\nMigration completed!");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
