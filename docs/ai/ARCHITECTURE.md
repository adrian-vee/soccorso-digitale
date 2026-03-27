# Architettura Sistema AI — Intelligence Predittiva

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Stato:** Design Phase

---

## Overview

Il sistema di Intelligence Predittiva di Soccorso Digitale fornisce cinque categorie di predizioni operative:

1. **Demand Forecasting** — quanti servizi aspettarsi per giorno/settimana
2. **Route Optimization** — assegnazione ottimale servizi a mezzi (VRP)
3. **Predictive Maintenance** — rischio guasto per veicolo
4. **Burnout Prediction** — rischio burnout per operatore
5. **Churn Prediction** — rischio cancellazione per organizzazione

Tutti i modelli producono output strutturati che alimentano la dashboard esistente. L'UI "Intelligence Predittiva" nella sidebar è già presente — questi documenti descrivono cosa ci va dietro.

---

## Tre Opzioni Architetturali

### Opzione A — Python Microservice (FastAPI + scikit-learn/Prophet)

```
┌─────────────────┐    HTTP/REST    ┌──────────────────────┐
│   Express.js    │ ─────────────▶ │  Python ML Service    │
│   (Railway)     │ ◀───────────── │  (FastAPI, Railway)   │
│   Port 5000     │   JSON resp.   │  Port 8000            │
└─────────────────┘                └──────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                ┌──────────────────────┐
│   PostgreSQL    │ ──── reads ──▶ │  Model Store          │
│   (130+ tables) │                │  (Railway Volume /    │
└─────────────────┘                │   or S3-compatible)   │
                                   └──────────────────────┘
```

**Come funziona:**
- Express.js chiama `http://ml-service:8000/predict/demand` con payload JSON
- Il microservice Python carica il modello pre-addestrato da disco, esegue la predizione, restituisce JSON
- Retraining schedulato come cron job (nightly o settimanale) che legge direttamente da PostgreSQL

**Pro:**
- Accesso all'intero ecosistema scikit-learn, Prophet, XGBoost, LightGBM, OR-Tools
- Separazione netta responsabilità (ML service vs business logic)
- Scaling indipendente (il ML service può avere più RAM, GPU se necessario)
- Testing isolato più semplice
- Team ML può lavorare su Python senza toccare il codice Express

**Contro:**
- Un servizio Railway in più da gestire (~$10-20/mese aggiuntivi)
- Latenza aggiuntiva per chiamata HTTP (5-50ms, trascurabile per batch prediction)
- Deploy più complesso (2 pipeline invece di 1)
- Cold start se il servizio scala a zero

**Quando sceglierla:** Se si prevede di costruire modelli complessi (Prophet, XGBoost, OR-Tools), team con competenze Python, o se si vuole testare modelli in isolamento.

---

### Opzione B — Node.js Nativo (TensorFlow.js + simple-statistics)

