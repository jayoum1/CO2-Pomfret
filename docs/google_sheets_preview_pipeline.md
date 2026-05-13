# Google Sheets → preview + publish pipeline (Phases 1 & 2)

This document describes the ingestion pipeline added under `src/pipeline/`
and `src/api/admin_routes.py`.

* **Phase 1 (preview)** stages a Google Sheet, validates it, and computes
  a structured diff against the current local dataset. It never touches
  canonical files.
* **Phase 2 (publish)** promotes a fresh fetch of the Google Sheet into
  the canonical dataset, regenerates the derived files the API serves,
  clears in-process caches, and records an immutable revision.

Phase 2 deliberately does **not**:

* retrain any ML models — it reuses the existing trained artifacts under
  `Models/` and the same `transform_plot` / `carbon_calc` /
  `generate_forest_snapshots` code paths,
* introduce a database, real auth framework, or background jobs,
* expose anything publicly — every admin route still requires
  `X-Admin-Token`.

---

## 1. Required environment variables

| Variable | Required | Description |
|---|---|---|
| `CO2_ADMIN_TOKEN` | yes | Bearer token. The admin routes return **503** until this is set. Compared with `hmac.compare_digest`. |
| `CO2_SHEETS_SPREADSHEET_ID` | yes (or pass in body) | Google Sheets ID. |
| `CO2_SHEETS_TAB_LOWER` | no | Override tab name. Default: `Lower`. |
| `CO2_SHEETS_TAB_MIDDLE` | no | Override tab name. Default: `Middle`. |
| `CO2_SHEETS_TAB_UPPER` | no | Override tab name. Default: `Upper`. |
| `CO2_SHEETS_CREDENTIALS_FILE` | one of these | Path to a service-account JSON file. |
| `CO2_SHEETS_CREDENTIALS_JSON` | one of these | Service-account JSON pasted directly into env. |
| `CO2_SHEETS_PUBLIC_CSV` | no | When `true`, skip auth and read via the public CSV-export URL. The spreadsheet must be shared "Anyone with the link can view". |

### Optional Python dependencies

The service-account mode requires `gspread` and `google-auth`. They are
**not** in `requirements.txt` to keep the simulation environment slim.

```bash
pip install gspread google-auth
```

The public-CSV fallback uses only the stdlib (`urllib`) plus `pandas`.

---

## 2. Running locally

```bash
# 1. Start the API normally — the admin router is auto-mounted.
export CO2_ADMIN_TOKEN="dev-token-not-for-prod"
export CO2_SHEETS_SPREADSHEET_ID="1AbCdEfGhIj..."
export CO2_SHEETS_PUBLIC_CSV=true   # easiest for local testing

cd src && uvicorn api.app:app --reload

# 2. Sanity check the admin endpoints (separate terminal):
curl -s -H "X-Admin-Token: dev-token-not-for-prod" \
     http://127.0.0.1:8000/admin/health | jq .
```

### Service-account quickstart

1. In Google Cloud, create a service account with **no project roles**.
2. Generate a JSON key and download it.
3. Share the Google Sheet with the service account's email
   (`...@<project>.iam.gserviceaccount.com`) as a **Viewer**.
4. Point the API at the key:
   ```bash
   export CO2_SHEETS_CREDENTIALS_FILE=/path/to/key.json
   unset CO2_SHEETS_PUBLIC_CSV
   ```

---

## 3. How preview works

`POST /admin/preview-sheet-sync` does the following, in order:

1. Build `SheetsConfig` from env (with optional JSON body overrides).
2. Fetch each plot tab — service-account or public-CSV mode.
3. Normalize Tree ID columns to canonical string form
   (`normalize_tree_id` in `validate_inventory.py`).
4. Run `validate_workbook(...)` → structured findings (errors + warnings).
5. Load the current local workbook from `Data/Raw Data/` and run
   `compute_workbook_diff(staged, current)`.
6. Write `Data/Staging/<revision_id>/{Lower,Middle,Upper}.csv` plus
   `manifest.json` and `preview.json`.
7. Update `Data/Staging/latest.json` and return the full preview payload.

The same payload is recoverable via `GET /admin/latest-preview`.

### Validation findings

