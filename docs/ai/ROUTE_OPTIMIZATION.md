# Route Optimization — Ottimizzazione Routing Servizi (VRP)

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Algoritmo:** OR-Tools VRP + OSRM per tempi reali

---

## Obiettivo

Assegnare i servizi di una giornata ai mezzi disponibili in modo da minimizzare:
- Km totali percorsi dalla flotta
- Tempi morti tra servizi consecutivi
- Ore di straordinario degli equipaggi

Rispettando i vincoli:
- Finestre temporali dei servizi (il paziente deve essere preso alle 08:00 ± 15min)
- Tipo mezzo richiesto (ambulanza barellata, furgone, auto)
- Competenze equipaggio (BLS, ALS, MSB)
- Durata turno degli operatori

**Output target:**
> "Riorganizzando i 14 servizi di domani si risparmiano 47 km e 1h 40min — proposta di assegnazione ottimale generata"

---

## Definizione del Problema: Vehicle Routing Problem (VRP)

Il VRP è NP-hard nella versione generale. La variante applicabile a SD è **VRPTW** (VRP with Time Windows) con:

- **n veicoli** eterogenei (tipi diversi, capacità diverse)
- **m servizi** con orari fissi (time windows)
- **Vincoli di compatibilità** veicolo-servizio
- **Depot multipli** (sedi diverse dell'organizzazione)
- **Pickup & Delivery** (origine ≠ destinazione)

### Formulazione matematica (semplificata)

```
Minimizza: Σ (distanza_tratta_ij × x_ij) + α × Σ (tempo_morto_k)

Soggetto a:
  - Ogni servizio è assegnato esattamente a 1 veicolo
  - Ogni veicolo rispetta la finestra temporale del servizio
  - Tipo veicolo compatibile con tipo servizio
  - Equipaggio in turno nel periodo richiesto
  - Durata totale turno ≤ max_shift_hours

dove x_ij = 1 se il veicolo va da i a j
     α = peso penalità tempi morti (default 0.3)
```

---

## Soluzione: Google OR-Tools

OR-Tools è la libreria open-source di Google per ottimizzazione combinatoriale. Il modulo `routing` implementa VRP con vincoli arbitrari.

### Perché OR-Tools

| Criterio | OR-Tools | Soluzione greedy | Libreria commerciale |
|---|---|---|---|
| Qualità soluzione | Alta (near-optimal) | Media | Alta |
| Costo | Gratuito | Gratuito | $500-5000/mese |
| Vincoli complessi | ✅ nativo | Difficile | ✅ nativo |
| Tempo soluzione (20 servizi) | < 2s | < 0.1s | < 1s |
| Tempo soluzione (100 servizi) | < 30s | < 1s | < 10s |

### Limiti OR-Tools

- Per > 500 servizi in un batch, il tempo di ottimizzazione può superare i 5 minuti → usare finestre temporali più strette o partizionare per sede
- La soluzione trovata è "near-optimal" (non garantisce il minimo assoluto per VRP generale)
- Richiede la matrice delle distanze pre-calcolata

---

## Integrazione con OSRM per Tempi Reali

### Perché OSRM invece di calcolo diretto

La distanza euclidea (volo d'uccello) sottostima il tempo reale di percorrenza del 30-60% in aree urbane. OSRM calcola tempi di percorrenza realistici basati su:
- Rete stradale OpenStreetMap
- Velocità medie stradali
- Sensi unici, zone a traffico limitato

### Self-hosted OSRM vs OSRM API pubblica

**Raccomandazione: self-hosted su Railway**

```bash
# Dockerfile per OSRM Italy
FROM osrm/osrm-backend

# Scarica Italia (~2GB)
RUN wget http://download.geofabrik.de/europe/italy-latest.osm.pbf

# Pre-elaborazione (richiede ~8GB RAM, fare una volta sola)
RUN osrm-extract -p /opt/car.lua italy-latest.osm.pbf
RUN osrm-partition italy-latest.osrm
RUN osrm-customize italy-latest.osrm

CMD ["osrm-routed", "--algorithm", "mld", "italy-latest.osrm"]
```

Costo aggiuntivo Railway: ~$15-20/mese per il servizio OSRM con 1GB RAM.

Alternativa gratuita: **OpenRouteService** (ORS) — API pubblica, 500 richieste/giorno free tier, poi $0.003/richiesta.

### Calcolo matrice distanze

```python
import requests
import numpy as np

def build_time_matrix(
    locations: list[tuple[float, float]],  # lista (lat, lon)
    osrm_url: str = "http://osrm-service:5000"
) -> np.ndarray:
    """
    Calcola matrice n×n dei tempi di percorrenza (secondi) via OSRM.
    OSRM Table API: calcola tutte le coppie in una sola richiesta.

    Per 50 locations: 50×50 = 2500 coppie, ~200ms
    """
    coords_str = ";".join(f"{lon},{lat}" for lat, lon in locations)
    url = f"{osrm_url}/table/v1/driving/{coords_str}"
    params = {"annotations": "duration"}

    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()

    data = resp.json()
    return np.array(data["durations"])  # secondi, matrice n×n
```

---

## Implementazione OR-Tools VRP

```python
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import numpy as np
from dataclasses import dataclass

@dataclass
class Service:
    id: str
    pickup_location: tuple[float, float]   # (lat, lon)
    delivery_location: tuple[float, float]
    time_window_start: int   # minuti da mezzanotte
    time_window_end: int     # minuti da mezzanotte
    service_duration: int    # minuti stimati servizio
    required_vehicle_type: str  # "ambulanza", "furgone", "auto"
    required_skills: list[str]  # es. ["BLS"]

@dataclass
class Vehicle:
    id: str
    depot_location: tuple[float, float]
    vehicle_type: str
    crew_skills: list[str]
    shift_start: int   # minuti da mezzanotte
    shift_end: int     # minuti da mezzanotte

def solve_vrp(
    services: list[Service],
    vehicles: list[Vehicle],
    time_matrix: np.ndarray,  # matrice tempi in minuti
    time_limit_seconds: int = 30
) -> dict:
    """
    Risolve il VRP con finestre temporali.

    Returns:
        dict con assegnazioni ottimali e statistiche
    """
    n_locations = time_matrix.shape[0]
    n_vehicles = len(vehicles)

    # Crea il manager di routing
    manager = pywrapcp.RoutingIndexManager(
        n_locations,
        n_vehicles,
        [v.depot_idx for v in vehicles],  # depot di partenza
        [v.depot_idx for v in vehicles],  # depot di ritorno
    )
    routing = pywrapcp.RoutingModel(manager)

    # Callback tempo di percorrenza
    def time_callback(from_idx, to_idx):
        from_node = manager.IndexToNode(from_idx)
        to_node = manager.IndexToNode(to_idx)
        return int(time_matrix[from_node][to_node])

    transit_callback_idx = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_idx)

    # Dimensione temporale con finestre e durata servizio
    routing.AddDimension(
        transit_callback_idx,
        slack_max=60,           # slack massimo (minuti) per anticipo
        capacity=480,           # max durata turno (8 ore)
        fix_start_cumul_to_zero=False,
        name="Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    # Applica finestre temporali ai servizi
    for service_idx, service in enumerate(services):
        index = manager.NodeToIndex(service_idx + n_vehicles)  # offset depot
        time_dimension.CumulVar(index).SetRange(
            service.time_window_start,
            service.time_window_end
        )

    # Applica finestre turno ai veicoli
    for v_idx, vehicle in enumerate(vehicles):
        start_index = routing.Start(v_idx)
        end_index = routing.End(v_idx)
        time_dimension.CumulVar(start_index).SetRange(vehicle.shift_start, vehicle.shift_end)
        time_dimension.CumulVar(end_index).SetRange(vehicle.shift_start, vehicle.shift_end)

    # Vincoli compatibilità veicolo-servizio
    for s_idx, service in enumerate(services):
        for v_idx, vehicle in enumerate(vehicles):
            if not _is_compatible(service, vehicle):
                routing.VehicleVar(manager.NodeToIndex(s_idx + n_vehicles)).RemoveValue(v_idx)

    # Strategia di ricerca iniziale + miglioramento locale
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_seconds
    search_params.log_search = False

    solution = routing.SolveWithParameters(search_params)

    if solution:
        return _extract_solution(routing, manager, solution, vehicles, services, time_matrix)
    else:
        return {"status": "infeasible", "routes": [], "savings": None}


def _is_compatible(service: Service, vehicle: Vehicle) -> bool:
    """Verifica compatibilità tipo mezzo e skills equipaggio."""
    if service.required_vehicle_type != vehicle.vehicle_type:
        if not (service.required_vehicle_type == "auto" and
                vehicle.vehicle_type in ["furgone", "ambulanza"]):
            return False
    for skill in service.required_skills:
        if skill not in vehicle.crew_skills:
            return False
    return True


def _extract_solution(routing, manager, solution, vehicles, services, time_matrix) -> dict:
    """Estrae e formatta la soluzione OR-Tools."""
    routes = []
    total_distance = 0
    total_idle_time = 0

    for v_idx in range(len(vehicles)):
        route = []
        index = routing.Start(v_idx)
        route_distance = 0
        prev_time = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(next_index)

            travel_time = time_matrix[node][next_node]
            route.append({
                "node": node,
                "arrival": solution.Min(routing.GetDimensionOrDie("Time").CumulVar(index)),
            })
            route_distance += travel_time
            index = next_index

        routes.append({
            "vehicle_id": vehicles[v_idx].id,
            "stops": route,
            "total_travel_minutes": route_distance,
        })
        total_distance += route_distance

    return {
        "status": "optimal",
        "routes": routes,
        "total_travel_minutes": total_distance,
        "objective_value": solution.ObjectiveValue(),
    }
```

---

## Pipeline Completa

```python
async def optimize_daily_routes(
    organization_id: str,
    target_date: date,
    db_session,
) -> OptimizationResult:
    """
    Pipeline completa di ottimizzazione giornaliera.
    Chiamata tipicamente la sera prima (18:00-21:00) per il giorno successivo.
    """

    # 1. Carica servizi non ancora assegnati
    services = await db_session.fetch_services_for_date(organization_id, target_date)
    vehicles = await db_session.fetch_available_vehicles(organization_id, target_date)

    if len(services) == 0:
        return OptimizationResult(status="no_services", savings=None)

    # 2. Costruisci lista locations (depot + pickup + delivery per ogni servizio)
    all_locations = build_location_list(vehicles, services)

    # 3. Calcola matrice tempi via OSRM
    time_matrix = await build_time_matrix_async(all_locations)

    # 4. Soluzione attuale (assegnazione manuale esistente, se presente)
    current_assignment = await db_session.fetch_current_assignments(organization_id, target_date)
    current_cost = compute_current_cost(current_assignment, time_matrix)

    # 5. Ottimizzazione VRP
    solution = solve_vrp(
        services=services,
        vehicles=vehicles,
        time_matrix=time_matrix,
        time_limit_seconds=30 if len(services) <= 50 else 120,
    )

    if solution["status"] != "optimal":
        return OptimizationResult(status="no_solution_found", savings=None)

    # 6. Calcola risparmio
    optimized_cost = solution["total_travel_minutes"]
    savings_pct = (current_cost - optimized_cost) / current_cost * 100 if current_cost > 0 else 0
    km_saved = (current_cost - optimized_cost) / 60 * AVG_SPEED_KMH  # stima km da minuti

    # 7. Salva proposta (NON applica automaticamente — richiede conferma coordinatore)
    await db_session.save_optimization_proposal(
        organization_id=organization_id,
        target_date=target_date,
        proposal=solution,
        savings_minutes=current_cost - optimized_cost,
        savings_km=km_saved,
        savings_pct=savings_pct,
    )

    return OptimizationResult(
        status="proposal_ready",
        routes=solution["routes"],
        savings=SavingsSummary(
            minutes=current_cost - optimized_cost,
            km=km_saved,
            pct=savings_pct,
        )
    )
```

---

## Workflow Coordinatore

**Importante:** L'ottimizzazione propone, il coordinatore decide.

```
18:00 — Sistema genera proposta ottimizzata per il giorno successivo
        ↓
18:30 — Notifica push al coordinatore: "Proposta ottimizzazione disponibile"
        ↓
Coordinatore vede: schema attuale vs schema ottimizzato
  - Km risparmiati: 47
  - Minuti risparmiati: 1h 40min
  - Servizi riassegnati: 5/14
        ↓
Coordinatore può:
  [Applica proposta] → sistema aggiorna tutte le assegnazioni
  [Applica parzialmente] → seleziona quali riassegnazioni accettare
  [Ignora] → mantiene assegnazioni manuali
        ↓
Equipaggi ricevono notifica push delle nuove assegnazioni
```

---

## KPI e Metriche

| KPI | Baseline (senza ottimizzazione) | Target ottimizzato |
|---|---|---|
| Km totali/giorno flotta | Misurato settimana 1 | -15% |
| Minuti morti tra servizi | Misurato settimana 1 | -20% |
| Servizi completati/mezzo/giorno | Baseline | +10% |
| Straordinari/settimana | Baseline | -15% |

### Come misurare il risparmio reale

```sql
-- Confronto km proposti vs km effettivi GPS
SELECT
  DATE(t.start_time) AS trip_date,
  SUM(t.distance_km) AS actual_km,
  SUM(p.proposed_km) AS proposed_km,
  SUM(t.distance_km) - SUM(p.proposed_km) AS delta_km
FROM trips t
JOIN optimization_proposals p ON p.trip_id = t.id AND p.applied = true
WHERE t.organization_id = $1
  AND DATE(t.start_time) >= $2
GROUP BY DATE(t.start_time)
ORDER BY trip_date;
```

---

## Limitazioni e Casistiche Non Coperte

1. **Servizi urgenti intraday** — il VRP è pianificato la sera prima. Per urgenze in giornata, servono euristiche di inserimento rapido (greedy insertion) con re-ottimizzazione parziale.

2. **Traffico real-time** — OSRM usa velocità medie storiche, non traffico live. Per integrazione con traffico real-time serve Google Maps Platform o HERE Traffic API (costo aggiuntivo).

3. **Multi-depot con preferenze** — se un equipaggio preferisce tornare al proprio deposito, OR-Tools lo supporta ma aumenta la complessità del modello.

4. **Servizi con più tappe** — es. "ritira paziente A, poi B, portali entrambi in ospedale". Modellato come PDPTW (Pickup and Delivery with Time Windows) — variante più complessa.
