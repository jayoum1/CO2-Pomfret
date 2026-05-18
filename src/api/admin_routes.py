"""
Admin-only FastAPI router for the Phase 1 preview pipeline.

These routes are intentionally **non-public**:

- By default every endpoint requires an ``X-Admin-Token`` header that matches
  ``CO2_ADMIN_TOKEN`` (compared in constant time).
- If ``CO2_ADMIN_TOKEN`` is unset, the routes return **503** rather than
  silently allowing access.
- **Local development only:** set ``CO2_DISABLE_ADMIN_AUTH=true`` to skip the
  token check so preview/publish can be tested without pasting a header. Never
  use this on a deployed or network-reachable backend.

Mounted by ``src/api/app.py`` via ``app.include_router(admin_router)``.
"""

from __future__ import annotations

import hmac
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

# Ensure `src/` is on the path when the FastAPI app imports this module.
_SRC_DIR = Path(__file__).resolve().parent.parent
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_logger = logging.getLogger("uvicorn.error")

from pipeline.diff_inventory import (  # noqa: E402
    compute_workbook_diff,
    load_current_workbook,
)
from pipeline.publish import (  # noqa: E402
    PublishError,
    PublishOptions,
    current_revision_summary,
    list_revisions_summary,
    publish_sheet_sync,
    revision_summary as get_revision_summary,
)
from pipeline.sheets_reader import (  # noqa: E402
    SheetsConfig,
    SheetsConfigError,
    SheetsFetchError,
    normalize_workbook_ids,
    read_workbook,
)
from pipeline.staging import (  # noqa: E402
    latest_preview as staging_latest_preview,
    write_preview_payload,
    write_staging_workbook,
)
from pipeline.validate_inventory import validate_workbook  # noqa: E402

ADMIN_TOKEN_ENV = "CO2_ADMIN_TOKEN"
ADMIN_AUTH_DISABLED_ENV = "CO2_DISABLE_ADMIN_AUTH"

ADMIN_AUTH_DISABLED_WARNING = (
    "Admin auth is disabled. Use only for local development."
)


def is_admin_auth_disabled() -> bool:
    """Return True if token checks are bypassed (local dev only).

    Truthy values: ``1``, ``true``, ``yes`` (case-insensitive).
    """
    v = os.environ.get(ADMIN_AUTH_DISABLED_ENV, "").strip().lower()
    return v in {"1", "true", "yes"}


router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def require_admin_token(
    x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token"),
) -> None:
    if is_admin_auth_disabled():
        return
    expected = os.environ.get(ADMIN_TOKEN_ENV, "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Admin endpoints are disabled: set {ADMIN_TOKEN_ENV} on the "
                "server to enable them."
            ),
        )
    if x_admin_token is None or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Token header.",
        )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class PreviewSheetSyncRequest(BaseModel):
    """Optional overrides for ``POST /admin/preview-sheet-sync``.

    All fields are optional; when omitted, the corresponding ``CO2_SHEETS_*``
    environment variable is used.
    """

    spreadsheet_id: Optional[str] = Field(default=None)
    tabs: Optional[Dict[str, str]] = Field(
        default=None,
        description="Canonical-plot → Sheets tab name overrides "
        "(e.g. {'Lower': 'Lower Plot 2026'}).",
    )
    public_csv: Optional[bool] = Field(default=None)


