"""
Manual publish orchestrator (Phase 2).

Promotes a freshly-fetched Google Sheet workbook into the canonical dataset
the FastAPI app reads at runtime, while keeping every intermediate artifact
under ``Data/Revisions/<revision_id>/`` for inspection and rollback.

Atomicity strategy
------------------
* Steps 1–4 (read, validate, diff, build) write **only** under the
  per-revision directory. If anything fails here, canonical files are
  untouched — the failed revision dir is left behind for debugging and
  marked ``status="failed"`` in its manifest.
* Step 5 (promote) copies revision artifacts to canonical paths. Each
  individual file swap is atomic on the same filesystem
  (``copy → .new → os.replace``). Whole-set atomicity is not achievable
  without a symlink-pointer design; the typical promote window is
  sub-second so the practical risk is low.
* Step 6 clears in-process FastAPI caches (only after all promotes
  succeed).
* Step 7 updates ``Data/Revisions/current.json`` and appends to
  ``index.json``.

The publish job is **manual and admin-token-protected**; it is not
scheduled or triggered by any user-facing route.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from .diff_inventory import compute_workbook_diff, load_current_workbook
from .process_inventory import (
    DEFAULT_KEYFRAME_YEARS,
    DEFAULT_NN_EPSILON_YEARS,
    DEFAULT_STOCHASTIC_SEED,
    SNAPSHOTS_BASELINE_SUBDIR,
    SNAPSHOTS_BASELINE_STOCH_SUBDIR,
    SNAPSHOTS_NN_EPSILON_SUBDIR,
    build_carbon,
    build_long_dbh,
    build_snapshots,
    build_snapshots_nn_epsilon,
    canonical_destinations,
    promote_artifacts,
    save_raw_workbook,
)
from .revisions import (
    append_to_index,
    make_revision_id,
    published_revision_dir,
    read_current_revision_id,
    write_current_pointer,
    write_revision_manifest,
)
from .sheets_reader import (
    SheetsConfig,
    SheetsConfigError,
    SheetsFetchError,
    normalize_workbook_ids,
    read_workbook,
)
from .validate_inventory import validate_workbook


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------


class PublishError(RuntimeError):
    """Raised when a publish cannot proceed (e.g. validation errors).

    ``detail`` is a structured dict suitable for serializing into the
    revision manifest and the HTTP response.
    """

    def __init__(self, message: str, *, detail: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.detail = detail or {}


@dataclass
class PublishOptions:
    overrides: Dict[str, Any] = field(default_factory=dict)
    keyframe_years: Tuple[int, ...] = DEFAULT_KEYFRAME_YEARS
    stochastic_seed: int = DEFAULT_STOCHASTIC_SEED
    include_nn_epsilon: bool = False
    nn_epsilon_years: Tuple[int, ...] = DEFAULT_NN_EPSILON_YEARS


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


def publish_sheet_sync(
    options: Optional[PublishOptions] = None,
    *,
    cache_clearer: Optional[Callable[[], Dict[str, int]]] = None,
) -> Dict[str, Any]:
    """Run the full publish pipeline. Returns the final manifest dict.

    Parameters
    ----------
    options : PublishOptions
        Overrides for spreadsheet id / tabs / public-CSV mode and which
        snapshot modes to regenerate.
    cache_clearer : callable, optional
        Function invoked after a successful promote to clear FastAPI's
        in-process snapshot/summary caches. Typically
        ``api.app.clear_runtime_caches``. Pipeline modules deliberately do
        not import FastAPI to avoid a circular dependency.
    """
    options = options or PublishOptions()

    # ── 1. Build SheetsConfig
    try:
        config = SheetsConfig.from_env(overrides=options.overrides)
    except SheetsConfigError as e:
        raise PublishError(str(e), detail={"stage": "config"}) from e

    # ── 2. Fetch fresh from Sheets
    try:
        workbook = read_workbook(config)
    except (SheetsConfigError, SheetsFetchError) as e:
        raise PublishError(str(e), detail={"stage": "fetch"}) from e
    workbook = normalize_workbook_ids(workbook)

    # ── 3. Validate
    validation = validate_workbook(workbook)
    if not validation.is_valid:
        raise PublishError(
            "Validation failed; aborting publish.",
            detail={"stage": "validate", "validation": validation.to_dict()},
        )

    # ── 4. Diff vs currently-published canonical data
    current = load_current_workbook()
    diff = compute_workbook_diff(workbook, current)

    # ── 5. Allocate a revision directory and build everything inside it
    revision_id = make_revision_id()
    rev_dir = published_revision_dir(revision_id)
    rev_dir.mkdir(parents=True, exist_ok=True)

    build_log: List[Dict[str, Any]] = []
    try:
        # 5a. Save raw to revision/raw/
        raw_dir = rev_dir / "raw"
        save_raw = save_raw_workbook(workbook, raw_dir, canonical_names=True)
        build_log.append(save_raw.to_dict())

        # 5b. Wide → long DBH
        dbh_dir = rev_dir / "processed" / "DBH"
        transform_result, long_dfs = build_long_dbh(raw_dir, dbh_dir)
        build_log.append(transform_result.to_dict())

        # 5c. Long DBH → carbon (+ all_plots_with_carbon.csv)
        carbon_dir = rev_dir / "processed" / "Carbon"
        carbon_result, all_plots_path = build_carbon(long_dfs, carbon_dir)
        build_log.append(carbon_result.to_dict())

        # 5d. Snapshots — baseline (required for /summary default mode)
        baseline_dir = rev_dir / "processed" / SNAPSHOTS_BASELINE_SUBDIR
        baseline_result = build_snapshots(
            carbon_all_plots_path=all_plots_path,
            output_dir=baseline_dir,
            mode="baseline",
            years_list=options.keyframe_years,
        )
        build_log.append(baseline_result.to_dict())

        # 5e. Snapshots — baseline_stochastic (required for /vector-forest/snapshot)
        stoch_dir = rev_dir / "processed" / SNAPSHOTS_BASELINE_STOCH_SUBDIR
        stoch_result = build_snapshots(
            carbon_all_plots_path=all_plots_path,
            output_dir=stoch_dir,
            mode="baseline_stochastic",
            years_list=options.keyframe_years,
            seed=options.stochastic_seed,
        )
        build_log.append(stoch_result.to_dict())

        # 5f. Optional — nn_epsilon snapshots (legacy /snapshots route)
        if options.include_nn_epsilon:
            nn_dir = rev_dir / "processed" / SNAPSHOTS_NN_EPSILON_SUBDIR
            nn_result = build_snapshots_nn_epsilon(
                carbon_all_plots_path=all_plots_path,
                output_dir=nn_dir,
                years_list=options.nn_epsilon_years,
            )
            build_log.append(nn_result.to_dict())

    except Exception as e:  # noqa: BLE001
        manifest = _build_manifest(
            revision_id=revision_id,
            status="failed",
            source=config.source_metadata(),
            validation=validation.to_dict(),
            diff=diff.to_dict(),
            build_log=build_log,
            promoted_files=[],
            cache_cleared=None,
            error=str(e),
        )
        write_revision_manifest(revision_id, manifest)
        append_to_index(
            {"revision_id": revision_id, "status": "failed", "error": str(e)}
        )
        raise PublishError(
            f"Build step failed: {e}", detail={"stage": "build", "revision_id": revision_id}
        ) from e

    # ── 6. Promote: copy revision artifacts to canonical paths
    file_pairs = canonical_destinations(
        revision_root=rev_dir,
        include_nn_epsilon=options.include_nn_epsilon,
    )
    try:
        promoted = promote_artifacts(file_pairs)
    except Exception as e:  # noqa: BLE001
        manifest = _build_manifest(
            revision_id=revision_id,
            status="promote_failed",
            source=config.source_metadata(),
            validation=validation.to_dict(),
            diff=diff.to_dict(),
            build_log=build_log,
            promoted_files=[],
            cache_cleared=None,
            error=str(e),
        )
        write_revision_manifest(revision_id, manifest)
        append_to_index(
            {
                "revision_id": revision_id,
                "status": "promote_failed",
                "error": str(e),
            }
        )
        raise PublishError(
            f"Promote step failed: {e}",
            detail={"stage": "promote", "revision_id": revision_id},
        ) from e

    # ── 7. Clear in-process caches
    cache_cleared: Optional[Dict[str, int]] = None
    if cache_clearer is not None:
        try:
            cache_cleared = cache_clearer()
        except Exception as e:  # noqa: BLE001 — cache failure must not poison publish
            cache_cleared = {"error": str(e)}  # type: ignore[assignment]

    # ── 8. Update current pointer and append to index
    previous_revision_id = read_current_revision_id()
    write_current_pointer(revision_id)

    manifest = _build_manifest(
        revision_id=revision_id,
        status="published",
        source=config.source_metadata(),
        validation=validation.to_dict(),
        diff=diff.to_dict(),
        build_log=build_log,
        promoted_files=promoted,
        cache_cleared=cache_cleared,
        previous_revision_id=previous_revision_id,
    )
    write_revision_manifest(revision_id, manifest)
    append_to_index(
        {
            "revision_id": revision_id,
            "status": "published",
            "previous_revision_id": previous_revision_id,
        }
    )
    return manifest


# ---------------------------------------------------------------------------
# Manifest helper
# ---------------------------------------------------------------------------


def _build_manifest(
    *,
    revision_id: str,
    status: str,
    source: Dict[str, Any],
    validation: Dict[str, Any],
    diff: Dict[str, Any],
    build_log: List[Dict[str, Any]],
    promoted_files: List[Dict[str, str]],
    cache_cleared: Optional[Dict[str, int]],
    error: Optional[str] = None,
    previous_revision_id: Optional[str] = None,
) -> Dict[str, Any]:
    from datetime import datetime, timezone

    plots_processed = sorted(
        {
            plot
            for step in build_log
            if isinstance(step, dict) and step.get("name") == "save_raw_workbook"
            for plot in step.get("row_counts", {}).keys()
        }
    )

    overall_diff = (diff or {}).get("overall", {})
    totals = overall_diff.get("totals", {})

    return {
        "revision_id": revision_id,
        "status": status,
        "schema_version": 2,
        "published_at": datetime.now(timezone.utc).isoformat(timespec="seconds")
        if status == "published"
        else None,
        "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "previous_revision_id": previous_revision_id,
        "source": source,
        "plots_processed": plots_processed,
        "tree_change_summary": {
            "added_trees": int(totals.get("added_trees", 0)),
            "removed_trees": int(totals.get("removed_trees", 0)),
            "species_changes": int(totals.get("species_changes", 0)),
            "dbh_cell_changes": int(totals.get("dbh_cell_changes", 0)),
            "new_year_columns": int(totals.get("new_year_columns", 0)),
            "removed_year_columns": int(totals.get("removed_year_columns", 0)),
            "changed_plots": overall_diff.get("changed_plots", []),
            "headline": overall_diff.get("headline", ""),
        },
        "validation": validation,
        "diff": diff,
        "build_log": build_log,
        "promoted_files": promoted_files,
        "cache_cleared": cache_cleared,
        "error": error,
    }


# ---------------------------------------------------------------------------
# Inspection helpers (used by GET /admin/revisions and CLI)
# ---------------------------------------------------------------------------


def revision_summary(revision_id: str) -> Optional[Dict[str, Any]]:
    """Return a compact summary for a single revision id.

    Reads ``Data/Revisions/<rid>/manifest.json`` and returns only the
    fields useful for listing UI; full manifest is available via
    ``read_revision_manifest`` in :mod:`pipeline.revisions`.
    """
    from .revisions import read_revision_manifest

    manifest = read_revision_manifest(revision_id)
    if manifest is None:
        return None
    return {
        "revision_id": revision_id,
        "status": manifest.get("status"),
        "published_at": manifest.get("published_at"),
        "recorded_at": manifest.get("recorded_at"),
        "previous_revision_id": manifest.get("previous_revision_id"),
        "source": manifest.get("source"),
        "plots_processed": manifest.get("plots_processed", []),
        "tree_change_summary": manifest.get("tree_change_summary", {}),
        "error": manifest.get("error"),
    }


def list_revisions_summary() -> List[Dict[str, Any]]:
    """Return summary dicts for every revision recorded in the index.

    Sorted **newest first**.
    """
    from .revisions import list_published_revisions

    entries = list_published_revisions()
    out: List[Dict[str, Any]] = []
    for entry in entries:
        rid = entry.get("revision_id")
        if not rid:
            continue
        summary = revision_summary(rid)
        if summary is None:
            # Manifest missing — fall back to the index entry so UI never breaks.
            summary = {
                "revision_id": rid,
                "status": entry.get("status", "unknown"),
                "recorded_at": entry.get("recorded_at"),
                "error": entry.get("error"),
            }
        out.append(summary)
    out.sort(key=lambda r: r.get("recorded_at") or "", reverse=True)
    return out


def current_revision_summary() -> Optional[Dict[str, Any]]:
    """Return the manifest summary of the currently-published revision, or None."""
    rid = read_current_revision_id()
    if rid is None:
        return None
    return revision_summary(rid)
