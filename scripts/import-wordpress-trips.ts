import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { trips, vehicles, users } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface WordpressTrip {
  id: number;
  vehicle_id: number;
  service_number: string;
  start_time: string;
  end_time: string;
  patient_birth_year: number | null;
  patient_gender: string | null;
  start_location: string;
  end_location: string;
  start_km: number;
  end_km: number;
  km_travelled: number;
  time_elapsed: number;
  created_at: string;
  user_id: number;
  is_modified: number;
  updated_at: string | null;
  notes: string | null;
  status: string;
  created_by: number | null;
}

interface WordpressVehicle {
  id: number;
  sigla: string;
  targa: string;
  marca: string;
  modello: string;
  alimentazione: string;
  sede: string;
}

async function parseWordpressSql(): Promise<{ trips: WordpressTrip[], vehicles: WordpressVehicle[] }> {
  const sqlFile = fs.readFileSync(
    path.join(process.cwd(), 'attached_assets/crocee86_wp_v2rov_(2)_1766731469643.sql'),
    'utf-8'
  );
  
  const trips: WordpressTrip[] = [];
  const vehicles: WordpressVehicle[] = [];
  
  const tripInsertRegex = /INSERT INTO `MjVXDb_ceu_trip_sheets`.*?VALUES\s*(.*?);/gs;
  const vehicleInsertRegex = /INSERT INTO `MjVXDb_ceu_vehicles`.*?VALUES\s*(.*?);/gs;
  
  let tripMatch = tripInsertRegex.exec(sqlFile);
  while (tripMatch) {
    const valuesStr = tripMatch[1];
    const rowRegex = /\((\d+),\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+|NULL),\s*'?([MF]?)'?,\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*'([^']*)',\s*(NULL|\d+)\)/g;
    
    let rowMatch = rowRegex.exec(valuesStr);
    while (rowMatch) {
      trips.push({
        id: parseInt(rowMatch[1]),
        vehicle_id: parseInt(rowMatch[2]),
        service_number: rowMatch[3],
        start_time: rowMatch[4],
        end_time: rowMatch[5],
        patient_birth_year: rowMatch[6] === 'NULL' ? null : parseInt(rowMatch[6]),
        patient_gender: rowMatch[7] || null,
        start_location: rowMatch[8],
        end_location: rowMatch[9],
        start_km: parseInt(rowMatch[10]),
        end_km: parseInt(rowMatch[11]),
        km_travelled: parseInt(rowMatch[12]),
        time_elapsed: parseInt(rowMatch[13]),
        created_at: rowMatch[14],
        user_id: parseInt(rowMatch[15]),
        is_modified: parseInt(rowMatch[16]),
        updated_at: rowMatch[17] === 'NULL' ? null : rowMatch[17].replace(/'/g, ''),
        notes: rowMatch[18] === 'NULL' ? null : rowMatch[18].replace(/'/g, ''),
        status: rowMatch[19],
        created_by: rowMatch[20] === 'NULL' ? null : parseInt(rowMatch[20])
      });
      rowMatch = rowRegex.exec(valuesStr);
    }
    tripMatch = tripInsertRegex.exec(sqlFile);
  }
  
  let vehicleMatch = vehicleInsertRegex.exec(sqlFile);
  while (vehicleMatch) {
    const valuesStr = vehicleMatch[1];
    const rowRegex = /\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*\d+,\s*\d+,\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*'([^']*)'\)/g;
    
    let rowMatch = rowRegex.exec(valuesStr);
    while (rowMatch) {
      vehicles.push({
        id: parseInt(rowMatch[1]),
        sigla: rowMatch[2],
        targa: rowMatch[3],
        modello: rowMatch[5],
        marca: rowMatch[4],
        alimentazione: rowMatch[6],
        sede: rowMatch[12]
      });
      rowMatch = rowRegex.exec(valuesStr);
    }
    vehicleMatch = vehicleInsertRegex.exec(sqlFile);
  }
  
  return { trips, vehicles };
}

function detectLocationType(location: string): { type: string, address: string } {
  const lowerLoc = location.toLowerCase();
  
  if (lowerLoc.includes('ospedale') || lowerLoc.includes('pronto soccorso') || 
      lowerLoc.includes('reparto') || lowerLoc.includes('emodialisi') ||
      lowerLoc.includes('mda degenze') || lowerLoc.includes('radiologia') ||
      lowerLoc.includes('cardiologia') || lowerLoc.includes('medicina') ||
      lowerLoc.includes('chirurgia') || lowerLoc.includes('neurologia') ||
      lowerLoc.includes('ortopedia') || lowerLoc.includes('geriatria')) {
    return { type: 'ospedale', address: location };
  }
  
  if (lowerLoc.includes('casa di riposo') || lowerLoc.includes('casa di soggiorno') ||
      lowerLoc.includes('pensionato') || lowerLoc.includes('rsa') ||
      lowerLoc.includes('ipab')) {
    return { type: 'casa_di_riposo', address: location };
  }
  
  if (lowerLoc.includes('via ') || lowerLoc.includes('piazza ') || 
      lowerLoc.includes('viale ') || lowerLoc.includes('contrada ')) {
    return { type: 'domicilio', address: location };
  }
  
  return { type: 'altro', address: location };
}

