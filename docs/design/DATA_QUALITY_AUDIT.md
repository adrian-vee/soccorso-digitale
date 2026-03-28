# DATA_QUALITY_AUDIT.md — Audit Pagina "Qualità del Dato"

**Autore**: VULCAN — Backend Engineer, Soccorso Digitale
**Data**: 2026-03-28
**Versione**: 1.0
**Scope**: `server/data-quality-engine.ts`, `server/routes/analytics.routes.ts` (righe 20-301), `admin/public/app.js` (funzioni DQ)
**Tipo**: Solo analisi — nessuna modifica al codice

---

## 1. MAPPA DELL'ARCHITETTURA ATTUALE

### 1.1 Flusso dati

```
Admin apre /data-quality
  → loadDataQualityData()
    → GET /api/data-quality/metrics
      → calculateOverallQualityScore()    [scan tabella trips × 3]
      → analyzeTripsTimeliness()          [scan tabella trips × 1]
      → analyzeTripsCoherence()           [scan tabella trips + vehicles × 1]
      → analyzeTripsCompleteness()        [scan tabella trips × 1]
      → storage.getTrips()               [scan tabella trips × 1]
      → storage.getVehicles()            [scan tabella vehicles × 1]
      → risposta JSON → renderDataQualityDashboard()

  (Secondo caricamento, lazy)
  → GET /api/data-quality/detailed
    → getDetailedQualityMetrics()
      → calculateOverallQualityScore()   [scan × 3 internamente]
      → analyzeTripsCompleteness()       [scan × 1, DUPLICATO]
      → analyzeTripsCoherence()          [scan × 1, DUPLICATO]
```

**Totale scan per caricamento iniziale**: ~6 full table scan su `trips`, 2 su `vehicles`
**Totale scan per caricamento detailed**: ~8 full table scan su `trips`

### 1.2 Endpoint disponibili

| Endpoint | Autenticazione | Funzione |
|----------|---------------|---------|
| `GET /api/data-quality/metrics` | `requireAdmin` | Overview + critical records (max 20) |
| `GET /api/data-quality/detailed` | `requireAdmin` | Analisi completa con max 50 incomplete, max 100 critical |
| `GET /api/data-quality/anomalies` | `requireAdmin` | Lista anomalie coerenza |
| `GET /api/data-quality/timeliness` | `requireAdmin` | Distribuzione tempestività |
| `GET /api/data-quality/trend` | `requireAdmin` | Storico snapshots (default 30gg) |
| `POST /api/data-quality/snapshot` | `requireAdmin` | Salva snapshot manuale |
| `GET /api/data-quality/config` | `requireAdmin` | Configurazione soglie |
| `GET /api/reports/utif-validate` | `requireAdmin` | Gate qualità pre-UTIF |

### 1.3 Componenti UI

| Componente | Dati | Funziona |
|-----------|------|---------|
| Gauge doughnut (Chart.js) | `qualityScore` | ✓ |
| Ring completezza SVG | `completenessPercent` | ✓ |
| Counter record totali / critici | `totalRecords`, `criticalRecords` | ✓ |
| Breakdown campi mancanti | `missingFields.*` | ⚠ parziale (vedi §3.4) |
| Breakdown anomalie per tipo | `anomalies.*` | ✓ |
| Percentuale realtime / ritardati | `realtimePercent`, `latePercent` | ⚠ concettualmente errato (vedi §3.3) |
| Tabella record critici (max 10) | `criticalDetails` | ✓ |
| Bottone "Risolvi" | modale modifica viaggio | ⚠ non persistente (vedi §3.6) |
| Score change rispetto a ieri | `scoreChange` | ✗ sempre 0 |
| Grafico trend storico | endpoint `/trend` | ✗ mai popolato (vedi §3.5) |

---

## 2. COSA FUNZIONA CORRETTAMENTE

### 2.1 Motore completezza (✓ Buono)
`analyzeTripsCompleteness()` controlla correttamente 8 campi su ogni viaggio:

