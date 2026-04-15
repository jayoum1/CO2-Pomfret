# CO₂ Pomfret Forest — Full Project Context Summary

> Generated April 15, 2026 to help onboard a new agent chat.  
> Read this file to understand the project structure, what has been built, and current state.

---

## 1. Project Overview

This is a **forest carbon modeling and visualization** project for the **Pomfret forest** in Vermont. It combines:

- **Python backend** — DBH growth models (baseline, stochastic, hybrid, neural net), carbon allometry, forest-wide snapshot generation, planting scenario simulation, area scaling.
- **Next.js frontend** — Dashboard, interactive Vector Forest visualization with 442 real trees, planting scenario builder, area scaling calculator, invasive species mapping.
- **FastAPI REST API** — Bridges the Python models to the Next.js frontend.

---

## 2. Directory Structure

```
Carbon DBH/
├── src/                    # Python backend (models, API, preprocessing, etc.)
│   ├── api/
│   │   ├── app.py          # FastAPI application (all endpoints)
│   │   └── encoding.py     # Feature encoding for model inputs
│   ├── models/
│   │   ├── baseline_simulation.py    # Baseline DBH growth (deterministic + stochastic)
│   │   ├── baseline_growth_curve.py  # Fitted constrained baseline growth curves
│   │   ├── dbh_growth_model.py       # XGBoost regression for next-year DBH
│   │   ├── dbh_growth_nn.py          # Neural net alternative DBH predictor
│   │   ├── dbh_increment_model.py    # Annual DBH increment model
│   │   ├── dbh_residual_model.py     # XGBoost residual model for hybrid approach
│   │   ├── forest_metrics.py         # Carbon/CO₂e from DBH via allometry
│   │   ├── forest_simulation.py      # Single-tree multi-year trajectories
│   │   ├── forest_snapshots.py       # Forest-wide XGBoost snapshot generation
│   │   ├── forest_snapshots_nn.py    # Forest-wide NN snapshot generation
│   │   ├── area_scaling.py           # Plot area densities and scaling
│   │   ├── removal_options.py        # DBH binning for removal/planting UI
│   │   └── uncertainty.py            # DBH uncertainty propagation
│   ├── scenarios/
│   │   └── planting.py       # Planting scenario generation and simulation
│   ├── config.py             # Central paths, constants (allometry, CO₂e factor)
│   ├── preprocessing/        # Data cleaning and preparation
│   ├── diagnostics/          # Model diagnostics and validation
│   └── visualization/        # Python plot generation
│
├── web/                      # Next.js 14 frontend (co2-pomfret-web)
│   ├── src/app/
│   │   ├── page.tsx              # Dashboard (/) — summary cards, metrics
│   │   ├── vector-forest/page.tsx  # Vector Forest — real tree visualization
│   │   ├── scenarios/page.tsx      # Planting scenario builder
│   │   ├── area/page.tsx           # Area scaling calculator with map
│   │   ├── visualize/page.tsx      # Invasive species spread visualization
│   │   ├── visualizations/page.tsx # Static chart gallery
│   │   ├── about/page.tsx          # About page
│   │   └── layout.tsx              # Root layout with AppShell sidebar
│   ├── src/components/
│   │   ├── vector-forest/          # 17 files: scene, trees, inspector, scenarios
│   │   │   ├── VectorForestScene.tsx     # Main SVG forest scene (pan, zoom, trees)
│   │   │   ├── TreeSVG.tsx               # Individual tree SVG rendering
│   │   │   ├── TreeInspectorPanel.tsx    # Side panel: tree data display
│   │   │   ├── TreeSpeciesImages.tsx     # Species photo display in inspector
│   │   │   ├── RegrowthInspectorPanel.tsx # Post-disturbance sapling inspector
│   │   │   ├── ScenarioCarousel.tsx      # Scenario selector overlay
│   │   │   └── aftermath/               # Post-disturbance visual elements
│   │   │       ├── AftermathLayer.tsx
│   │   │       ├── BurntGroundPatch.tsx, CharredStump.tsx, DebrisBranch.tsx
│   │   │       ├── FallenLog.tsx, MudPatch.tsx, ReedCluster.tsx
│   │   │       ├── Sapling.tsx, WaterPool.tsx
│   │   ├── layout/AppShell.tsx, Sidebar.tsx
│   │   ├── area/MapContent.tsx, MapDrawer.tsx
│   │   ├── visualize/InvasiveMap.tsx
│   │   └── ui/ (Radix-based primitives)
│   ├── src/lib/
│   │   ├── api.ts                    # Typed fetch client for FastAPI backend
│   │   ├── utils.ts                  # General utilities
│   │   ├── vectorForest/
│   │   │   ├── treeModel.ts          # TreeInstance type + getTreeState()
│   │   │   ├── visualMapping.ts      # TreeState → visual SVG params
│   │   │   ├── scenarios.ts          # Disturbance scenario logic (fire, flood, etc.)
│   │   │   ├── scenarioCatalog.ts    # Scenario definitions + carousel ordering
│   │   │   └── treeSpeciesImages.ts  # Species → image path mapping
│   │   ├── geo/                      # Plot boundary GeoJSON helpers
│   │   └── sim/                      # Invasive spread simulation
│   ├── public/
│   │   ├── tree-species/             # Tree photos (7 species have images)
│   │   └── disturbances/             # Scenario images (placeholder PNGs)
│   └── package.json                  # Next 14, React 18, Tailwind, Radix, Leaflet, Recharts
│
├── Data/
│   ├── Raw Data/                     # Original CSVs per plot (Upper, Middle, Lower)
│   ├── Processed Data/
│   │   ├── DBH/                      # Long-format DBH time series with growth
│   │   ├── Carbon/                   # Carbon-enriched CSVs per plot + combined
│   │   ├── forest_snapshots_baseline/          # Deterministic baseline (years 0,5,10,20)
│   │   ├── forest_snapshots_baseline_stochastic/ # Stochastic baseline (years 0,5,10,20)
│   │   ├── forest_snapshots_hybrid/            # Hybrid model (years 0-20, every year)
│   │   ├── forest_snapshots_nn_epsilon/        # NN epsilon variant
│   │   └── diagnostics/                        # Validation CSVs, JSON summaries
│   ├── Metadata/                     # plot_areas.json
│   └── Scenarios/                    # Preset planting scenario JSONs
│
├── Models/                           # Trained model artifacts
│   ├── dbh_growth_nn_model.pkl       # Neural net growth model
│   ├── dbh_growth_nn_scaler.pkl      # NN feature scaler
│   ├── dbh_residual_model.pkl        # XGBoost residual model
│   ├── baseline_growth_metadata.json # Baseline curve metadata
│   └── (feature lists, CV results, SHAP values, diagnostic PNGs)
│
├── docs/                             # Documentation
├── Graphs/                           # Generated analysis figures
└── .cursorrules                      # Cursor AI rules (English, PEP 8, project layout)
```