```
┌─────────────────────────────────────┐
│         Express.js (Railway)         │
│  ┌────────────────────────────────┐  │
│  │      AI Module (TypeScript)    │  │
│  │  - simple-statistics (stats)   │  │
│  │  - ml-matrix (linear algebra)  │  │
│  │  - tfjs-node (neural nets)     │  │
│  └────────────────────────────────┘  │
│              │                       │
│              ▼                       │
│  ┌────────────────────────────────┐  │
│  │      PostgreSQL (Drizzle ORM)  │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Pro:**
- Zero servizi aggiuntivi (tutto nel monolite Express)
- Deploy identico all'attuale
- Latenza zero per predizioni (tutto in-process)
- Codebase unificata TypeScript

**Contro:**
- TensorFlow.js in Node è significativamente più lento di Python per training
- Librerie ML Node molto meno mature (niente Prophet nativo, OR-Tools non disponibile)
- Aumenta il bundle size e il memory footprint del server principale
- Prophet (il modello più adatto per demand forecasting) non esiste per Node.js
- Retraining del modello blocca il thread principale se non gestito con worker_threads

**Quando sceglierla:** Solo per modelli molto semplici (regressione lineare, scoring rule-based). Non adatta per Prophet o VRP.

---

### Opzione C — Claude API (Anthropic) per Reasoning

```
┌─────────────────┐    HTTPS API    ┌──────────────────────┐
│   Express.js    │ ─────────────▶ │   Anthropic API       │
│                 │                 │   claude-sonnet-4-6   │
│                 │ ◀───────────── │                       │
└─────────────────┘   insight text  └──────────────────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │ ──── SQL aggregates ──▶ structured JSON ──▶ Claude prompt
└─────────────────┘
```

**Come funziona:**
- Express.js esegue query SQL aggregate per ottenere dati strutturati (es. `{week: "2026-W13", total_trips: 47, avg_duration: 38, by_type: {...}}`)
- I dati vengono inviati a Claude con un system prompt specifico per dominio EMS
- Claude restituisce insight in linguaggio naturale e suggerimenti operativi

**Pro:**
- Zero infrastruttura ML aggiuntiva
- Output in linguaggio naturale comprensibile ai coordinatori non tecnici
- Funziona da subito, senza dati storici (Claude porta conoscenza del dominio)
- Adattabile facilmente a nuovi casi d'uso

**Contro:**
- Costo per token (vedasi `CLAUDE_API_INTEGRATION.md` per stime)
- Non produce predizioni numeriche precise come Prophet/XGBoost
- Latenza 1-5 secondi per risposta
- Non adatto per VRP o ottimizzazione algoritmica
- Dipendenza da servizio esterno (rate limits, outage Anthropic)
- Non "impara" dai dati storici in modo tradizionale (no fine-tuning)

**Quando sceglierla:** Per insights narrativi e Q&A normativa. **Non** come sostituto dei modelli statistici per demand forecasting.

---

## Raccomandazione: Architettura Ibrida A+C

```
┌──────────────────────────────────────────────────────────────┐
│                     Express.js (Railway)                      │
│                                                              │
│  /api/ai/demand      ─────▶  ML Service (Option A)          │
│  /api/ai/routes      ─────▶  ML Service (Option A)          │
│  /api/ai/maintenance ─────▶  ML Service (Option A)          │
│  /api/ai/burnout     ─────▶  ML Service (Option A)          │
│  /api/ai/churn       ─────▶  ML Service (Option A)          │
│                                                              │
│  /api/ai/insights    ─────▶  Claude API (Option C)          │
│  /api/ai/normativa   ─────▶  Claude API (Option C, RAG)     │
│  /api/ai/anomalies   ─────▶  Claude API (Option C)          │
└──────────────────────────────────────────────────────────────┘
```

**Rationale:** I modelli statistici (Prophet, XGBoost) richiedono Python per essere implementati correttamente. Claude API è adatto per i casi dove serve ragionamento in linguaggio naturale. Usare solo Claude per tutto è rischioso (costi, latenza, mancanza di predizioni numeriche precise).

---

## Flusso Dati Completo

```
PostgreSQL (trips, vehicles, staff_members, shifts)
         │
         ▼
  Feature Extraction Layer (Python/SQL)
  ┌─────────────────────────────────┐
  │ - Aggregazioni temporali        │
  │ - One-hot encoding categorie    │
  │ - Feature engineering           │
  │   (km_since_maintenance,        │
  │    consecutive_nights, etc.)    │
  └─────────────────────────────────┘
         │
         ▼
  Model Inference
  ┌─────────────────────────────────┐
  │ Prophet (demand)                │
  │ OR-Tools (routing)              │
  │ XGBoost (maintenance, churn)    │
  │ Scoring rules (burnout)         │
  └─────────────────────────────────┘
         │
         ▼
  Prediction Cache (PostgreSQL)
  ┌─────────────────────────────────┐
  │ ai_predictions table            │
  │ - model_type, org_id            │
  │ - prediction_date, value        │
  │ - confidence, metadata          │
  │ - created_at, expires_at        │
  └─────────────────────────────────┘
         │
         ▼
  Express.js REST API
  /api/ai/* endpoints
         │
         ▼
  Dashboard "Intelligence Predittiva"
  (admin/public/ — UI già esistente)
```

---

## Schema Database Predizioni

```sql
CREATE TABLE ai_predictions (
  id            SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  model_type    VARCHAR(50) NOT NULL,  -- 'demand', 'maintenance', 'burnout', 'churn'
  entity_id     UUID,                  -- vehicle_id, staff_id, etc. (nullable per demand)
  prediction_date DATE NOT NULL,
  predicted_value JSONB NOT NULL,      -- flessibile per tipo modello
  confidence    FLOAT,                 -- 0.0-1.0
  model_version VARCHAR(20),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  metadata      JSONB
);

CREATE INDEX ON ai_predictions(organization_id, model_type, prediction_date);
CREATE INDEX ON ai_predictions(entity_id, model_type);
```

---

## Requisiti Infrastrutturali

### ML Service (Opzione A)

| Componente | Specifica | Costo stimato Railway |
|---|---|---|
| CPU | 1-2 vCPU (inference), 4 vCPU (training) | ~$15-30/mese |
| RAM | 2GB (inference), 8GB (training) | incluso |
| Storage | 5GB per model artifacts | ~$1/mese |
| Volume persistente | Per model store | ~$3/mese |

**Training schedule:** Ogni domenica notte (00:00-04:00), quando il traffico è minimo.

### Dipendenze Python

```
fastapi==0.115.0
uvicorn==0.32.0
prophet==1.1.6
scikit-learn==1.5.2
xgboost==2.1.1
ortools==9.11.4210
pandas==2.2.3
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
numpy==2.1.3
```

---

## Roadmap Implementazione

Vedi `IMPLEMENTATION_ROADMAP.md` per il piano dettagliato in 4 fasi.

La sequenza logica è:

1. **Fase 1**: Demand Forecasting — massimo valore visibile, dati già disponibili
2. **Fase 2**: Route Optimization — impatto diretto sui costi operativi
3. **Fase 3**: Predictive Maintenance + Burnout — valore enterprise, differenziazione
4. **Fase 4**: Churn Prediction + Claude API Insights — completamento del sistema
