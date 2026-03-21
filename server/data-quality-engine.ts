import { db } from "./db";
import { 
  trips, vehicles, users, structures, locations,
  dataQualityAnomalies, dataQualityScores, dataQualityHistory, dataQualityConfig
} from "../shared/schema";
import { eq, and, gte, lte, desc, sql, count, isNull, or } from "drizzle-orm";

// ============================================================================
// CONFIGURAZIONE MONITORAGGIO QUALITÀ
// ============================================================================

export interface QualityMonitoringConfig {
  // Campi obbligatori per entità
  trips: {
    required: string[];
    critical: string[];
  };
  vehicles: {
    required: string[];
    critical: string[];
  };
  // Soglie tempestività (minuti)
  timeliness: {
    realtime: number;     // < X minuti = realtime
    timely: number;       // < X minuti = tempestivo
    delayed: number;      // < X minuti = ritardato
    // > delayed = late
  };
  // Soglie km/durata
  thresholds: {
    maxKmPerTrip: number;
    minKmPerTrip: number;
    maxDurationMinutes: number;
    minDurationMinutes: number;
    maxKmPerHour: number;
  };
}

export const DEFAULT_QUALITY_CONFIG: QualityMonitoringConfig = {
  trips: {
    required: [
      "vehicleId", "serviceDate", "departureTime", "returnTime",
      "originType", "destinationType", "kmInitial", "kmFinal"
    ],
    critical: [
      "vehicleId", "serviceDate", "kmInitial", "kmFinal"
    ]
  },
  vehicles: {
    required: ["code", "locationId"],
    critical: ["code", "locationId", "licensePlate"]
  },
  timeliness: {
    realtime: 5,
    timely: 30,
    delayed: 120
  },
  thresholds: {
    maxKmPerTrip: 500,
    minKmPerTrip: 0,
    maxDurationMinutes: 480,
    minDurationMinutes: 1,
    // Soglia velocità per ambulanze: 160 km/h è realistico per emergenze in autostrada
    // Ambulanze possono legalmente superare i limiti di velocità durante emergenze
    maxKmPerHour: 160
  }
};

// ============================================================================
// MOTORE COMPLETEZZA (TASK 1.2)
// ============================================================================

export interface CompletenessResult {
  entityId: string;
  entityType: "trip" | "vehicle" | "user" | "structure";
  isComplete: boolean;
  completenessScore: number;
  missingFields: string[];
  criticalMissing: string[];
}

export async function analyzeTripsCompleteness(): Promise<CompletenessResult[]> {
  const allTrips = await db.select().from(trips);
  const results: CompletenessResult[] = [];
  
  // Campi obbligatori da controllare (allineati con config)
  // required: vehicleId, serviceDate, departureTime, returnTime, originType, destinationType, kmInitial, kmFinal
  // critical: vehicleId, serviceDate, kmInitial, kmFinal
  
  for (const trip of allTrips) {
    const missingFields: string[] = [];
    const criticalMissing: string[] = [];
    
    // Controlla campi required (non-critical)
    if (!trip.departureTime) missingFields.push("departureTime");
    if (!trip.returnTime) missingFields.push("returnTime");
    if (!trip.originType) missingFields.push("originType");
    if (!trip.destinationType) missingFields.push("destinationType");
    
    // Controlla campi critici (subset di required)
    if (!trip.vehicleId) criticalMissing.push("vehicleId");
    if (!trip.serviceDate) criticalMissing.push("serviceDate");
    if (trip.kmInitial === null || trip.kmInitial === undefined) criticalMissing.push("kmInitial");
    if (trip.kmFinal === null || trip.kmFinal === undefined) criticalMissing.push("kmFinal");
    
    // Totale 8 campi required: 4 critical + 4 non-critical
    const totalRequired = 8;
    const missingCount = missingFields.length + criticalMissing.length;
    const presentCount = Math.max(0, totalRequired - missingCount);
    const completenessScore = Math.max(0, Math.min(100, Math.round((presentCount / totalRequired) * 100)));
    
    results.push({
      entityId: trip.id,
      entityType: "trip",
      isComplete: missingFields.length === 0 && criticalMissing.length === 0,
      completenessScore,
      missingFields,
      criticalMissing
    });
  }
  
  return results;
}

