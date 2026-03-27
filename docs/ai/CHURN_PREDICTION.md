# Churn Prediction — Predizione Abbandono Organizzazioni

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Modello:** Logistic Regression + Gradient Boosting (ensemble)

---

## Obiettivo

Identificare organizzazioni clienti a rischio di cancellazione subscription prima che cancellino, per consentire interventi di retention proattivi.

**Output target:**
> "Croce Verde Trento — health score: 31/100 (CRITICO). Nessun login negli ultimi 18 giorni. Utilizzo funzionalità in calo del 60% vs trimestre scorso. Ticket aperto non risolto da 5 giorni. Azione: contattare entro 24h."

**Chi usa questo output:** Sales/Customer Success (ODYSSEUS/PENELOPE) nella sezione SaaS Analytics del superadmin.

---

## Definizione di "Churn"

```
Churn = organizzazione che cancella il proprio piano entro i prossimi 60 giorni
        OPPURE
        non rinnova all'expiry date
        OPPURE
        fa downgrade a piano inferiore (churn parziale)
```

**Nota:** Nel modello trattiamo le tre categorie separatamente ma le combiniamo in un unico score composito. Il modello predice la probabilità di qualsiasi forma di abbandono o downgrade.

---

## Feature Set

### Engagement e Utilizzo

```sql
SELECT
  o.id                            AS organization_id,
  o.plan,
  o.created_at,
  EXTRACT(DAYS FROM NOW() - o.created_at) AS tenure_days,

  -- Login activity (proxy per engagement)
  COUNT(DISTINCT DATE(al.created_at))
    FILTER (WHERE al.created_at >= NOW() - INTERVAL '30 days') AS active_days_30d,
  COUNT(DISTINCT DATE(al.created_at))
    FILTER (WHERE al.created_at >= NOW() - INTERVAL '7 days') AS active_days_7d,
  MAX(al.created_at)              AS last_login,
  EXTRACT(DAYS FROM NOW() - MAX(al.created_at)) AS days_since_last_login,

  -- Feature adoption
  COUNT(DISTINCT al.feature_used)
    FILTER (WHERE al.created_at >= NOW() - INTERVAL '30 days') AS features_used_30d,

  -- Operatività piattaforma
  COUNT(t.id)
    FILTER (WHERE t.start_time >= NOW() - INTERVAL '30 days') AS trips_30d,
  COUNT(t.id)
    FILTER (WHERE t.start_time >= NOW() - INTERVAL '90 days') AS trips_90d,

  -- Trend operativo (calo = segnale)
  COUNT(t.id) FILTER (WHERE t.start_time >= NOW() - INTERVAL '30 days') * 1.0 /
  NULLIF(COUNT(t.id) FILTER (WHERE t.start_time BETWEEN NOW() - INTERVAL '60 days'
    AND NOW() - INTERVAL '30 days'), 0)  AS trips_trend_ratio,

  -- Supporto (ticket aperti = insoddisfazione potenziale)
  COUNT(st.id)
    FILTER (WHERE st.created_at >= NOW() - INTERVAL '30 days') AS support_tickets_30d,
  COUNT(st.id)
    FILTER (WHERE st.status = 'open'
      AND st.created_at >= NOW() - INTERVAL '14 days') AS open_tickets_14d,
  AVG(EXTRACT(HOURS FROM st.resolved_at - st.created_at))
    FILTER (WHERE st.status = 'resolved') AS avg_resolution_hours,

  -- Pagamenti
  COUNT(inv.id) FILTER (WHERE inv.status = 'overdue') AS overdue_invoices,
  MAX(CASE WHEN inv.status = 'paid' THEN inv.paid_at END) AS last_payment,
  EXTRACT(DAYS FROM NOW() - MAX(CASE WHEN inv.status = 'paid' THEN inv.paid_at END))
    AS days_since_last_payment,

  -- Piano e onboarding
  CASE WHEN o.onboarding_completed THEN 1 ELSE 0 END AS onboarding_completed,
  COUNT(DISTINCT om.module_id)    AS active_modules_count

FROM organizations o
LEFT JOIN audit_logs al ON al.organization_id = o.id
LEFT JOIN trips t ON t.organization_id = o.id
LEFT JOIN support_tickets st ON st.organization_id = o.id
LEFT JOIN invoices inv ON inv.organization_id = o.id
LEFT JOIN org_modules om ON om.organization_id = o.id AND om.active = true
WHERE o.status = 'active'
GROUP BY o.id, o.plan, o.created_at, o.onboarding_completed;
```