async function importTrips() {
  console.log('Parsing WordPress SQL file...');
  const { trips: wpTrips, vehicles: wpVehicles } = await parseWordpressSql();
  
  console.log(`Found ${wpTrips.length} trips and ${wpVehicles.length} vehicles in WordPress dump`);
  
  const existingVehicles = await db.select().from(vehicles);
  console.log(`Found ${existingVehicles.length} vehicles in current database`);
  
  const plateToUuid: Record<string, string> = {};
  const codeToUuid: Record<string, string> = {};
  
  for (const v of existingVehicles) {
    if (v.licensePlate) {
      plateToUuid[v.licensePlate.toUpperCase()] = v.id;
    }
    if (v.code) {
      codeToUuid[v.code.toUpperCase()] = v.id;
    }
  }
  
  const wpIdToUuid: Record<number, string> = {};
  for (const wpVehicle of wpVehicles) {
    const targa = wpVehicle.targa.toUpperCase();
    const sigla = wpVehicle.sigla.toUpperCase();
    
    if (plateToUuid[targa]) {
      wpIdToUuid[wpVehicle.id] = plateToUuid[targa];
    } else if (codeToUuid[sigla]) {
      wpIdToUuid[wpVehicle.id] = codeToUuid[sigla];
    }
  }
  
  console.log(`Mapped ${Object.keys(wpIdToUuid).length} WordPress vehicles to current database`);
  
  const allUsers = await db.select().from(users);
  const systemUserId = allUsers.length > 0 ? allUsers[0].id : null;
  
  if (!systemUserId) {
    console.error('No users found in database. Please create at least one user first.');
    process.exit(1);
  }
  
  console.log(`Using system user ID: ${systemUserId}`);
  
  const existingTrips = await db.select({
    progressiveNumber: trips.progressiveNumber,
    vehicleId: trips.vehicleId,
    serviceDate: trips.serviceDate
  }).from(trips);
  
  const existingKeys = new Set(
    existingTrips.map(t => `${t.vehicleId}_${t.progressiveNumber}_${t.serviceDate}`)
  );
  
  console.log(`Found ${existingTrips.length} existing trips in database`);
  
  let imported = 0;
  let skipped = 0;
  let noVehicle = 0;
  
  for (const wpTrip of wpTrips) {
    const vehicleUuid = wpIdToUuid[wpTrip.vehicle_id];
    
    if (!vehicleUuid) {
      noVehicle++;
      continue;
    }
    
    const startDateTime = new Date(wpTrip.start_time);
    const endDateTime = new Date(wpTrip.end_time);
    const serviceDate = startDateTime.toISOString().split('T')[0];
    
    const key = `${vehicleUuid}_${wpTrip.service_number}_${serviceDate}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    
    const departureTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
    const returnTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
    
    const origin = detectLocationType(wpTrip.start_location);
    const destination = detectLocationType(wpTrip.end_location);
    
    try {
      await db.insert(trips).values({
        progressiveNumber: wpTrip.service_number,
        vehicleId: vehicleUuid,
        userId: systemUserId,
        serviceDate: serviceDate,
        departureTime: departureTime,
        returnTime: returnTime,
        patientBirthYear: wpTrip.patient_birth_year,
        patientGender: wpTrip.patient_gender,
        originType: origin.type,
        originAddress: origin.address,
        destinationType: destination.type,
        destinationAddress: destination.address,
        kmInitial: wpTrip.start_km,
        kmFinal: wpTrip.end_km,
        kmTraveled: wpTrip.km_travelled,
        durationMinutes: wpTrip.time_elapsed,
        notes: wpTrip.notes,
        createdAt: new Date(wpTrip.created_at),
        updatedAt: new Date(wpTrip.created_at)
      });
      
      imported++;
      existingKeys.add(key);
    } catch (error) {
      console.error(`Error importing trip ${wpTrip.id}:`, error);
    }
  }
  
  console.log('\n=== Import Summary ===');
  console.log(`Total WordPress trips: ${wpTrips.length}`);
  console.log(`Successfully imported: ${imported}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Skipped (vehicle not found): ${noVehicle}`);
  console.log('======================\n');
}

importTrips()
  .then(() => {
    console.log('Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