Errors block a future publish; warnings do not. Examples:

| Code | Severity | Meaning |
|---|---|---|
| `missing_id_column` | error | No column matching "tree…id". |
| `missing_species_column` | error | No "species" column. |
| `missing_dbh_year_columns` | error | No column with a 20xx year. |
| `duplicate_tree_ids_within_plot` | error | Same Tree ID twice in one tab. |
| `non_numeric_dbh` | warning | Some DBH cells aren't numeric; transform drops them. |
| `dbh_out_of_range` | warning | DBH outside `[0.5, 250] cm`. |
| `tree_id_appears_in_multiple_plots` | warning | Cross-plot duplicate. |
| `unknown_plot_keys` | error | Workbook key isn't Lower/Middle/Upper. |
| `missing_plots` | warning | Workbook missing one of the three canonical plots. |

### Diff shape

```jsonc
{
  "overall": {
    "changed_plots": ["Upper"],
    "totals": {
      "added_trees": 1, "removed_trees": 0,
      "species_changes": 0, "dbh_cell_changes": 3,
      "new_year_columns": 1, "removed_year_columns": 0
    },
    "headline": "Changes in Upper: 1 new tree(s); 3 DBH cell update(s); 1 new year column(s)"
  },
  "per_plot": {
    "Upper": {
      "summary": { /* same totals scoped to plot */ },
      "added_trees":   [{"tree_id": "999", "species": "red oak"}],
      "removed_trees": [],
      "species_changes": [],
      "dbh_cell_changes": [
        {"tree_id": "1", "year": 2025, "from": 10.80, "to": 10.95}
      ],
      "new_year_columns": [2026],
      "removed_year_columns": []
    }
  },
  "notes": []
}
```

---

## 4. Staging filesystem layout

```
Data/
  Staging/
    latest.json                            # { revision_id, updated_at }
    20260511T184312Z-3a7f1c/
      Lower.csv                            # raw wide CSV as read
      Middle.csv
      Upper.csv
      manifest.json                        # source, hashes, validation summary
      preview.json                         # full payload returned by the API
```

`Data/Raw Data/` and `Data/Processed Data/` are never written by Phase 1.

`manifest.json` shape:

```jsonc
{
  "revision_id": "20260511T184312Z-3a7f1c",
  "created_at": "2026-05-11T18:43:12+00:00",
  "source": {
    "spreadsheet_id": "1AbCd...",
    "tab_names": {"Lower": "Lower", "Middle": "Middle", "Upper": "Upper"},
    "mode": "public_csv"
  },
  "files": {
    "Lower": {"filename": "Lower.csv", "sha256": "...", "rows": 122, "columns": [...]}
  },
  "validation_summary": {"errors": 0, "warnings": 2, "plots": 3},
  "schema_version": 1
}
```

`Data/Raw Data/` and `Data/Processed Data/` are mutated only by the
**publish** flow (§5). `Data/Revisions/` is created the first time publish
runs.

---

## 5. How publish works (Phase 2)

`POST /admin/publish-sheet-sync` runs the following pipeline. Steps 1–5
write **only** under `Data/Revisions/<rid>/`; canonical files are not
touched until step 6.

1. Build `SheetsConfig` from env (or JSON body overrides).
2. Re-read the spreadsheet **fresh** (preview is not reused — publish is
   always a full round-trip to Sheets).
3. Validate (`validate_workbook`). Any `error`-level finding aborts the
   publish before anything is written to disk.
4. Compute the diff against the currently-published dataset.
5. Allocate a new revision id and build everything inside
   `Data/Revisions/<rid>/`:
   * `raw/` — wide CSVs (canonical and human-friendly names),
   * `processed/DBH/` — per-plot long DBH CSVs (via `transform_plot`),
   * `processed/Carbon/` — per-plot + `all_plots_with_carbon.csv` (via
     `add_carbon_and_carbon_growth`),
   * `processed/forest_snapshots_baseline/forest_{0,5,10,20}_years.csv` —
     used by `/summary` (default mode),
   * `processed/forest_snapshots_baseline_stochastic/forest_{0,5,10,20}_years.csv` —
     used by `/vector-forest/snapshot`,
   * (optional) `processed/forest_snapshots_nn_epsilon/forest_nn_{0..20}_years.csv` —
     legacy `/snapshots` route. Off by default; enable with
     `{"include_nn_epsilon": true}` in the request body.