- **Critici** (blocco rendicontazione): `vehicleId`, `serviceDate`, `kmInitial`, `kmFinal`
- **Required** (warning): `departureTime`, `returnTime`, `originType`, `destinationType`

Il punteggio per viaggio è proporzionale ai campi presenti (0–100%). La distinzione critical/non-critical è sensata per il dominio EMS.

### 2.2 Motore coerenza — 9 anomalie implementate (✓ Buono)

| Codice anomalia | Descrizione | Severity |
|----------------|-------------|---------|
| `km_invalid` | kmFinal < kmInitial | critical |
| `time_invalid` | returnTime ≤ departureTime | warning |
| `duration_mismatch` | velocità implausibile (>160 km/h) | warning |
| `no_departure` | returnTime presente, departureTime assente | critical |
| `km_implausible` | 0 km su viaggio non di ritorno | info |
| `km_implausible` | kmTraveled > 500 km | warning |
| `duration_implausible` | durata > 480 minuti | warning |
| `km_regression` | kmInitiale(N) < kmFinale(N-1) per stesso veicolo | critical |
| `overlap` | sovrapposizione orari stesso veicolo stessa data | critical |

La gestione del **midnight crossover** (partenza ≥20:00, rientro ≤08:00) è un caso edge correttamente implementato.

### 2.3 Formula score globale — pesi ragionevoli (✓ Accettabile)

```
globalScore = completeness × 30% + coherence × 35% + timeliness × 20% + accuracy × 15%
```

I pesi sono difendibili per EMS: la coerenza (35%) è il rischio principale per la rendicontazione ULSS; la completezza (30%) è necessaria per i report UTIF.

### 2.4 Gate qualità UTIF (✓ Ben implementato)
`/api/reports/utif-validate` blocca la generazione del report se ci sono anomalie critiche (`canGenerate: false`). Buona integrazione tra DQ engine e workflow operativo.

### 2.5 Tabella record critici con "Risolvi" (✓ UX buona)
Il bottone "Risolvi" apre direttamente il modale di modifica del viaggio. Approccio corretto: avvicina il problema al punto di correzione.

---

## 3. BUG CONFERMATI

### 3.1 🔴 CRITICO — Assenza isolamento multi-tenant

**File**: `server/data-quality-engine.ts`, righe 83, 139, 339, 499

```typescript
// ATTUALE — restituisce TUTTI i viaggi di TUTTE le organizzazioni
const allTrips = await db.select().from(trips);

// ATTESO
const allTrips = await db.select().from(trips)
  .where(eq(trips.organizationId, orgId));
```

**Impatto**:
- Un admin di Croce Europa che apre la pagina DQ vede i problemi di ALS Soccorso mescolati.
- I contatori (totalRecords, anomalyCount) sommano tutti i tenant.
- Le anomalie `km_regression` e `overlap` attraversano i confini dei tenant.
- Il punteggio globale è una media di tutte le organizzazioni — privo di significato per il singolo cliente.

**Gravità**: Alta. Non è un problema di sicurezza assoluto perché il dato mostrato non contiene PII sensibili (no nomi pazienti), ma viola il principio di isolamento multi-tenant e rende il punteggio fuorviante.

---

### 3.2 🔴 CRITICO — Full table scan ripetute, nessun LIMIT

**File**: `server/data-quality-engine.ts`

Per ogni chiamata a `/api/data-quality/metrics` il server esegue:

1. `analyzeTripsCompleteness()` → `SELECT * FROM trips` (scan #1)
2. `analyzeTripsCoherence()` → `SELECT * FROM trips ORDER BY...` + `SELECT * FROM vehicles` (scan #2, #3)
3. `analyzeTripsTimeliness()` → `SELECT * FROM trips` (scan #4)
4. `storage.getTrips()` nella route → scan #5
5. `storage.getVehicles()` nella route → scan #6

Con 10.000 viaggi (realistico per un cliente con 3 anni di attività): ~10.000 rows × 6 = 60.000 row fetches per ogni apertura della pagina. Su un'istanza Railway shared da 1GB RAM, questo rischia di causare OOM o timeout.

L'algoritmo di overlap detection è **O(n²)** per veicolo:
```typescript
for (let i = 0; i < sortedTrips.length; i++) {
  for (let j = i + 1; j < sortedTrips.length; j++) { ... }
}
```
Per un veicolo con 500 viaggi: 125.000 confronti. Per una flotta da 20 veicoli con storico 3 anni: potenzialmente milioni di confronti.

---

### 3.3 🟡 MEDIO — Metrica tempestività concettualmente errata

**File**: `server/data-quality-engine.ts`, righe 338–381

La metrica misura: `createdAt - (serviceDate + departureTime)`.

Nel trasporto sanitario programmato, **i viaggi vengono creati prima della data del servizio** (prenotazione anticipata). Quindi `createdAt < eventTime` → `delayMinutes < 0` → `Math.max(0, delayMinutes) = 0` → status `"realtime"` → score 100.

**Conseguenza**: quasi tutti i viaggi programmati ottengono `timelinessScore = 100` indipendentemente dalla qualità dell'inserimento. La metrica è statisticamente vuota per questo use case.

La metrica corretta per EMS sarebbe: ritardo tra **completamento del servizio** (`returnTime`) e **chiusura del record** (ultimo aggiornamento). Un viaggio completato alle 14:30 ma aggiornato nel sistema solo 3 giorni dopo è un problema di tempestività reale.

---

### 3.4 🟡 MEDIO — Bug field name: `destination` vs `destinationType`

**File**: `server/routes/analytics.routes.ts`, riga 111

```typescript
// NELLA ROUTE
missingFields: {
  destination: fieldMissing.destination || 0,   // ← legge "destination"
  ...
}

// NEL MOTORE (data-quality-engine.ts, riga 98)
if (!trip.destinationType) missingFields.push("destinationType");   // ← scrive "destinationType"
```

La chiave `fieldMissing.destination` sarà sempre `undefined` → sempre 0. Il contatore "Destinazione mancante" in UI mostra sempre 0, anche quando ci sono viaggi senza `destinationType`. Stesso problema per `originType` → mappato su nessuna chiave nella risposta.

---

### 3.5 🟡 MEDIO — Trend storico mai popolato

**File**: `server/data-quality-engine.ts`, righe 660–670; `server/routes/analytics.routes.ts`, riga 193

`saveQualitySnapshot()` salva lo stato nella tabella `dataQualityHistory` — ma:
1. Non è schedulato da nessun `setInterval` o cron job nel server
2. `POST /api/data-quality/snapshot` deve essere chiamato manualmente
3. `getDetailedQualityMetrics()` restituisce `trend: []` hardcodato (riga 623)

Il grafico trend in UI non mostrerà mai dati storici a meno che qualcuno non chiami manualmente l'endpoint.

---

### 3.6 🟡 MEDIO — "Risolvi" non persiste la risoluzione

**File**: `admin/public/app.js`, funzione `resolveRecord()`

Il bottone apre il modale di modifica del viaggio, ma:
- Non esiste un endpoint `PATCH /api/data-quality/anomalies/:id/resolve`
- Non esiste un campo `resolvedAt` o `resolvedBy` nella tabella anomalie
- Alla prossima apertura della pagina, il record torna in lista come "critico"

Il sistema non può distinguere anomalie **note e accettate** (es. viaggio 0 km per mezzo in officina) da anomalie **reali da correggere**.

---

### 3.7 🟡 MEDIO — `scoreChange` hardcodato a 0

**File**: `server/routes/analytics.routes.ts`, riga 104

```typescript
scoreChange: 0,    // TODO: implementare delta vs ieri
weeklyChange: 0,   // TODO
```

La UI mostra "+0 rispetto a ieri" sempre. Fuorviante: potrebbe sembrare che il sistema non stia tracciando nessun cambiamento.

---

### 3.8 🟢 BASSO — Due sistemi DQ paralleli e disconnessi

Il modulo `data-quality-engine.ts` misura la qualità dei **viaggi operativi**. Esiste un sistema parallelo in `renderQualityMetrics()` (app.js) che mostra metriche come `patientSatisfaction`, `safetyIncidents`, `vehicleAvailability` — questi dati provengono da un endpoint di org-health analysis e **non hanno connessione con il motore DQ**. I valori mostrati in quella card sembrano hardcodati o stimati.

Rischio: l'utente vede due sezioni "qualità" con metriche diverse e potenzialmente contraddittorie.

---

### 3.9 🟢 BASSO — Score coerenza può essere negativo (poi clampato)

```typescript
const coherenceScore = Math.round(100 - (anomalyCount / totalRecords * 100));
```

Se un singolo viaggio ha 3 anomalie diverse, `anomalyCount > totalRecords`. Il risultato viene poi clampato con `Math.max(0, coherenceScore)`, ma l'informazione sulla reale gravità va persa. Un dataset con 10 viaggi e 30 anomalie mostra score = 0, identico a un dataset con 10 viaggi e 11 anomalie.

---

## 4. GAP DI COVERAGE — Controlli mancanti

### 4.1 Dimensioni DAMA DMBOK non coperte

| Dimensione DAMA | Implementata | Note |
|----------------|-------------|------|
| Completezza | ✓ Parziale | Solo trips; vehicles/users/structures nella config ma non implementati |
| Coerenza logica | ✓ Buona | 9 regole su trips |
| Tempestività | ⚠ Difettosa | Concetto sbagliato per il dominio |
| Accuratezza | ✓ Parziale | Solo km e durata implausibili |
| **Unicità** | ✗ Mancante | Nessun rilevamento duplicati |
| **Validità formato** | ✗ Mancante | Nessuna validazione CF, targhe, email |
| **Integrità referenziale** | ✗ Mancante | Veicolo/struttura inesistente |
| **Consistenza cross-entità** | ✗ Mancante | Patient name in trips ≠ booking |

### 4.2 Controlli specifici EMS mancanti

**Documenti veicolo** (tabella `vehicleDocuments`)
- Nessun controllo scadenza assicurazione, revisione, collaudo ASL
- Un veicolo con revisione scaduta ha impatto diretto sulla legalità del servizio e sulle gare d'appalto
- La piattaforma ha già i dati (vehicleDocuments.expiryDate) — manca solo il controllo DQ

**Certificazioni operatori** (tabella `staffMembers`)
- Nessun controllo scadenza BLS-D, TSSA, patente
- Un operatore con BLS-D scaduto non può legalmente effettuare servizi
- Dato già presente nel DB

**Anagrafica paziente nei viaggi**
- Nessun controllo su `patientName` (lunghezza, caratteri speciali), `patientFiscalCode` (formato CF)
- Il codice fiscale italiano ha algoritmo di controllo verificabile

**GPS e coordinate**
- Le check di velocità usano odometro (`kmTraveled`), non coordinate GPS
- Nessun controllo "punto GPS fuori Italia" o "teleport" (salto improvviso di 200km)
- Nessun controllo "GPS fisso da ore" (veicolo fermo ma km in aumento)

**Duplicati viaggi**
- Nessun rilevamento di viaggi duplicati (stesso veicolo, stessa data, stessa ora, stesso paziente)
- Rilevante per prevenire doppia fatturazione

**Stato workflow**
- Nessun controllo "viaggio in stato scheduled da più di 48h" (dimenticato?)
- Nessun controllo "viaggio completed senza km finali" (impossibile ma non bloccato)

**Strutture di destinazione**
- Nessun controllo che `structureId` corrisponda a una struttura effettivamente esistente nella tabella `structures`

---

## 5. ANALISI DELLO SCORE — È ACCURATO?

### 5.1 Problemi di rappresentatività

Il `globalScore` è una media ponderata su 4 dimensioni. Due di queste hanno difetti strutturali:

**Tempestività (20% del peso)**: come descritto in §3.3, per i viaggi programmati la metrica è quasi sempre 100. Il peso del 20% si riduce di fatto a un bonus costante che gonfia il punteggio finale di circa +20 punti rispetto alla realtà.

**Accuratezza (15% del peso)**: è calcolata solo su due tipi di anomalia (`km_implausible`, `duration_implausible`). I km invalidi critici (`km_invalid`, `km_regression`) non influenzano l'accuracy score ma solo il coherence score. Questo può portare a un accuracy score di 100 anche con km regressivi critici.

### 5.2 Confronto con ISO 8000

ISO 8000 (Data Quality) definisce la qualità del dato come la capacità di soddisfare i requisiti dichiarati in uno specifico contesto d'uso. Per Soccorso Digitale, il contesto d'uso principale è la **rendicontazione ULSS per rimborso servizi**.

Requisiti ULSS tipici:
- Data servizio: presente ✓
- Km percorsi verificabili: parzialmente ✓ (controllo coerenza c'è)
- Tipo servizio: NON controllato dalla DQ
- Dati paziente: NON controllati dalla DQ
- Firma/autorizzazione: NON controllata dalla DQ

Il punteggio attuale misura principalmente la completezza di campi tecnici (km, orari) ma **non la completezza documentale per la rendicontazione sanitaria** — che è il vero rischio per i clienti.

### 5.3 Confronto con DAMA DMBOK framework

| Dimensione DMBOK | Peso raccomandato (EMS) | Peso attuale | Delta |
|-----------------|------------------------|-------------|-------|
| Completezza | 30% | 30% | ≈ OK |
| Coerenza | 30% | 35% | +5% (accettabile) |
| Accuratezza | 25% | 15% | -10% (sottostimata) |
| Tempestività | 15% | 20% | +5% (sovrastimata) |

---

## 6. RACCOMANDAZIONI — ORDINE DI PRIORITÀ

### P0 — Fix immediati (sicurezza e correttezza)

#### P0.1 Isolamento multi-tenant nel motore DQ

Tutte le funzioni del motore devono accettare `organizationId: string` come parametro e filtrare:

```typescript
// Aggiungere a ogni query nel motore
.where(eq(trips.organizationId, organizationId))
```

Le route devono estrarre l'orgId dalla sessione (`getEffectiveOrgId(req)`) e passarlo al motore.

#### P0.2 Fix field name bug (2 minuti di lavoro)

In `analytics.routes.ts`:
```typescript
// CORREGGI
destination: fieldMissing.destinationType || 0,
origin: fieldMissing.originType || 0,
```

---

### P1 — Bug critici (impatto funzionale diretto)

#### P1.1 Snapshot automatico

Aggiungere in `server/routes/index.ts` (o in un cron dedicated):
```typescript
// Snapshot giornaliero alle 02:00
setInterval(() => dataQuality.saveQualitySnapshot(), 24 * 60 * 60 * 1000);
setTimeout(() => dataQuality.saveQualitySnapshot(), 5000); // primo snapshot al boot
```

#### P1.2 Delta score (scoreChange)

Leggere il record più recente da `dataQualityHistory` e calcolare la differenza reale con lo score corrente.

#### P1.3 Persistenza risoluzione anomalie

Aggiungere campo `is_acknowledged` (boolean) + `acknowledged_by` + `acknowledged_at` alla tabella `dataQualityAnomalies`. Creare endpoint `POST /api/data-quality/anomalies/:id/acknowledge`. Le anomalie acknowledged non entrano nel conteggio critico ma rimangono nello storico.

---

### P2 — Miglioramenti significativi (impatto qualità misura)

#### P2.1 Fix metrica tempestività

Sostituire il concetto di timeliness. Nuova proposta:

```
timelinessScore = percentuale di viaggi completati (status="completed")
                  aggiornati entro 24h dalla data del servizio
```

Questo misura la disciplina di chiusura dei record, che è il vero rischio operativo.

#### P2.2 Documenti veicolo nella DQ

Aggiungere `analyzeVehicleDocuments(orgId)`:
- Controlla `vehicleDocuments.expiryDate` per ogni tipo di documento
- Anomalia "critical" se scaduto
- Anomalia "warning" se scade entro 30 giorni
- Contribuisce all'accuracy score (è già nella config `vehicles.required`)

#### P2.3 Certificazioni operatori nella DQ

Aggiungere `analyzeStaffCertifications(orgId)`:
- BLS-D, TSSA, patente — controllo scadenza
- Peso: contribuisce alla nuova dimensione "Compliance" (sostituisce accuracy)

#### P2.4 Ottimizzazione performance

Sostituire i full table scan ripetuti con una singola query materializzata:

```sql
-- Vista materializzata o CTE che fa tutto in un round-trip
WITH trip_analysis AS (
  SELECT id, ...campi...,
    CASE WHEN km_final < km_initial THEN 1 ELSE 0 END as km_invalid,
    ...
  FROM trips WHERE organization_id = $1
)
SELECT
  COUNT(*) as total,
  SUM(km_invalid) as km_invalid_count,
  ...
FROM trip_analysis
```

Riduzione: da 6 round-trip a 1 per `/api/data-quality/metrics`.

---

### P3 — Funzionalità nuove (next sprint)

#### P3.1 Rilevamento duplicati

Aggiungere `analyzeDuplicateTrips(orgId)`:
```
Duplicato probabile = stesso vehicleId + serviceDate + departureTime (±5min) + patientName
```

#### P3.2 Validazione Codice Fiscale

Il CF italiano ha un checksum algoritmo (BELFIORE). Aggiungere validazione a:
- `analyzeTripsCompleteness()`: campo `patientFiscalCode` se presente
- Come info anomaly (non critica — il CF potrebbe essere deliberatamente omesso per privacy)

#### P3.3 Unificazione delle due sezioni "qualità" in UI

La card `renderQualityMetrics()` con `patientSatisfaction`, `vehicleAvailability` ecc. va connessa a dati reali o rimossa. Attualmente mostra valori undefined (`-`) per molte metriche se i dati non sono disponibili, creando confusione.

#### P3.4 Alert real-time via WebSocket

Quando un nuovo viaggio viene creato con anomalie critiche, inviare un alert WebSocket alla dashboard. L'infrastruttura WS esiste già (`/ws/chat`). Questo trasforma il DQ da dashboard periodica a sistema di early warning.

---

## 7. RIEPILOGO ESECUTIVO

| Categoria | Stato | Dettaglio |
|-----------|-------|-----------|
| **Motore DQ** | ⚠ Funziona ma con difetti | Multi-tenant gap, performance, timeliness errata |
| **UI Dashboard** | ✓ Ben strutturata | Gauge, ring, tabella critica, tutto renderizza |
| **Score accuracy** | ⚠ Sovrastimato | +20 punti artificiali da timeliness |
| **Trend storico** | ✗ Non funziona | Snapshot mai schedulato |
| **Isolamento tenant** | ✗ Assente | Ogni admin vede dati globali |
| **Coverage entità** | ⚠ Solo trips | Veicoli, operatori, strutture non coperti |
| **Compliance EMS** | ⚠ Parziale | Mancano documenti veicolo e cert. operatori |
| **Performance** | ⚠ Rischio a scala | O(n²) overlap, 6 full scan per request |
| **Persistenza risoluzione** | ✗ Assente | "Risolvi" non salva nulla |

**Priorità assoluta**: fix multi-tenant (P0.1) — è l'unico punto che riguarda la correttezza dei dati mostrati a ogni cliente. Tutto il resto è miglioramento incrementale.

**Tempo stimato per P0 + P1**: 1 giornata di sviluppo backend + 30 minuti di test.
**Impatto**: il punteggio DQ diventa per la prima volta un numero significativo per ogni singola organizzazione, invece di una media di sistema priva di senso.

---

*Riferimenti normativi*: ISO 8000 (Data Quality), DAMA DMBOK 2nd ed. (Cap. 13 Data Quality), EDPB Guidelines 01/2021 (Data Quality for healthcare).