### Feature Engineering

```python
def engineer_churn_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Health score componenti
    df["login_health"] = (df["active_days_30d"] / 22.0).clip(0, 1)  # 22 giorni lavorativi

    # Recency score (decay esponenziale — giorni senza login)
    df["recency_score"] = np.exp(-df["days_since_last_login"] / 14.0)

    # Feature adoption ratio (features usate / features disponibili nel piano)
    plan_features = {"starter": 5, "professional": 10, "enterprise": 15}
    df["feature_adoption_ratio"] = df.apply(
        lambda row: row["features_used_30d"] / plan_features.get(row["plan"], 10),
        axis=1
    ).clip(0, 1)

    # Trend operativo (se trips calano del 40%+, segnale forte)
    df["trips_declining"] = (df["trips_trend_ratio"] < 0.6).astype(int)
    df["trips_trend_ratio"] = df["trips_trend_ratio"].fillna(1.0).clip(0, 3)

    # Supporto insoddisfazione proxy
    df["support_stress"] = (
        df["support_tickets_30d"] * 2 +
        df["open_tickets_14d"] * 5  # ticket non risolti pesano di più
    ).clip(0, 20)

    # Pagamento health
    df["payment_risk"] = (
        df["overdue_invoices"] * 10 +
        (df["days_since_last_payment"] > 45).astype(int) * 5
    ).clip(0, 20)

    # Tenure: organizzazioni molto nuove (< 30gg) e molto vecchie (> 730gg) sono diverse
    df["is_early_stage"] = (df["tenure_days"] < 60).astype(int)
    df["is_long_term"]   = (df["tenure_days"] > 730).astype(int)

    return df
```

---

## Modello: Logistic Regression + Gradient Boosting

### Costruzione del training set

Il training set richiede eventi di churn storici. Con SD che ha pochi mesi di dati, si usano due strategie:

**Strategia 1 — Censored survival analysis:** Trattare ogni organizzazione come un "soggetto" e churn come "evento". Anche le org che NON hanno cancellato contribuiscono come negative.

**Strategia 2 — Finestra temporale rolling:** Per ogni organizzazione ancora attiva, calcola le feature al giorno T e la label (churn nei successivi 60 giorni) in modo retrospettivo per tutte le osservazioni storiche disponibili.

```python
def build_training_dataset(
    org_snapshots: list[dict],  # snapshot settimanali di ogni org
    churn_events: list[dict],   # quando ogni org ha cancellato
    prediction_horizon_days: int = 60
) -> pd.DataFrame:
    """
    Costruisce dataset di training con etichette di churn.

    Per ogni snapshot della settimana W:
    - Features: metriche al giorno W
    - Label: 1 se l'org ha cancellato tra W e W+60gg, 0 altrimenti
    """
    rows = []
    churn_dates = {c["org_id"]: c["churn_date"] for c in churn_events}

    for snapshot in org_snapshots:
        org_id = snapshot["organization_id"]
        snapshot_date = snapshot["snapshot_date"]
        churn_date = churn_dates.get(org_id)

        if churn_date:
            days_to_churn = (churn_date - snapshot_date).days
            label = 1 if 0 <= days_to_churn <= prediction_horizon_days else 0
        else:
            label = 0  # org ancora attiva = non-churn

        rows.append({**snapshot, "churn_label": label})

    return pd.DataFrame(rows)
```

### Training modello

