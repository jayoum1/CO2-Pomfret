"""
Staging area writer / reader.

Phase 1 writes every preview attempt to its own ``Data/Staging/<revision_id>/``
subdirectory containing:

* ``Lower.csv`` / ``Middle.csv`` / ``Upper.csv`` — the raw wide CSVs as read
  from Sheets (one per plot that was successfully read).
* ``manifest.json`` — minimal source/integrity metadata.
* ``preview.json`` — full preview payload (validation + diff + summary) used
  by ``GET /admin/latest-preview``.

Production data under ``Data/Raw Data/`` and ``Data/Processed Data/`` is
never touched.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping, Optional

import pandas as pd

from .revisions import (
    ensure_staging_root,
    make_revision_id,
    read_latest_pointer,
    staging_revision_dir,
    write_latest_pointer,
)


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


def write_staging_workbook(
    workbook: Mapping[str, pd.DataFrame],
    *,
    source: Dict[str, Any],
    validation_summary: Optional[Dict[str, Any]] = None,
    revision_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist a workbook to ``Data/Staging/<revision_id>/``.

    Returns a dict with keys ``revision_id``, ``directory``, ``manifest``.
    """
    ensure_staging_root()
    rid = revision_id or make_revision_id()
    rev_dir = staging_revision_dir(rid)
    rev_dir.mkdir(parents=True, exist_ok=True)

    files: Dict[str, Dict[str, Any]] = {}
    for plot, df in workbook.items():
        target = rev_dir / f"{plot}.csv"
        df.to_csv(target, index=False)
        files[plot] = {
            "filename": target.name,
            "sha256": _sha256_file(target),
            "rows": int(len(df)),
            "columns": [str(c) for c in df.columns],
        }

    manifest = {
        "revision_id": rid,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "files": files,
        "validation_summary": validation_summary or {},
        "schema_version": 1,
    }
    (rev_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    write_latest_pointer(rid)

    return {
        "revision_id": rid,
        "directory": str(rev_dir),
        "manifest": manifest,
    }


def write_preview_payload(revision_id: str, payload: Dict[str, Any]) -> Path:
    """Persist the full preview JSON (validation + diff) for later retrieval."""
    rev_dir = staging_revision_dir(revision_id)
    rev_dir.mkdir(parents=True, exist_ok=True)
    target = rev_dir / "preview.json"
    target.write_text(json.dumps(payload, indent=2, default=str))
    return target


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def read_staging_manifest(revision_id: str) -> Optional[Dict[str, Any]]:
    path = staging_revision_dir(revision_id) / "manifest.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def read_preview_payload(revision_id: str) -> Optional[Dict[str, Any]]:
    path = staging_revision_dir(revision_id) / "preview.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def read_staging_workbook(revision_id: str) -> Dict[str, pd.DataFrame]:
    """Reload the wide CSVs of a staged revision (without re-running Sheets)."""
    rev_dir = staging_revision_dir(revision_id)
    workbook: Dict[str, pd.DataFrame] = {}
    if not rev_dir.exists():
        return workbook
    for csv_path in sorted(rev_dir.glob("*.csv")):
        plot = csv_path.stem
        workbook[plot] = pd.read_csv(csv_path)
    return workbook


def latest_preview() -> Optional[Dict[str, Any]]:
    """Convenience: latest revision id + its preview payload, or ``None``."""
    rid = read_latest_pointer()
    if rid is None:
        return None
    payload = read_preview_payload(rid)
    if payload is None:
        return None
    return {"revision_id": rid, **payload}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()
