"""Unit tests for the publish-pipeline wrappers in ``pipeline.process_inventory``.

These tests intentionally cover **only** the pure / IO paths that don't
require trained ML artifacts:

* ``save_raw_workbook`` writes canonical + human-friendly filenames.
* ``build_long_dbh`` reuses the existing ``transform_plot`` correctly.
* ``build_carbon`` reuses ``add_carbon_and_carbon_growth`` and emits
  the combined ``all_plots_with_carbon.csv``.
* ``canonical_destinations`` returns the right (src, dest) pairs.
* ``promote_artifacts`` atomically swaps files into a destination dir.
* ``override_canonical_paths`` patches and restores the snapshot
  module's ``CARBON_ALL_PLOTS`` binding.

Snapshot generation itself is not tested here — it needs the trained
baseline curves and stochastic seed plumbing which belong in a model
test suite.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from pipeline.process_inventory import (  # noqa: E402
    CANONICAL_CARBON_ALL_FILENAME,
    CANONICAL_CARBON_FILENAME,
    CANONICAL_DBH_LONG_FILENAME,
    CANONICAL_RAW_FILENAME,
    build_carbon,
    build_long_dbh,
    canonical_destinations,
    override_canonical_paths,
    promote_artifacts,
    save_raw_workbook,
)


# ---------------------------------------------------------------------------
# Fixtures (zero-dependency)
# ---------------------------------------------------------------------------


def _make_plot_df(prefix: str) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Tree ID": f"{prefix}-1",
                "Tree Species": "red oak",
                "DBH - 2023": 10.1,
                "DBH - 2024": 11.4,
                "DBH - 2025": 12.0,
            },
            {
                "Tree ID": f"{prefix}-2",
                "Tree Species": "white pine",
                "DBH - 2023": 8.6,
                "DBH - 2024": 9.2,
                "DBH - 2025": 9.9,
            },
        ]
    )


def _sample_workbook() -> dict[str, pd.DataFrame]:
    return {
        "Lower": _make_plot_df("L"),
        "Middle": _make_plot_df("M"),
        "Upper": _make_plot_df("U"),
    }


# ---------------------------------------------------------------------------
# save_raw_workbook
# ---------------------------------------------------------------------------


def test_save_raw_workbook_writes_canonical_and_short_names():
    workbook = _sample_workbook()
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp)
        result = save_raw_workbook(workbook, target, canonical_names=True)

        for plot in ("Lower", "Middle", "Upper"):
            short = target / f"{plot}.csv"
            canonical = target / CANONICAL_RAW_FILENAME.format(plot=plot)
            assert short.exists(), f"missing short name for {plot}"
            assert canonical.exists(), f"missing canonical name for {plot}"

        assert result.row_counts == {"Lower": 2, "Middle": 2, "Upper": 2}
        # Each plot contributes 2 output paths (short + canonical).
        assert len(result.output_paths) == 6


def test_save_raw_workbook_skips_canonical_when_disabled():
    workbook = {"Lower": _make_plot_df("L")}
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp)
        save_raw_workbook(workbook, target, canonical_names=False)

        assert (target / "Lower.csv").exists()
        canonical = target / CANONICAL_RAW_FILENAME.format(plot="Lower")
        assert not canonical.exists()


# ---------------------------------------------------------------------------
# build_long_dbh + build_carbon
# ---------------------------------------------------------------------------


def test_build_long_dbh_emits_expected_files_and_columns():
    workbook = _sample_workbook()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        raw_dir = tmp_path / "raw"
        dbh_dir = tmp_path / "dbh"
        save_raw_workbook(workbook, raw_dir, canonical_names=True)

        result, long_dfs = build_long_dbh(raw_dir, dbh_dir)

        assert set(long_dfs.keys()) == {"Lower", "Middle", "Upper"}
        for plot, df in long_dfs.items():
            # The transform should have produced a "Year" and "DBH" column.
            assert "Year" in df.columns
            cols_lower = {c.lower() for c in df.columns}
            assert any("dbh" in c for c in cols_lower)
            assert len(df) > 0

            expected_file = dbh_dir / CANONICAL_DBH_LONG_FILENAME.format(
                plot_lower=plot.lower()
            )
            assert expected_file.exists()


def test_build_carbon_writes_per_plot_and_all_plots_csv():
    workbook = _sample_workbook()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        raw_dir = tmp_path / "raw"
        dbh_dir = tmp_path / "dbh"
        carbon_dir = tmp_path / "carbon"
        save_raw_workbook(workbook, raw_dir, canonical_names=True)
        _, long_dfs = build_long_dbh(raw_dir, dbh_dir)

        result, all_plots_path = build_carbon(long_dfs, carbon_dir)

        for plot in ("Lower", "Middle", "Upper"):
            per_plot = carbon_dir / CANONICAL_CARBON_FILENAME.format(
                plot_lower=plot.lower()
            )
            assert per_plot.exists(), f"missing per-plot carbon for {plot}"

        assert all_plots_path.name == CANONICAL_CARBON_ALL_FILENAME
        assert all_plots_path.exists()
        combined = pd.read_csv(all_plots_path)
        # Combined should have rows from all three plots.
        assert "Plot" in combined.columns or "plot" in combined.columns
        assert len(combined) > 0
        # And it should be the sum of the per-plot files.
        per_plot_totals = sum(
            len(pd.read_csv(carbon_dir / CANONICAL_CARBON_FILENAME.format(
                plot_lower=p.lower()
            )))
            for p in ("Lower", "Middle", "Upper")
        )
        assert len(combined) == per_plot_totals


# ---------------------------------------------------------------------------
# canonical_destinations + promote_artifacts
# ---------------------------------------------------------------------------


def test_canonical_destinations_covers_required_artifacts():
    with tempfile.TemporaryDirectory() as tmp:
        rev_root = Path(tmp) / "rev"
        pairs = canonical_destinations(revision_root=rev_root, include_nn_epsilon=False)

        rel = {str(dst) for _, dst in pairs}

        # Raw — 3 plots, canonical filenames
        for plot in ("Lower", "Middle", "Upper"):
            assert any(f"CO2 Pomfret Raw Data - {plot}.csv" in s for s in rel)

        # Processed Carbon: per-plot + combined
        assert any("all_plots_with_carbon.csv" in s for s in rel)

        # Snapshots required by live routes
        assert any("forest_snapshots_baseline/forest_0_years.csv" in s for s in rel)
        assert any(
            "forest_snapshots_baseline_stochastic/forest_20_years.csv" in s for s in rel
        )
        # NN epsilon NOT requested
        assert not any("forest_snapshots_nn_epsilon" in s for s in rel)


def test_canonical_destinations_includes_nn_epsilon_when_requested():
    with tempfile.TemporaryDirectory() as tmp:
        rev_root = Path(tmp) / "rev"
        pairs = canonical_destinations(revision_root=rev_root, include_nn_epsilon=True)
        rel = {str(dst) for _, dst in pairs}
        assert any("forest_snapshots_nn_epsilon/forest_nn_0_years.csv" in s for s in rel)
        assert any("forest_snapshots_nn_epsilon/forest_nn_20_years.csv" in s for s in rel)


def test_promote_artifacts_swaps_files_atomically():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / "src.csv"
        dest = tmp_path / "nested" / "dest.csv"
        src.write_text("v=new\n")
        # Pre-existing destination with stale content
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("v=old\n")

        moves = promote_artifacts([(src, dest)])

        assert dest.read_text() == "v=new\n"
        # No leftover ``*.new`` temp files
        assert not list(dest.parent.glob("*.new"))
        assert moves and moves[0]["to"] == str(dest)


# ---------------------------------------------------------------------------
# override_canonical_paths
# ---------------------------------------------------------------------------


def test_override_canonical_paths_restores_on_exit():
    import models.forest_snapshots as fs

    original = fs.CARBON_ALL_PLOTS
    fake = Path("/tmp/fake_carbon.csv")

    with override_canonical_paths(carbon_all_plots=fake):
        assert fs.CARBON_ALL_PLOTS == fake

    assert fs.CARBON_ALL_PLOTS == original


def test_override_canonical_paths_restores_on_exception():
    import models.forest_snapshots as fs

    original = fs.CARBON_ALL_PLOTS
    fake = Path("/tmp/fake_carbon.csv")

    try:
        with override_canonical_paths(carbon_all_plots=fake):
            assert fs.CARBON_ALL_PLOTS == fake
            raise RuntimeError("simulated")
    except RuntimeError:
        pass

    assert fs.CARBON_ALL_PLOTS == original