// ============================================================================
// MOTORE COERENZA LOGICA (TASK 1.3)
// ============================================================================

export interface AnomalyDetection {
  entityId: string;
  entityType: "trip" | "vehicle";
  anomalyType: string;
  severity: "info" | "warning" | "critical";
  description: string;
  details: Record<string, any>;
}

export async function analyzeTripsCoherence(): Promise<AnomalyDetection[]> {
  const allTrips = await db.select().from(trips).orderBy(trips.serviceDate, trips.departureTime);
  const allVehicles = await db.select().from(vehicles);
  const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
  
  const anomalies: AnomalyDetection[] = [];
  
  // Raggruppa viaggi per veicolo per controlli sovrapposizione
  const tripsByVehicle = new Map<string, typeof allTrips>();
  for (const trip of allTrips) {
    if (!tripsByVehicle.has(trip.vehicleId)) {
      tripsByVehicle.set(trip.vehicleId, []);
    }
    tripsByVehicle.get(trip.vehicleId)!.push(trip);
  }
  
  for (const trip of allTrips) {
    // 1. km_finali >= km_iniziali
    if (trip.kmFinal < trip.kmInitial) {
      anomalies.push({
        entityId: trip.id,
        entityType: "trip",
        anomalyType: "km_invalid",
        severity: "critical",
        description: `Km finali (${trip.kmFinal}) inferiori a km iniziali (${trip.kmInitial})`,
        details: { kmInitial: trip.kmInitial, kmFinal: trip.kmFinal, diff: trip.kmInitial - trip.kmFinal }
      });
    }
    
    // 2. ora_arrivo > ora_partenza (se entrambi presenti)
    // Handle midnight crossover: if departure is late evening (>=20:00) and return is early morning (<=08:00)
    // this is a valid overnight service, not an error
    if (trip.departureTime && trip.returnTime) {
      const depTime = trip.departureTime;
      const retTime = trip.returnTime;
      
      // Parse hours to detect midnight crossover
      const depHour = parseInt(depTime.split(':')[0], 10);
      const retHour = parseInt(retTime.split(':')[0], 10);
      
      // Midnight crossover: departure >= 20:00 and return <= 08:00 is valid overnight service
      const isMidnightCrossover = depHour >= 20 && retHour <= 8;
      
      if (retTime <= depTime && !isMidnightCrossover) {
        anomalies.push({
          entityId: trip.id,
          entityType: "trip",
          anomalyType: "time_invalid",
          severity: "warning",
          description: `Ora arrivo (${retTime}) non successiva a partenza (${depTime})`,
          details: { departureTime: depTime, returnTime: retTime }
        });
      }
    }
    
    // 3. durata compatibile con km (velocità plausibile)
    // Skip speed check for very short trips (< 10 km) or very short duration (< 10 min)
    // to avoid false positives on legitimate short-distance services
    const MIN_KM_FOR_SPEED_CHECK = 10;
    const MIN_DURATION_FOR_SPEED_CHECK = 10; // minuti
    
    if (trip.durationMinutes && trip.durationMinutes >= MIN_DURATION_FOR_SPEED_CHECK && 
        trip.kmTraveled >= MIN_KM_FOR_SPEED_CHECK) {
      const hours = trip.durationMinutes / 60;
      const speedKmh = trip.kmTraveled / hours;
      if (speedKmh > DEFAULT_QUALITY_CONFIG.thresholds.maxKmPerHour) {
        anomalies.push({
          entityId: trip.id,
          entityType: "trip",
          anomalyType: "duration_mismatch",
          severity: "warning",
          description: `Velocità media implausibile: ${Math.round(speedKmh)} km/h`,
          details: { kmTraveled: trip.kmTraveled, durationMinutes: trip.durationMinutes, speedKmh: Math.round(speedKmh) }
        });
      }
    }
    
    // 4. rientro senza partenza
    if (trip.returnTime && !trip.departureTime) {
      anomalies.push({
        entityId: trip.id,
        entityType: "trip",
        anomalyType: "no_departure",
        severity: "critical",
        description: "Viaggio con ora rientro ma senza ora partenza",
        details: { returnTime: trip.returnTime }
      });
    }
    
    // 5. km troppo breve (< 1km per viaggi non di ritorno)
    if (trip.kmTraveled === 0 && !trip.isReturnTrip) {
      anomalies.push({
        entityId: trip.id,
        entityType: "trip",
        anomalyType: "km_implausible",
        severity: "info",
        description: "Viaggio con 0 km percorsi",
        details: { kmTraveled: 0, isReturnTrip: trip.isReturnTrip }
      });
    }
    
    // 6. km fuori soglia
    if (trip.kmTraveled > DEFAULT_QUALITY_CONFIG.thresholds.maxKmPerTrip) {
      anomalies.push({
        entityId: trip.id,
        entityType: "trip",
        anomalyType: "km_implausible",
        severity: "warning",
        description: `Km percorsi (${trip.kmTraveled}) superiori alla soglia massima (${DEFAULT_QUALITY_CONFIG.thresholds.maxKmPerTrip})`,
        details: { kmTraveled: trip.kmTraveled, threshold: DEFAULT_QUALITY_CONFIG.thresholds.maxKmPerTrip }
      });
    }
    
    // 7. durata fuori soglia
    if (trip.durationMinutes && trip.durationMinutes > DEFAULT_QUALITY_CONFIG.thresholds.maxDurationMinutes) {
      anomalies.push({
        entityId: trip.id,
        entityType: "trip",
        anomalyType: "duration_implausible",
        severity: "warning",
        description: `Durata (${trip.durationMinutes} min) superiore alla soglia massima`,
        details: { durationMinutes: trip.durationMinutes, threshold: DEFAULT_QUALITY_CONFIG.thresholds.maxDurationMinutes }
      });
    }
  }
  
  // 8. Controllo km regressivi per veicolo nel tempo
  for (const [vehicleId, vehicleTrips] of tripsByVehicle) {
    const sortedTrips = vehicleTrips.sort((a, b) => {
      const dateA = new Date(a.serviceDate + " " + (a.departureTime || "00:00"));
      const dateB = new Date(b.serviceDate + " " + (b.departureTime || "00:00"));
      return dateA.getTime() - dateB.getTime();
    });
    
    for (let i = 1; i < sortedTrips.length; i++) {
      const prevTrip = sortedTrips[i - 1];
      const currTrip = sortedTrips[i];
      
      // Km iniziali del viaggio corrente dovrebbero essere >= km finali del precedente
      if (currTrip.kmInitial < prevTrip.kmFinal) {
        anomalies.push({
          entityId: currTrip.id,
          entityType: "trip",
          anomalyType: "km_regression",
          severity: "critical",
          description: `Km iniziali (${currTrip.kmInitial}) inferiori a km finali viaggio precedente (${prevTrip.kmFinal})`,
          details: {
            prevTripId: prevTrip.id,
            prevKmFinal: prevTrip.kmFinal,
            currKmInitial: currTrip.kmInitial,
            regression: prevTrip.kmFinal - currTrip.kmInitial
          }
        });
      }
    }
    
    // 9. Controllo sovrapposizione viaggi stesso veicolo
    for (let i = 0; i < sortedTrips.length; i++) {
      for (let j = i + 1; j < sortedTrips.length; j++) {
        const tripA = sortedTrips[i];
        const tripB = sortedTrips[j];
        
        if (tripA.serviceDate === tripB.serviceDate && 
            tripA.departureTime && tripA.returnTime && 
            tripB.departureTime && tripB.returnTime) {
          // Verifica sovrapposizione: A inizia prima che B finisca AND B inizia prima che A finisca
          if (tripA.departureTime < tripB.returnTime && tripB.departureTime < tripA.returnTime) {
            anomalies.push({
              entityId: tripA.id,
              entityType: "trip",
              anomalyType: "overlap",
              severity: "critical",
              description: `Sovrapposizione con viaggio ${tripB.progressiveNumber}`,
              details: {
                tripAId: tripA.id,
                tripATime: `${tripA.departureTime}-${tripA.returnTime}`,
                tripBId: tripB.id,
                tripBTime: `${tripB.departureTime}-${tripB.returnTime}`
              }
            });
          }
        }
      }
    }
  }
  
  return anomalies;
}

