# CO₂ Pomfret — Architecture handoff: data pipeline & Google Sheets → publish

This document describes the **current** repository architecture as of the time of writing, to support planning for a future **Google Sheets → FastAPI → (optional) static publish** workflow.  

**No implementation** is proposed here beyond naming likely insertion points.

---

## 1. Repo overview

### Top-level folders (relevant)

| Path | Role |
|------|------|
| `web/` | **Frontend**: Next.js 14 app (`co2-pomfret-web`). Source under `web/src/`. |
| `src/` | **Backend**: Python package (`api`, `models`, `scenarios`, `preprocessing`, etc.). FastAPI lives in `src/api/app.py`. |
| `Data/` | **Data**: raw CSVs, processed DBH/carbon long tables, generated forest snapshot CSVs, metadata, diagnostics JSON. |
| `Models/` | **Trained ML artifacts** (e.g. NN, residual XGBoost) and supporting CSV/JSON used by growth models. |
| `docs/` | Project documentation (including GitHub Pages / deployment notes). |
| `.github/workflows/` | CI (e.g. GitHub Actions for static export deploy). |
| `midterm_site/` | **Archived / legacy** static HTML (per `midterm_site/GITHUB_PAGES_SETUP.md`); the **live** showcase is now the Next.js `/midterm` route. |
| Root scripts | One-off generators (e.g. `generate_all_snapshots.py`, `generate_snapshots_0_20.py`) and training/diagnostic scripts — **not** started automatically with the API. |

**Frontend folder:** `web/`  
**Backend folder:** `src/` (run as a module path `src.api.app:app` per frontend error strings and typical `uvicorn` usage).

**Shared config / constants (backend):** `src/config.py` — central paths to `Data/` and `Models/`, allometry-related constants, `CO2E_FACTOR`.

---

## 2. Frontend architecture

### Framework and routing

- **Framework:** Next.js **14** (`web/package.json`: `"next": "^14.0.0"`), **React 18**.
- **Router:** **App Router** — pages are `web/src/app/**/page.tsx`.
- **Global layout:** `web/src/app/layout.tsx` wraps most routes in `AppShell`; the **`/midterm`** route is excluded inside `AppShell` (see below).

### Route map (actual routes)

| URL path | File | Purpose |
|----------|------|---------|
| `/` | `web/src/app/page.tsx` | **Forest Insights** — unified summaries + Recharts visualizations. |
| `/vector-forest` | `web/src/app/vector-forest/page.tsx` | Vector forest simulation UI + API-driven snapshots. |
| `/scenarios` | `web/src/app/scenarios/page.tsx` | **Forest Modification** — planting/removal UI; calls scenario APIs. |
| `/area` | `web/src/app/area/page.tsx` | Area generalization / scaling calculator + map. |
| `/visualize` | `web/src/app/visualize/page.tsx` | Invasive spread simulator (client-side sim + Leaflet). |
| `/about` | `web/src/app/about/page.tsx` | About + loads `/uncertainty/summary`. |
| `/midterm` | `web/src/app/midterm/page.tsx` | **Showcase / static-demo** page (no full `AppShell` in midterm-only export). |
| `/visualizations` | `web/src/app/visualizations/page.tsx` | **Server redirect** to `/` (`redirect('/')`). |

### Key components by feature area

**Summaries & charts (Forest Insights)**  
- Page: `web/src/app/page.tsx` — loads visualization bundle via `fetchVisualizationData` from `web/src/lib/visualizationData.ts`.  
- Chart components: `web/src/components/visualizations/*.tsx` (e.g. `CarbonTrendChart.tsx`, `CarbonByPlotChart.tsx`, …).  
- Controls: `web/src/components/visualizations/GraphSectionControls.tsx`.  
- Metrics: `web/src/components/visualizations/GraphMetricCards.tsx`.  
- Chart primitives: `web/src/components/ui/chart.tsx` (Recharts wrapper).

