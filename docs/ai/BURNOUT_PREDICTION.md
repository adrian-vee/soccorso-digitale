# Burnout Prediction — Prevenzione Burnout Operatori

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Approccio:** Rule-based scoring + Anomaly Detection
**Privacy:** Richiede DPIA — vedi docs/legal/DPIA.md

---

## Obiettivo

Identificare operatori a rischio di burnout prima che si verifichi, per consentire interventi preventivi.

**Output target:**
> "Operatore Marco Bianchi — rischio burnout MEDIO. Lavora 18 settimane consecutive senza riposo weekend. Azione consigliata: assegnare almeno 2 weekend liberi nelle prossime 4 settimane."

**Chi usa questo output:** Coordinatori e direttori, nella sezione Personale e Dashboard benessere. **MAI visibile all'operatore stesso** (vedere sezione Privacy).

---

## Avviso Privacy — LEGGERE PRIMA DI IMPLEMENTARE

Questo modello tratta **dati comportamentali di dipendenti/volontari**. In Italia e UE:

- Richiede una **DPIA (Data Protection Impact Assessment)** ai sensi dell'Art. 35 GDPR
- Il trattamento deve avere **base giuridica** (legittimo interesse o consenso)
- Il risultato (score burnout) è un dato derivato che può essere **sensibile**
- Deve essere previsto un **meccanismo di rettifica** per l'operatore
- I risultati NON possono essere usati per decisioni automatizzate con effetti legali (Art. 22 GDPR)

**Riferimento obbligatorio:** Prima di deployare in produzione, THEMIS deve completare la DPIA in `docs/legal/DPIA.md` e aggiornare il DPA con le organizzazioni clienti.

---

## Perché Rule-Based e Non Solo ML

Per dataset di personale di organizzazioni piccole (5-50 operatori), il machine learning puro produce risultati inaffidabili. Con 20 operatori e 12 mesi di storico, non c'è abbastanza segnale per addestrare un modello supervisionato.

La letteratura clinica sul burnout (Maslach, 1981; WHO, 2019) identifica fattori di rischio ben documentati e quantificabili che funzionano meglio come **regole** con soglie calibrate.

Un sistema ibrido è più robusto:

```
Rule-based scoring (deterministic) → score 0-100
          +
Anomaly detection (statistical)   → flag pattern anomali
          =
Risk level: VERDE / GIALLO / ROSSO
```

---

## Feature Set

### Dati da PostgreSQL

```sql
-- Feature per ogni operatore — ultimi 90 giorni
SELECT
  sm.id                           AS staff_id,
  sm.organization_id,
  sm.role,
  sm.employment_type,             -- dipendente, volontario, libero_professionista

  -- Volume lavoro
  COUNT(DISTINCT s.date)          AS days_worked_90d,
  SUM(s.hours)                    AS total_hours_90d,
  COUNT(DISTINCT s.date)
    FILTER (WHERE EXTRACT(DOW FROM s.date) IN (0,6)) AS weekend_days_90d,
  COUNT(DISTINCT s.date)
    FILTER (WHERE s.shift_type = 'notte') AS night_shifts_90d,

  -- Consecutive work patterns
  MAX(consecutive_days.streak)    AS max_consecutive_days,

  -- Ore straordinario
  SUM(GREATEST(0, s.hours - s.contracted_hours)) AS overtime_hours_90d,

  -- Assenze
  COUNT(DISTINCT a.date)          AS absence_days_90d,
  COUNT(DISTINCT a.date)
    FILTER (WHERE a.type = 'malattia') AS sick_days_90d,

  -- Variazioni turno dell'ultimo mese (indicatore instabilità)
  COUNT(DISTINCT sch.id)
    FILTER (WHERE sch.change_type = 'sostituzione_urgente'
      AND sch.date >= NOW() - INTERVAL '30 days') AS urgent_subs_30d

FROM staff_members sm
LEFT JOIN shifts s ON s.staff_id = sm.id
  AND s.date >= NOW() - INTERVAL '90 days'
  AND s.status = 'completed'
LEFT JOIN absences a ON a.staff_id = sm.id
  AND a.date >= NOW() - INTERVAL '90 days'
LEFT JOIN shift_changes sch ON sch.staff_id = sm.id
WHERE sm.organization_id = $1
  AND sm.status = 'active'
GROUP BY sm.id, sm.organization_id, sm.role, sm.employment_type;
```

### Calcolo streak consecutivi

```python
def compute_consecutive_streaks(work_dates: list[date]) -> dict:
    """
    Calcola la serie massima di giorni lavorativi consecutivi
    e la serie attuale.
    """
    if not work_dates:
        return {"max_streak": 0, "current_streak": 0}

    sorted_dates = sorted(set(work_dates))
    max_streak = 1
    current_streak = 1
    streak = 1

    for i in range(1, len(sorted_dates)):
        delta = (sorted_dates[i] - sorted_dates[i-1]).days
        if delta == 1:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1

    # Streak corrente: dalla fine del periodo
    today = date.today()
    current_streak = 0
    for d in reversed(sorted_dates):
        if (today - d).days <= current_streak + 1:
            current_streak += 1
        else:
            break

    return {"max_streak": max_streak, "current_streak": current_streak}
```

