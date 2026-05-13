"""
Revision id helpers for the staging/publish pipeline.

Used by:

* **Phase 1** (preview)  — `Data/Staging/<rid>/` with `latest.json` pointer.
* **Phase 2** (publish)  — `Data/Revisions/<rid>/` with `current.json` pointer
  and an append-only `index.json` of every revision ever published.

Layout::

    Data/
      Staging/
        latest.json                 # { "revision_id": "..." }
        <revision_id>/
          Lower.csv / Middle.csv / Upper.csv
          manifest.json
          preview.json

      Revisions/
        current.json                # { "revision_id": "..." } — active dataset
        index.json                  # ordered list of all published revisions
        <revision_id>/
          raw/                      # promoted raw CSVs (canonical names)
          processed/                # generated DBH / Carbon / snapshot CSVs
          manifest.json             # source, validation, diff, status

No database is introduced. File pointers + append-only index are sufficient.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_DIR  # type: ignore


STAGING_DIR: Path = DATA_DIR / "Staging"
PUBLISHED_DIR: Path = DATA_DIR / "Revisions"
STAGING_LATEST_POINTER: Path = STAGING_DIR / "latest.json"
PUBLISHED_CURRENT_POINTER: Path = PUBLISHED_DIR / "current.json"
PUBLISHED_INDEX: Path = PUBLISHED_DIR / "index.json"


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


# ---------------------------------------------------------------------------
# Published (Phase 2) helpers
# ---------------------------------------------------------------------------


def ensure_published_root() -> Path:
    PUBLISHED_DIR.mkdir(parents=True, exist_ok=True)
    return PUBLISHED_DIR


def published_revision_dir(revision_id: str) -> Path:
    """Return the published directory for ``revision_id`` (not created)."""
    return PUBLISHED_DIR / revision_id


def write_current_pointer(revision_id: str) -> Path:
    """Promote ``revision_id`` to the active published dataset."""
    ensure_published_root()
    payload = {"revision_id": revision_id, "updated_at": _utc_iso()}
    PUBLISHED_CURRENT_POINTER.write_text(json.dumps(payload, indent=2))
    return PUBLISHED_CURRENT_POINTER


def read_current_revision_id() -> Optional[str]:
    """Return the currently-active published revision id, if any."""
    if not PUBLISHED_CURRENT_POINTER.exists():
        return None
    try:
        return json.loads(PUBLISHED_CURRENT_POINTER.read_text())["revision_id"]
    except (json.JSONDecodeError, KeyError):
        return None


def list_published_revisions() -> List[Dict[str, Any]]:
    """Return the append-only list of all published-or-attempted revisions.

    Entries are dicts with at least ``revision_id``, ``status``,
    ``recorded_at``. Missing index file → empty list.
    """
    if not PUBLISHED_INDEX.exists():
        return []
    try:
        return json.loads(PUBLISHED_INDEX.read_text())
    except json.JSONDecodeError:
        return []


def append_to_index(entry: Dict[str, Any]) -> None:
    """Append a single entry to ``Data/Revisions/index.json`` (creating it)."""
    ensure_published_root()
    existing = list_published_revisions()
    existing.append({"recorded_at": _utc_iso(), **entry})
    PUBLISHED_INDEX.write_text(json.dumps(existing, indent=2))


def read_revision_manifest(revision_id: str) -> Optional[Dict[str, Any]]:
    """Load ``Data/Revisions/<rid>/manifest.json`` if present."""
    path = published_revision_dir(revision_id) / "manifest.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def write_revision_manifest(revision_id: str, manifest: Dict[str, Any]) -> Path:
    """Persist ``manifest`` to ``Data/Revisions/<rid>/manifest.json``."""
    rev_dir = published_revision_dir(revision_id)
    rev_dir.mkdir(parents=True, exist_ok=True)
    path = rev_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2, default=str))
    return path


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