```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedKFold, cross_val_score

FEATURE_COLS = [
    "active_days_30d",
    "active_days_7d",
    "days_since_last_login",
    "recency_score",
    "feature_adoption_ratio",
    "trips_30d",
    "trips_trend_ratio",
    "trips_declining",
    "support_tickets_30d",
    "open_tickets_14d",
    "overdue_invoices",
    "payment_risk",
    "tenure_days",
    "is_early_stage",
    "onboarding_completed",
    "active_modules_count",
    "login_health",
]

def train_churn_model(df: pd.DataFrame) -> tuple:
    """
    Ensemble di Logistic Regression (interpretabile) + Gradient Boosting (performance).
    """
    X = df[FEATURE_COLS]
    y = df["churn_label"]

    # Modello 1: Logistic Regression (alta interpretabilità)
    lr_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model", LogisticRegression(
            C=0.5,              # regolarizzazione L2
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
        )),
    ])

    # Modello 2: Gradient Boosting (alta performance)
    gb_model = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.05,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )
    # Calibrazione probabilità (GBM non è ben calibrato di default)
    gb_calibrated = CalibratedClassifierCV(gb_model, cv=5, method="sigmoid")

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    lr_auc  = cross_val_score(lr_pipeline, X, y, cv=cv, scoring="roc_auc")
    gb_auc  = cross_val_score(gb_calibrated, X, y, cv=cv, scoring="roc_auc")

    # Fit finale
    lr_pipeline.fit(X, y)
    gb_calibrated.fit(X, y)

    return (lr_pipeline, gb_calibrated), {
        "lr_roc_auc": lr_auc.mean(),
        "gb_roc_auc": gb_auc.mean(),
    }


def predict_churn_ensemble(
    lr_model, gb_model,
    X: pd.DataFrame,
    lr_weight: float = 0.4
) -> np.ndarray:
    """Predizione ensemble pesata."""
    lr_proba = lr_model.predict_proba(X)[:, 1]
    gb_proba = gb_model.predict_proba(X)[:, 1]
    return lr_weight * lr_proba + (1 - lr_weight) * gb_proba
```

---

## Health Score 0-100

Lo health score è l'inverso della probabilità di churn, reso leggibile:

```python
def compute_health_score(churn_probability: float) -> dict:
    """
    Converte probabilità churn in health score 0-100.

    health_score = 100 × (1 - churn_probability)
    ma con bucketing per rendere le soglie intuitive.
    """
    health = round(100 * (1 - churn_probability))

    if health >= 70:
        status = "SANO"
        color = "green"
        action = None
        urgency_days = None
    elif health >= 50:
        status = "ATTENZIONE"
        color = "yellow"
        action = "check_in_call"
        urgency_days = 7
    elif health >= 30:
        status = "A_RISCHIO"
        color = "orange"
        action = "retention_call"
        urgency_days = 3
    else:
        status = "CRITICO"
        color = "red"
        action = "urgent_intervention"
        urgency_days = 1

    return {
        "score": health,
        "status": status,
        "color": color,
        "recommended_action": action,
        "act_within_days": urgency_days,
    }
```

---

## Interpretabilità: Perché un'Org Rischia il Churn

```python
def explain_churn_risk(
    org_features: pd.Series,
    lr_model: Pipeline,
    top_n: int = 3
) -> list[dict]:
    """
    Usa i coefficienti della Logistic Regression per spiegare il rischio.
    LR è interpretabile direttamente: coeff × feature_value = contributo al log-odds.

    Returns:
        Lista di fattori ordinati per impatto, con descrizione human-readable.
    """
    lr = lr_model.named_steps["model"]
    scaler = lr_model.named_steps["scaler"]

    scaled_features = scaler.transform(org_features.to_frame().T)[0]
    contributions = lr.coef_[0] * scaled_features

    # Ordina per contributo positivo al rischio (log-odds verso churn)
    sorted_contrib = sorted(
        zip(FEATURE_COLS, contributions),
        key=lambda x: x[1],
        reverse=True
    )

    EXPLANATIONS = {
        "days_since_last_login": lambda v: f"Nessun accesso da {int(v)} giorni",
        "recency_score": lambda v: f"Engagement in forte calo",
        "active_days_30d": lambda v: f"Solo {int(v)} giorni di accesso nell'ultimo mese",
        "trips_declining": lambda v: "Volume servizi in calo del 40%+" if v > 0 else None,
        "open_tickets_14d": lambda v: f"{int(v)} ticket aperti non risolti",
        "feature_adoption_ratio": lambda v: f"Utilizza solo {v*100:.0f}% delle funzionalità disponibili",
        "overdue_invoices": lambda v: f"{int(v)} fatture scadute non pagate",
        "onboarding_completed": lambda v: "Onboarding non completato" if v == 0 else None,
    }

    results = []
    for feature, contrib in sorted_contrib[:top_n]:
        if contrib > 0:
            raw_value = org_features.get(feature, 0)
            explain_fn = EXPLANATIONS.get(feature)
            if explain_fn:
                text = explain_fn(raw_value)
                if text:
                    results.append({"factor": feature, "contribution": contrib, "text": text})

    return results
```

---

## Output API

