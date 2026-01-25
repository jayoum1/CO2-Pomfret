"""
Area Scaling Utilities

Computes carbon densities from plot snapshots and scales to target areas.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys
import json

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROCESSED_DATA_DIR, DATA_DIR, ensure_dir

# Plot areas configuration path
PLOT_AREAS_PATH = DATA_DIR / "Metadata" / "plot_areas.json"


def load_plot_areas() -> Dict[str, Dict[str, Optional[float]]]:
    """
    Load plot areas from configuration file.
    
    Returns
    -------
    Dict[str, Dict[str, Optional[float]]]
        Dictionary mapping plot names to area dictionaries with 'area_m2' key
    """
    if not PLOT_AREAS_PATH.exists():
        # Return default structure if file doesn't exist
        return {
            "Upper": {"area_m2": None},
            "Middle": {"area_m2": None},
            "Lower": {"area_m2": None}
        }
    
    try:
        with open(PLOT_AREAS_PATH, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Warning: Could not load plot areas: {e}")
        return {
            "Upper": {"area_m2": None},
            "Middle": {"area_m2": None},
            "Lower": {"area_m2": None}
        }


def set_plot_area(plot: str, area_m2: float) -> bool:
    """
    Set area for a plot and save to configuration file.
    
    Parameters
    ----------
    plot : str
        Plot name (Upper, Middle, or Lower)
    area_m2 : float
        Area in square meters
    
    Returns
    -------
    bool
        True if successful, False otherwise
    """
    try:
        areas = load_plot_areas()
        if plot not in areas:
            areas[plot] = {}
        areas[plot]["area_m2"] = area_m2
        
        ensure_dir(PLOT_AREAS_PATH.parent)
        with open(PLOT_AREAS_PATH, 'w') as f:
            json.dump(areas, f, indent=2)
        return True
    except Exception as e:
        print(f"Error setting plot area: {e}")
        return False


def compute_plot_summaries(snapshot_df: pd.DataFrame) -> Dict[str, Dict]:
    """
    Compute summary statistics by plot from a snapshot DataFrame.
    
    Parameters
    ----------
    snapshot_df : pd.DataFrame
        Snapshot DataFrame with columns: Plot, DBH_cm, carbon_at_time
    
    Returns
    -------
    Dict[str, Dict]
        Dictionary mapping plot names to summary statistics:
        {
            "Upper": {
                "total_carbon_kgC": float,
                "num_trees": int,
                "mean_dbh_cm": float
            },
            ...
        }
    """
    summaries = {}
    
    for plot in snapshot_df['Plot'].unique():
        plot_data = snapshot_df[snapshot_df['Plot'] == plot]
        
        summaries[plot] = {
            "total_carbon_kgC": float(plot_data['carbon_at_time'].sum()),
            "num_trees": int(len(plot_data)),
            "mean_dbh_cm": float(plot_data['DBH_cm'].mean()) if len(plot_data) > 0 else 0.0
        }
    
    return summaries


def compute_plot_densities(
    plot_summaries: Dict[str, Dict],
    plot_areas: Dict[str, Dict[str, Optional[float]]]
) -> Dict[str, Dict]:
    """
    Compute carbon and tree densities by plot.
    
    Parameters
    ----------
    plot_summaries : Dict[str, Dict]
        Output from compute_plot_summaries
    plot_areas : Dict[str, Dict[str, Optional[float]]]
        Plot areas dictionary from load_plot_areas
    
    Returns
    -------
    Dict[str, Dict]
        Dictionary mapping plot names to density metrics:
        {
            "Upper": {
                "carbon_density_kgC_per_m2": float or None,
                "trees_per_m2": float or None,
                "area_m2": float or None
            },
            ...
        }
    """
    densities = {}
    
    for plot, summary in plot_summaries.items():
        area_m2 = plot_areas.get(plot, {}).get("area_m2")
        
        densities[plot] = {
            "carbon_density_kgC_per_m2": summary["total_carbon_kgC"] / area_m2 if area_m2 and area_m2 > 0 else None,
            "trees_per_m2": summary["num_trees"] / area_m2 if area_m2 and area_m2 > 0 else None,
            "area_m2": area_m2,
            "total_carbon_kgC": summary["total_carbon_kgC"],
            "num_trees": summary["num_trees"],
            "mean_dbh_cm": summary["mean_dbh_cm"]
        }
    
    return densities


def compute_sequestration_densities(
    snapshot_t0: pd.DataFrame,
    snapshot_t1: pd.DataFrame,
    plot_areas: Dict[str, Dict[str, Optional[float]]],
    years_diff: float
) -> Dict[str, Optional[float]]:
    """
    Compute annual sequestration density between two snapshots.
    
    Parameters
    ----------
    snapshot_t0 : pd.DataFrame
        Earlier snapshot
    snapshot_t1 : pd.DataFrame
        Later snapshot
    plot_areas : Dict[str, Dict[str, Optional[float]]]
        Plot areas dictionary
    years_diff : float
        Number of years between snapshots
    
    Returns
    -------
    Dict[str, Optional[float]]
        Dictionary mapping plot names to annual sequestration density (kgC/m²/year)
    """
    summaries_t0 = compute_plot_summaries(snapshot_t0)
    summaries_t1 = compute_plot_summaries(snapshot_t1)
    
    sequestration_densities = {}
    
    for plot in summaries_t0.keys():
        if plot not in summaries_t1:
            sequestration_densities[plot] = None
            continue
        
        area_m2 = plot_areas.get(plot, {}).get("area_m2")
        if not area_m2 or area_m2 <= 0:
            sequestration_densities[plot] = None
            continue
        
        carbon_diff = summaries_t1[plot]["total_carbon_kgC"] - summaries_t0[plot]["total_carbon_kgC"]
        annual_sequestration_density = carbon_diff / (years_diff * area_m2)
        sequestration_densities[plot] = annual_sequestration_density
    
    return sequestration_densities


def scale_to_area(density: float, target_area_m2: float) -> float:
    """
    Scale a density to a target area.
    
    Parameters
    ----------
    density : float
        Density value (e.g., kgC/m²)
    target_area_m2 : float
        Target area in square meters
    
    Returns
    -------
    float
        Scaled total value
    """
    return density * target_area_m2


def get_snapshot(mode: str, years_ahead: int) -> pd.DataFrame:
    """
    Load a forest snapshot for a given mode and horizon.
    
    Parameters
    ----------
    mode : str
        Simulation mode ('baseline' or 'baseline_stochastic')
    years_ahead : int
        Years ahead (0, 5, 10, or 20)
    
    Returns
    -------
    pd.DataFrame
        Snapshot DataFrame
    """
    if mode == "baseline":
        snapshot_dir = PROCESSED_DATA_DIR / "forest_snapshots_baseline"
    elif mode == "baseline_stochastic":
        snapshot_dir = PROCESSED_DATA_DIR / "forest_snapshots_baseline_stochastic"
    else:
        raise ValueError(f"Unknown mode: {mode}")
    
    snapshot_path = snapshot_dir / f"forest_{years_ahead}_years.csv"
    
    if not snapshot_path.exists():
        raise FileNotFoundError(f"Snapshot not found: {snapshot_path}")
    
    return pd.read_csv(snapshot_path)


def compute_all_densities(mode: str = "baseline") -> Dict:
    """
    Compute densities for all plots at all horizons.
    
    Parameters
    ----------
    mode : str
        Simulation mode
    
    Returns
    -------
    Dict
        Dictionary with densities by plot and horizon, plus sequestration rates
    """
    plot_areas = load_plot_areas()
    horizons = [0, 5, 10, 20]
    
    # Load snapshots
    snapshots = {}
    for horizon in horizons:
        snapshots[horizon] = get_snapshot(mode, horizon)
    
    # Compute densities at each horizon
    densities_by_horizon = {}
    for horizon in horizons:
        summaries = compute_plot_summaries(snapshots[horizon])
        densities_by_horizon[horizon] = compute_plot_densities(summaries, plot_areas)
    
    # Compute sequestration densities
    sequestration_rates = {}
    horizon_pairs = [(0, 5), (5, 10), (10, 20), (0, 20)]
    
    for t0, t1 in horizon_pairs:
        years_diff = t1 - t0
        seq_densities = compute_sequestration_densities(
            snapshots[t0], snapshots[t1], plot_areas, years_diff
        )
        sequestration_rates[f"{t0}→{t1}"] = seq_densities
    
    # Compute min/max/average across plots (only for plots with areas)
    plots_with_areas = [p for p, data in plot_areas.items() if data.get("area_m2") is not None]
    
    aggregated = {}
    if len(plots_with_areas) > 0:
        for horizon in horizons:
            carbon_densities = [
                densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"]
                for p in plots_with_areas
                if densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"] is not None
            ]
            tree_densities = [
                densities_by_horizon[horizon][p]["trees_per_m2"]
                for p in plots_with_areas
                if densities_by_horizon[horizon][p]["trees_per_m2"] is not None
            ]
            
            if carbon_densities:
                aggregated[f"carbon_density_kgC_per_m2_{horizon}"] = {
                    "min": min(carbon_densities),
                    "max": max(carbon_densities),
                    "average": np.mean(carbon_densities)
                }
            
            if tree_densities:
                aggregated[f"trees_per_m2_{horizon}"] = {
                    "min": min(tree_densities),
                    "max": max(tree_densities),
                    "average": np.mean(tree_densities)
                }
    
    return {
        "densities_by_horizon": densities_by_horizon,
        "sequestration_rates": sequestration_rates,
        "aggregated": aggregated,
        "plots_with_areas": plots_with_areas
    }
