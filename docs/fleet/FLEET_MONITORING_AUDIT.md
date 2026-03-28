# Fleet Monitoring Audit — Soccorso Digitale

**Data:** 2026-03-28
**Team:** HEPHAESTUS (Backend) + HERMES (Mobile) + APHRODITE (UX) + VULCAN (Systems)
**Scope:** Sistema completo di monitoraggio flotta — mobile GPS → server → dashboard
**Vincolo:** SOLO AUDIT — nessuna modifica al codice in questo documento

---

## Executive Summary

Il sistema di monitoraggio flotta attuale è funzionante e sopra la media del mercato healthcare italiano, ma presenta **gap significativi rispetto agli standard Uber/Bolt**. L'architettura è scalabile nei fondamentali (WebSocket broadcast + PostgreSQL + Leaflet), ma soffre di tre problemi strutturali critici:

1. **Tracking foreground-only** — il GPS si ferma quando l'app va in background
2. **HTTP POST per singolo punto** — 1 request/punto crea overhead inutile a volume
3. **Nessuna soglia di accuratezza** — punti GPS imprecisi inquinano lo storico

Priorità complessiva di intervento: **alta**. I fix P0 e P1 sono necessari prima di una crescita oltre i 20 veicoli attivi simultanei.

---

## 1. Stato Attuale — Architettura End-to-End

### 1.1 Layer Mobile (React Native / Expo)

**File principale:** `client/contexts/GpsTrackingContext.tsx`
**File legacy:** `client/hooks/useGpsTracking.ts`

#### Costanti di campionamento

```
DEFAULT_TIME_INTERVAL    = 3000ms   (1 punto ogni 3 secondi)
DEFAULT_DISTANCE_INTERVAL = 5m     (distanza minima tra punti)
BATCH_SIZE               = 1       (sync immediata su ogni punto)
MAX_BUFFER_SIZE          = 500     (buffer offline AsyncStorage)
SYNC_INTERVAL            = 5000ms  (timer backup su GpsTrackingContext)
SYNC_INTERVAL (legacy)   = 30000ms (timer backup su useGpsTracking.ts — INCONSISTENZA)
```

#### Permessi

```typescript
const [permission, requestPermission] = Location.useForegroundPermissions();
```

**Nota critica:** `useForegroundPermissions` (NON `useBackgroundPermissions`). Il tracking si interrompe automaticamente quando l'app viene messa in background o il telefono si blocca.

#### Flusso di invio

```
GPS fix (3s / 5m) → buffer locale
  ↓ (BATCH_SIZE=1 → immediato)
HTTP POST /api/gps/points
  body: { vehicleId, tripId, latitude, longitude, accuracy, speed, heading, altitude }
  ↓ risposta 200
buffer.clear()
```

Se offline → punto in AsyncStorage → retry al ripristino connessione.

#### Auto-start tracking

Il contesto avvia automaticamente il tracking quando rileva un `vehicleId` assegnato all'utente. L'autista non deve premere nessun bottone.

---

### 1.2 Layer Backend (Express.js + PostgreSQL)

#### Schema tabelle GPS

**`trip_gps_points`** (`shared/schema.ts` linea 329)

| Colonna | Tipo | Note |
|---------|------|------|
| id | varchar (UUID) | PK |
| trip_id | varchar | FK → trips.id (nullable solo se non associato) |
| vehicle_id | varchar | FK → vehicles.id |
| latitude | text | Stringa, non numeric — vedi P2 |
| longitude | text | Stringa, non numeric — vedi P2 |
| accuracy | real | Metri, nullable — mai filtrato |
| speed | real | km/h, nullable |
| heading | real | 0-360°, nullable |
| altitude | real | Metri, nullable |
| timestamp | timestamp | Ora del fix GPS |
| created_at | timestamp | Ora di ricezione server |

**`active_tracking_sessions`** (`shared/schema.ts` linea ~347)