// ============================================================================
// MOTORE TEMPESTIVITÀ (TASK 1.4)
// ============================================================================

export interface TimelinessResult {
  entityId: string;
  status: "realtime" | "timely" | "delayed" | "late";
  delayMinutes: number;
  score: number;
}

export async function analyzeTripsTimeliness(): Promise<TimelinessResult[]> {
  const allTrips = await db.select().from(trips);
  const results: TimelinessResult[] = [];
  const config = DEFAULT_QUALITY_CONFIG.timeliness;
  
  for (const trip of allTrips) {
    // Calcola differenza tra timestamp evento (serviceDate + departureTime) e createdAt
    let eventTime: Date;
    if (trip.departureTime) {
      eventTime = new Date(`${trip.serviceDate}T${trip.departureTime}`);
    } else {
      eventTime = new Date(trip.serviceDate);
    }
    
    const insertTime = new Date(trip.createdAt);
    const delayMinutes = Math.round((insertTime.getTime() - eventTime.getTime()) / 60000);
    
    let status: TimelinessResult["status"];
    let score: number;
    
    if (delayMinutes <= config.realtime) {
      status = "realtime";
      score = 100;
    } else if (delayMinutes <= config.timely) {
      status = "timely";
      score = 80;
    } else if (delayMinutes <= config.delayed) {
      status = "delayed";
      score = 50;
    } else {
      status = "late";
      score = 20;
    }
    
    results.push({
      entityId: trip.id,
      status,
      delayMinutes: Math.max(0, delayMinutes),
      score
    });
  }
  
  return results;
}