6. **Promote** — copy every revision artifact onto its canonical path.
   Each file swap is atomic (`copy → .new → os.replace`) on the same
   filesystem.
7. Clear in-process caches via `api.app.clear_runtime_caches()` so
   `/summary` and `/vector-forest/snapshot` start serving fresh data.
8. Write `Data/Revisions/<rid>/manifest.json`, update
   `Data/Revisions/current.json` to point at `<rid>`, and append an entry
   to `Data/Revisions/index.json`.

The publish job blocks for the duration of all eight steps — snapshot
generation for `baseline` + `baseline_stochastic` at four keyframes
typically takes a few seconds.

### Active-dataset selection

After Phase 2 the API still reads from the **same canonical paths** it
always has:

* `Data/Raw Data/CO2 Pomfret Raw Data - {Lower,Middle,Upper}.csv`
* `Data/Processed Data/Carbon/all_plots_with_carbon.csv`
* `Data/Processed Data/forest_snapshots_baseline/forest_{0,5,10,20}_years.csv`
* `Data/Processed Data/forest_snapshots_baseline_stochastic/forest_{0,5,10,20}_years.csv`

Publish overwrites those paths from the latest revision. The
`current.json` pointer is metadata only — the FastAPI app does not yet
read it. (Phase 3 may consume it for an in-app "currently serving
revision X" badge.)

### Atomicity caveat

Whole-set atomicity is not achievable without a symlink-based design.
The promote window is sub-second in practice. If the process is killed
between steps 6 and 8 you can end up with:

* canonical files = new revision,
* `current.json` = previous revision id,
* caches potentially empty.

The data is consistent and the API will serve correct (new) values; only
the operator-facing metadata is briefly out of sync. The next successful
publish resyncs everything.

### Revision directory layout

```
Data/
  Revisions/
    current.json                            # { revision_id, updated_at }
    index.json                              # append-only list, oldest → newest
    20260513T130212Z-c4f0a3/
      manifest.json                         # source, validation, diff, build log
      raw/
        Lower.csv  Middle.csv  Upper.csv    # human-friendly copies
        CO2 Pomfret Raw Data - Lower.csv    # canonical names (used by promote)
        CO2 Pomfret Raw Data - Middle.csv
        CO2 Pomfret Raw Data - Upper.csv
      processed/
        DBH/upper_long_with_growth.csv      # …middle_…, lower_…
        Carbon/upper_with_carbon.csv        # …middle_…, lower_…
        Carbon/all_plots_with_carbon.csv
        forest_snapshots_baseline/forest_{0,5,10,20}_years.csv
        forest_snapshots_baseline_stochastic/forest_{0,5,10,20}_years.csv
        forest_snapshots_nn_epsilon/forest_nn_{0..20}_years.csv  (optional)
```

### Inspecting revisions

```
GET  /admin/revisions             # newest-first summary list
GET  /admin/current-revision      # the active revision
GET  /admin/revisions/{rid}       # one revision manifest summary
```

Manifest summary fields (`tree_change_summary`, `validation`, `source`,
`promoted_files`, `cache_cleared`, `build_log`, `previous_revision_id`)
are derived from the full diff/validation results captured at publish
time.

### Recovering from a failed publish

* **Validation errors** — the route returns HTTP 400 with the structured
  validation payload; no revision dir is created. Fix the sheet and
  re-run.
* **Build failure** (e.g. `transform_plot` blows up on bad data) — a
  revision dir is created with `status: "failed"` and an `error` field.
  Canonical files are untouched. Inspect `Data/Revisions/<rid>/manifest.json`
  to see which build step failed, fix the source, and re-run.
* **Promote failure** (rare — disk full, permissions) — manifest
  `status: "promote_failed"`. Some canonical files **may** have been
  swapped before the failure; the safest recovery is to re-run publish
  once the underlying issue is resolved. Each atomic per-file swap leaves
  the destination in a consistent state, so partial promotes do not
  produce corrupt CSVs.
* **Cache clear failure** — manifest records the error under
  `cache_cleared`; publish still completes. Restart the API to be safe.
* **Manual rollback** — Phase 2 ships no `/admin/rollback` endpoint, but
  revisions are self-contained: `cp -r Data/Revisions/<old_rid>/raw/* "Data/Raw Data/"`
  followed by re-running publish on the same revision will restore an
  earlier state. (Phase 3 will add a proper rollback route.)

### What is still manual

* Triggering publish itself (no scheduler).
* Editing the Google Sheet — the future Apps Script + Form integration
  is **not** part of this phase.
* Reviewing the diff before publishing — preview is the operator's safety
  net; there is no separate "approve" step.

---

## 6. CLI helper

For local debugging without booting FastAPI. Invoke from inside `src/`
so the `pipeline.*` package resolves:

```bash
cd src

# Preview only — same as POST /admin/preview-sheet-sync
python -m pipeline.cli preview

# Manual publish — same as POST /admin/publish-sheet-sync
python -m pipeline.cli publish

# Publish + regenerate legacy NN snapshots
python -m pipeline.cli publish --include-nn-epsilon

# Publish but skip the FastAPI cache clear (e.g. no API running locally)
python -m pipeline.cli publish --no-clear-caches

# Inspect revisions
python -m pipeline.cli revisions      # all known revisions, newest first
python -m pipeline.cli current        # active revision only
```

The CLI reads the same `CO2_SHEETS_*` env vars as the routes. It does
**not** require `CO2_ADMIN_TOKEN` — but the admin HTTP routes still do.

---

## 7. Admin token (temporary auth)

This is intentionally minimal:

* Set `CO2_ADMIN_TOKEN` to a strong random value in any non-trivial
  environment.
* Pass it on every request as `X-Admin-Token: <token>`.
* Compared with `hmac.compare_digest` (constant time).
* If unset, every admin endpoint returns **503** so endpoints can never be
  accidentally exposed without an explicit token.

This will be replaced by a real auth layer in Phase 3 (see
`ARCHITECTURE_HANDOFF_DATA_PIPELINE.md` §9).

---

## 8. Example curl commands

```bash
# Health check
curl -s \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  http://127.0.0.1:8000/admin/health | jq .

# Run a preview using fully env-driven config
curl -s -X POST \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8000/admin/preview-sheet-sync | jq .

# Run a preview with body overrides (different spreadsheet / tab names)
curl -s -X POST \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "spreadsheet_id": "1XyZ...",
        "tabs": {"Lower": "Lower 2026", "Middle": "Middle 2026", "Upper": "Upper 2026"},
        "public_csv": true
      }' \
  http://127.0.0.1:8000/admin/preview-sheet-sync | jq .

# Retrieve the most recent preview
curl -s \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  http://127.0.0.1:8000/admin/latest-preview | jq .

# Run a manual publish (env-driven config)
curl -s -X POST \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8000/admin/publish-sheet-sync | jq .

# Publish and also regenerate legacy NN epsilon snapshots
curl -s -X POST \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"include_nn_epsilon": true}' \
  http://127.0.0.1:8000/admin/publish-sheet-sync | jq .

# List all revisions (newest first)
curl -s \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  http://127.0.0.1:8000/admin/revisions | jq .

# Show the currently-active revision
curl -s \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  http://127.0.0.1:8000/admin/current-revision | jq .

# Show one revision's manifest summary
curl -s \
  -H "X-Admin-Token: $CO2_ADMIN_TOKEN" \
  http://127.0.0.1:8000/admin/revisions/20260513T130212Z-c4f0a3 | jq .
```

---

## 9. Phase 3 reuse notes

* The `current.json` pointer is metadata-only today; Phase 3 can switch
  the FastAPI app to read it instead of canonical paths to make rollback
  a single-file change.
* `compute_workbook_diff` runs **at publish time** as well as preview, so
  every revision manifest captures the exact change set that was applied.
* `clear_runtime_caches()` is called by publish; Phase 3 can extend it
  without changing the route layer.
* The admin token will be replaced by a real auth layer in Phase 3
  (see `ARCHITECTURE_HANDOFF_DATA_PIPELINE.md` §9).