**Scenario simulation**  
- Page: `web/src/app/scenarios/page.tsx` (large single file).  
- API client: `simulateScenario()` → `POST /scenario/simulate` in `web/src/lib/api.ts`. Additional endpoints used from same file (removal options, planting bins, presets, etc.).

**Area / plot views**  
- Page: `web/src/app/area/page.tsx`.  
- Map: `web/src/components/area/MapDrawer.tsx`, `MapContent.tsx`.  
- API: `getPlotAreas`, `getAreaDensities`, `scaleArea` in `web/src/lib/api.ts` → `/area/*`.

**Vector forest**  
- Page: `web/src/app/vector-forest/page.tsx`.  
- Scene: `web/src/components/vector-forest/VectorForestScene.tsx` (+ tree SVG, inspector panels, scenario carousel).  
- Client model helpers: `web/src/lib/vectorForest/*` (`treeModel.ts`, `scenarios.ts`, `scenarioCatalog.ts`, …).

**Invasive visualize**  
- Page: `web/src/app/visualize/page.tsx`.  
- Map/sim: `web/src/components/visualize/InvasiveMap.tsx`, `web/src/lib/sim/*` — **does not depend on forest snapshot CSV pipeline** for core spread logic (geo boundaries in `web/src/lib/geo/`).

### Where data fetching happens

| Concern | Location | Notes |
|---------|----------|--------|
| Typed HTTP client | `web/src/lib/api.ts` | `fetchAPI()`, `getSummary`, `getVectorForestSnapshot`, `simulateScenario`, area/removal/planting helpers. |
| Visualization aggregation | `web/src/lib/visualizationData.ts` | `fetchVisualizationData()` orchestrates parallel `getSummary` + `getVectorForestSnapshot` for keyframe years. |
| Page-level `useEffect` | Various `page.tsx` files | e.g. Forest Insights, About, Area, Scenarios — call `api.ts` functions. |
| Midterm / offline | `web/src/lib/midtermStaticData.ts` | Imports bundled JSON from `web/public/midterm-data/*.json` (build-time bundle, no runtime `fetch` to those files — see file header comment). |

**Base URL:** `web/src/lib/api.ts`:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
```

### Runtime vs baked data

- **Full app (local):** Almost all forest metrics are **fetched at runtime** from FastAPI when the backend is reachable.
- **GitHub Pages / midterm demo:** Build sets `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` (via `web/next.config.js` when `GITHUB_ACTIONS=true`). Midterm logic uses **baked JSON** under `web/public/midterm-data/` (`snapshots.json`, `summaries.json`) per `web/src/lib/midtermStaticData.ts` and comments in `web/src/app/midterm/page.tsx`.
- **Next config:** `web/next.config.js` sets `output: 'export'` for **all** builds — i.e. the project is configured as a **static export** build. Full multi-route behavior is expected in `next dev`; production `next start` is not the primary documented path.

### Static export / GitHub Pages compatibility

- **Yes, partially:** CI builds a **midterm-only** tree via `web/scripts/build-midterm-github-pages.sh` with `MIDTERM_EXPORT_ONLY` / `NEXT_PUBLIC_EXPORT_MIDTERM_SITE` (`web/next.config.js`, `web/src/app/layout.tsx`).
- **Full app** on GitHub Pages would require all routes to work without SSR APIs; many routes **expect a live FastAPI** backend, so they are **not** inherently offline-safe without further data publishing (see §8).

### Admin / auth

- **None found** in the frontend for admin or authenticated roles (grep for `auth`, `admin`, `session`, `NextAuth` only hits unrelated `class-variance-authority` imports).
- Backend CORS is permissive: `allow_origins=["*"]` in `src/api/app.py` — **no API-key or JWT** in current code.

### Environment variables / config (frontend)

| Variable | Where set / used | Effect |
|----------|------------------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `web/src/lib/api.ts` | Overrides default `http://127.0.0.1:8000`. |
| `NEXT_PUBLIC_BASE_PATH` | `web/next.config.js` → `env` | Base path for GitHub Pages repo deployment. |
| `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` | `web/next.config.js`; read in `web/src/lib/midtermMode.ts` | Prefer static JSON / skip FastAPI for midterm paths when true. |
| `NEXT_PUBLIC_EXPORT_MIDTERM_SITE` | `web/next.config.js`; `web/src/app/layout.tsx` | Midterm-only export: no `AppShell`, different metadata. |
| `GITHUB_ACTIONS` | `web/next.config.js` | When `true`, enables `basePath` / `assetPrefix` for `/CO2-Pomfret`-style hosting. |

