"""Tests for ``src/pipeline/validate_inventory.py``.

Pure functions only — no Google Sheets calls, no filesystem writes.
Compatible with both ``pytest`` and the bare ``tests/run_all.py`` runner.
"""

from __future__ import annotations

# Path setup mirrors conftest.py so the bare runner works too.
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import pandas as pd  # noqa: E402

from pipeline.validate_inventory import (  # noqa: E402
    detect_dbh_year_columns,
    detect_id_column,
    detect_species_column,
    normalize_tree_id,
    validate_plot,
    validate_workbook,
)


def _good_plot_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Tree ID Number": [1, 2, 3],
            "Tree Species": ["Sugar Maple", "Red Oak", "Beech"],
            "DBH - 2024": [10.0, 20.0, 30.0],
            "DBH - 2025": [10.5, 20.5, 30.5],
        }
    )


# ---------------------------------------------------------------------------
# detection helpers
# ---------------------------------------------------------------------------


def test_detect_id_column_handles_variants() -> None:
    assert detect_id_column(["Tree ID Number", "Tree Species"]) == "Tree ID Number"
    assert detect_id_column(["TREE ID", "Species"]) == "TREE ID"
    assert detect_id_column(["Species", "DBH - 2025"]) is None


def test_detect_species_column() -> None:
    assert detect_species_column(["Tree ID", "Tree Species"]) == "Tree Species"
    assert detect_species_column(["x", "y"]) is None


def test_detect_dbh_year_columns_extracts_year() -> None:
    cols = ["Tree ID", "Species", "DBH - 2020", "DBH - 2025", "Notes"]
    years = detect_dbh_year_columns(cols)
    assert years == {2020: "DBH - 2020", 2025: "DBH - 2025"}


def test_detect_dbh_year_columns_ignores_non_dbh_with_year() -> None:
    # 'Planted - 2025' has a year but no 'dbh'; must be ignored.
    cols = ["Tree ID", "Species", "DBH - 2025", "Planted - 2025"]
    assert detect_dbh_year_columns(cols) == {2025: "DBH - 2025"}


# ---------------------------------------------------------------------------
# normalize_tree_id
# ---------------------------------------------------------------------------


def test_normalize_tree_id_strips_dot_zero() -> None:
    assert normalize_tree_id("1.0") == "1"
    assert normalize_tree_id(2) == "2"
    assert normalize_tree_id("416 (was 683)") == "416 (was 683)"
    assert normalize_tree_id("") == ""
    assert normalize_tree_id(None) == ""


# ---------------------------------------------------------------------------
# validate_plot
# ---------------------------------------------------------------------------


def test_validate_plot_happy_path() -> None:
    result = validate_plot(_good_plot_df(), "Upper")
    assert result.is_valid is True
    assert result.id_column == "Tree ID Number"
    assert result.species_column == "Tree Species"
    assert sorted(result.dbh_year_columns) == [2024, 2025]
    assert result.findings == []


def test_validate_plot_missing_columns_yields_errors() -> None:
    df = pd.DataFrame({"foo": [1], "bar": [2]})
    result = validate_plot(df, "Upper")
    assert result.is_valid is False
    codes = {f.code for f in result.findings}
    assert "missing_id_column" in codes
    assert "missing_species_column" in codes
    assert "missing_dbh_year_columns" in codes


def test_validate_plot_duplicate_ids_within_plot() -> None:
    df = _good_plot_df()
    df.loc[2, "Tree ID Number"] = 1  # duplicate of row 0
    result = validate_plot(df, "Upper")
    assert result.is_valid is False
    assert any(
        f.code == "duplicate_tree_ids_within_plot" for f in result.findings
    )


def test_validate_plot_non_numeric_dbh_is_warning_not_error() -> None:
    df = _good_plot_df()
    df.loc[1, "DBH - 2025"] = "n/a"
    result = validate_plot(df, "Upper")
    assert result.is_valid is True  # warnings only
    codes = {f.code for f in result.findings}
    assert "non_numeric_dbh" in codes


def test_validate_plot_dbh_out_of_range_is_warning() -> None:
    df = _good_plot_df()
    df.loc[0, "DBH - 2025"] = 999.0
    result = validate_plot(df, "Upper")
    assert result.is_valid is True
    assert any(f.code == "dbh_out_of_range" for f in result.findings)


# ---------------------------------------------------------------------------
# validate_workbook
# ---------------------------------------------------------------------------


def test_validate_workbook_full_happy_path() -> None:
    wb = {p: _good_plot_df() for p in ("Lower", "Middle", "Upper")}
    result = validate_workbook(wb)
    assert result.is_valid is True
    assert set(result.per_plot.keys()) == {"Lower", "Middle", "Upper"}
    assert result.summary()["errors"] == 0


def test_validate_workbook_unknown_plot_is_error() -> None:
    wb = {"Lower": _good_plot_df(), "Middle": _good_plot_df(), "FooBar": _good_plot_df()}
    result = validate_workbook(wb)
    assert result.is_valid is False
    codes = {f.code for f in result.findings}
    assert "unknown_plot_keys" in codes


def test_validate_workbook_missing_plot_is_warning_only() -> None:
    wb = {"Lower": _good_plot_df(), "Middle": _good_plot_df()}
    result = validate_workbook(wb)
    codes = {f.code for f in result.findings}
    assert "missing_plots" in codes
    # Only a warning — workbook can still be previewed.
    assert result.is_valid is True


def test_validate_workbook_cross_plot_duplicate_id_is_warning() -> None:
    a = _good_plot_df()
    b = _good_plot_df()  # also has ids 1,2,3
    wb = {"Lower": a, "Middle": b, "Upper": _good_plot_df()}
    result = validate_workbook(wb)
    codes = {f.code for f in result.findings}
    assert "tree_id_appears_in_multiple_plots" in codes


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
    print("test_validate_inventory.py: all passed")
