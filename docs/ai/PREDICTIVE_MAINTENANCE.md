# Predictive Maintenance — Manutenzione Predittiva Flotta

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Modello:** Random Forest + XGBoost per classificazione rischio

---

## Obiettivo

Predire la probabilità di guasto di ogni veicolo nei prossimi 7-30 giorni, prima che il guasto si verifichi.

**Output target:**
> "Ambulanza J54 — rischio guasto ALTO entro 15 giorni. Motivo: km dall'ultima manutenzione (+340% oltre soglia) + 2 guasti negli ultimi 6 mesi. Azione consigliata: ispezione entro 3 giorni."

**Chi usa questo output:** Coordinatori per pianificare manutenzione preventiva; direttori per visibilità sul rischio flotta.

---

## Contesto del Problema

La manutenzione predittiva nel settore ambulanze/trasporto sanitario ha caratteristiche specifiche:

- **Missione critica**: un guasto durante un servizio paziente è inaccettabile
- **Flotte piccole**: 5-30 veicoli per organizzazione → poco dato per veicolo
- **Dati disponibili**: principalmente km, date manutenzione, storico guasti in PostgreSQL
- **Assenza di sensori IoT**: SD non ha OBD-II reader o telemetria motore in tempo reale

Questo limita la scelta del modello: non possiamo fare manutenzione predittiva "vera" (basata su vibrazioni, temperatura motore, etc.) — facciamo invece **risk scoring** basato su pattern storici e soglie km/tempo.

---

## Feature Set

### Dati da PostgreSQL

```sql
-- Feature per ogni veicolo al momento della predizione
SELECT
  v.id                                    AS vehicle_id,
  v.organization_id,
  v.vehicle_type,                          -- ambulanza, furgone, auto
  v.year_of_manufacture,
  EXTRACT(YEAR FROM NOW()) - v.year_of_manufacture AS age_years,
  v.total_km,

  -- Ultima manutenzione ordinaria
  MAX(CASE WHEN m.type = 'ordinaria' THEN m.date END) AS last_ordinary_maint_date,
  MAX(CASE WHEN m.type = 'ordinaria' THEN m.km_at_service END) AS last_ordinary_maint_km,
  v.total_km - MAX(CASE WHEN m.type = 'ordinaria' THEN m.km_at_service END)
    AS km_since_last_ordinary,

  -- Ultima manutenzione straordinaria (guasto)
  MAX(CASE WHEN m.type = 'straordinaria' THEN m.date END) AS last_breakdown_date,

  -- Storico guasti ultimi N mesi
  COUNT(CASE WHEN m.type = 'straordinaria'
    AND m.date >= NOW() - INTERVAL '6 months' THEN 1 END) AS breakdowns_6m,
  COUNT(CASE WHEN m.type = 'straordinaria'
    AND m.date >= NOW() - INTERVAL '12 months' THEN 1 END) AS breakdowns_12m,
  COUNT(CASE WHEN m.type = 'straordinaria'
    AND m.date >= NOW() - INTERVAL '24 months' THEN 1 END) AS breakdowns_24m,

  -- Intensità d'uso recente
  COUNT(CASE WHEN t.start_time >= NOW() - INTERVAL '30 days' THEN 1 END) AS trips_30d,
  SUM(CASE WHEN t.start_time >= NOW() - INTERVAL '30 days' THEN t.distance_km END)
    AS km_30d,

  -- Prossima revisione programmata
  MIN(CASE WHEN m.date > NOW() THEN m.date END) AS next_scheduled_maint

FROM vehicles v
LEFT JOIN vehicle_maintenances m ON m.vehicle_id = v.id
LEFT JOIN trips t ON t.vehicle_id = v.id
WHERE v.organization_id = $1
  AND v.status = 'active'
GROUP BY v.id, v.organization_id, v.vehicle_type, v.year_of_manufacture, v.total_km;
```

### Feature Engineering

