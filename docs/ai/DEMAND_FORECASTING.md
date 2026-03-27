# Demand Forecasting — Previsione Domanda Servizi

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Modello:** Facebook Prophet + XGBoost ensemble

---

## Obiettivo

Predire il numero di servizi per giorno e settimana, per tipo e per organizzazione.

**Output target:**
> "Lunedì 31 marzo: previsti 14 servizi dialisi, 3 dimissioni, 2 visite — stimati 5 mezzi attivi necessari dalle 07:00 alle 19:00"

**Chi usa questo output:** Coordinatori operativi per pianificare turni e disponibilità mezzi la settimana successiva.

---

## Modello Raccomandato: Prophet

### Perché Prophet

Facebook Prophet è progettato specificamente per serie temporali con:
- **Stagionalità multipla**: giornaliera, settimanale, annuale
- **Festività**: supporto nativo per calendari festività italiani
- **Trend non-lineari**: gestisce cambi di trend automaticamente
- **Missing data**: robusto su gap nei dati storici (es. periodo COVID, chiusure estive)
- **Incertezza**: produce intervalli di confidenza nativamente

Rispetto a ARIMA/SARIMA: Prophet non richiede stazionarietà, è meno sensibile agli outlier, e ha iperparametri più interpretabili da un operatore non statistico.

Rispetto a LSTM/Transformer: Prophet richiede molto meno dati per convergere (3-6 mesi vs 2+ anni). Per organizzazioni con 6-18 mesi di storico, Prophet è superiore.

### Limitazioni Prophet

- Non cattura dipendenze tra feature esterne complesse (es. "questo tipo di servizio aumenta solo quando piove E ci sono dimissioni ospedaliere pianificate") → per questo si usa XGBoost in ensemble
- Non gestisce bene serie con meno di 60-90 punti dati (meno di 2-3 mesi di storico giornaliero)
- La stagionalità annuale richiede almeno 12 mesi di dati per essere stimata correttamente

---

## Feature Set

### Feature primarie (da PostgreSQL)

```sql
-- Query aggregazione giornaliera per training
SELECT
  DATE(start_time)                    AS ds,
  COUNT(*)                            AS y,
  service_type,
  organization_id,
  EXTRACT(DOW FROM start_time)        AS day_of_week,
  EXTRACT(MONTH FROM start_time)      AS month,
  EXTRACT(WEEK FROM start_time)       AS week_of_year
FROM trips
WHERE organization_id = $1
  AND status = 'completed'
  AND start_time >= NOW() - INTERVAL '24 months'
GROUP BY DATE(start_time), service_type, organization_id
ORDER BY ds;
```

### Feature esterne (regressori aggiuntivi per Prophet)

| Feature | Fonte | Tipo | Impatto atteso |
|---|---|---|---|
| `is_holiday` | Nager.Date API | Binario | Alta: -30-60% servizi programmati |
| `is_holiday_eve` | Nager.Date + 1 | Binario | Media: -15% |
| `temperature_max` | Open-Meteo | Continuo | Media: +10% servizi urgenti con freddo estremo |
| `is_rain` | Open-Meteo | Binario | Bassa: leggero +% incidenti |
| `is_summer` | Derivata | Binario | Alta: -20% dialisi (pazienti in vacanza) |
| `week_of_month` | Derivata | Categoria | Media: dimissioni picco a fine mese |
| `is_post_holiday` | Derivata | Binario | Media: +15% il giorno dopo festività |

### Come ottenere i dati meteo (Open-Meteo)

```python
import requests
from datetime import date, timedelta

def get_weather_features(lat: float, lon: float, target_date: date) -> dict:
    """
    Fetch meteo per una location e data.
    Open-Meteo è gratuito, no API key per uso standard.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ["temperature_2m_max", "precipitation_sum", "weathercode"],
        "start_date": target_date.isoformat(),
        "end_date": (target_date + timedelta(days=7)).isoformat(),
        "timezone": "Europe/Rome"
    }
    resp = requests.get(url, params=params, timeout=5)
    resp.raise_for_status()
    data = resp.json()["daily"]
    return {
        "dates": data["time"],
        "temp_max": data["temperature_2m_max"],
        "precip": data["precipitation_sum"],
        "is_rain": [p > 2.0 for p in data["precipitation_sum"]],
    }
```

