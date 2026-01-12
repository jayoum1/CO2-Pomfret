# Forest Simulation App

Streamlit frontend for the Pomfret Forest Growth & Carbon Simulation project.

## Features

- **Time Slider**: View forest snapshots at different time horizons (0/5/10/20 years)
- **Single Tree Predictor**: Predict next-year DBH and carbon for individual trees
- **Planting Scenarios**: Main school impact feature - compare baseline vs. planting scenarios

## Quick Start

### 1. Start the FastAPI Backend

```bash
# From project root
python3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 2. Start the Streamlit Frontend

```bash
# From project root
streamlit run app/streamlit_app.py
```

The app will open in your browser at `http://localhost:8501`

## Requirements

Install dependencies:

```bash
pip install -r requirements.txt
pip install fastapi uvicorn streamlit requests plotly
```

## API Endpoints

The FastAPI backend provides:

- `POST /predict/tree` - Single tree prediction
- `POST /scenarios/planting/recipe` - Recipe-based planting scenario
- `POST /scenarios/planting/explicit` - Explicit tree list scenario
- `GET /scenarios/presets` - List preset scenarios
- `GET /scenarios/presets/{filename}/simulate` - Simulate preset scenario
- `GET /snapshots` - Get forest snapshot for a year
- `GET /summary` - Get summary metrics for a year

## Preset Scenarios

Preset scenarios are stored in `Data/Scenarios/`:

- `native_mix.json` - Native species mix reflecting Pomfret forest
- `fast_sequestration.json` - Fast-growing species for carbon sequestration
- `biodiversity_mix.json` - Diverse species mix for biodiversity

## Usage

### Single Tree Predictor

1. Enter current DBH (cm)
2. Select plot (Upper/Middle/Lower)
3. Enter species name (optional)
4. Click "Predict" to see next-year DBH and carbon metrics

### Planting Scenarios

**Recipe Mode:**
- Specify total number of trees
- Set species proportions (must sum to 1.0)
- Choose plot and initial DBH
- Select years to simulate

**Explicit Mode:**
- Add trees one by one with individual species, plot, and DBH

**Preset Scenarios:**
- Select from predefined scenarios
- Customize years to simulate
- View comparison results

## Simulation Details

- Uses epsilon simulation mode (no shrinkage; negative deltas → 0.02 cm growth)
- No mortality modeled (growth-only baseline)
- DBH in cm, Carbon in kg C