```typescript
// GET /api/ai/churn?superadmin=true — solo per superadmin SD
interface ChurnReport {
  generated_at: string;
  organizations: OrgHealthStatus[];
  summary: {
    total: number;
    healthy: number;      // score >= 70
    warning: number;      // score 50-69
    at_risk: number;      // score 30-49
    critical: number;     // score < 30
  };
}

interface OrgHealthStatus {
  organization_id: string;
  organization_name: string;
  plan: string;
  health_score: number;          // 0-100
  status: "SANO" | "ATTENZIONE" | "A_RISCHIO" | "CRITICO";
  churn_probability_60d: number; // 0.0-1.0
  top_risk_factors: string[];    // max 3 frasi
  recommended_action: string | null;
  act_within_days: number | null;
  tenure_days: number;
  last_login: string;            // ISO date
  metrics: {
    active_days_30d: number;
    trips_30d: number;
    open_tickets: number;
  };
}
```

---

## Early Warning System

Alert automatico quando un'org scende sotto soglia:

```sql
-- Trigger per inserire alert quando health score scende sotto 50
-- (eseguito dopo ogni update della tabella ai_predictions)

INSERT INTO notifications (
  type, recipient_role, title, body, metadata, created_at
)
SELECT
  'churn_alert',
  'superadmin',
  'Organizzazione a rischio — ' || o.name,
  'Health score sceso a ' || new_score || '/100. Azione consigliata: ' || action,
  jsonb_build_object('org_id', org_id, 'score', new_score),
  NOW()
FROM ai_predictions
JOIN organizations o ON o.id = ai_predictions.entity_id
WHERE model_type = 'churn'
  AND (predicted_value->>'health_score')::int < 50
  AND (predicted_value->>'health_score')::int >=
    COALESCE(
      (SELECT (predicted_value->>'health_score')::int
       FROM ai_predictions prev
       WHERE prev.entity_id = ai_predictions.entity_id
         AND prev.model_type = 'churn'
         AND prev.created_at < ai_predictions.created_at
       ORDER BY created_at DESC LIMIT 1),
      100  -- prima volta: genera sempre alert
    ) - 15  -- genera alert solo se calo >= 15 punti
;
```

---

## Accuracy Attesa e Minimum Data

| Dataset | ROC-AUC | Precision (alert) | Note |
|---|---|---|---|
| < 20 churn events | Non addestrare | — | Troppo pochi eventi |
| 20-50 churn events | 0.65-0.72 | 40-55% | Modello light, utile ma con falsi positivi |
| 50-150 churn events | 0.72-0.80 | 55-70% | Target per 12-18 mesi SD |
| > 150 churn events | 0.80-0.88 | 70-80% | Maturità |

**Precision del 60%** significa: su 10 organizzazioni che il modello segnala come "critiche", 6 effettivamente disdiceranno entro 60 giorni. Le altre 4 sono falsi positivi — il costo di un retention call inutile è basso (15 min), il costo di perdere un cliente è alto (~€2.000-15.000 ARR). Precision del 60% è quindi ROI positivo.

---

## Cold Start

SD potrebbe avere pochi churn storici nei primi 12-18 mesi. Prima di addestrare il modello supervisionato, usare il **rule-based health score** basato esclusivamente su metriche di engagement:

```python
def rule_based_health_score(features: dict) -> int:
    """
    Health score senza ML — basato su soglie empiriche.
    Usare finché non ci sono abbastanza churn events per ML.
    """
    score = 100

    # Penalità inattività
    days_inactive = features.get("days_since_last_login", 0)
    if days_inactive > 30:  score -= 40
    elif days_inactive > 14: score -= 20
    elif days_inactive > 7:  score -= 10

    # Penalità volume
    trips_30d = features.get("trips_30d", 0)
    if trips_30d == 0:       score -= 20
    elif trips_30d < 3:      score -= 10

    # Penalità trend calo
    if features.get("trips_declining", 0):  score -= 15

    # Penalità ticket aperti
    open_tickets = features.get("open_tickets_14d", 0)
    if open_tickets >= 2:    score -= 15
    elif open_tickets == 1:  score -= 5

    # Penalità pagamenti
    overdue = features.get("overdue_invoices", 0)
    score -= overdue * 10

    # Bonus onboarding completato
    if features.get("onboarding_completed", False): score += 5

    return max(0, min(100, score))
```
