"""
Structured diff between a *staged* workbook and the *current local* dataset.

Phase 1 strategy
----------------
The "current published" dataset is, today, the wide CSVs under
``Data/Raw Data/``. We deliberately do **not** introduce a separate
``Data/Published/`` directory in Phase 1 — that lives in
``src/pipeline/revisions.py`` for Phase 2.

The diff is row/cell-level and intended to be rendered in an admin UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple

import pandas as pd

from .validate_inventory import (
    CANONICAL_PLOTS,
    detect_dbh_year_columns,
    detect_id_column,
    detect_species_column,
    normalize_tree_id,
)

# ---------------------------------------------------------------------------
# Output shape
# ---------------------------------------------------------------------------


@dataclass
class PlotDiff:
    plot: str
    added_trees: List[Dict[str, Any]] = field(default_factory=list)
    removed_trees: List[Dict[str, Any]] = field(default_factory=list)
    species_changes: List[Dict[str, Any]] = field(default_factory=list)
    dbh_cell_changes: List[Dict[str, Any]] = field(default_factory=list)
    new_year_columns: List[int] = field(default_factory=list)
    removed_year_columns: List[int] = field(default_factory=list)

    def has_changes(self) -> bool:
        return any(
            (
                self.added_trees,
                self.removed_trees,
                self.species_changes,
                self.dbh_cell_changes,
                self.new_year_columns,
                self.removed_year_columns,
            )
        )

    def summary(self) -> Dict[str, int]:
        return {
            "added_trees": len(self.added_trees),
            "removed_trees": len(self.removed_trees),
            "species_changes": len(self.species_changes),
            "dbh_cell_changes": len(self.dbh_cell_changes),
            "new_year_columns": len(self.new_year_columns),
            "removed_year_columns": len(self.removed_year_columns),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plot": self.plot,
            "summary": self.summary(),
            "added_trees": self.added_trees,
            "removed_trees": self.removed_trees,
            "species_changes": self.species_changes,
            "dbh_cell_changes": self.dbh_cell_changes,
            "new_year_columns": sorted(self.new_year_columns),
            "removed_year_columns": sorted(self.removed_year_columns),
        }


@dataclass
class WorkbookDiff:
    per_plot: Dict[str, PlotDiff]
    notes: List[str] = field(default_factory=list)

    def overall_summary(self) -> Dict[str, Any]:
        totals = {
            "added_trees": 0,
            "removed_trees": 0,
            "species_changes": 0,
            "dbh_cell_changes": 0,
            "new_year_columns": 0,
            "removed_year_columns": 0,
        }
        changed_plots: List[str] = []
        for plot, d in self.per_plot.items():
            if d.has_changes():
                changed_plots.append(plot)
            for k, v in d.summary().items():
                totals[k] += v
        return {
            "changed_plots": changed_plots,
            "totals": totals,
            "headline": _headline(changed_plots, totals),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall": self.overall_summary(),
            "per_plot": {p: d.to_dict() for p, d in self.per_plot.items()},
            "notes": self.notes,
        }


def _headline(changed_plots: List[str], totals: Dict[str, int]) -> str:
    if not changed_plots:
        return "No changes detected vs current dataset."
    parts: List[str] = []
    if totals["added_trees"]:
        parts.append(f"{totals['added_trees']} new tree(s)")
    if totals["removed_trees"]:
        parts.append(f"{totals['removed_trees']} removed")
    if totals["dbh_cell_changes"]:
        parts.append(f"{totals['dbh_cell_changes']} DBH cell update(s)")
    if totals["species_changes"]:
        parts.append(f"{totals['species_changes']} species change(s)")
    if totals["new_year_columns"]:
        parts.append(f"{totals['new_year_columns']} new year column(s)")
    if totals["removed_year_columns"]:
        parts.append(f"{totals['removed_year_columns']} dropped year column(s)")
    plot_list = ", ".join(changed_plots)
    return f"Changes in {plot_list}: " + "; ".join(parts) if parts else (
        f"Changes in {plot_list}."
    )


# ---------------------------------------------------------------------------
# Current dataset loader
# ---------------------------------------------------------------------------


def _candidate_raw_paths(raw_data_dir: Path, plot: str) -> List[Path]:
    """Return possible filenames for the current wide CSV for ``plot``.

    Tries the config-blessed name first, then the actual on-disk file name
    used in this repo (these currently differ — pre-existing inconsistency).
    """
    return [
        raw_data_dir / f"CO2 Pomfret Raw Data - {plot}.csv",
        raw_data_dir / f"Carbon DBH Raw Data - {plot}.csv",
    ]


def load_current_workbook(raw_data_dir: Optional[Path] = None) -> Dict[str, pd.DataFrame]:
    """Load the current wide-format workbook for diff comparison.

    Plots that have no readable CSV are simply omitted from the returned dict;
    the caller can decide how to surface that.
    """
    import sys
    from pathlib import Path as _Path

    if raw_data_dir is None:
        sys.path.insert(0, str(_Path(__file__).resolve().parent.parent))
        from config import RAW_DATA_DIR  # type: ignore

        raw_data_dir = RAW_DATA_DIR

    workbook: Dict[str, pd.DataFrame] = {}
    for plot in CANONICAL_PLOTS:
        for path in _candidate_raw_paths(raw_data_dir, plot):
            if path.exists():
                try:
                    workbook[plot] = pd.read_csv(path)
                    break
                except Exception:  # noqa: BLE001
                    continue
    return workbook


# ---------------------------------------------------------------------------
# Diff computation
# ---------------------------------------------------------------------------


def _normalize_for_diff(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, Optional[str], Optional[str], Dict[int, str]]:
    """Return (normalized_df_indexed_by_treeid, id_col, species_col, year_map).

    The returned DataFrame is indexed by the *normalized* tree id string and
    has only the columns we diff on: species (canonical key 'Species') plus
    one column per year ``DBH_<year>`` (float, NaN for missing).
    """
    cols = list(df.columns)
    id_col = detect_id_column(cols)
    species_col = detect_species_column(cols)
    year_map = detect_dbh_year_columns(cols)

    if id_col is None or species_col is None:
        # Can't do per-tree diff; return empty.
        return pd.DataFrame(), id_col, species_col, year_map

    ids = df[id_col].map(normalize_tree_id)
    species = df[species_col].astype("string").fillna("").str.strip()

    rows = pd.DataFrame({"TreeID": ids, "Species": species})
    for year, col in year_map.items():
        rows[f"DBH_{year}"] = pd.to_numeric(df[col], errors="coerce")

    # Drop blank ids — they're already flagged by validation; skip in diff.
    rows = rows[rows["TreeID"] != ""].copy()

    # If duplicates exist within a plot, keep the *first* occurrence here
    # (duplicates were already flagged by validation as an error).
    rows = rows.drop_duplicates(subset=["TreeID"], keep="first")
    rows = rows.set_index("TreeID")
    return rows, id_col, species_col, year_map


def _species_changed(a: Any, b: Any) -> bool:
    """Case- and whitespace-insensitive species comparison."""
    sa = "" if pd.isna(a) else str(a).strip().lower()
    sb = "" if pd.isna(b) else str(b).strip().lower()
    return sa != sb


def _dbh_changed(a: Any, b: Any) -> bool:
    """Compare two DBH cells. NaN==NaN is treated as unchanged."""
    a_na = a is None or (isinstance(a, float) and pd.isna(a))
    b_na = b is None or (isinstance(b, float) and pd.isna(b))
    if a_na and b_na:
        return False
    if a_na != b_na:
        return True
    return not (float(a) == float(b))


def compute_plot_diff(
    plot: str,
    staged_df: pd.DataFrame,
    current_df: pd.DataFrame,
) -> PlotDiff:
    diff = PlotDiff(plot=plot)
    staged_norm, _, _, staged_years = _normalize_for_diff(staged_df)
    current_norm, _, _, current_years = _normalize_for_diff(current_df)

    diff.new_year_columns = sorted(set(staged_years) - set(current_years))
    diff.removed_year_columns = sorted(set(current_years) - set(staged_years))

    if staged_norm.empty and current_norm.empty:
        return diff

    staged_ids = set(staged_norm.index) if not staged_norm.empty else set()
    current_ids = set(current_norm.index) if not current_norm.empty else set()

    added = sorted(staged_ids - current_ids)
    removed = sorted(current_ids - staged_ids)
    common = sorted(staged_ids & current_ids)

    for tid in added:
        diff.added_trees.append(
            {
                "tree_id": tid,
                "species": _safe_get(staged_norm, tid, "Species"),
            }
        )
    for tid in removed:
        diff.removed_trees.append(
            {
                "tree_id": tid,
                "species": _safe_get(current_norm, tid, "Species"),
            }
        )

    shared_years = sorted(set(staged_years) & set(current_years))
    for tid in common:
        s_species = _safe_get(staged_norm, tid, "Species")
        c_species = _safe_get(current_norm, tid, "Species")
        if _species_changed(s_species, c_species):
            diff.species_changes.append(
                {"tree_id": tid, "from": c_species, "to": s_species}
            )
        for year in shared_years:
            col = f"DBH_{year}"
            s_val = _safe_get(staged_norm, tid, col)
            c_val = _safe_get(current_norm, tid, col)
            if _dbh_changed(s_val, c_val):
                diff.dbh_cell_changes.append(
                    {
                        "tree_id": tid,
                        "year": year,
                        "from": None if pd.isna(c_val) else float(c_val),
                        "to": None if pd.isna(s_val) else float(s_val),
                    }
                )

    return diff


def _safe_get(df: pd.DataFrame, tid: str, col: str) -> Any:
    if col not in df.columns:
        return None
    try:
        return df.at[tid, col]
    except KeyError:
        return None


def compute_workbook_diff(
    staged_workbook: Mapping[str, pd.DataFrame],
    current_workbook: Mapping[str, pd.DataFrame],
) -> WorkbookDiff:
    per_plot: Dict[str, PlotDiff] = {}
    notes: List[str] = []

    plot_keys = list(
        sorted(set(staged_workbook.keys()) | set(current_workbook.keys()))
    )
    for plot in plot_keys:
        staged_df = staged_workbook.get(plot)
        current_df = current_workbook.get(plot)
        if staged_df is None:
            notes.append(f"Plot '{plot}' missing from staged workbook.")
            staged_df = pd.DataFrame()
        if current_df is None:
            notes.append(f"Plot '{plot}' missing from current dataset.")
            current_df = pd.DataFrame()
        per_plot[plot] = compute_plot_diff(plot, staged_df, current_df)

    return WorkbookDiff(per_plot=per_plot, notes=notes)