---

## 3. Key Backend API Endpoints (`src/api/app.py`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/predict/tree` | POST | Single tree next-year DBH + carbon prediction |
| `/summary` | GET | Summary metrics for a snapshot year (any mode) |
| `/snapshots/years` | GET | Available snapshot years |
| `/snapshots` | GET | Raw snapshot data for a year |
| `/scenario/simulate` | POST | Planting scenario simulation with comparison |
| `/scenarios/planting/recipe` | POST | Recipe-based planting scenario |
| `/scenarios/planting/explicit` | POST | Explicit tree list planting scenario |
| `/scenarios/presets` | GET | List preset scenarios |
| `/area/plot-areas` | GET | Plot area configuration |
| `/area/densities` | GET | Carbon densities by plot |
| `/area/scale` | POST | Scale carbon to target area |
| `/removal/options` | GET | Removal bin options per plot/species |
| `/planting/dbh-bins` | GET | Planting DBH bin definitions |
| `/uncertainty/summary` | GET | Model uncertainty metrics |
| **`/vector-forest/snapshot`** | **GET** | **Tree-level data for Vector Forest (see §4)** |

---

## 4. Vector Forest — Current Implementation Details

### Data flow

1. **Backend** (`GET /vector-forest/snapshot?years_ahead=N&plot=all|Upper|Middle|Lower`)
   - Uses **baseline_stochastic** model (`Data/Processed Data/forest_snapshots_baseline_stochastic/`)
   - Available keyframe CSVs: **years 0, 5, 10, 20** (format: `forest_{N}_years.csv`)
   - For in-between years (1-4, 6-9, 11-19): **linear interpolation** on DBH and carbon between surrounding keyframes
   - Returns: `tree_id`, `plot`, `species`, `dbh_cm`, `carbon_kgC` per tree
   - TreeID parsing handles edge cases like `"416 (was 683)"` — extracts leading number