| Colonna | Tipo | Note |
|---------|------|------|
| id | varchar (UUID) | PK |
| vehicle_id | varchar | UNIQUE — una sola sessione attiva per veicolo |
| trip_id | varchar | Nullable — linked post-creazione viaggio |
| user_id | varchar | FK → users.id |
| started_at | timestamp | Inizio sessione |
| last_update_at | timestamp | Ultimo punto ricevuto |
| points_count | integer | Contatore punti (incrementale) |
| is_active | boolean | Flag sessione attiva |

**Nota:** Nessuna delle due tabelle ha `organizationId` diretto. L'isolamento multi-tenant avviene via `vehicleId → vehicles.organizationId`.

#### Endpoint GPS (tutti in admin.routes.ts)

| Endpoint | Metodo | Auth | Funzione |
|----------|--------|------|----------|
| `/api/gps/tracking/start` | POST | requireAuth | Crea sessione, aggiorna vehicle.isOnService |
| `/api/gps/tracking/end` | POST | requireAuth | Chiude sessione, isOnService → false |
| `/api/gps/tracking/session/:vehicleId` | GET | requireAuth | Sessione attiva per veicolo |
| `/api/gps/tracking/active` | GET | requireAuth | Tutte le sessioni attive |
| `/api/gps/points` | POST | requireAuth | Riceve punti, aggiorna vehicle, broadcast WS |
| `/api/gps/live` | GET | requireAuth | Snapshot flotta per dashboard |
| `/api/gps/trips/:tripId/points` | GET | requireAuth | Punti GPS di un viaggio |
| `/api/gps/trips/:tripId/track` | GET | requireAuth | Track semplificato (no Douglas-Peucker) |
| `/api/gps/vehicles/:vehicleId/history` | GET | requireAuth | Storico per veicolo per data |
| `/api/gps/vehicles/:vehicleId/daily-summary` | GET | requireAuth | Riepilogo giornaliero completo |

#### Flusso `/api/gps/points` (linea ~1179)

```
1. Verifica sessione attiva
2. Se latitude/longitude presenti:
   → storage.updateVehicleLocation() — aggiorna vehicles.latitude/longitude
   → broadcastMessage({ type: 'gps_location_update', ... }) — push WebSocket
3. Se array `points` presente (batch):
   → storage.addGpsPointsBatch() — INSERT in trip_gps_points (solo se tripId presente)
4. Se singolo punto:
   → storage.addGpsPoint() — INSERT in trip_gps_points (solo se tripId presente)
5. UPDATE active_tracking_sessions.points_count += n
```

**Gap critico:** se `effectiveTripId` è null (nessun viaggio associato), la posizione viene aggiornata e broadcast ma i punti NON sono salvati in `trip_gps_points`. Il tracciato storico è perso.

#### Endpoint `/api/gps/live` (fleet.routes.ts linea 938)

Query composite:
1. `storage.getVehicles()` → filtra per orgId
2. `storage.getAllActiveTrackingSessions()` → NO filtro org (in-memory join dopo)
3. `trips` filtrati per oggi + orgId
4. `scheduledServices` con status `in_progress` / `waiting_for_visit` + orgId

Response per veicolo:
```json
{
  "vehicleId": "...",
  "vehicleCode": "A01",
  "latitude": 45.3836,
  "longitude": 11.0397,
  "hasRealGps": false,   ← true solo se lat/lng != 0
  "isTracking": true,
  "isOnService": true,
  "isWaitingForVisit": false,
  "tripCountToday": 3,
  "totalKmToday": 47.2,
  "activeService": { ... }
}
```

**Sede fallback:** se `hasRealGps = false`, il veicolo appare alle coordinate della sua sede operativa (5 sedi hardcoded sia in `fleet.routes.ts` che in `admin.routes.ts`).

---

### 1.3 Layer WebSocket (Real-time Push)

**Implementazione:** WebSocket nativo Node.js, su `broadcastMessage()` (in `server/routes/index.ts` e usato da più route).

**GPS push (app.js linea 14900):**