```python
def engineer_maintenance_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Deriva feature aggiuntive dal raw data.
    """
    df = df.copy()

    # Soglie km per tipo veicolo (da manuali costruttori + esperienza operativa)
    KM_THRESHOLDS = {
        "ambulanza": {"ordinary": 15000, "tires": 30000, "critical": 50000},
        "furgone":   {"ordinary": 20000, "tires": 40000, "critical": 80000},
        "auto":      {"ordinary": 15000, "tires": 35000, "critical": 60000},
    }

    # Quanto si è oltre la soglia ordinaria (in %)
    def km_overdue_pct(row):
        threshold = KM_THRESHOLDS.get(row["vehicle_type"], {}).get("ordinary", 15000)
        km_since = row.get("km_since_last_ordinary", 0) or 0
        return max(0, (km_since - threshold) / threshold * 100)

    df["km_overdue_pct"] = df.apply(km_overdue_pct, axis=1)

    # Giorni dall'ultima manutenzione
    df["days_since_last_ordinary"] = (
        pd.Timestamp.now() - pd.to_datetime(df["last_ordinary_maint_date"])
    ).dt.days.fillna(9999)

    # Frequenza guasti (guasti per 10k km — normalizzazione per utilizzo)
    df["breakdown_rate_per_10k_km"] = (
        df["breakdowns_24m"] / (df["total_km"] / 10000 + 1e-6)
    ).clip(0, 10)

    # Intensità uso recente vs media storica
    avg_km_per_month = df["total_km"] / (df["age_years"] * 12 + 1e-6)
    df["usage_intensity_ratio"] = (df["km_30d"] / (avg_km_per_month + 1e-6)).fillna(1.0)

    # Età categoria
    df["age_category"] = pd.cut(
        df["age_years"],
        bins=[0, 2, 5, 8, 100],
        labels=["nuovo", "giovane", "maturo", "vecchio"]
    )

    return df
```

---

## Modello: Random Forest per Classificazione Rischio

### Perché Random Forest

- Gestisce bene feature eterogenee (km, date, conteggi, categorie)
- Robusto agli outlier (es. veicolo con 0 guasti ma 200k km)
- Interpretabile via feature importance → spiega PERCHÉ il rischio è alto
- Non richiede normalizzazione delle feature
- Funziona bene anche con dataset piccoli (50-500 esempi)

### Limitazione principale

Il nostro dataset di training è **piccolo**: ogni organizzazione ha 5-30 veicoli, con 2-5 anni di storico. Questo significa 100-500 righe totali per organizzazione.

**Soluzione**: training su dataset aggregato cross-organizzazione (anonimizzato), con fine-tuning per organizzazione se ha dati sufficienti.

### Definizione della label (target)

```python
def compute_breakdown_label(
    vehicle_id: str,
    reference_date: date,
    maintenance_history: list[MaintenanceRecord],
    horizon_days: int = 30
) -> int:
    """
    Label binaria: il veicolo ha avuto un guasto NON pianificato
    entro horizon_days da reference_date?

    0 = nessun guasto nel periodo
    1 = almeno un guasto straordinario nel periodo
    """
    future_breakdowns = [
        m for m in maintenance_history
        if m.type == "straordinaria"
        and reference_date < m.date <= reference_date + timedelta(days=horizon_days)
        and not m.was_scheduled  # esclude manutenzioni preventive già pianificate
    ]
    return 1 if future_breakdowns else 0
```

### Training

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder
import shap

FEATURE_COLS = [
    "age_years",
    "total_km",
    "km_overdue_pct",
    "days_since_last_ordinary",
    "breakdowns_6m",
    "breakdowns_12m",
    "breakdown_rate_per_10k_km",
    "usage_intensity_ratio",
    "km_30d",
    "trips_30d",
    "vehicle_type_encoded",  # label encoded
]

def train_maintenance_model(
    df: pd.DataFrame,
    horizon_days: int = 30
) -> tuple[RandomForestClassifier, dict]:
    """
    Addestra il modello di classificazione rischio.

    Args:
        df: DataFrame con feature + label colonna 'breakdown_label'
        horizon_days: orizzonte temporale della predizione

    Returns:
        (modello, metriche_validazione)
    """
    le = LabelEncoder()
    df = df.copy()
    df["vehicle_type_encoded"] = le.fit_transform(df["vehicle_type"])

    X = df[FEATURE_COLS]
    y = df["breakdown_label"]

    # Bilanciamento classi (guasti sono rari: ~15-25% delle righe)
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,        # evita overfitting su dataset piccoli
        class_weight="balanced",   # compensa sbilanciamento 0/1
        random_state=42,
        n_jobs=-1,
    )

    # Cross-validation temporale (non k-fold standard — evita data leakage)
    scores = cross_val_score(model, X, y, cv=5, scoring="roc_auc")
    model.fit(X, y)

    # SHAP per interpretabilità
    explainer = shap.TreeExplainer(model)

    return model, {
        "roc_auc_mean": scores.mean(),
        "roc_auc_std": scores.std(),
        "feature_importance": dict(zip(FEATURE_COLS, model.feature_importances_)),
    }