### Exact symbols — frontend data path

- `fetchVisualizationData(mode)` — `web/src/lib/visualizationData.ts`  
- `getSummary(yearsAhead, mode)` — `web/src/lib/api.ts` → `GET /summary`  
- `getVectorForestSnapshot(yearsAhead, plot)` — `web/src/lib/api.ts` → `GET /vector-forest/snapshot`  
- `simulateScenario(request)` — `web/src/lib/api.ts` → `POST /scenario/simulate`  
- `KEYFRAME_YEARS` — `[0, 5, 10, 20]` in `web/src/lib/visualizationData.ts` (must align with backend snapshot files for baseline modes).

---

## 3. Backend architecture

### Entrypoint

- **FastAPI app:** `app = FastAPI(...)` in `src/api/app.py`.  
- **Run:** typically `uvicorn src.api.app:app` from project root (or equivalent `PYTHONPATH`); frontend README/error text references `uvicorn src.api.app:app`.

### Structure (high level)

| Area | Location |
|------|----------|
| HTTP routes | `src/api/app.py` (single large module) |
| Pydantic request/response models | Defined inline in `src/api/app.py` (e.g. `TreePredictionRequest`, `ScenarioSimulateRequest`, `ScaleAreaRequest`, …) |
| Snapshot loading & caches | `src/api/app.py`: `_snapshot_cache`, `_summary_cache`, `load_snapshot()`, `get_snapshot_dir()` |
| Encoding / single-tree prediction helper | `src/api/encoding.py` |
| Planting scenario orchestration | `src/scenarios/planting.py` |
| Growth / simulation | `src/models/baseline_simulation.py`, `src/models/dbh_growth_model.py`, `src/models/dbh_growth_nn.py`, `src/models/forest_snapshots.py`, `src/models/forest_snapshots_nn.py`, … |
| Carbon from DBH | `src/models/forest_metrics.py` → `carbon_from_dbh()`; uses `forestry/allometry.py` (`dbh_to_carbon`) |
| Area scaling | `src/models/area_scaling.py` |
| Removal / binning | `src/models/removal_options.py` |
| Paths & constants | `src/config.py` |

### Endpoints (authoritative list from decorators)

All in `src/api/app.py`:

