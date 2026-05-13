"""
Thin wrappers around the existing preprocessing & snapshot generators.

Goals
-----
* **Reuse** ``src/preprocessing/transform.py`` and
  ``src/preprocessing/carbon_calc.py`` and
  ``src/models/forest_snapshots.py`` — Phase 2 must not refactor or retrain.
* Accept **explicit input/output paths** so each step can be run inside a
  per-revision directory without touching canonical paths.
* Provide a tiny :func:`override_canonical_paths` context manager that
  temporarily redirects the few module-level constants the snapshot
  generator reads from ``config`` at import time. This lets the publish
  pipeline stay atomic — nothing under ``Data/Processed Data/`` is
  written until the final promote step.

Nothing in this module touches the FastAPI app or its caches.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

import pandas as pd

# Make ``src/`` importable when this module is loaded directly.
_SRC = Path(__file__).resolve().parent.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from config import (  # type: ignore  # noqa: E402
    CARBON_ALL_PLOTS,
    PROCESSED_DATA_DIR,
    RAW_DATA_DIR,
)
from preprocessing.carbon_calc import add_carbon_and_carbon_growth  # noqa: E402
from preprocessing.transform import transform_plot  # noqa: E402

from .validate_inventory import CANONICAL_PLOTS  # noqa: E402


# ---------------------------------------------------------------------------
# Constants — canonical filenames the rest of the codebase reads
# ---------------------------------------------------------------------------

# Per-plot raw CSV filename (matches the names imported in src/config.py).
# These differ from the on-disk legacy ``Carbon DBH Raw Data - *.csv`` files;
# see ARCHITECTURE_HANDOFF_DATA_PIPELINE.md §10 (pre-existing inconsistency).
CANONICAL_RAW_FILENAME = "CO2 Pomfret Raw Data - {plot}.csv"

# Per-plot processed DBH filename (under Processed Data/DBH/).
CANONICAL_DBH_LONG_FILENAME = "{plot_lower}_long_with_growth.csv"

# Per-plot processed Carbon filename (under Processed Data/Carbon/).
CANONICAL_CARBON_FILENAME = "{plot_lower}_with_carbon.csv"
CANONICAL_CARBON_ALL_FILENAME = "all_plots_with_carbon.csv"

# Snapshot subdirectories (under Processed Data/) consumed by live routes.
SNAPSHOTS_BASELINE_SUBDIR = "forest_snapshots_baseline"
SNAPSHOTS_BASELINE_STOCH_SUBDIR = "forest_snapshots_baseline_stochastic"
SNAPSHOTS_NN_EPSILON_SUBDIR = "forest_snapshots_nn_epsilon"

# Default keyframes generated for baseline / baseline_stochastic.
# Aligned with the values hard-coded in src/api/app.py:
#   * /summary               → uses baseline / baseline_stochastic snapshots
#   * /vector-forest/snapshot → keyframes [0, 5, 10, 20] with interpolation
DEFAULT_KEYFRAME_YEARS: Tuple[int, ...] = (0, 5, 10, 20)
DEFAULT_NN_EPSILON_YEARS: Tuple[int, ...] = tuple(range(0, 21))
DEFAULT_STOCHASTIC_SEED: int = 42


# ---------------------------------------------------------------------------
# Result shapes
# ---------------------------------------------------------------------------


@dataclass
class StepResult:
    """Summary of a single build step (transform / carbon / snapshots)."""

    name: str
    output_paths: List[str] = field(default_factory=list)
    row_counts: Dict[str, int] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "output_paths": self.output_paths,
            "row_counts": self.row_counts,
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# Path-override context manager
# ---------------------------------------------------------------------------


@contextmanager
def override_canonical_paths(
    *,
    carbon_all_plots: Optional[Path] = None,
):
    """Temporarily redirect the few module-level paths the snapshot
    generator reads at import time.

    The snapshot generators in ``models/forest_snapshots*.py`` import
    ``CARBON_ALL_PLOTS`` and ``PROCESSED_DATA_DIR`` from ``config`` *at
    module import time*, so patching ``config.X`` after import doesn't
    propagate. Instead we patch the local module bindings.

    Only ``carbon_all_plots`` is exposed — that is the only path the publish
    pipeline needs to redirect so snapshots can be regenerated from a
    revision-scoped carbon CSV without touching canonical files.
    """
    import models.forest_snapshots as fs  # noqa: E402

    backups: Dict[str, Any] = {}
    if carbon_all_plots is not None:
        backups["CARBON_ALL_PLOTS"] = fs.CARBON_ALL_PLOTS
        fs.CARBON_ALL_PLOTS = Path(carbon_all_plots)
    try:
        yield
    finally:
        for name, value in backups.items():
            setattr(fs, name, value)


# ---------------------------------------------------------------------------
# Step 1 — Save raw workbook to a target directory
# ---------------------------------------------------------------------------


def save_raw_workbook(
    workbook: Mapping[str, pd.DataFrame],
    target_dir: Path,
    *,
    canonical_names: bool = True,
) -> StepResult:
    """Write each plot's wide DataFrame as a CSV under ``target_dir``.

    When ``canonical_names`` is True (default), filenames match
    :data:`CANONICAL_RAW_FILENAME` so downstream steps that read by path
    work out-of-the-box. Plot files are also written under the
    human-readable name (``Lower.csv`` / ``Middle.csv`` / ``Upper.csv``)
    for ergonomics in the revision directory.
    """
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    result = StepResult(name="save_raw_workbook")
    for plot, df in workbook.items():
        # Human-friendly copy
        short_path = target_dir / f"{plot}.csv"
        df.to_csv(short_path, index=False)
        result.output_paths.append(str(short_path))
        result.row_counts[plot] = int(len(df))

        if canonical_names:
            canon = target_dir / CANONICAL_RAW_FILENAME.format(plot=plot)
            if canon != short_path:
                df.to_csv(canon, index=False)
                result.output_paths.append(str(canon))
    return result


# ---------------------------------------------------------------------------
# Step 2 — wide → long DBH with growth (via existing transform_plot)
# ---------------------------------------------------------------------------


def build_long_dbh(
    raw_dir: Path,
    output_dir: Path,
    *,
    plots: Iterable[str] = CANONICAL_PLOTS,
) -> Tuple[StepResult, Dict[str, pd.DataFrame]]:
    """Run ``transform_plot`` for each plot's canonical raw CSV.

    Reads ``<raw_dir>/<CANONICAL_RAW_FILENAME>`` and writes
    ``<output_dir>/<CANONICAL_DBH_LONG_FILENAME>``.

    Returns the :class:`StepResult` plus the in-memory long DataFrames
    keyed by canonical plot name (used by the next step).
    """
    raw_dir = Path(raw_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = StepResult(name="build_long_dbh")
    long_dfs: Dict[str, pd.DataFrame] = {}
    for plot in plots:
        raw_path = raw_dir / CANONICAL_RAW_FILENAME.format(plot=plot)
        if not raw_path.exists():
            result.notes.append(f"Skipping {plot}: raw CSV missing at {raw_path}.")
            continue
        df_long = transform_plot(str(raw_path), plot)
        out_path = output_dir / CANONICAL_DBH_LONG_FILENAME.format(
            plot_lower=plot.lower()
        )
        df_long.to_csv(out_path, index=False)
        long_dfs[plot] = df_long
        result.output_paths.append(str(out_path))
        result.row_counts[plot] = int(len(df_long))
    return result, long_dfs


# ---------------------------------------------------------------------------
# Step 3 — long DBH → carbon (via existing add_carbon_and_carbon_growth)
# ---------------------------------------------------------------------------


def build_carbon(
    long_dfs: Mapping[str, pd.DataFrame],
    output_dir: Path,
) -> Tuple[StepResult, Path]:
    """Run ``add_carbon_and_carbon_growth`` per plot and write the combined CSV.

    Returns the :class:`StepResult` plus the path of the combined
    ``all_plots_with_carbon.csv`` (consumed by snapshot generation).
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = StepResult(name="build_carbon")
    combined: List[pd.DataFrame] = []

    for plot, df in long_dfs.items():
        with_carbon = add_carbon_and_carbon_growth(df)
        per_plot_path = output_dir / CANONICAL_CARBON_FILENAME.format(
            plot_lower=plot.lower()
        )
        with_carbon.to_csv(per_plot_path, index=False)
        result.output_paths.append(str(per_plot_path))
        result.row_counts[plot] = int(len(with_carbon))
        combined.append(with_carbon)

    if not combined:
        result.notes.append("No plot long DataFrames provided; no carbon CSV written.")
        return result, output_dir / CANONICAL_CARBON_ALL_FILENAME

    all_plots = pd.concat(combined, ignore_index=True)
    all_plots_path = output_dir / CANONICAL_CARBON_ALL_FILENAME
    all_plots.to_csv(all_plots_path, index=False)
    result.output_paths.append(str(all_plots_path))
    result.row_counts["__all__"] = int(len(all_plots))
    return result, all_plots_path