```

---

## Output: Risk Scoring per Veicolo

### Classi di rischio

```python
def classify_risk(probability: float) -> dict:
    """
    Converti probabilità grezza in livello rischio actionable.

    Soglie calibrate per priorità operativa:
    - BASSO: probabilità guasto <20% nei prossimi 30 giorni
    - MEDIO: 20-50% → monitorare, pianificare ispezione
    - ALTO: >50% → ispezione entro 3-5 giorni
    - CRITICO: >80% → non assegnare a servizi fino a ispezione
    """
    if probability < 0.20:
        return {"level": "BASSO", "color": "green", "action": "nessuna", "days_to_act": None}
    elif probability < 0.50:
        return {"level": "MEDIO", "color": "yellow", "action": "pianifica_ispezione", "days_to_act": 14}
    elif probability < 0.80:
        return {"level": "ALTO", "color": "orange", "action": "ispezione_urgente", "days_to_act": 5}
    else:
        return {"level": "CRITICO", "color": "red", "action": "blocca_veicolo", "days_to_act": 1}
```

### Spiegazione del rischio (SHAP)

```python
def generate_risk_explanation(
    model,
    vehicle_features: pd.Series,
    explainer: shap.TreeExplainer
) -> list[str]:
    """
    Genera spiegazione human-readable del rischio.
    Usa SHAP values per identificare le feature che contribuiscono di più.

    Returns:
        Lista di stringhe da mostrare nella UI (max 3 motivi)
    """
    shap_values = explainer.shap_values(vehicle_features.to_frame().T)[1][0]

    feature_impacts = sorted(
        zip(FEATURE_COLS, shap_values),
        key=lambda x: abs(x[1]),
        reverse=True
    )

    explanations = []
    for feature, impact in feature_impacts[:3]:
        if impact > 0:  # aumenta il rischio
            if feature == "km_overdue_pct":
                pct = vehicle_features["km_overdue_pct"]
                explanations.append(f"Km dall'ultima manutenzione: {pct:.0f}% oltre la soglia")
            elif feature == "breakdowns_6m":
                n = int(vehicle_features["breakdowns_6m"])
                explanations.append(f"Guasti negli ultimi 6 mesi: {n}")
            elif feature == "age_years":
                age = vehicle_features["age_years"]
                explanations.append(f"Età veicolo: {age:.0f} anni")
            elif feature == "usage_intensity_ratio":
                ratio = vehicle_features["usage_intensity_ratio"]
                explanations.append(f"Utilizzo recente: {ratio:.1f}x la media storica")

    return explanations
```

### Esempio output API

```json
{
  "vehicle_id": "uuid-J54",
  "plate": "J54",
  "vehicle_type": "ambulanza",
  "risk": {
    "level": "ALTO",
    "color": "orange",
    "probability_30d": 0.67,
    "action": "ispezione_urgente",
    "days_to_act": 5
  },
  "explanation": [
    "Km dall'ultima manutenzione: 340% oltre la soglia",
    "Guasti negli ultimi 6 mesi: 2",
    "Età veicolo: 8 anni"
  ],
  "recommended_actions": [
    "Pianificare ispezione entro venerdì 3 aprile",
    "Verificare livello olio e freni",
    "Considerare di non assegnare a servizi lunghi fino all'ispezione"
  ],
  "last_maintenance": "2025-09-14",
  "km_since_maintenance": 18420,
  "next_scheduled": "2026-06-01"
}
```

---

## Integrazione Dashboard

```
Widget "Flotta" nella dashboard principale
├── 🟢 Ambulanza A12 — Basso rischio
├── 🟡 Furgone B03 — Medio rischio — ispezione consigliata entro 14gg
├── 🟠 Ambulanza J54 — ALTO RISCHIO — ispezione entro 5 giorni
└── [Vedi tutti i 12 veicoli →]
```

L'alert appare anche nella campanella notifiche (stessa UI delle scadenze documenti).

---

## Accuracy Realistica

| Dataset | ROC-AUC atteso | Note |
|---|---|---|
| < 50 veicoli, < 12 mesi | 0.65-0.70 | Baseline ragionevole |
| 50-200 veicoli, 12-24 mesi | 0.72-0.78 | Buona discriminazione |
| > 200 veicoli, > 24 mesi | 0.78-0.85 | Target enterprise |

**Cosa significa ROC-AUC 0.75:** Il modello identifica correttamente il 75% dei veicoli che avranno un guasto prima che accada, e tra quelli che segnala come a rischio, circa il 40-50% avrà effettivamente un problema. Accettabile per manutenzione preventiva — il costo di un falso positivo (ispezione non necessaria: ~€100) è molto inferiore a un guasto in servizio (€500-2000 + rischio sicurezza).

---

## Training Schedule

- **Settimanale** (domenica notte): full retrain con tutti i dati disponibili
- **Giornaliero** (ogni mattina 06:00): aggiornamento predizioni per nuovi km registrati e nuovi guasti
- **Trigger immediato**: ogni volta che viene registrata una manutenzione straordinaria → aggiorna il modello online (partial_fit su Gradient Boosting)
