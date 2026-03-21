import fs from 'fs';
import { db } from './db';
import { trips, vehicles } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface WpVehicle {
  id: number;
  sigla: string;
  targa: string;
  sede: string;
}

interface WpTripSheet {
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
}

const wpVehicles: WpVehicle[] = [
  { id: 1, sigla: 'J 71', targa: 'GH425RD', sede: 'Verona' },
  { id: 5, sigla: 'ROMEO 21', targa: 'FG100YX', sede: 'Legnago' },
  { id: 6, sigla: 'J 54', targa: 'FM009GB', sede: 'Legnago' },
  { id: 7, sigla: 'J 55', targa: 'FM010GB', sede: 'Legnago' },
  { id: 8, sigla: 'J 46', targa: 'FX170LT', sede: 'Cologna Veneta' },
  { id: 9, sigla: 'J 56', targa: 'FR781NC', sede: 'Montecchio Maggiore' },
  { id: 10, sigla: 'J 58', targa: 'FN888AH', sede: 'Montecchio Maggiore' },
  { id: 11, sigla: 'J 59', targa: 'GH925JL', sede: 'Cologna Veneta' },
  { id: 12, sigla: 'J 60', targa: 'GN887TV', sede: 'Montecchio Maggiore' },
  { id: 13, sigla: 'J 61', targa: 'GN885TV', sede: 'Montecchio Maggiore' },
  { id: 14, sigla: 'J 63', targa: 'FN735DE', sede: 'Verona' },
  { id: 15, sigla: 'J 67', targa: 'FX656TT', sede: 'Cologna Veneta' },
  { id: 16, sigla: 'J 68', targa: 'FL054VT', sede: 'Montecchio Maggiore' },
  { id: 17, sigla: 'J 69', targa: 'FG775TR', sede: 'Cologna Veneta' },
  { id: 18, sigla: 'J 72', targa: 'FP014TX', sede: 'Montecchio Maggiore' },
  { id: 19, sigla: 'J 64', targa: 'GR528XY', sede: 'Nogara' },
  { id: 20, sigla: 'J 65', targa: 'GR526XY', sede: 'Legnago' },
  { id: 21, sigla: 'J 66', targa: 'GR527XY', sede: 'Cologna Veneta' },
  { id: 22, sigla: 'J 49', targa: 'FX171LT', sede: 'Cologna Veneta' },
  { id: 24, sigla: 'J 52', targa: 'BY993AL', sede: 'Legnago' },
  { id: 25, sigla: 'J 50', targa: 'BY995AL', sede: 'Legnago' },
  { id: 26, sigla: 'J 70', targa: 'FJ757LL', sede: 'Legnago' },
  { id: 27, sigla: 'J 30', targa: 'FL929VM', sede: 'Montecchio Maggiore' },
];

function parseDateTime(datetime: string): { date: string; time: string } {
  const match = datetime.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  return { date: datetime.split(' ')[0], time: '00:00' };
}

function determineLocationType(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('ospedale') || loc.includes('pronto soccorso') || loc.includes('reparto')) {
    return 'ospedale';
  }
  if (loc.includes('casa di riposo') || loc.includes('residenza') || loc.includes('rsa')) {
    return 'casa_di_riposo';
  }
  return 'domicilio';
}

async function importTrips() {
  console.log('Starting WordPress trip import...');
  
  const allVehicles = await db.select().from(vehicles);
  console.log(`Found ${allVehicles.length} vehicles in database`);
  
  const vehicleMap = new Map<number, string>();
  for (const wpVeh of wpVehicles) {
    const match = allVehicles.find(v => 
      v.licensePlate?.toUpperCase() === wpVeh.targa.toUpperCase() ||
      v.code?.toUpperCase() === wpVeh.sigla.toUpperCase()
    );
    if (match) {
      vehicleMap.set(wpVeh.id, match.id);
      console.log(`Mapped WP vehicle ${wpVeh.id} (${wpVeh.sigla}/${wpVeh.targa}) -> ${match.id} (${match.code})`);
    } else {
      console.warn(`No match found for WP vehicle ${wpVeh.id} (${wpVeh.sigla}/${wpVeh.targa})`);
    }
  }
  
  const sqlContent = fs.readFileSync('attached_assets/crocee86_wp_v2rov_(1)_1766135700348.sql', 'utf-8');
  
  const tripRegex = /\((\d+),\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+|NULL),\s*'?([MF]|NULL)'?,\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',/g;
  
  const tripsData: WpTripSheet[] = [];
  let match;
  
  while ((match = tripRegex.exec(sqlContent)) !== null) {
    tripsData.push({
      id: parseInt(match[1]),
      vehicle_id: parseInt(match[2]),
      service_number: match[3],
      start_time: match[4],
      end_time: match[5],
      patient_birth_year: match[6] === 'NULL' ? null : parseInt(match[6]),
      patient_gender: match[7] === 'NULL' ? null : match[7],
      start_location: match[8],
      end_location: match[9],
      start_km: parseInt(match[10]),
      end_km: parseInt(match[11]),
      km_travelled: parseInt(match[12]),
      time_elapsed: parseInt(match[13]),
      created_at: match[14],
    });
  }
  
  console.log(`Parsed ${tripsData.length} trips from SQL file`);
  
  const seenProgressives = new Set<string>();
  const uniqueTrips = tripsData.filter(t => {
    const key = `${t.vehicle_id}-${t.service_number}-${t.start_time}`;
    if (seenProgressives.has(key)) return false;
    seenProgressives.add(key);
    return true;
  });
  
  console.log(`${uniqueTrips.length} unique trips after deduplication`);
  
  const adminUserId = '0e204b31-38d4-4732-8432-e607c8fadf00';
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const trip of uniqueTrips) {
    try {
      const vehicleId = vehicleMap.get(trip.vehicle_id);
      if (!vehicleId) {
        skipped++;
        continue;
      }
      
      const { date, time: departureTime } = parseDateTime(trip.start_time);
      const { time: returnTime } = parseDateTime(trip.end_time);
      
      const originType = determineLocationType(trip.start_location);
      const destType = determineLocationType(trip.end_location);
      
      await db.insert(trips).values({
        progressiveNumber: trip.service_number,
        vehicleId: vehicleId,
        userId: adminUserId,
        serviceDate: date,
        departureTime: departureTime,
        returnTime: returnTime,
        patientBirthYear: trip.patient_birth_year,
        patientGender: trip.patient_gender,
        originType: originType,
        originAddress: trip.start_location,
        destinationType: destType,
        destinationAddress: trip.end_location,
        kmInitial: trip.start_km,
        kmFinal: trip.end_km,
        kmTraveled: trip.km_travelled,
        durationMinutes: trip.time_elapsed,
        serviceType: 'trasporto_programmato',
        crewType: 'autista_soccorritore',
        isReturnTrip: false,
        notes: null,
      });
      
      imported++;
      if (imported % 100 === 0) {
        console.log(`Imported ${imported} trips...`);
      }
    } catch (err: any) {
      errors++;
      if (errors <= 5) {
        console.error(`Error importing trip ${trip.id}:`, err.message);
      }
    }
  }
  
  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (no vehicle match): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

importTrips()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
