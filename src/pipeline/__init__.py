"""
CO2 Pomfret data ingestion pipeline (Phase 1 — preview only).

Modules
-------
- sheets_reader      Google Sheets / public-CSV fetcher (per plot tab).
- validate_inventory Pure validation rules (mirror the wide CSV pipeline).
- staging            Filesystem staging area + manifest writers.
- diff_inventory     Compare staged workbook against current local dataset.
- revisions          File-based revision id helpers (no DB).

Public/production endpoints are unaffected. See
docs/google_sheets_preview_pipeline.md for usage.
"""