# ---------------------------------------------------------------------------
# Step 4 — Forest-wide snapshot generation
# ---------------------------------------------------------------------------


def build_snapshots(
    *,
    carbon_all_plots_path: Path,
    output_dir: Path,
    mode: str,
    years_list: Iterable[int] = DEFAULT_KEYFRAME_YEARS,
    seed: Optional[int] = None,
) -> StepResult:
    """Generate forest snapshots under ``output_dir`` for the given ``mode``.

    Supported modes (delegates to ``models/forest_snapshots.py``):
    ``baseline``, ``baseline_stochastic``.
    """
    from models.forest_snapshots import generate_forest_snapshots  # noqa: E402

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = StepResult(name=f"build_snapshots:{mode}")
    with override_canonical_paths(carbon_all_plots=carbon_all_plots_path):
        kwargs: Dict[str, Any] = {
            "years_list": list(years_list),
            "output_dir": str(output_dir),
            "mode": mode,
        }
        if seed is not None and mode == "baseline_stochastic":
            kwargs["seed"] = seed
        generate_forest_snapshots(**kwargs)

    for year in years_list:
        path = output_dir / f"forest_{year}_years.csv"
        if path.exists():
            df = pd.read_csv(path)
            result.output_paths.append(str(path))
            result.row_counts[f"year_{year}"] = int(len(df))
        else:
            result.notes.append(f"Expected snapshot missing: {path.name}")
    return result