| Method | Path | Notes |
|--------|------|-------|
| POST | `/predict/tree` | Single-tree next-year style prediction via `api.encoding.predict_all_from_user_input` |
| POST | `/scenarios/planting/recipe` | Recipe planting |
| POST | `/scenarios/planting/explicit` | Explicit tree list planting |
| GET | `/scenarios/presets` | List JSON presets from `Data/Scenarios/` |
| GET | `/scenarios/presets/{filename}` | Load one preset |
| POST | `/scenarios/presets/{filename}/simulate` | Simulate preset |
| POST | `/scenarios/save` | Save scenario JSON |
| POST | `/scenario/simulate` | **Main UI** — `ScenarioSimulateRequest` — compares baseline vs planting cohort |
| GET | `/snapshots/years` | Returns `{ years: [0, 5, 10, 20] }` **hardcoded** |
| GET | `/snapshots` | Reads **only** `forest_snapshots_nn_epsilon` CSVs (`forest_nn_{N}_years.csv`) |
| GET | `/summary` | Uses `load_snapshot(years_ahead, mode)` — supports `baseline`, `baseline_stochastic`, `hybrid`, `nn_epsilon` (with legacy mapping — see `get_snapshot_dir`) |
| GET | `/area/plot-areas` | `load_plot_areas()` |
| GET | `/area/densities` | `compute_all_densities(mode)` |
| POST | `/area/scale` | `scale_to_area` / density pipeline |
| GET | `/removal/options` | Removal bin options |
| GET | `/removal/dbh-bins` | DBH bins |
| GET | `/planting/dbh-bins` | Planting bins |
| GET | `/uncertainty/summary` | Reads `Data/Processed Data/diagnostics/uncertainty_summary.json` |
| GET | `/` | API info |
| GET | `/vector-forest/snapshot` | Tree-level rows; uses **baseline_stochastic** keyframes + interpolation |
| GET | `/health` | Health check |

### Simulation / projection logic locations

- **Forward year-by-year cohort simulation** (planting): `simulate_cohort_forward()` and `POST /scenario/simulate` in `src/api/app.py` — uses `carbon_from_dbh` and mode-specific DBH step functions (`baseline`, `baseline_stochastic`, `hybrid`, NN fallback).
- **Forest-wide snapshot generation (offline scripts):**  
  - `src/models/forest_snapshots.py` — `generate_forest_snapshots()` (uses `load_base_forest_df()` from `CARBON_ALL_PLOTS`).  
  - `src/models/forest_snapshots_nn.py` — `generate_forest_snapshots()` for NN/hybrid variants (also used by root `generate_all_snapshots.py` / `generate_snapshots_0_20.py`).
- **Baseline stochastic / deterministic stepping:** `src/models/baseline_simulation.py` (`predict_dbh_next_year_sim`, `predict_delta_sim`, etc. — referenced from `app.py`).

### Where plot/tree data is loaded

- **Raw wide CSVs per plot:** `src/config.py`  
  - `RAW_DATA_UPPER`, `RAW_DATA_MIDDLE`, `RAW_DATA_LOWER` → `Data/Raw Data/CO2 Pomfret Raw Data - {Upper|Middle|Lower}.csv`
- **Transformed long DBH:** `src/preprocessing/transform.py` → `*_long_with_growth.csv` under `Data/Processed Data/DBH/`.
- **Carbon-augmented long:** `src/preprocessing/carbon_calc.py` → per-plot and `all_plots_with_carbon.csv`.
- **Simulation base table:** `load_base_forest_df()` in `src/models/forest_snapshots.py` reads `CARBON_ALL_PLOTS` (`all_plots_with_carbon.csv`).
- **Runtime API reads snapshot CSVs** from `Data/Processed Data/forest_snapshots_*` directories (see `get_snapshot_dir()` in `src/api/app.py`).

### Background jobs

- **No Celery/RQ/APScheduler** (or similar) was identified in this pass.  
- Snapshot generation and diagnostics are **batch scripts** run manually or in CI externally to the API process.  
- The API uses **in-process memory caches** only: `_snapshot_cache`, `_summary_cache` in `src/api/app.py`.

---

## 4. Data flow today

### End-to-end path (raw → UI)

1. **Raw inventory (wide format)**  
   - Files: `Data/Raw Data/CO2 Pomfret Raw Data - Upper.csv` (and Middle, Lower).  
   - Columns (example from Upper): `Tree ID Number, Tree Species, DBH - 2015, DBH - 2016, …` (year embedded in header).

2. **Wide → long DBH + growth features**  
   - `src/preprocessing/transform.py` — `transform_plot(path, plot_name)`  
   - Detects ID column (name contains `tree` + `id`), species column, and all columns with `dbh` + a **4-digit year** via regex `20\d{2}`.  
   - Melts to long format: `Plot`, `TreeID`, `Species`, `Year`, `DBH`, `GapYears`, `PrevDBH`, `GrowthRate`, `GrowthType`.  
   - CLI block writes `upper_long_with_growth.csv`, etc.