### Feature engineering aggiuntive

```python
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggiunge regressori calcolati al dataframe Prophet.
    df deve avere colonne: ds (date), y (count), organization_id
    """
    df = df.copy()
    df["ds"] = pd.to_datetime(df["ds"])

    # Lag features (storico recente come segnale)
    df["y_lag7"]  = df["y"].shift(7)   # stesso giorno settimana scorsa
    df["y_lag14"] = df["y"].shift(14)  # 2 settimane fa
    df["y_lag28"] = df["y"].shift(28)  # 4 settimane fa (allineamento mensile)

    # Rolling statistics
    df["y_rolling7_mean"]  = df["y"].rolling(7).mean()
    df["y_rolling7_std"]   = df["y"].rolling(7).std()
    df["y_rolling30_mean"] = df["y"].rolling(30).mean()

    # Trend indicator
    df["y_trend"] = (df["y_rolling7_mean"] - df["y_rolling30_mean"]) / (df["y_rolling30_mean"] + 1e-6)

    return df
```

---

## Architettura Modello: Prophet + XGBoost Ensemble

### Step 1: Prophet per decomposizione temporale

```python
from prophet import Prophet
import pandas as pd

def train_prophet_model(df: pd.DataFrame, country_code: str = "IT") -> Prophet:
    """
    Addestra un modello Prophet per una singola organizzazione e tipo di servizio.

    Args:
        df: DataFrame con colonne ds (date), y (count), + regressori
        country_code: per festività automatiche

    Returns:
        Modello Prophet addestrato
    """
    model = Prophet(
        # Stagionalità
        yearly_seasonality=True,       # pattern annuale (estate, inverno)
        weekly_seasonality=True,       # pattern settimanale (Mon-Sun)
        daily_seasonality=False,       # non applicabile per dati giornalieri aggregati
        seasonality_mode="multiplicative",  # variazioni % non assolute

        # Festività
        holidays=None,  # aggiunte sotto via add_country_holidays

        # Iperparametri (tuning consigliato dopo 6+ mesi dati)
        changepoint_prior_scale=0.05,  # flessibilità trend (0.001=rigido, 0.5=flessibile)
        seasonality_prior_scale=10.0,  # forza stagionalità
        holidays_prior_scale=10.0,     # forza effetto festività

        # Incertezza
        interval_width=0.80,           # 80% confidence interval (non 95% — troppo ampio)
        uncertainty_samples=1000,
    )

    # Festività italiane automatiche
    model.add_country_holidays(country_name=country_code)

    # Aggiungi regressori esterni se presenti
    if "temperature_max" in df.columns:
        model.add_regressor("temperature_max", standardize=True)
    if "is_rain" in df.columns:
        model.add_regressor("is_rain", standardize=False)

    model.fit(df)
    return model
```

### Step 2: XGBoost per residui e feature esterne

Prophet cattura trend e stagionalità. XGBoost modella i residui e le interazioni tra feature esterne:

```python
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit

def train_residual_model(
    df: pd.DataFrame,
    prophet_predictions: pd.Series,
    feature_cols: list[str]
) -> xgb.XGBRegressor:
    """
    Addestra XGBoost sui residui di Prophet.
    Cattura pattern che Prophet non modella:
    - interazioni meteo * tipo_servizio
    - eventi locali (fiere, concerti — se abbiamo dati)
    - correlazioni inter-tipo (aumento dialisi → aumento dimissioni lag-1g)
    """
    residuals = df["y"] - prophet_predictions

    X = df[feature_cols].copy()
    y = residuals

    # TimeSeriesSplit per evitare data leakage
    tscv = TimeSeriesSplit(n_splits=5)

    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        early_stopping_rounds=20,
        eval_metric="mae",
    )

    # Ultimo fold per validation
    splits = list(tscv.split(X))
    train_idx, val_idx = splits[-1]

    model.fit(
        X.iloc[train_idx], y.iloc[train_idx],
        eval_set=[(X.iloc[val_idx], y.iloc[val_idx])],
        verbose=False,
    )
    return model


def predict_ensemble(
    prophet_model: Prophet,
    xgb_model: xgb.XGBRegressor,
    future_df: pd.DataFrame,
    feature_cols: list[str],
    ensemble_weight: float = 0.7  # 70% Prophet, 30% XGBoost correction
) -> pd.DataFrame:
    """
    Predizione ensemble: Prophet base + correzione XGBoost.
    ensemble_weight = peso Prophet (0.5-0.9 a seconda della quantità dati)
    """
    prophet_pred = prophet_model.predict(future_df)
    xgb_correction = xgb_model.predict(future_df[feature_cols])

    final_pred = (
        ensemble_weight * prophet_pred["yhat"] +
        (1 - ensemble_weight) * (prophet_pred["yhat"] + xgb_correction)
    )

    return pd.DataFrame({
        "ds": future_df["ds"],
        "yhat": final_pred.clip(lower=0).round(),  # non negativi, interi
        "yhat_lower": prophet_pred["yhat_lower"].clip(lower=0).round(),
        "yhat_upper": prophet_pred["yhat_upper"].clip(lower=0).round(),
    })
```

---

## Training: Quando e Come

### Schedule

```
┌─────────────────────────────────────────────────────┐
│  FULL RETRAIN — ogni domenica, 01:00 ora italiana    │
│  - Legge tutto lo storico disponibile               │
│  - Riaddestra Prophet + XGBoost per ogni org+tipo   │
│  - Salva modelli su volume persistente              │
│  - Genera predizioni per i prossimi 14 giorni       │
│  - Salva in tabella ai_predictions                  │
├─────────────────────────────────────────────────────┤
│  INCREMENTAL UPDATE — ogni notte, 03:00             │
│  - Non riaddestra i modelli                         │
│  - Aggiorna le predizioni con ultimi 7 giorni reali │
│  - Refresh ai_predictions per i prossimi 7 giorni  │
└─────────────────────────────────────────────────────┘
```

### Gestione modelli per organizzazione

Ogni organizzazione ha modelli distinti per tipo di servizio:

```
model_store/
├── org_{uuid}/
│   ├── demand_dialisi_prophet.pkl
│   ├── demand_dialisi_xgb.pkl
│   ├── demand_dimissioni_prophet.pkl
│   ├── demand_dimissioni_xgb.pkl
│   ├── demand_visite_prophet.pkl
│   └── metadata.json              # versione, data training, MAE validazione
```

---

## Metriche di Accuratezza

### Target

| Metrica | Target | Note |
|---|---|---|
| MAE | < 2 servizi/giorno | dopo 3 mesi dati, per org con 10+ servizi/giorno |
| MAPE | < 20% | su giorni non-festivi |
| MAE festività | < 4 servizi | i festivi sono intrinsecamente più rumorosi |
| Coverage 80% CI | > 78% | l'intervallo di confidenza deve essere calibrato |

### Valutazione su holdout set

```python
def evaluate_model(
    model: Prophet,
    df_test: pd.DataFrame,  # ultimi 30 giorni non usati nel training
    service_type: str
) -> dict:
    """
    Calcola metriche su holdout. Usa SEMPRE dati mai visti dal modello.
    """
    predictions = model.predict(df_test[["ds"]])
    y_true = df_test["y"].values
    y_pred = predictions["yhat"].clip(lower=0).values

    mae  = np.mean(np.abs(y_true - y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-6))) * 100
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))

    # Coverage dell'intervallo di confidenza
    in_interval = (
        (y_true >= predictions["yhat_lower"].values) &
        (y_true <= predictions["yhat_upper"].values)
    )
    coverage = in_interval.mean()

    return {
        "service_type": service_type,
        "mae": round(mae, 2),
        "mape": round(mape, 1),
        "rmse": round(rmse, 2),
        "ci_coverage_80pct": round(coverage, 3),
        "n_samples": len(y_true),
    }
```

---

## Minimum Data Requirements