```javascript
function connectGpsWebSocket() {
  gpsWebSocket = new WebSocket(`${protocol}//${window.location.host}`);
  gpsWebSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'gps_location_update') {
      handleRealtimeGpsUpdate(data);
    }
  };
  gpsWebSocket.onclose = () => {
    gpsWebSocket = null;
    setTimeout(connectGpsWebSocket, 3000); // reconnect dopo 3s
  };
  gpsWebSocket.onerror = () => {};  // ← errori silenti
}
```

**Handler aggiornamento (app.js linea 14925):**

```javascript
function handleRealtimeGpsUpdate({ vehicleId, latitude, longitude, speed, timestamp }) {
  if (gpsMap && gpsMarkers[vehicleId]) {
    animateMarker(gpsMarkers[vehicleId], currentLatLng, L.latLng(latitude, longitude), 800);
    // aggiorna gpsVehicleData in-memory
  }
  if (vehicleMap && vehicleMarkers[vehicleId]) {
    animateMarker(..., 800);  // anche la vehicleMap principale
  }
}
```

**`animateMarker()` (app.js linea 14951):** interpolazione easeInOutQuad a 800ms usando `requestAnimationFrame`.

---

### 1.4 Layer Dashboard (Polling)

- **Polling attivo:** `setInterval(loadGpsData, 30000)` — ogni 30 secondi, solo se checkbox "auto-refresh" è spuntata
- **Trigger manuale:** click sul menu GPS → `initGpsMap()` → `loadGpsData()` una volta
- **WebSocket:** sempre attivo quando la pagina GPS è aperta (aggiornamenti < 1s latency)

**Architettura ibrida WebSocket + polling:**
- WebSocket: aggiornamenti posizione in tempo reale (latency: ~3s = GPS interval)
- Polling 30s: sincronizza stato completo (sessionPoints, trips oggi, serviceInfo, statistiche)

---

## 2. Gap Analysis vs Uber/Bolt

### 2.1 Background Tracking

| | SD Attuale | Uber/Bolt |
|---|---|---|
| Tracking in background | ❌ Impossibile | ✅ Sempre attivo |
| Permesso richiesto | Foreground only | Background location |
| App minimizzata | Tracking si ferma | Tracking continua |
| Schermo bloccato | Tracking si ferma | Tracking continua |
| Chiamata in entrata | Tracking a rischio | Tracking continua |

**Impatto operativo:** Un autista che riceve una chiamata o usa Google Maps per navigare perde il tracking. Questo è il gap più grave per un servizio di soccorso.

**Soluzione Expo:** `expo-location` supporta `Location.startLocationUpdatesAsync()` con `TaskManager` per background tasks. Richiede `ACCESS_BACKGROUND_LOCATION` su Android e `NSLocationAlwaysUsageDescription` su iOS.

---

### 2.2 Frequenza e Adattività

| | SD Attuale | Uber/Bolt |
|---|---|---|
| Intervallo GPS | 3s fisso | Adattivo: 1-30s |
| Distanza minima | 5m | Adattivo: 0-100m |
| Quando fermo | 1 punto/3s (inutile) | 1 punto/30s o 0 |
| Quando ad alta velocità | 1 punto/3s | 1 punto/1s |
| Batteria | Alta consumo | Ottimizzato |

**Impatto:** 10 veicoli attivi × 20 req/min = 200 req/min solo per GPS. Inutile quando il veicolo è fermo in sede.

---

### 2.3 Trasporto e Batching

| | SD Attuale | Uber/Bolt |
|---|---|---|
| Trasporto | HTTP POST per punto | WebSocket stream bidirezionale |
| Batching | BATCH_SIZE=1 (nessuno) | Buffer adattivo 5-30 punti |
| Overhead | ~500B HTTP headers per request | Overhead WebSocket una tantum |
| Connessione persa | AsyncStorage fino a 500 punti | Buffer in memoria + flush |
| Compressione | Nessuna | Delta encoding, Protobuf |

**Impatto:** Con 10 veicoli attivi e 3s interval: 120.000 HTTP request/ora. Ogni richiesta include autenticazione cookie + sessione DB lookup.

---

### 2.4 Qualità Dati GPS

| | SD Attuale | Uber/Bolt |
|---|---|---|
| Filtro accuratezza | ❌ Nessuno | ✅ Drop se accuracy > 50m |
| Punti duplicati | ❌ Possibili | ✅ Deduplicati |
| Jitter smoothing | ❌ Nessuno | ✅ Kalman filter |
| Outlier removal | ❌ Nessuno | ✅ Speed plausibility check |
| Snapping a strada | ❌ Nessuno | ✅ Map-matching (OSRM/HERE) |

**Impatto:** Tracciati GPS che mostrano zigzag improbabili (GPS indoor o multipath), punti nel mare, velocità fisicamente impossibili. Riduce l'utilità dello storico per analisi percorsi.

---

### 2.5 Track Storage

| | SD Attuale | Uber/Bolt |
|---|---|---|
| Punti salvati | Solo se tripId è presente | Sempre |
| Viaggio non ancora creato | Punti persi | Buffered, associati dopo |
| Granularità storico | 3s (eccessiva) | Adattiva, ottimizzata |
| Compressione storico | Nessuna (TODO Douglas-Peucker) | Implementata |
| Retention policy | Indefinita | 90 giorni (base), 1 anno (premium) |

---

### 2.6 Funzionalità Dashboard

| | SD Attuale | Uber/Bolt (driver app) |
|---|---|---|
| ETA al paziente | ❌ | ✅ (road network) |
| Replay percorso | ✅ (base) | ✅ (completo + velocità) |
| Clustering veicoli | ❌ | ✅ |
| Heatmap servizi | ❌ | ✅ |
| Alert geofence | ❌ | ✅ |
| Layer traffico | ⚠️ (richiede API key) | ✅ |
| Distanza da sede | ❌ | ✅ |
| Isocrone reali | ❌ (cerchi approssimativi) | ✅ (road-time isochrones) |

---

### 2.7 Metriche Performance Attuali vs Target

| Metrica | SD Attuale | Target Uber-level |
|---------|-----------|-------------------|
| Latency GPS → dashboard | ~3-5s (WS) | < 2s |
| Payload per punto | ~500B HTTP | ~50B WS frame |
| Request/veicolo/ora | 1200 | ~120 (batching 10x) |
| DB writes/ora (10 veicoli) | ~1200 INSERT | ~120 (con batching) |
| GPS accuracy tracking | N/D | < 20m median |
| Background uptime | 0% | >95% |
| Battery impact (stime) | Alto | Basso (adaptive) |

---

## 3. Target Architecture — "Uber-level Fleet"

### 3.1 Mobile: Background Tracking + Adaptive Intervals

```
Stato FERMO (speed < 3 km/h, accuracy > 20m):
  → intervallo GPS: 30s, distanza: 50m
  → non inviare punti ridondanti