// ============================================================================
// CALCOLO SCORE COMPLESSIVO (TASK 1.7)
// ============================================================================

export interface OverallQualityScore {
  globalScore: number;
  completenessScore: number;
  coherenceScore: number;
  timelinessScore: number;
  accuracyScore: number;
  totalRecords: number;
  completeRecords: number;
  incompleteRecords: number;
  anomalyCount: number;
  criticalAnomalies: number;
  realtimePercent: number;
  latePercent: number;
}

export async function calculateOverallQualityScore(): Promise<OverallQualityScore> {
  // Analizza completezza
  const completenessResults = await analyzeTripsCompleteness();
  const totalRecords = completenessResults.length;
  const completeRecords = completenessResults.filter(r => r.isComplete).length;
  const incompleteRecords = totalRecords - completeRecords;
  const avgCompleteness = totalRecords > 0 
    ? Math.round(completenessResults.reduce((sum, r) => sum + r.completenessScore, 0) / totalRecords)
    : 100;
  
  // Analizza coerenza
  const anomalies = await analyzeTripsCoherence();
  const anomalyCount = anomalies.length;
  const criticalAnomalies = anomalies.filter(a => a.severity === "critical").length;
  const coherenceScore = totalRecords > 0
    ? Math.round(100 - (anomalyCount / totalRecords * 100))
    : 100;
  
  // Analizza tempestività
  const timelinessResults = await analyzeTripsTimeliness();
  const realtimeCount = timelinessResults.filter(r => r.status === "realtime").length;
  const lateCount = timelinessResults.filter(r => r.status === "late").length;
  const realtimePercent = totalRecords > 0 ? Math.round(realtimeCount / totalRecords * 100) : 0;
  const latePercent = totalRecords > 0 ? Math.round(lateCount / totalRecords * 100) : 0;
  const avgTimeliness = totalRecords > 0
    ? Math.round(timelinessResults.reduce((sum, r) => sum + r.score, 0) / totalRecords)
    : 100;
  
  // Accuratezza basata su anomalie di plausibilità
  const implausibleAnomalies = anomalies.filter(a => 
    a.anomalyType === "km_implausible" || a.anomalyType === "duration_implausible"
  ).length;
  const accuracyScore = totalRecords > 0
    ? Math.round(100 - (implausibleAnomalies / totalRecords * 100))
    : 100;
  
  // Score globale: media pesata
  // Completezza: 30%, Coerenza: 35%, Tempestività: 20%, Accuratezza: 15%
  const globalScore = Math.round(
    avgCompleteness * 0.30 +
    Math.max(0, coherenceScore) * 0.35 +
    avgTimeliness * 0.20 +
    Math.max(0, accuracyScore) * 0.15
  );
  
  return {
    globalScore: Math.max(0, Math.min(100, globalScore)),
    completenessScore: avgCompleteness,
    coherenceScore: Math.max(0, coherenceScore),
    timelinessScore: avgTimeliness,
    accuracyScore: Math.max(0, accuracyScore),
    totalRecords,
    completeRecords,
    incompleteRecords,
    anomalyCount,
    criticalAnomalies,
    realtimePercent,
    latePercent
  };
}