def build_snapshots_nn_epsilon(
    *,
    carbon_all_plots_path: Path,
    output_dir: Path,
    years_list: Iterable[int] = DEFAULT_NN_EPSILON_YEARS,
    epsilon_cm: float = 0.02,
) -> StepResult:
    """Generate the legacy NN epsilon snapshots (years 0–20).

    Off by default in publish — kept available for callers that explicitly
    opt in via the admin route's ``include_nn_epsilon`` flag. Requires the
    trained NN artifacts under ``Models/`` to be present.
    """
    from models.forest_snapshots_nn import generate_forest_snapshots as gen_nn  # noqa: E402

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    result = StepResult(name="build_snapshots:nn_epsilon")

    with override_canonical_paths(carbon_all_plots=carbon_all_plots_path):
        gen_nn(
            years_list=list(years_list),
            output_dir=str(output_dir),
            model_type="nn_state",
            simulation_mode="epsilon",
            epsilon_cm=epsilon_cm,
        )

    for year in years_list:
        path = output_dir / f"forest_nn_{year}_years.csv"
        if path.exists():
            df = pd.read_csv(path)
            result.output_paths.append(str(path))
            result.row_counts[f"year_{year}"] = int(len(df))
        else:
            result.notes.append(f"Expected NN snapshot missing: {path.name}")
    return result


# ---------------------------------------------------------------------------
# Step 5 — atomic promote (copy revision artifacts → canonical paths)
# ---------------------------------------------------------------------------


