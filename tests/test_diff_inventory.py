"""Tests for ``src/pipeline/diff_inventory.py``."""

from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import math  # noqa: E402

import pandas as pd  # noqa: E402

from pipeline.diff_inventory import (  # noqa: E402
    compute_plot_diff,
    compute_workbook_diff,
)


def _df(
    tree_ids,
    species,
    *,
    extra: dict | None = None,
    year_cols: dict | None = None,
) -> pd.DataFrame:
    data = {
        "Tree ID Number": tree_ids,
        "Tree Species": species,
    }
    if year_cols:
        for col, values in year_cols.items():
            data[col] = values
    if extra:
        data.update(extra)
    return pd.DataFrame(data)


# ---------------------------------------------------------------------------
# compute_plot_diff
# ---------------------------------------------------------------------------


def test_plot_diff_no_changes() -> None:
    df = _df([1, 2], ["red oak", "sugar maple"], year_cols={"DBH - 2025": [10, 20]})
    diff = compute_plot_diff("Upper", df.copy(), df.copy())
    assert diff.has_changes() is False
    assert diff.summary() == {
        "added_trees": 0,
        "removed_trees": 0,
        "species_changes": 0,
        "dbh_cell_changes": 0,
        "new_year_columns": 0,
        "removed_year_columns": 0,
    }


def test_plot_diff_added_tree() -> None:
    current = _df([1, 2], ["red oak", "sugar maple"], year_cols={"DBH - 2025": [10, 20]})
    staged = _df([1, 2, 3], ["red oak", "sugar maple", "beech"], year_cols={"DBH - 2025": [10, 20, 5]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.summary()["added_trees"] == 1
    assert diff.added_trees[0]["tree_id"] == "3"
    assert diff.added_trees[0]["species"] == "beech"


def test_plot_diff_removed_tree() -> None:
    current = _df([1, 2, 3], ["a", "b", "c"], year_cols={"DBH - 2025": [10, 20, 30]})
    staged = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10, 20]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.summary()["removed_trees"] == 1
    assert diff.removed_trees[0]["tree_id"] == "3"


def test_plot_diff_dbh_cell_change() -> None:
    current = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10.0, 20.0]})
    staged = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10.5, 20.0]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.summary()["dbh_cell_changes"] == 1
    change = diff.dbh_cell_changes[0]
    assert change["tree_id"] == "1"
    assert change["year"] == 2025
    assert change["from"] == 10.0 and change["to"] == 10.5


def test_plot_diff_dbh_nan_to_value_is_change() -> None:
    current = _df([1], ["a"], year_cols={"DBH - 2025": [float("nan")]})
    staged = _df([1], ["a"], year_cols={"DBH - 2025": [12.0]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.summary()["dbh_cell_changes"] == 1
    assert diff.dbh_cell_changes[0]["from"] is None
    assert diff.dbh_cell_changes[0]["to"] == 12.0


def test_plot_diff_nan_to_nan_is_not_change() -> None:
    current = _df([1], ["a"], year_cols={"DBH - 2025": [float("nan")]})
    staged = _df([1], ["a"], year_cols={"DBH - 2025": [float("nan")]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.summary()["dbh_cell_changes"] == 0


def test_plot_diff_new_year_column() -> None:
    current = _df([1], ["a"], year_cols={"DBH - 2024": [10.0]})
    staged = _df([1], ["a"], year_cols={"DBH - 2024": [10.0], "DBH - 2025": [11.0]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.new_year_columns == [2025]
    assert diff.removed_year_columns == []


def test_plot_diff_species_change_case_insensitive() -> None:
    current = _df([1], ["Red Oak"], year_cols={"DBH - 2025": [10]})
    staged = _df([1], ["red oak"], year_cols={"DBH - 2025": [10]})
    diff = compute_plot_diff("Upper", staged, current)
    # Casing only — not a real change.
    assert diff.species_changes == []


def test_plot_diff_species_change_real() -> None:
    current = _df([1], ["red oak"], year_cols={"DBH - 2025": [10]})
    staged = _df([1], ["sugar maple"], year_cols={"DBH - 2025": [10]})
    diff = compute_plot_diff("Upper", staged, current)
    assert len(diff.species_changes) == 1
    assert diff.species_changes[0]["from"].lower() == "red oak"
    assert diff.species_changes[0]["to"].lower() == "sugar maple"


def test_plot_diff_handles_sheets_dot_zero_ids() -> None:
    # Sheets often delivers integer ids as "1.0" / "2.0" — diff must not flag
    # those as added/removed if they match canonical ints in the current CSV.
    current = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10, 20]})
    staged = _df(["1.0", "2.0"], ["a", "b"], year_cols={"DBH - 2025": [10, 20]})
    diff = compute_plot_diff("Upper", staged, current)
    assert diff.has_changes() is False


# ---------------------------------------------------------------------------
# compute_workbook_diff
# ---------------------------------------------------------------------------


def test_workbook_diff_overall_summary_quiet() -> None:
    base = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10, 20]})
    wb = {p: base.copy() for p in ("Lower", "Middle", "Upper")}
    result = compute_workbook_diff(wb, wb)
    overall = result.overall_summary()
    assert overall["changed_plots"] == []
    assert overall["totals"]["added_trees"] == 0
    assert "No changes detected" in overall["headline"]


def test_workbook_diff_overall_summary_changes() -> None:
    base = _df([1, 2], ["a", "b"], year_cols={"DBH - 2025": [10, 20]})
    staged = {
        "Lower": base.copy(),
        "Middle": base.copy(),
        "Upper": _df([1, 2, 3], ["a", "b", "c"], year_cols={"DBH - 2025": [10, 20, 30]}),
    }
    current = {p: base.copy() for p in ("Lower", "Middle", "Upper")}
    result = compute_workbook_diff(staged, current)
    overall = result.overall_summary()
    assert overall["changed_plots"] == ["Upper"]
    assert overall["totals"]["added_trees"] == 1
    assert "Upper" in overall["headline"]


def test_workbook_diff_records_missing_sides() -> None:
    base = _df([1], ["a"], year_cols={"DBH - 2025": [10]})
    staged = {"Upper": base}
    current = {"Lower": base, "Upper": base}
    result = compute_workbook_diff(staged, current)
    # 'Lower' is missing from staged → diff is still produced (empty staged
    # side means all current trees look 'removed'). The note documents why.
    assert "Lower" in result.per_plot
    assert any("Lower" in n for n in result.notes)


# ---------------------------------------------------------------------------
# Bare runner entrypoint
# ---------------------------------------------------------------------------


def _run_all() -> None:
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")


if __name__ == "__main__":
    _run_all()
    print("test_diff_inventory.py: all passed")