// ============================================================================
// API DATA QUALITY COMPLETA (TASK 2.2)
// ============================================================================

export interface DetailedQualityMetrics {
  overview: OverallQualityScore;
  completeness: {
    byField: Record<string, number>;
    incompleteTrips: Array<{
      id: string;
      progressiveNumber: string;
      vehicleCode: string;
      serviceDate: string;
      missingFields: string[];
    }>;
  };
  coherence: {
    byType: Record<string, number>;
    anomalies: AnomalyDetection[];
  };
  timeliness: {
    distribution: Record<string, number>;
    avgDelayMinutes: number;
    trend: Array<{ date: string; avgDelay: number }>;
  };
  criticalRecords: Array<{
    id: string;
    progressiveNumber: string;
    vehicleCode: string;
    serviceDate: string;
    issues: string[];
    severity: string;
  }>;
}

export async function getDetailedQualityMetrics(): Promise<DetailedQualityMetrics> {
  const allTrips = await db.select().from(trips);
  const allVehicles = await db.select().from(vehicles);
  const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
  
  // Overview
  const overview = await calculateOverallQualityScore();
  
  // Completeness analysis
  const completenessResults = await analyzeTripsCompleteness();
  const fieldMissingCount: Record<string, number> = {};
  const incompleteTrips: DetailedQualityMetrics["completeness"]["incompleteTrips"] = [];
  
  for (const result of completenessResults) {
    for (const field of [...result.missingFields, ...result.criticalMissing]) {
      fieldMissingCount[field] = (fieldMissingCount[field] || 0) + 1;
    }
    
    if (!result.isComplete && incompleteTrips.length < 50) {
      const trip = allTrips.find(t => t.id === result.entityId);
      if (trip) {
        const vehicle = vehicleMap.get(trip.vehicleId);
        incompleteTrips.push({
          id: trip.id,
          progressiveNumber: trip.progressiveNumber,
          vehicleCode: vehicle?.code || vehicle?.licensePlate || "Veicolo N/D",
          serviceDate: trip.serviceDate,
          missingFields: [...result.missingFields, ...result.criticalMissing]
        });
      }
    }
  }
  
  // Coherence analysis  
  const anomalies = await analyzeTripsCoherence();
  const anomalyByType: Record<string, number> = {};
  for (const anomaly of anomalies) {
    anomalyByType[anomaly.anomalyType] = (anomalyByType[anomaly.anomalyType] || 0) + 1;
  }
  
  // Timeliness analysis
  const timelinessResults = await analyzeTripsTimeliness();
  const timelinessDistribution: Record<string, number> = {
    realtime: 0,
    timely: 0,
    delayed: 0,
    late: 0
  };
  let totalDelay = 0;
  
  for (const result of timelinessResults) {
    timelinessDistribution[result.status]++;
    totalDelay += result.delayMinutes;
  }
  
  const avgDelayMinutes = timelinessResults.length > 0 
    ? Math.round(totalDelay / timelinessResults.length)
    : 0;
  
  // Critical records (combina tutti i problemi)
  const criticalRecords: DetailedQualityMetrics["criticalRecords"] = [];
  const tripIssues = new Map<string, { issues: string[]; severity: string }>();
  
  // Aggiungi problemi completezza
  for (const result of completenessResults) {
    if (result.criticalMissing.length > 0) {
      if (!tripIssues.has(result.entityId)) {
        tripIssues.set(result.entityId, { issues: [], severity: "warning" });
      }
      const entry = tripIssues.get(result.entityId)!;
      entry.issues.push(`Campi critici mancanti: ${result.criticalMissing.join(", ")}`);
      entry.severity = "critical";
    }
  }
  
  // Aggiungi anomalie
  for (const anomaly of anomalies) {
    if (!tripIssues.has(anomaly.entityId)) {
      tripIssues.set(anomaly.entityId, { issues: [], severity: "warning" });
    }
    const entry = tripIssues.get(anomaly.entityId)!;
    entry.issues.push(anomaly.description);
    if (anomaly.severity === "critical") {
      entry.severity = "critical";
    }
  }
  
  // Converti in array
  for (const [tripId, data] of tripIssues) {
    if (criticalRecords.length >= 100) break;
    
    const trip = allTrips.find(t => t.id === tripId);
    if (trip) {
      const vehicle = vehicleMap.get(trip.vehicleId);
      criticalRecords.push({
        id: trip.id,
        progressiveNumber: trip.progressiveNumber,
        vehicleCode: vehicle?.code || vehicle?.licensePlate || "Veicolo N/D",
        serviceDate: trip.serviceDate,
        issues: data.issues,
        severity: data.severity
      });
    }
  }
  
  // Ordina per severity (critical prima)
  criticalRecords.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return 0;
  });
  
  return {
    overview,
    completeness: {
      byField: fieldMissingCount,
      incompleteTrips
    },
    coherence: {
      byType: anomalyByType,
      anomalies: anomalies.slice(0, 100)
    },
    timeliness: {
      distribution: timelinessDistribution,
      avgDelayMinutes,
      trend: []
    },
    criticalRecords
  };
}

// ============================================================================
// SALVATAGGIO STORICO (per trend)
// ============================================================================

export async function saveQualitySnapshot() {
  const overview = await calculateOverallQualityScore();
  const today = new Date().toISOString().split("T")[0];
  
  await db.insert(dataQualityHistory).values({
    snapshotDate: today,
    entityType: "trip",
    totalRecords: overview.totalRecords,
    completeRecords: overview.completeRecords,
    incompleteRecords: overview.incompleteRecords,
    anomalyCount: overview.anomalyCount,
    avgCompletenessScore: overview.completenessScore,
    avgCoherenceScore: overview.coherenceScore,
    avgTimelinessScore: overview.timelinessScore,
    avgAccuracyScore: overview.accuracyScore,
    avgOverallScore: overview.globalScore,
    realtimePercent: overview.realtimePercent,
    latePercent: overview.latePercent
  }).onConflictDoNothing();
  
  return overview;
}

// ============================================================================
// GET QUALITY TREND
// ============================================================================

export async function getQualityTrend(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const history = await db.select()
    .from(dataQualityHistory)
    .where(gte(dataQualityHistory.snapshotDate, startDate.toISOString().split("T")[0]))
    .orderBy(dataQualityHistory.snapshotDate);
  
  return history;
}