| Dati disponibili | Comportamento modello | Azione consigliata |
|---|---|---|
| < 30 giorni | Non addestrare Prophet | Cold start (vedi sotto) |
| 30-90 giorni | Prophet possibile, no stagionalità annuale | Modello light, confidence bassa |
| 90-180 giorni | Stagionalità settimanale buona, annuale parziale | Modello standard |
| 180-365 giorni | Buona accuratezza, stagionalità annuale parziale | Modello completo |
| > 365 giorni | Accuratezza ottimale | Modello ensemble completo |

---

## Cold Start Strategy

Per organizzazioni nuove senza storico:

### Step 1: Benchmark di settore (mese 1-2)

Aggrega le statistiche anonimizzate per:
- Tipo organizzazione (CRI, Misericordia, cooperativa privata, etc.)
- Regione geografica
- Numero di mezzi attivi

```sql
-- Media servizi per tipo da org simili (stessa regione, stessa dimensione)
SELECT
  service_type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_count) AS median_daily,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_count) AS p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_count) AS p75
FROM (
  SELECT service_type, COUNT(*) / 30.0 AS daily_count, organization_id
  FROM trips
  WHERE DATE(start_time) >= NOW() - INTERVAL '90 days'
  GROUP BY service_type, organization_id
) sub
JOIN organizations o ON o.id = sub.organization_id
WHERE o.region = $1
  AND o.fleet_size BETWEEN $2 * 0.5 AND $2 * 1.5
GROUP BY service_type;
```

### Step 2: Attivazione modello personale (mese 3+)

Dopo 90 giorni di dati reali, addestra il modello Prophet dell'organizzazione. Mostra nella UI:

```json
{
  "model_status": "active",
  "data_since": "2025-12-01",
  "accuracy": {"mae": 2.1, "mape": 18.5},
  "message": "Modello calibrato su 94 giorni di dati storici"
}
```

---

## Output API

```typescript
// GET /api/ai/demand?org={id}&from=2026-04-01&to=2026-04-07
interface DemandForecastResponse {
  organization_id: string;
  generated_at: string;       // ISO timestamp
  model_version: string;
  forecast: DayForecast[];
}

interface DayForecast {
  date: string;               // "2026-04-01"
  day_of_week: string;        // "Lunedì"
  total_predicted: number;    // 19
  confidence_low: number;     // 15
  confidence_high: number;    // 23
  by_type: {
    [service_type: string]: {
      predicted: number;
      confidence_low: number;
      confidence_high: number;
    }
  };
  vehicles_needed: number;    // stima mezzi necessari
  warnings: string[];         // es. ["Festività: Pasquetta — atteso -30%"]
}
```

### Esempio output reale

```json
{
  "date": "2026-04-06",
  "day_of_week": "Lunedì",
  "total_predicted": 11,
  "confidence_low": 7,
  "confidence_high": 15,
  "by_type": {
    "dialisi": {"predicted": 7, "confidence_low": 5, "confidence_high": 9},
    "dimissioni": {"predicted": 3, "confidence_low": 1, "confidence_high": 5},
    "visite": {"predicted": 1, "confidence_low": 0, "confidence_high": 3}
  },
  "vehicles_needed": 4,
  "warnings": ["Pasquetta: previsto -35% rispetto a lunedì normale"]
}
```

---

## Note Implementative

### Parallelismo training

Per 100 organizzazioni con 3-5 tipi di servizio ciascuna, sono potenzialmente 300-500 modelli. Usare `multiprocessing.Pool` per parallelizzare il training:

```python
from multiprocessing import Pool

def retrain_all_organizations(org_ids: list[str], n_workers: int = 4) -> None:
    with Pool(n_workers) as pool:
        pool.map(retrain_single_org, org_ids)
```

Tempo stimato: 2-5 minuti per 100 org su 4 worker (sufficiente per finestra notturna).

### Gestione eccezioni nel training

Se il training fallisce per una org (es. dati insufficienti, outlier anomali):
1. Log dell'errore con contesto (org_id, service_type, n_samples)
2. Mantieni il modello precedente (non sovrascrivere con modello rotto)
3. Setta `model_status = "degraded"` in metadata.json
4. La UI mostra "Aggiornamento previsioni non disponibile — utilizzo dati precedenti"
