"""
Revision id helpers for the staging/publish pipeline.

Phase 1 only uses these for *staging* revisions. The same shape is intended
to be reused for *published* revisions in a later phase (single source of
truth for ids and manifest discovery).

Layout (Phase 1):

    Data/
      Staging/
        latest.json                 # { "revision_id": "..." }
        <revision_id>/
          Lower.csv
          Middle.csv
          Upper.csv
          manifest.json
          preview.json              # full preview payload (incl. diff)

Phase 2 (later) will add:

    Data/
      Revisions/
        manifest.json               # list of published revisions
        <revision_id>/...

No database is introduced in Phase 1.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_DIR  # type: ignore


STAGING_DIR: Path = DATA_DIR / "Staging"
PUBLISHED_DIR: Path = DATA_DIR / "Revisions"  # reserved for Phase 2
STAGING_LATEST_POINTER: Path = STAGING_DIR / "latest.json"


def make_revision_id() -> str:
    """Generate a sortable, human-readable revision id.

    Format: ``YYYYMMDDTHHMMSSZ-<6 hex>`` (UTC).
    Sortable lexicographically by timestamp.
    """
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = hashlib.sha256(now.encode("utf-8")).hexdigest()[:6]
    return f"{now}-{suffix}"


def staging_revision_dir(revision_id: str) -> Path:
    """Return the staging directory for a given revision id (not created)."""
    return STAGING_DIR / revision_id


def ensure_staging_root() -> Path:
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    return STAGING_DIR


def write_latest_pointer(revision_id: str) -> Path:
    """Update ``Data/Staging/latest.json`` to point at ``revision_id``."""
    ensure_staging_root()
    payload = {"revision_id": revision_id, "updated_at": _utc_iso()}
    STAGING_LATEST_POINTER.write_text(json.dumps(payload, indent=2))
    return STAGING_LATEST_POINTER


def read_latest_pointer() -> Optional[str]:
    """Return the most recent staging revision id, or ``None`` if absent."""
    if not STAGING_LATEST_POINTER.exists():
        return None
    try:
        return json.loads(STAGING_LATEST_POINTER.read_text())["revision_id"]
    except (json.JSONDecodeError, KeyError):
        return None


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