Stato IN MOVIMENTO (speed 3-50 km/h):
  → intervallo GPS: 5s, distanza: 10m
  → batch 5 punti, invio ogni 25s

Stato AD ALTA VELOCITÀ (speed > 50 km/h):
  → intervallo GPS: 2s, distanza: 20m
  → batch 5 punti, invio ogni 10s

Tutti gli stati:
  → TaskManager background task attivo sempre
  → GPS accuracy filter: skip se accuracy > 50m
  → Buffer offline: AsyncStorage 1000 punti (vs 500 attuale)
```

**Componente target:** `expo-location` background mode + `expo-task-manager`

---

### 3.2 Backend: WebSocket da Mobile + Server-Sent Events per Dashboard

**Fase A (breve termine):** Keep HTTP POST ma con batching lato mobile (10 punti per request).

**Fase B (medio termine):** WebSocket persistente mobile → server:
```
Mobile WebSocket client → WS endpoint /ws/gps-ingest
  → message: { vehicleId, sessionId, points: [...] }
  → server: batch INSERT + broadcast → dashboard
```

**Batch endpoint alternativo (minimo sforzo):**
```
POST /api/gps/points/batch
  body: { vehicleId, points: Point[] }  ← già supportato ma non usato
```
Semplicemente aumentare `BATCH_SIZE` nel client da 1 a 10 riduce il traffico del 90%.

---

### 3.3 Database: Ottimizzazione Storico

```sql
-- Indici mancanti (current state: nessuno su trip_gps_points oltre PK)
CREATE INDEX idx_trip_gps_points_vehicle_timestamp
  ON trip_gps_points(vehicle_id, timestamp DESC);