def promote_artifacts(file_pairs: Iterable[Tuple[Path, Path]]) -> List[Dict[str, str]]:
    """Copy each ``(src, dest)`` pair atomically per file.

    Uses ``src → dest.new → os.replace(dest)`` so any single file swap is
    atomic on the same filesystem. Whole-set atomicity is not achievable
    without symlinks (see docstring of :mod:`pipeline.publish` for the
    trade-off discussion). The dest directory is created if needed.
    """
    import os
    import shutil

    moves: List[Dict[str, str]] = []
    for src, dest in file_pairs:
        src = Path(src)
        dest = Path(dest)
        if not src.exists():
            raise FileNotFoundError(f"Promote source missing: {src}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".new")
        shutil.copy2(src, tmp)
        os.replace(tmp, dest)
        moves.append({"from": str(src), "to": str(dest)})
    return moves


# ---------------------------------------------------------------------------
# Convenience — discover the canonical destination for a revision artifact
# ---------------------------------------------------------------------------


def canonical_destinations(
    *,
    revision_root: Path,
    plots: Iterable[str] = CANONICAL_PLOTS,
    include_nn_epsilon: bool = False,
) -> List[Tuple[Path, Path]]:
    """Return ``(revision_src, canonical_dest)`` pairs for every file the
    publish process should swap into the live dataset.

    Mirrors the canonical layout consumed by:

    * ``transform_plot`` and ``add_carbon_and_carbon_growth`` (raw + processed)
    * ``/summary``                     (forest_snapshots_baseline/forest_{N}_years.csv)
    * ``/vector-forest/snapshot``      (forest_snapshots_baseline_stochastic/...)
    * Legacy ``/snapshots`` if ``include_nn_epsilon`` is True.
    """
    revision_root = Path(revision_root)
    pairs: List[Tuple[Path, Path]] = []

    # Raw
    raw_src = revision_root / "raw"
    for plot in plots:
        name = CANONICAL_RAW_FILENAME.format(plot=plot)
        pairs.append((raw_src / name, RAW_DATA_DIR / name))

    # Processed DBH
    dbh_src = revision_root / "processed" / "DBH"
    for plot in plots:
        name = CANONICAL_DBH_LONG_FILENAME.format(plot_lower=plot.lower())
        pairs.append((dbh_src / name, PROCESSED_DATA_DIR / "DBH" / name))

    # Processed Carbon
    carbon_src = revision_root / "processed" / "Carbon"
    for plot in plots:
        name = CANONICAL_CARBON_FILENAME.format(plot_lower=plot.lower())
        pairs.append((carbon_src / name, PROCESSED_DATA_DIR / "Carbon" / name))
    pairs.append(
        (
            carbon_src / CANONICAL_CARBON_ALL_FILENAME,
            PROCESSED_DATA_DIR / "Carbon" / CANONICAL_CARBON_ALL_FILENAME,
        )
    )

    # Snapshots — baseline + baseline_stochastic (live route inputs)
    for subdir, years in (
        (SNAPSHOTS_BASELINE_SUBDIR, DEFAULT_KEYFRAME_YEARS),
        (SNAPSHOTS_BASELINE_STOCH_SUBDIR, DEFAULT_KEYFRAME_YEARS),
    ):
        snap_src = revision_root / "processed" / subdir
        snap_dst = PROCESSED_DATA_DIR / subdir
        for year in years:
            name = f"forest_{year}_years.csv"
            pairs.append((snap_src / name, snap_dst / name))

    # Optional — legacy NN epsilon snapshots (years 0–20)
    if include_nn_epsilon:
        snap_src = revision_root / "processed" / SNAPSHOTS_NN_EPSILON_SUBDIR
        snap_dst = PROCESSED_DATA_DIR / SNAPSHOTS_NN_EPSILON_SUBDIR
        for year in DEFAULT_NN_EPSILON_YEARS:
            name = f"forest_nn_{year}_years.csv"
            pairs.append((snap_src / name, snap_dst / name))

    return pairs
