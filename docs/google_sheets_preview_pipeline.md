# Google Sheets → preview pipeline (Phase 1)

This document describes the **preview-only** Phase 1 of the ingestion
pipeline added under `src/pipeline/` and `src/api/admin_routes.py`.

Phase 1 lets an admin:

1. Read a Google Sheet that mirrors the existing wide-format inventory
   (3 tabs: Lower / Middle / Upper).
2. Validate it against the same rules the existing pipeline uses.
3. Persist it to a staging area under `Data/Staging/<revision_id>/`.
4. Compute a structured diff against the **current local** dataset under
   `Data/Raw Data/`.
5. Retrieve the most recent preview through a JSON endpoint.

Phase 1 does **not**:

* publish or overwrite anything under `Data/Raw Data/` or
  `Data/Processed Data/`,
* invalidate the in-memory snapshot caches (the helper
  `clear_runtime_caches()` is in place for Phase 2),
* introduce a database, real auth framework, or background jobs.

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

`Data/Revisions/` is reserved for Phase 2 (publish). It is **not** created
by Phase 1.

---

## 5. Admin token (temporary auth)

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

## 6. Example curl commands

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
```

---

## 7. Phase 2 / 3 reuse notes

* The staging revision-id scheme (`YYYYMMDDTHHMMSSZ-<hex>`) is reused by
  `Data/Revisions/` when publish is implemented.
* `clear_runtime_caches()` in `src/api/app.py` is the publish-time cache
  invalidation hook.
* `compute_workbook_diff` is already structured for "preview at publish
  time" if we want one last confirmation before applying changes.