CREATE INDEX idx_trip_gps_points_trip_id
  ON trip_gps_points(trip_id);

-- Tipo dato: latitude/longitude come text è suboptimal
-- Target: numeric(10,7) o double precision

-- Partitioning per data (per archivi grandi):
-- PARTITION BY RANGE (timestamp)
```

---

### 3.4 Dashboard: Animazione e UX

**Animazione marker attuale:** `animateMarker(800ms)` con easeInOutQuad — già buona.

**Gap UX da colmare:**
1. Icona ambulanza identica per tutti gli stati (active/service/idle)
2. Nessun clustering quando ci sono molti veicoli vicini
3. Nessuna direzione (heading) visualizzata sull'icona
4. Popup WebSocket onerror silenzioso — utente non sa se il WS è disconnesso
5. Il badge "LIVE" pulsa sempre, anche quando il WS è disconnesso

---

## 4. Fix Prioritizzati (P0 → P3)

### P0 — Critici (blockers per produzione scalata)

#### P0-1: Background GPS Tracking
**Impatto:** Un autista che risponde al telefono perde il tracking. Inaccettabile per un servizio 118.
**File:** `client/contexts/GpsTrackingContext.tsx`
**Soluzione:** Aggiungere `expo-task-manager` + `Location.startLocationUpdatesAsync()` con `wantsDistanceUpdates: true`.
**Effort:** 3 giorni
**Blocker:** Richiede privacy policy aggiornata (background location), review App Store.

#### P0-2: Punti GPS persi senza tripId
**Impatto:** Ogni viaggio creato DOPO l'inizio del tracking (autista già in moto) perde i punti iniziali.
**File:** `server/routes/admin.routes.ts` linea ~1229
**Soluzione:** Se `effectiveTripId` è null, salvare comunque i punti in `trip_gps_points` con `trip_id = null`. Retroattivamente associarli al viaggio quando creato (via `PATCH /api/gps/tracking/link-trip`).
**Effort:** 4 ore

#### P0-3: Filtro accuratezza GPS
**Impatto:** Punti con accuracy 100-500m (GPS indoor, tunnel) distorcono i tracciati e i km calcolati.
**File:** `server/routes/admin.routes.ts` linea ~1196
**Soluzione:** `if (accuracy && accuracy > 50) { // skip storage, still update vehicle location }`
**Effort:** 1 ora

---

### P1 — Alta priorità (impatto performance/scalabilità)

#### P1-1: Batching lato mobile
**Impatto:** 10 veicoli attivi = 1200 HTTP req/ora → 120 req/ora.
**File:** `client/contexts/GpsTrackingContext.tsx`
**Soluzione:** Cambiare `BATCH_SIZE = 1` → `BATCH_SIZE = 10`, `SYNC_INTERVAL = 15000ms`. L'endpoint batch è già implementato.
**Effort:** 30 minuti
**Trade-off:** Latenza live dashboard da ~3s a ~15s per posizione (WebSocket update non cambia).

#### P1-2: Inconsistenza timer backup
**Impatto:** `GpsTrackingContext` ha sync backup ogni 5s, `useGpsTracking.ts` ogni 30s. Se il legacy hook è ancora in uso, i dati arrivano tardi.
**File:** `client/hooks/useGpsTracking.ts` linea backup sync timer
**Soluzione:** Uniformare a 15s o deprecare completamente il legacy hook.
**Effort:** 1 ora

#### P1-3: Indici DB su trip_gps_points
**Impatto:** Ogni query storico scansiona l'intera tabella. Con 1M+ punti diventa lenta.
**File:** Nuova migration Drizzle
**Soluzione:** Aggiungere `idx_trip_gps_points_vehicle_timestamp` e `idx_trip_gps_points_trip_id`.
**Effort:** 2 ore

#### P1-4: WebSocket GPS disconnect silenzioso
**Impatto:** Se il WS si disconnette, il badge "LIVE" continua a pulsare. L'utente pensa di vedere dati in tempo reale ma non è così.
**File:** `admin/public/app.js` linea 14921
**Soluzione:** `gpsWebSocket.onerror = (e) => { showNotification('GPS live disconnesso', 'warning'); }` + rimuovere la pulsazione dal badge quando WS è down.
**Effort:** 2 ore

---

### P2 — Media priorità (qualità dati e UX)

#### P2-1: Latitude/longitude come `text` invece di `numeric`
**Impatto:** Impossibile usare funzioni PostGIS, calcoli distanza, indici geografici. Conversione `parseFloat()` ad ogni lettura.
**File:** `shared/schema.ts` linea 335-336
**Soluzione:** Migration Drizzle per cambiare tipo in `doublePrecision` (richiede cast dei dati esistenti).
**Effort:** 4 ore + test

#### P2-2: Coordinate sede hardcoded in due posti
**Impatto:** Se una sede cambia coordinate, vanno aggiornate in `fleet.routes.ts` E `admin.routes.ts`. Manutenzione fragile.
**File:** `server/routes/fleet.routes.ts` + `server/routes/admin.routes.ts`
**Soluzione:** Centralizzare in `shared/constants.ts` o meglio: caricarle dalla tabella `locations` (già disponibile).
**Effort:** 2 ore

#### P2-3: Douglas-Peucker per track display
**Impatto:** Un viaggio di 2h a 3s intervallo = 2400 punti in una singola risposta API. Rallenta il browser.
**File:** `server/routes/admin.routes.ts` linea ~1294 (TODO già presente nel codice)
**Soluzione:** Implementare Douglas-Peucker con epsilon 0.0001 gradi (~10m) sul server prima di restituire il track.
**Effort:** 3 ore

#### P2-4: Heading visualizzato sull'icona veicolo
**Impatto:** L'icona ambulanza è statica. Su Uber l'icona auto ruota nella direzione di marcia.
**File:** `admin/public/app.js` linea 14511 — `L.icon()` statico
**Soluzione:** `L.divIcon()` con SVG ruotato di `vehicle.heading` gradi. Il campo `heading` è già inviato dal backend.
**Effort:** 3 ore

#### P2-5: Clustering veicoli sulla mappa
**Impatto:** Con molti veicoli nella stessa zona (ex: tutti in sede), i marker si sovrappongono.
**File:** `admin/public/app.js`
**Soluzione:** `leaflet.markercluster` — già nel pattern del progetto.
**Effort:** 2 ore

---

### P3 — Bassa priorità (funzionalità avanzate)

#### P3-1: ETA predittivo
**Impatto:** Il coordinatore non sa quanti minuti mancano all'arrivo del mezzo.
**Soluzione:** Integrazione OSRM (già pianificata in `docs/ai/ROUTE_OPTIMIZATION.md`) per calcolo ETA da posizione attuale a destinazione via rete stradale.
**Effort:** 2 giorni
**Dipendenza:** Infrastruttura OSRM deployata.

#### P3-2: Alert geofencing
**Impatto:** Nessun alert automatico quando un veicolo esce dall'area operativa o entra in zona critica.
**Soluzione:** Server-side geofence check su ogni `/api/gps/points` ricevuto. Check PostGIS `ST_Within()` o calcolo haversine.
**Effort:** 1 giorno

#### P3-3: Heatmap storica servizi
**Impatto:** Non c'è visibilità su dove si concentrano i servizi nel territorio.
**Soluzione:** Layer Leaflet.heat su `/api/gps/heatmap?from=&to=` con query aggregata per zone.
**Effort:** 1 giorno

#### P3-4: Retention policy GPS points
**Impatto:** `trip_gps_points` cresce senza limite. Non c'è meccanismo di cleanup.
**Soluzione:** Job settimanale che archivia/elimina punti più vecchi di N giorni (configurabile per piano).
**Effort:** 4 ore

---

## 5. Effort Estimates

| Priority | Fix | Effort | Chi |
|----------|-----|--------|-----|
| P0-1 | Background GPS | 3 giorni | HERMES (mobile) |
| P0-2 | Punti GPS senza tripId | 4 ore | HEPHAESTUS (backend) |
| P0-3 | Filtro accuratezza | 1 ora | HEPHAESTUS |
| P1-1 | Batching mobile | 30 min | HERMES |
| P1-2 | Timer backup inconsistente | 1 ora | HERMES |
| P1-3 | Indici DB | 2 ore | VULCAN |
| P1-4 | WS disconnect silenzioso | 2 ore | APHRODITE (dashboard) |
| P2-1 | lat/lng tipo dato | 4 ore | VULCAN + HEPHAESTUS |
| P2-2 | Coordinate sede centralizzate | 2 ore | HEPHAESTUS |
| P2-3 | Douglas-Peucker | 3 ore | HEPHAESTUS |
| P2-4 | Heading icona veicolo | 3 ore | APHRODITE |
| P2-5 | Clustering marker | 2 ore | APHRODITE |
| P3-1 | ETA predittivo | 2 giorni | HEPHAESTUS + MINERVA |
| P3-2 | Geofencing alert | 1 giorno | HEPHAESTUS + VULCAN |
| P3-3 | Heatmap storica | 1 giorno | APHRODITE + HEPHAESTUS |
| P3-4 | Retention policy | 4 ore | HEPHAESTUS |

**Totale P0:** ~3,5 giorni
**Totale P1:** ~6 ore
**Totale P2:** ~14 ore (~2 giorni)
**Totale P3:** ~4 giorni

**Scope completo per "Uber-level":** ~10 giorni lavorativi

---

## 6. Dipendenze e Vincoli

### 6.1 Dipendenze tecniche

| Fix | Dipendenza |
|-----|-----------|
| P0-1 Background GPS | `expo-task-manager`, review App Store + Play Store per background location |
| P3-1 ETA | OSRM server deployato (vedi `docs/ai/ROUTE_OPTIMIZATION.md`) |
| P2-1 Tipo lat/lng | Migration Drizzle con dati esistenti — test su staging prima |
| P3-2 Geofencing | PostGIS extension attiva su Railway PostgreSQL |

### 6.2 Vincoli operativi

- **Privacy/GDPR:** Il background tracking richiede aggiornamento della privacy policy e del DPA (Data Processing Agreement). Già documentato in `docs/ai/BURNOUT_PREDICTION.md` per le implicazioni GDPR del tracking personale.
- **App Store review:** Background location richiede giustificazione specifica. Use case "servizio di soccorso sanitario" è esplicito e approvabile.
- **Contratti cliente:** I dati GPS sono dati personali se associati a un autista identificato. Da menzionare nei contratti di servizio.

### 6.3 Prerequisiti per scalabilità

Prima di superare **50 veicoli attivi simultanei**, necessari:
1. P1-1 (batching) — riduce 10x il carico HTTP
2. P1-3 (indici DB) — evita full scan su tabella grande
3. P0-2 (punti senza tripId) — evita perdita dati ad alto volume

Oltre **200 veicoli attivi**, da valutare:
- Separare il GPS ingestion in un microservizio dedicato
- Redis per lo stato live (invece di query DB su `/api/gps/live`)
- Timescale DB o PostgreSQL partitioning per `trip_gps_points`

---

## Appendice — File Chiave

| File | Riga | Contenuto |
|------|------|-----------|
| `client/contexts/GpsTrackingContext.tsx` | ~1 | Costanti GPS, auto-start, offline buffer |
| `client/hooks/useGpsTracking.ts` | ~1 | Legacy hook (inconsistenza timer 30s) |
| `shared/schema.ts` | 329 | Definizione `trip_gps_points` |
| `shared/schema.ts` | 347 | Definizione `active_tracking_sessions` |
| `server/routes/admin.routes.ts` | 1082 | GPS tracking start/end/points |
| `server/routes/fleet.routes.ts` | 938 | `/api/gps/live` endpoint |
| `admin/public/app.js` | 14286 | Inizializzazione mappa Leaflet |
| `admin/public/app.js` | 14432 | `loadGpsData()` — polling 30s |
| `admin/public/app.js` | 14900 | `connectGpsWebSocket()` |
| `admin/public/app.js` | 14925 | `handleRealtimeGpsUpdate()` |
| `admin/public/app.js` | 14951 | `animateMarker(800ms)` |