2. **Frontend** (`web/src/app/vector-forest/page.tsx`)
   - Fetches snapshot on every `year` (0-20) and `plotFilter` change
   - Converts backend trees to `TreeInstance` objects with **stratified grid positioning**:
     - Uses **splitmix32 PRNG** seeded from tree ID for truly independent random values
     - Trees placed in a **stratified grid** (sqrt(N×1.5) columns) — each cell gets one tree, jittered within 70% of cell area
     - Prevents clustering while ensuring even coverage
   - Tree positions are **deterministic** and **stable** (same seed = same position regardless of year)

3. **Scene** (`VectorForestScene.tsx`)
   - Scene is **4× wide, 3× tall** relative to the viewport container
   - Trees placed across full scene area; user **pans** to explore (drag-to-pan)
   - `depth` (0→1) controls: scale (0.45→1.15), vertical position, z-index, opacity
   - Background gradient extends to `1200%×800%` for seamless panning
   - Pan extent: 3× container in each direction

4. **Inspector** (`TreeInspectorPanel.tsx`)
   - Shows: Tree ID, Plot, Species, Year, DBH, Carbon, CO₂e, Health, Status
   - Species images for 7 species (see §5)
   - Compact layout, no redundant text, `overflow-y-auto`

5. **Scenarios** (presentation-only disturbances, not model-backed)
   - Carousel: Baseline, Emerald Ash Borer, Tornado, Flood, Fire
   - Visual overlays per scenario (fire glow, flood water, tornado wind streaks)
   - Aftermath layer with procedural elements (stumps, logs, saplings, etc.)
   - Trees die/fall based on scenario logic; regrowth saplings spawn afterward

### Data pipeline fix (important)

The inspector panel now looks up the **current** tree from the latest fetched `trees` array when computing measurements (not the stale object captured at click time). This means sliding the year slider correctly updates DBH, carbon, and CO₂e in the inspector.

---

## 5. Species Image Status

**7 species have images** in `web/public/tree-species/`:
- Beech, Mockernut Hickory, Red Maple, Red Oak, Shagbark Hickory, Sugar Maple, White Pine

**15 species are missing images** (tracked in `docs/vector-forest-tree-species-missing-images.md`):
- american hophornbeam, autumn olive, basswood, black birch, black oak, buckthorn, burning bush, dogwood, hophornbeam, musclewood, norway maple, pignut hickory, sassafras, white ash, yellow birch

The mapping chain: CSV `Species` string → `SPECIES_IMAGE_MAP` in `page.tsx` → `TreeSpeciesKey` → `TREE_SPECIES_IMAGE_PATHS` in `treeSpeciesImages.ts` → `public/tree-species/<folder>/`

---

## 6. CSV Format Reference

**Baseline stochastic snapshot** (`forest_N_years.csv`):
```
TreeID,Plot,Species,DBH_cm,carbon_at_time,years_ahead
1,Upper,sugar maple,27.432,152.424,0
```

**442 trees** across 3 plots (Upper, Middle, Lower), **23 species**.

---

## 7. Running the App

```bash
# Backend (from project root)
cd src && uvicorn api.app:app --reload --host 127.0.0.1 --port 8000

# Frontend (separate terminal)
cd web && npm run dev
# → http://localhost:3000
# → http://localhost:3000/vector-forest
```

The frontend expects the backend at `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://127.0.0.1:8000`).

---

## 8. Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, Uvicorn, Pandas, NumPy, XGBoost, PyTorch (NN model) |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS 3 |
| UI | Radix UI primitives, Lucide icons, Recharts |
| Maps | Leaflet + react-leaflet, Turf.js |
| Models | XGBoost (DBH growth, residuals), feedforward NN (DBH), baseline growth curves |

---

## 9. Git Status

- **Branch:** `main` (tracks `school/main`)
- **Working tree:** Clean
- **Recent commits:** unclustering_vf → expanded_forest_pipeline → data_pipeline → disturbance_cleanup → regrowth_simulation → post-disturbance_update → vectorforest_post-disturbance_redirection → readme_update_spring → infinite_re-render_loop_fix → z-index_fix

---

## 10. Cursor Rules (`.cursorrules`)

- Always respond in English
- snake_case for Python, PEP 8
- Data files in `Data/`, scripts in `src/`, models in `Models/`, plots in `plots/`