---

## Modello: Rule-Based Scoring

### Score composito 0-100

```python
from dataclasses import dataclass

@dataclass
class BurnoutScore:
    total: float        # 0-100 (100 = massimo rischio)
    level: str          # VERDE, GIALLO, ROSSO
    components: dict    # contributo di ogni fattore
    warnings: list[str] # messaggi specifici

def compute_burnout_score(features: dict) -> BurnoutScore:
    """
    Calcola score burnout basato su fattori di rischio documentati.

    Pesi basati su letteratura:
    - Karasek job demand-control model
    - Maslach Burnout Inventory (MBI) correlates
    - Linee guida INAIL per lavoro notturno
    """
    score = 0.0
    components = {}
    warnings = []

    # ── FATTORE 1: Ore lavorate (peso 25%)
    hours_90d = features["total_hours_90d"] or 0
    # Threshold: > 180h/90gg = media > 2h/giorno sopra standard 8h
    # > 270h = media sopra 12h/giorno — soglia critica
    if hours_90d > 270:
        component = 25.0
        warnings.append(f"Ore lavorate negli ultimi 90 giorni: {hours_90d:.0f} (soglia critica: 270)")
    elif hours_90d > 216:  # > 8h/giorno media
        component = 15.0
        warnings.append(f"Ore lavorate elevate: {hours_90d:.0f}/90 giorni")
    elif hours_90d > 180:
        component = 5.0
    else:
        component = 0.0
    score += component
    components["ore_lavorate"] = component

    # ── FATTORE 2: Turni notturni (peso 20%)
    night_shifts = features["night_shifts_90d"] or 0
    # INAIL: > 3 notti/settimana cronica = rischio elevato
    # In 90 giorni: 12 settimane → > 36 notti = critico
    if night_shifts > 36:
        component = 20.0
        warnings.append(f"Turni notturni: {night_shifts}/90gg (soglia critica: 36)")
    elif night_shifts > 18:  # > 1.5/settimana
        component = 12.0
        warnings.append(f"Frequenza turni notturni elevata: {night_shifts}/90gg")
    elif night_shifts > 9:
        component = 5.0
    else:
        component = 0.0
    score += component
    components["turni_notturni"] = component

    # ── FATTORE 3: Weekend lavorati (peso 15%)
    weekend_days = features["weekend_days_90d"] or 0
    # 90gg = ~25 weekend giorni disponibili
    # > 18 weekend days = > 72% dei weekend lavorati
    if weekend_days > 20:
        component = 15.0
        warnings.append(f"Weekend lavorati: {weekend_days}/~26 disponibili")
    elif weekend_days > 14:  # > 56%
        component = 9.0
        warnings.append(f"Alta frequenza lavoro weekend: {weekend_days}/90gg")
    elif weekend_days > 10:
        component = 4.0
    else:
        component = 0.0
    score += component
    components["weekend_lavorati"] = component

    # ── FATTORE 4: Giorni consecutivi senza riposo (peso 20%)
    max_consecutive = features["max_consecutive_days"] or 0
    # CCNL tipico: massimo 6 giorni consecutivi
    if max_consecutive > 12:
        component = 20.0
        warnings.append(f"Serie consecutiva massima: {max_consecutive} giorni senza riposo")
    elif max_consecutive > 9:
        component = 14.0
        warnings.append(f"Serie di {max_consecutive} giorni consecutivi rilevata")
    elif max_consecutive > 6:
        component = 7.0
    else:
        component = 0.0
    score += component
    components["giorni_consecutivi"] = component

    # ── FATTORE 5: Straordinari (peso 10%)
    overtime = features["overtime_hours_90d"] or 0
    if overtime > 60:
        component = 10.0
        warnings.append(f"Straordinari: {overtime:.0f}h negli ultimi 90 giorni")
    elif overtime > 30:
        component = 5.0
    elif overtime > 15:
        component = 2.0
    else:
        component = 0.0
    score += component
    components["straordinari"] = component

    # ── FATTORE 6: Segnale di distress (assenze malattia) (peso 10%)
    sick_days = features["sick_days_90d"] or 0
    # > 3 episodi di malattia in 90gg = possibile segnale distress
    # Nota: questo ha overlap con altri segnali di salute, non usare in isolamento
    if sick_days > 10:
        component = 10.0
        warnings.append(f"Assenze per malattia: {sick_days} giorni/90gg — possibile segnale distress")
    elif sick_days > 5:
        component = 6.0
    elif sick_days > 2:
        component = 2.0
    else:
        component = 0.0
    score += component
    components["assenze_malattia"] = component

    # ── CLASSIFICAZIONE
    if score < 25:
        level = "VERDE"
    elif score < 55:
        level = "GIALLO"
    else:
        level = "ROSSO"

    return BurnoutScore(
        total=min(score, 100.0),
        level=level,
        components=components,
        warnings=warnings,
    )
```

