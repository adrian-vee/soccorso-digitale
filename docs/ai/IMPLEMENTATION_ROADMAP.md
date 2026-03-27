# Implementation Roadmap — AI/ML in 4 Fasi

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Orizzonte:** 7+ mesi

---

## Overview

```
FASE 1 (M1-M2) ── FASE 2 (M3-M4) ── FASE 3 (M5-M6) ── FASE 4 (M7+)
Demand             Route              Predictive          Churn +
Forecasting        Optimization       Maintenance +       Claude API
                                      Burnout             Insights
─────────────────────────────────────────────────────────────────────
Valore:            Costi:             Enterprise:         Retention:
Visibilità         Risparmio          Differenziazione    ARR protection
operativa          operativo          competitiva         + NLU insights
```

---

## Fase 1: Demand Forecasting (Mesi 1-2)

### Obiettivo

Rendere operativa la sezione "Intelligence Predittiva" con le previsioni di domanda, il modello più visibile e con il maggior impatto immediato sui coordinatori.

### Deliverable tecnici

| Componente | Dettaglio | Effort |
|---|---|---|
| Python ML Service (FastAPI) | Setup base, health endpoint, struttura | 3 giorni |
| Feature extraction pipeline | Query SQL + pandas transformation | 2 giorni |
| Prophet model training | Training multi-org + serializzazione | 3 giorni |
| API endpoint Express | `/api/ai/demand` con caching Redis | 2 giorni |
| Training cron job | Scheduler domenicale + incremental | 1 giorno |
| Storage modelli | Railway Volume + model versioning | 1 giorno |
| Cold start logic | Benchmark cross-org per nuovi clienti | 2 giorni |
| UI integration | Aggiornare widget "Intelligence Predittiva" | 3 giorni |
| Testing + monitoring | Unit test ML service + alert degraded | 2 giorni |

**Effort totale stimato: 19 giorni/uomo**
Assumendo 1 ML engineer + 1 backend engineer part-time.

### Dipendenze

- [ ] Railway account con accesso a deploy nuovo servizio Python
- [ ] Volume persistente Railway per model store
- [ ] Schema tabella `ai_predictions` creato in PostgreSQL
- [ ] Open-Meteo API testato per le regioni dei clienti attivi
- [ ] Almeno 90 giorni di dati `trips` per organizzazioni pilota (Croce Europa, ALS)

### KPI di successo Fase 1

| KPI | Target |
|---|---|
| MAE demand forecast | < 3 servizi/giorno per org con 90+ giorni dati |
| Coverage UI | 100% organizzazioni con piano Professional/Enterprise |
| Uptime ML service | > 99.5% |
| Latency predizione | < 500ms (servito da cache) |
| Feedback coordinatori | > 70% "utile" o "molto utile" dopo 4 settimane |

### Infrastruttura Fase 1

```yaml
# railway.toml per ML service
[build]
  builder = "DOCKERFILE"
  dockerfilePath = "ml-service/Dockerfile"

[deploy]
  startCommand = "uvicorn app.main:app --host 0.0.0.0 --port 8000"
  restartPolicyType = "ON_FAILURE"

[environments.production]
  resources:
    memory: "2Gi"
    cpu: "1"
```

### Rischi Fase 1

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Dati storici trips insufficienti (< 90gg) | Media | Cold start con benchmark cross-org |
| Prophet instabile su org con pochi servizi/giorno | Alta | Fallback a media mobile 4 settimane |
| Latenza ML service troppo alta | Bassa | Pre-calcolo notturno + cache |

---

## Fase 2: Route Optimization (Mesi 3-4)

### Obiettivo

Ottimizzazione VRP per ridurre km totali e tempi morti. Massimo impatto economico diretto per le organizzazioni.

### Prerequisiti

- Fase 1 operativa (ML service Python già funzionante)
- Tabella `vehicle_assignments` con assegnazioni giornaliere storicizzate
- Coordinate GPS di sedi (depot) e strutture sanitarie frequenti

### Deliverable tecnici

| Componente | Dettaglio | Effort |
|---|---|---|
| OSRM self-hosted | Deploy Railway, download Italy OSM | 2 giorni |
| Time matrix builder | Batch OSRM calls + caching | 2 giorni |
| OR-Tools VRP solver | Model + vincoli + serializzazione soluzione | 5 giorni |
| Greedy insertion per urgenti | Re-routing intraday per servizi urgenti | 2 giorni |
| API endpoint Express | `/api/ai/routes/optimize` + `/apply` | 2 giorni |
| UI workflow coordinatore | "Proposta ottimizzazione" con before/after | 4 giorni |
| Savings tracking | Tabella storica risparmio per ROI report | 1 giorno |
| A/B testing setup | % organizzazioni pilota che ricevono proposte | 1 giorno |

**Effort totale stimato: 19 giorni/uomo**

### Dipendenze

- [ ] OSRM Italy deployment testato
- [ ] Schema `optimization_proposals` in DB
- [ ] Test con dati reali Croce Europa (organizzazione con più mezzi)
- [ ] UI mockup approvato da APHRODITE

### KPI di successo Fase 2

| KPI | Target |
|---|---|
| Risparmio km | -15% su organizzazioni che applicano proposte |
| Risparmio minuti | -20% tempi morti |
| Tasso di adozione | > 60% coordinatori accettano proposte (parzialmente o totalmente) |
| Tempo ottimizzazione | < 30s per scenario con 50 servizi |
| Infeasibility rate | < 5% (soluzioni non trovate su scenari reali) |