class PublishSheetSyncRequest(PreviewSheetSyncRequest):
    """Optional overrides for ``POST /admin/publish-sheet-sync``.

    Extends preview overrides with publish-only flags. ``include_nn_epsilon``
    triggers regeneration of the legacy NN epsilon snapshot directory used by
    the older ``/snapshots`` route (off by default — slower).
    """

    include_nn_epsilon: Optional[bool] = Field(
        default=False,
        description="Also regenerate forest_snapshots_nn_epsilon/* "
        "(legacy /snapshots route). Default: false.",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/health")
async def admin_health(_: None = Depends(require_admin_token)) -> Dict[str, Any]:
    """Lightweight liveness check for admin endpoints."""
    payload: Dict[str, Any] = {
        "status": "healthy",
        "sheets_configured": bool(os.environ.get("CO2_SHEETS_SPREADSHEET_ID")),
        "credentials_present": bool(
            os.environ.get("CO2_SHEETS_CREDENTIALS_FILE")
            or os.environ.get("CO2_SHEETS_CREDENTIALS_JSON")
        ),
        "public_csv_mode": os.environ.get(
            "CO2_SHEETS_PUBLIC_CSV", ""
        ).lower() in {"1", "true", "yes"},
    }
    if is_admin_auth_disabled():
        payload["admin_auth_disabled"] = True
        payload["warning"] = ADMIN_AUTH_DISABLED_WARNING
    return payload


@router.post("/preview-sheet-sync")
async def preview_sheet_sync(
    body: Optional[PreviewSheetSyncRequest] = None,
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    """Fetch the configured Google Sheet, validate, stage, and diff.

    Preview-only: production data and caches are **not** touched.
    """
    overrides: Dict[str, Any] = {}
    if body:
        if body.spreadsheet_id:
            overrides["spreadsheet_id"] = body.spreadsheet_id
        if body.tabs:
            overrides["tabs"] = body.tabs
        if body.public_csv is not None:
            overrides["public_csv"] = body.public_csv

    try:
        config = SheetsConfig.from_env(overrides=overrides)
    except SheetsConfigError as e:
        _logger.warning("POST /admin/preview-sheet-sync — %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e

    fetch_errors: List[str] = []
    try:
        workbook = read_workbook(config)
    except SheetsConfigError as e:
        _logger.warning("POST /admin/preview-sheet-sync — %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except SheetsFetchError as e:
        # Partial-read isn't supported by the simple reader yet — surface
        # the failure cleanly so the admin UI can show a useful message.
        raise HTTPException(status_code=502, detail=str(e)) from e

    workbook = normalize_workbook_ids(workbook)

    validation = validate_workbook(workbook)
    current = load_current_workbook()
    diff = compute_workbook_diff(workbook, current)

    staged = write_staging_workbook(
        workbook,
        source=config.source_metadata(),
        validation_summary=validation.summary(),
    )
    revision_id = staged["revision_id"]

    preview_payload: Dict[str, Any] = {
        "revision_id": revision_id,
        "source": config.source_metadata(),
        "manifest": staged["manifest"],
        "validation": validation.to_dict(),
        "diff": diff.to_dict(),
        "fetch_errors": fetch_errors,
        "warnings": _collect_top_warnings(validation),
    }
    write_preview_payload(revision_id, preview_payload)

    return preview_payload


@router.get("/latest-preview")
async def get_latest_preview(
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    payload = staging_latest_preview()
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No preview has been generated yet. "
                "POST /admin/preview-sheet-sync to create one."
            ),
        )
    return payload


# ---------------------------------------------------------------------------
# Phase 2 — manual publish & revision inspection
# ---------------------------------------------------------------------------


def _build_publish_options(body: Optional[PublishSheetSyncRequest]) -> PublishOptions:
    overrides: Dict[str, Any] = {}
    include_nn = False
    if body:
        if body.spreadsheet_id:
            overrides["spreadsheet_id"] = body.spreadsheet_id
        if body.tabs:
            overrides["tabs"] = body.tabs
        if body.public_csv is not None:
            overrides["public_csv"] = body.public_csv
        include_nn = bool(body.include_nn_epsilon)
    return PublishOptions(overrides=overrides, include_nn_epsilon=include_nn)


@router.post("/publish-sheet-sync")
async def publish_sheet_sync_route(
    body: Optional[PublishSheetSyncRequest] = None,
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    """Promote the current Google Sheet into the canonical dataset.

    Re-reads the sheet, validates, builds a per-revision directory, and
    atomically swaps the live raw/processed/snapshot CSVs. In-process
    snapshot/summary caches are cleared after a successful promote.

    Returns the full revision manifest.
    """
    options = _build_publish_options(body)

    try:
        from api.app import clear_runtime_caches  # type: ignore
    except Exception:  # noqa: BLE001
        clear_runtime_caches = None  # type: ignore[assignment]

    try:
        manifest = publish_sheet_sync(options, cache_clearer=clear_runtime_caches)
    except PublishError as e:
        detail = {"error": str(e), **(e.detail or {})}
        status_code = 400 if detail.get("stage") in {"config", "validate"} else 500
        raise HTTPException(status_code=status_code, detail=detail) from e
    return manifest


@router.get("/revisions")
async def list_revisions(
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    """List all known published-or-attempted revisions (newest first)."""
    revisions = list_revisions_summary()
    return {
        "count": len(revisions),
        "revisions": revisions,
    }


@router.get("/current-revision")
async def get_current_revision(
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    """Return the currently-active revision summary, or ``null`` if none."""
    summary = current_revision_summary()
    if summary is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No revision is currently published. "
                "POST /admin/publish-sheet-sync to create one."
            ),
        )
    return summary


@router.get("/revisions/{revision_id}")
async def get_revision(
    revision_id: str,
    _: None = Depends(require_admin_token),
) -> Dict[str, Any]:
    """Return the manifest summary for ``revision_id``."""
    summary = get_revision_summary(revision_id)
    if summary is None:
        raise HTTPException(
            status_code=404,
            detail=f"Revision {revision_id!r} not found.",
        )
    return summary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _collect_top_warnings(validation: Any) -> List[Dict[str, Any]]:
    """Flatten the highest-priority findings for quick UI rendering."""
    out: List[Dict[str, Any]] = []
    for f in validation.findings:
        out.append({"plot": None, **f.to_dict()})
    for plot, r in validation.per_plot.items():
        for f in r.findings:
            out.append({"plot": plot, **f.to_dict()})
    out.sort(key=lambda x: {"error": 0, "warning": 1, "info": 2}.get(x["severity"], 3))
    return out[:25]