---

## Anomaly Detection per Pattern Nuovi

Il rule-based scoring non cattura tutti i pattern. L'anomaly detection identifica operatori il cui comportamento si discosta significativamente dalla loro baseline personale e dalla media del gruppo:

```python
from sklearn.ensemble import IsolationForest
import numpy as np

def detect_burnout_anomalies(
    features_matrix: np.ndarray,  # righe = operatori, colonne = feature
    staff_ids: list[str],
    contamination: float = 0.10  # stima % anomalie (default 10%)
) -> dict[str, float]:
    """
    Isolation Forest per anomaly detection.
    Identifica operatori con pattern di lavoro statisticamente anomali.

    contamination=0.10 → segnala il 10% più anomalo del gruppo
    (non necessariamente a rischio, ma merita attenzione)
    """
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
    )
    model.fit(features_matrix)

    # anomaly_scores: più negativo = più anomalo
    anomaly_scores = model.decision_function(features_matrix)

    # Normalizza in [0, 1] dove 1 = più anomalo
    normalized = 1 - (anomaly_scores - anomaly_scores.min()) / (
        anomaly_scores.max() - anomaly_scores.min() + 1e-6
    )

    return dict(zip(staff_ids, normalized))
```

---

## Output API

```typescript
// GET /api/ai/burnout?org={id}
interface BurnoutReport {
  organization_id: string;
  generated_at: string;
  staff_summary: {
    green: number;
    yellow: number;
    red: number;
  };
  staff: StaffBurnoutStatus[];
}

interface StaffBurnoutStatus {
  staff_id: string;          // UUID
  // NOTA: nome/cognome NON incluso nell'API response —
  // il frontend li risolve via staff_id per evitare
  // di loggare dati personali nei log ML service
  risk_level: "VERDE" | "GIALLO" | "ROSSO";
  score: number;             // 0-100
  anomaly_score: number;     // 0-1
  top_reasons: string[];     // max 3 motivi
  recommended_actions: string[];
  data_period: {
    from: string;
    to: string;
    days_with_data: number;
  };
}
```

---

## Dashboard Benessere

```
Sezione "Benessere Personale" (solo Direttore e Admin)
─────────────────────────────────────────────────────
  🟢 18 operatori — Nessuna criticità
  🟡  4 operatori — Attenzione
  🔴  1 operatore — Intervento consigliato

[Visualizza dettaglio per operatore →]

─ Operatore A ──────────────────────────── GIALLO ─
  Score: 47/100
  • Weekend lavorati: 19/26 negli ultimi 90gg
  • Turni notturni: 22
  Azione: Pianificare 2 weekend liberi nelle prossime 4 settimane

─ Operatore B ──────────────────────────── ROSSO ──
  Score: 68/100
  • Serie consecutiva: 11 giorni senza riposo
  • Ore totali: 287/90gg (sopra soglia critica)
  • 2 assenze malattia nell'ultimo mese
  Azione: Colloquio diretto entro 3 giorni. Limitare turni extra.
```

---

## Calibrazione Soglie

Le soglie numeriche indicate sono punti di partenza basati su letteratura. **Devono essere calibrate** sulla base delle caratteristiche specifiche dell'organizzazione:

- Volontari vs dipendenti hanno contratti molto diversi
- Turni notturni in pronto soccorso vs trasporto programmato hanno profili di stress diversi
- Cooperative grandi con staff dedicato vs piccole associazioni con volontari saltuari

**Raccomandazione:** Dopo 6 mesi di deployment, raccogliere feedback dai direttori sulle segnalazioni corrette/errate e aggiustare le soglie per tipo organizzazione.

---

## Vincoli Privacy Tecnici

1. **Lo score non viene mai inviato all'operatore** — solo al direttore/coordinatore
2. **Retention massima**: i dati di scoring vengono conservati 12 mesi, poi eliminati
3. **Audit log**: ogni accesso al report burnout viene registrato con chi ha visto cosa
4. **Diritto di accesso**: se un operatore richiede accesso ai propri dati (Art. 15 GDPR), deve ricevere anche lo score burnout e la sua spiegazione
5. **Diritto di rettifica**: se lo score è basato su dati errati (es. turni registrati male), l'operatore può contestare tramite il direttore

```sql
-- Audit log accessi burnout data
CREATE TABLE ai_burnout_access_log (
  id          SERIAL PRIMARY KEY,
  accessed_by UUID NOT NULL REFERENCES staff_members(id),  -- chi ha visto
  subject_id  UUID NOT NULL REFERENCES staff_members(id),  -- di chi i dati
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_type VARCHAR(50),  -- 'dashboard_view', 'api_export', 'gdpr_access_request'
  ip_address  INET
);
```