3. **Long DBH → carbon columns**  
   - `src/preprocessing/carbon_calc.py` — `add_carbon_and_carbon_growth()`  
   - Computes `DBH_cm`, `Group`, `Carbon`, `CO2e`, growth rates; writes `upper_with_carbon.csv`, …, **`all_plots_with_carbon.csv`**.

4. **Offline forest snapshot CSV generation**  
   - `src/models/forest_snapshots.py` / `forest_snapshots_nn.py` — read combined carbon dataset, simulate forward, write `forest_*_years.csv` under directories such as:  
     - `Data/Processed Data/forest_snapshots_baseline/`  
     - `Data/Processed Data/forest_snapshots_baseline_stochastic/`  
     - `Data/Processed Data/forest_snapshots_hybrid/`  
     - `Data/Processed Data/forest_snapshots_nn_epsilon/`  
   - **Baseline family** files: `forest_{n}_years.csv`.  
   - **Hybrid/NN family** files: `forest_nn_{n}_years.csv`.  
   - Root scripts like `generate_all_snapshots.py` target **NN epsilon** output directory.

5. **FastAPI runtime**  
   - `load_snapshot()` in `src/api/app.py` loads the appropriate CSV (cached in `_snapshot_cache`).  
   - `GET /summary` aggregates `carbon_at_time`, `DBH_cm`, plot breakdown (in-memory pandas).  
   - `GET /vector-forest/snapshot` uses **`baseline_stochastic`** keyframes `[0,5,10,20]` and **`_interpolated_snapshot()`** for intermediate integer years 1–19.  
   - `GET /snapshots` is a **separate code path** fixed to `forest_snapshots_nn_epsilon` (possible inconsistency with `/summary` if callers assume same mode).

6. **Frontend**  
   - Forest Insights: `fetchVisualizationData()` pulls summaries + vector-forest snapshots for keyframes.  
   - Vector Forest page: polls `getVectorForestSnapshot` on slider changes.

### Caching / storage

- **Disk:** authoritative processed data is **CSV / JSON files under `Data/`**.  
- **Memory:** API caches loaded DataFrames and summary dicts per `(mode, years_ahead)` in `src/api/app.py`.  
- **No database** in the current architecture.

### Scripts creating derived outputs (non-exhaustive)

| Script / module | Output |
|-----------------|--------|
| `src/preprocessing/transform.py` | `*_long_with_growth.csv` |
| `src/preprocessing/carbon_calc.py` | `*_with_carbon.csv`, `all_plots_with_carbon.csv` |
| `src/models/forest_snapshots.py` → `generate_forest_snapshots` | Baseline snapshot CSVs |
| `src/models/forest_snapshots_nn.py` → `generate_forest_snapshots` | NN/hybrid snapshot CSVs |
| `generate_all_snapshots.py`, `generate_snapshots_0_20.py` | Convenience wrappers for NN epsilon directory |
| Diagnostics / uncertainty | e.g. `Data/Processed Data/diagnostics/uncertainty_summary.json` (consumers: `/uncertainty/summary`) |

**Note:** The repo contains `web/public/midterm-data/*.json` used for static demo; **no Python script path was found in-repo** that regenerates those JSON files (may be manual or external). Treat as **open question** for reproducibility (§10).

---

## 5. Current data model

### Snapshot CSV (API / vector forest)

Example columns from `Data/Processed Data/forest_snapshots_baseline_stochastic/forest_0_years.csv`:

```text
TreeID, Plot, Species, DBH_cm, carbon_at_time, years_ahead
```