### Rischi Fase 2

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Coordinatori ignorano le proposte (change management) | Alta | UI chiara before/after + training PENELOPE |
| OR-Tools infeasible su vincoli reali complessi | Media | Relax vincoli meno critici automaticamente |
| OSRM mappe obsolete (OSM aggiornamento) | Bassa | Refresh mensile automatico |
| Servizi urgenti non gestiti dal VRP notturno | Certa | Greedy insertion separato per urgenti |

---

## Fase 3: Predictive Maintenance + Burnout (Mesi 5-6)

### Obiettivo

Aggiungere modelli per rischio flotta e benessere personale — funzionalità enterprise con forte valore differenziante vs competitor.

**Nota privacy burnout:** DPIA deve essere completata e approvata prima del deploy (vedi `BURNOUT_PREDICTION.md` e `docs/legal/DPIA.md`).

### Deliverable tecnici

#### 3A — Predictive Maintenance

| Componente | Effort |
|---|---|
| Feature extraction veicoli (SQL + pandas) | 2 giorni |
| Random Forest training + calibrazione | 2 giorni |
| SHAP explainability module | 1 giorno |
| API endpoint + widget dashboard flotta | 2 giorni |
| Alert integration (campanella) | 1 giorno |

**Subtotale:** 8 giorni/uomo

#### 3B — Burnout Prediction

| Componente | Effort |
|---|---|
| DPIA completata (THEMIS) | Prerequisito |
| Feature extraction staff (SQL) | 2 giorni |
| Rule-based scoring engine | 2 giorni |
| Isolation Forest anomaly detection | 1 giorno |
| Dashboard benessere (solo Direttore) | 2 giorni |
| Audit log accessi + GDPR compliance | 1 giorno |

**Subtotale:** 8 giorni/uomo

**Effort totale Fase 3:** ~16 giorni/uomo

### KPI di successo Fase 3

| KPI | Target |
|---|---|
| Maintenance ROC-AUC | > 0.72 su holdout |
| Guasti "sorpresa" per flotte che usano il modello | Riduzione > 30% vs baseline anno precedente |
| Burnout false positive rate | < 25% (Direttore segnala score non pertinente) |
| Adozione burnout dashboard | > 40% Direttori accedono settimanalmente |

---

## Fase 4: Churn Prediction + Claude API Insights (Mesi 7+)

### Obiettivo

Completare il sistema con predizione churn per protezione ARR, e Claude API per insights in linguaggio naturale ad alto valore percepito.

### Prerequisiti

- Fase 1-3 operative
- Almeno 12 mesi di dati + alcuni eventi di churn reali per training
- API key Anthropic configurata (env `ANTHROPIC_API_KEY`)
- Budget mensile Claude API approvato

### Deliverable tecnici

#### 4A — Churn Prediction

| Componente | Effort |
|---|---|
| Feature extraction engagement cross-tabelle | 3 giorni |
| LR + GBM ensemble training | 3 giorni |
| Health score UI superadmin | 2 giorni |
| Early warning notification system | 1 giorno |

**Subtotale:** 9 giorni/uomo

#### 4B — Claude API Insights

| Componente | Effort |
|---|---|
| System prompt engineering EMS | 1 giorno |
| Aggregazione dati per context | 2 giorni |
| Natural language insights endpoint | 2 giorni |
| RAG normativa (docs/domain/) | 3 giorni |
| Anomaly explanation endpoint | 1 giorno |
| Rate limiting + cost monitoring | 1 giorno |

**Subtotale:** 10 giorni/uomo

**Effort totale Fase 4:** ~19 giorni/uomo

### KPI di successo Fase 4

| KPI | Target |
|---|---|
| Churn prediction precision | > 55% a soglia health < 40 |
| Churn catturato (recall) | > 65% degli effettivi churner segnalati in anticipo |
| NPS insights Claude | > 4/5 dai Direttori che usano la feature |
| Token cost mensile Claude | < €200/mese con 100 org attive |

---

## Costi Infrastruttura Totali

| Servizio | Fase | Costo mensile Railway |
|---|---|---|
| ML Service Python (FastAPI) | Da Fase 1 | ~$20-30 |
| Volume persistente model store | Da Fase 1 | ~$3-5 |
| OSRM Italy service | Da Fase 2 | ~$15-20 |
| Claude API (Anthropic) | Da Fase 4 | ~$50-150 (volume dipendente) |
| **Totale** | | **~$88-205/mese** |

Da confrontare con il valore generato:
- Risparmio km Fase 2: ~€500-2000/mese per organizzazione media
- Retention Fase 4: un cliente salvato = €2000-15000 ARR

---

## Team e Risorse Necessarie

| Ruolo | Fase 1 | Fase 2 | Fase 3 | Fase 4 |
|---|---|---|---|---|
| ML Engineer (Python) | Full-time | Full-time | Full-time | Full-time |
| Backend Engineer (TypeScript) | Part-time | Part-time | Part-time | Part-time |
| Frontend Engineer | Part-time | Part-time | Part-time | Part-time |
| DPO/Legal (THEMIS) | — | — | Fase 3B | — |
| Product/UX | Review | Review | Review | Review |

---

## Go/No-Go Checkpoints

Alla fine di ogni fase, prima di procedere:

```
✅ Modelli deployati in produzione (non solo staging)
✅ KPI misurati su dati reali (non simulati)
✅ Almeno 2 organizzazioni pilota hanno usato la feature per 4+ settimane
✅ Feedback qualitativo positivo (NPS > 4/5)
✅ Zero incidenti sicurezza/privacy legati ai modelli AI
✅ Costi infrastruttura nei budget
```

Se il checkpoint non passa → diagnosi, correzione, e ri-verifica dopo 2 settimane. Non procedere alla fase successiva con modelli non validati in produzione.
