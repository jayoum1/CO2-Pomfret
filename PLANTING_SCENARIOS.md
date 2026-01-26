# Planting Scenarios Feature

## Overview

The "Plant a Group of Trees" scenario builder allows users to simulate the impact of planting new trees on forest carbon sequestration. This is the main **school benefit feature** that enables comparison between baseline forest and forest with new plantings.

## Architecture

### Backend Module: `src/scenarios/planting.py`

**Core Functions:**

1. **`generate_planting_trees()`**
   - Generates a DataFrame of new trees with columns: `TreeID`, `Plot`, `Species`, `DBH_cm`, `years_ahead=0`
   - Supports two modes:
     - **Recipe mode**: Species proportions + total count + plot + initial DBH
     - **Explicit mode**: List of individual trees with species, plot, DBH

2. **`simulate_planting_scenario()`**
   - Combines baseline forest with new planting trees
   - Simulates both baseline and combined forest using epsilon simulation mode
   - Returns snapshots at multiple time horizons (0/5/10/20 years)

3. **`compare_scenarios()`**
   - Compares baseline vs. planting scenario results
   - Returns comparison metrics: total carbon, mean DBH, carbon added, tree counts

4. **`save_scenario()` / `load_scenario()`**
   - Save/load scenario configurations as JSON files

### API Endpoints: `src/api/app.py`

**Planting Scenario Endpoints:**

- `POST /scenarios/planting/recipe` - Create recipe-based scenario
- `POST /scenarios/planting/explicit` - Create explicit tree list scenario
- `GET /scenarios/presets` - List available preset scenarios
- `GET /scenarios/presets/{filename}` - Get preset scenario details
- `POST /scenarios/presets/{filename}/simulate` - Simulate preset scenario
- `POST /scenarios/save` - Save custom scenario

**Single Tree Predictor (kept for compatibility):**

- `POST /predict/tree` - Predict next-year DBH and carbon for single tree

**Snapshot Endpoints (for time slider):**

- `GET /snapshots/years` - Get available snapshot years
- `GET /snapshots?years_ahead=X` - Get snapshot data
- `GET /summary?years_ahead=X` - Get summary metrics

### Frontend: `app/streamlit_app.py`

**Three Main Pages:**

1. **Time Slider**: View forest snapshots at different horizons
2. **Single Tree Predictor**: Predict individual tree growth (original feature)
3. **Planting Scenarios**: Main feature with three modes:
   - Recipe Mode: Specify proportions and total count
   - Explicit Mode: Add trees individually
   - Preset Scenarios: Use predefined scenarios

## Preset Scenarios

Located in `Data/Scenarios/`:

1. **`native_mix.json`**
   - Native species mix reflecting Pomfret forest composition
   - 100 trees, Middle plot, 5.0 cm initial DBH
   - Species: red oak (25%), sugar maple (25%), white oak (15%), etc.

2. **`fast_sequestration.json`**
   - Fast-growing species optimized for carbon sequestration
   - 100 trees, Upper plot, 5.0 cm initial DBH
   - Species: white pine (40%), red oak (30%), sugar maple (20%), tulip poplar (10%)

3. **`biodiversity_mix.json`**
   - Diverse species mix to enhance forest biodiversity
   - 100 trees, Lower plot, 5.0 cm initial DBH
   - 10 different species with balanced proportions

## Usage

### Running the App

1. **Start FastAPI Backend:**
```bash
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

2. **Start Streamlit Frontend:**
```bash
streamlit run app/streamlit_app.py
```

### Creating a Recipe Scenario

**Via API:**
```python
import requests

response = requests.post("http://localhost:8000/scenarios/planting/recipe", json={
    "total_count": 100,
    "species_proportions": {
        "red oak": 0.5,
        "sugar maple": 0.5
    },
    "plot": "Upper",
    "initial_dbh_cm": 5.0,
    "years_list": [0, 5, 10, 20]
})
```

**Via Python Module:**
```python
from src.scenarios.planting import generate_planting_trees, simulate_planting_scenario, compare_scenarios

# Generate trees
trees = generate_planting_trees(
    mode="recipe",
    total_count=100,
    species_proportions={"red oak": 0.5, "sugar maple": 0.5},
    plot="Upper",
    initial_dbh_cm=5.0
)

# Simulate
results = simulate_planting_scenario(trees, years_list=[0, 5, 10, 20])

# Compare
comparison = compare_scenarios(results)
print(comparison)
```

### Creating an Explicit Scenario

```python
trees = generate_planting_trees(
    mode="explicit",
    explicit_trees=[
        {"species": "red oak", "plot": "Upper", "dbh_cm": 5.0},
        {"species": "sugar maple", "plot": "Middle", "dbh_cm": 4.5}
    ]
)
```

## Comparison Metrics

The comparison function returns a DataFrame with columns:

- `years_ahead`: Time horizon (0, 5, 10, 20)
- `baseline_total_carbon`: Total carbon in baseline forest (kg C)
- `with_planting_total_carbon`: Total carbon with new trees (kg C)
- `carbon_added`: Carbon added by new trees only (kg C)
- `baseline_mean_dbh`: Mean DBH in baseline forest (cm)
- `with_planting_mean_dbh`: Mean DBH with new trees (cm)
- `planting_only_mean_dbh`: Mean DBH of planted trees only (cm)
- `baseline_num_trees`: Number of trees in baseline
- `with_planting_num_trees`: Total number of trees with planting
- `planting_num_trees`: Number of planted trees

## Simulation Details

- **Simulation Mode**: Epsilon mode (no shrinkage; negative deltas → 0.02 cm growth)
- **Model**: Neural Network state model (predicts next-year DBH)
- **No Mortality**: Growth-only baseline (no tree death modeled)
- **Units**: DBH in cm, Carbon in kg C

## File Structure

```
CO2 Pomfret/
├── src/
│   ├── scenarios/
│   │   ├── __init__.py
│   │   └── planting.py          # Core planting scenario functions
│   └── api/
│       └── app.py                # FastAPI endpoints
├── app/
│   ├── streamlit_app.py         # Streamlit frontend
│   └── README.md                 # App documentation
└── Data/
    └── Scenarios/                # Preset scenario JSON files
        ├── native_mix.json
        ├── fast_sequestration.json
        └── biodiversity_mix.json
```

## Future Enhancements

- Save/load custom scenarios from UI
- Export comparison results to CSV/PDF
- 3D visualization of planting locations
- Multi-plot planting scenarios
- Cost-benefit analysis (tree cost vs. carbon value)