- **`TreeID`:** string or numeric in CSV; API normalizes for JSON (see below).
- **`Plot`:** `Upper` | `Middle` | `Lower` (and string variants compared case-insensitively in `/vector-forest/snapshot`).
- **`Species`:** free-text species label passed into allometry / growth (case varies in raw data, e.g. `Sugar Maple` vs `sugar maple`).
- **`DBH_cm`:** diameter at breast height (cm) at the simulated horizon.
- **`carbon_at_time`:** kg C per tree (aboveground carbon per project’s allometry).
- **`years_ahead`:** simulation horizon label matching file / request.

### Vector forest API JSON row shape

Returned by `GET /vector-forest/snapshot` (`src/api/app.py`):

```python
{
  "tree_id": int,       # parsed from leading numeric token of TreeID; fallback hash
  "plot": str,
  "species": str,
  "dbh_cm": float,
  "carbon_kgC": float  # from carbon_at_time
}
```

TypeScript mirror: `VectorForestTree` in `web/src/lib/api.ts`.

### Summary API shape

`GET /summary` returns (`src/api/app.py`):

- `num_trees`, `mean_dbh_cm`, `total_carbon_kgC`
- `plot_breakdown`: map plot → `{ carbon_at_time, count }`
- `species_breakdown`: top species by carbon

### Long-format combined inventory (simulation input)

`load_base_forest_df()` expects `CARBON_ALL_PLOTS` to contain at least: **`TreeID`, `Plot`, `Species`, `DBH_cm`**, plus `Year` for filtering / “most recent year per tree” logic (`src/models/forest_snapshots.py`).

### Constraints / assumptions enforced in code

- **Plot count:** business logic often assumes three plots **Upper / Middle / Lower**; area scaling warns if fewer than three plots have configured areas (`src/api/app.py` around `scale_area`).
- **Keyframe years:** vector forest hardcodes `[0, 5, 10, 20]` in `src/api/app.py` (`_BASELINE_KEYFRAMES`).
- **Wide raw format:** `transform_plot` requires at least one `dbh` column with a year in `20xx`; **non-four-digit or differently labeled columns would be skipped**.
- **Tree ID quirks:** vector forest uses `raw_id.split()[0]` before `int(float(...))` to support IDs like `"416 (was 683)"` (`src/api/app.py`).

---

## 6. CSV ingestion compatibility (Google Sheet mirroring current wide CSV)

### Fit with existing `transform_plot`

The function `transform_plot()` in `src/preprocessing/transform.py` already:

- Accepts **per-plot** tables (one sheet → one plot name argument).
- Detects **wide** DBH columns by regex **`(20\d{2})`** in the column name.
- Supports flexible ID/species column names (`tree`+`id`, `species`).

### Adding a new year column (e.g. `DBH - 2026`)

- **Easy**, provided the header matches the pattern containing `20xx` (e.g. `DBH - 2026`).  
- After export from Sheets to CSV, rerun: transform → carbon → (optional) regenerate snapshots.  
- **Model / training implications:** adding years changes available training rows; **retraining is a separate decision** from ingestion.

### Adding a new tree row

- **Easy** in wide format: new row with ID + species + at least one DBH cell.  
- Downstream: long format drops NaN DBH rows; simulation needs a valid latest `DBH_cm` per tree in `CARBON_ALL_PLOTS`.

### Three plot tabs in one spreadsheet

- **Conceptually easy:** treat each tab as one call to `transform_plot(exported_csv_for_tab, "Upper"|"Middle"|"Lower")`.  
- **Caveats:**  
  - Tab names must map reliably to canonical plot keys expected everywhere else (`Upper`, `Middle`, `Lower`).  
  - Column naming must remain consistent per tab (same regex rules).

### Adapter / normalization layer (likely needed for Sheets → repo)

Even if teachers mirror CSV layout, a **Google Sheets → CSV/export → validate → merge** layer should handle:

1. **Export normalization:** Google Sheets API or Drive export may alter types (IDs as floats). `transform_plot` already casts ID to string — good for lossless IDs.  
2. **Column drift:** tolerate extra columns; ensure `dbh` + year detection still works.  
3. **Species casing:** unify or accept case variance (already present in data).  
4. **Sheet → three files vs one workbook:** orchestration to produce the three paths in `src/config.py` or override paths via env for a “staging” dataset.  
5. **Deterministic ordering / joins:** `load_base_forest_df` groups by `TreeID`; **duplicated TreeID across plots** would be a data error — today’s pipeline assumes IDs are unique per forest or at least per combined file; **verify** in project assumptions.

### Code paths that would change for automated pipeline (later)

- **Replace or parameterize** hardcoded `RAW_DATA_*` paths in `src/config.py` — or add parallel “staging” paths.  
- **Orchestrate** running `transform_plot` → `carbon_calc` → `generate_forest_snapshots*` with a chosen model mode — today these are **manual scripts**.  
- **`/summary` / caches:** after publishing new CSVs, **process restart** or cache invalidation is required (`_snapshot_cache`, `_summary_cache`).

---

## 7. Best insertion points for new pipeline features

| Feature | Recommendation |
|---------|----------------|
| **Google Sheets reader** | New module e.g. `src/integrations/google_sheets.py` (or `src/pipeline/sheets_reader.py`) — keep FastAPI thin; call from a service layer. |
| **Normalization / validation** | New `src/pipeline/validate_inventory.py` (schema checks, plot labels, year columns, duplicate TreeID detection, optional species whitelist). Reuse rules from `transform_plot` where possible; consider wrapping rather than rewriting `transform_plot` initially. |
| **Revision storage** | No DB today — choices: (a) versioned folders under `Data/Published/{revision_id}/`, (b) object storage/S3, (c) SQLite/Postgres. **Minimal:** timestamped directories + `manifest.json` listing CSV hashes and mode. |
| **Preview diff** | New `src/pipeline/diff_inventory.py` comparing last published `all_plots_with_carbon.csv` (or wide long) vs staging export; optional summary endpoint returning per-plot counts, new/removed trees, DBH deltas for latest year. |
| **Publish / regenerate** | CLI command e.g. `src/pipeline/publish.py` or Makefile target that: writes files to `Data/Raw Data/` or parallel dirs → runs preprocessing → runs snapshot generation → updates `manifest.json`. Optionally **reload caches** or fork worker. |
| **Admin-only endpoints** | New router `src/api/admin_routes.py` included from `app.py` behind auth (future) — e.g. `POST /admin/preview`, `POST /admin/publish`, `GET /admin/revisions`. **Current `app.py` is monolithic** — either split routers (medium refactor) or append carefully. |
| **Admin UI** | New Next.js route e.g. `web/src/app/admin/page.tsx` (protected) **or** separate tiny Vite app under `web/admin/` to reduce attack surface. **No auth framework exists yet** — Phase 3. |

---

## 8. Deployment and hosting constraints

### Separation of frontend and backend

- **Yes:** frontend is a standalone Next.js app in `web/`; backend is Python in `src/`. They communicate only via HTTP.

### What breaks if the SPA (full app) is hosted on GitHub Pages only

- **`output: 'export'`** produces static HTML/JS; **FastAPI routes are not available**.  
- Any page that calls `http://127.0.0.1:8000` (default) will fail unless:  
  - `NEXT_PUBLIC_API_BASE_URL` points to a **public** API, **and** CORS remains allowed, **and** the browser can reach it over HTTPS.  
- **POST** scenario simulation, area scaling, etc. require a live backend (unless replaced by precomputed JSON — not current design for scenarios).

### Same-origin assumptions

- **No same-origin assumption** in code — URLs are absolute from `API_BASE_URL`.  
- **CORS:** currently `allow_origins=["*"]` — permissive for experiments; production should narrow allowed origins.

### Static public app + updating data

Two patterns align with existing code:

1. **Backend-hosted dynamic API (keep current endpoints):** simplest for full interactivity; frontend points `NEXT_PUBLIC_API_BASE_URL` at production API.  
2. **Published JSON assets:** already used for **midterm** (`web/public/midterm-data/*.json` + import in `midtermStaticData.ts`). Extending this to Forest Insights would require **new frontend branching** similar to midterm (not implemented for main app today).

**Tradeoff:** JSON publishing fits **read-only public** dashboards; **scenario builder** still needs server-side simulation or a heavy client port (not present).

---

## 9. Minimal implementation plan (grounded in this repo)

### Phase 1 — Preview only

- Add **staging data paths** (parallel to `RAW_DATA_*` in `src/config.py`) *or* env overrides — avoid touching canonical files during preview.  
- Implement **Sheets export fetch → on-disk CSV** + run `transform_plot` / validation only — **no snapshot overwrite**.  
- Add **`GET /admin/preview-diff`** (or CLI-first) comparing staging vs last published long/carbon tables.  
- **Frontend:** minimal `web/src/app/admin/page.tsx` gated by env (weak) or localhost-only in dev.

**Touches:** `src/preprocessing/transform.py` (wrap, don’t fork), new `src/pipeline/*`, optional `src/api/app.py` routes.

### Phase 2 — Publish / regenerate

- **Atomic publish:** write to `Data/Published/current/` or replace `Data/Raw Data` + rerun pipeline in one transaction script.  
- Run `carbon_calc` pipeline + selected `generate_forest_snapshots` implementation (baseline vs NN — **explicit choice required**).  
- Clear `_snapshot_cache` / `_summary_cache` on publish (expose `app` lifecycle hook or restart container).  
- Optional: regenerate `web/public/midterm-data/*.json` for static demo parity (script **to be defined** — currently unclear in repo).

**Touches:** `src/models/forest_snapshots.py` or `forest_snapshots_nn.py`, `src/api/app.py` caches, possibly CI in `.github/workflows/`.

### Phase 3 — Hardening / auth

- Lock down CORS in `src/api/app.py`.  
- Add API key / JWT middleware for `/admin/*`.  
- Add auth to admin UI (Next.js middleware or external IdP).  
- Audit logs for publish events (who, when, revision id).

**Touches:** `src/api/app.py`, new `src/api/middleware.py`, `web/src/app/admin/*`, deployment secrets.

---

## 10. Open questions / ambiguities

1. **Midterm JSON regeneration:** `web/public/midterm-data/*.json` is consumed by code, but **no generator script** was found in-repo. Confirm how summaries/snapshots JSON are produced for CI parity.  
2. **`/snapshots` vs `/summary` mode split:** `/snapshots` always reads `forest_snapshots_nn_epsilon`; `/summary` defaults `mode="baseline"`. Any client mixing these may see **inconsistent** forests. Clarify intended contract.  
3. **`/snapshots/years` hardcoded:** returns `[0,5,10,20]` even if `forest_nn_*` files exist for 0–20.  
4. **Units in long DBH:** `carbon_calc.py` multiplies `DBH` by `2.54` → `DBH_cm`; confirm teacher Sheets must remain in **inches** at that stage or adjust conversion — inconsistent teacher input would silently skew carbon.  
5. **Which snapshot mode is “official” for teaching:** UI vector forest forces **`baseline_stochastic`**; Forest Insights default mode parameter is **`baseline`** in `fetchVisualizationData('baseline')` — potential pedagogical inconsistency.  
6. **Unique TreeID across plots:** pipeline should confirm whether IDs are globally unique in combined `all_plots_with_carbon.csv` — collisions would break `groupby('TreeID')` semantics in `load_base_forest_df`.  
7. **Google credentials & hosting:** where will Sheets service account credentials live (env on Fly/Render/etc.) — not addressed in codebase today.

---

*End of handoff document.*
