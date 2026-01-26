"""
Helper functions for tree removal and planting options based on DBH bins.
Shared by frontend and backend for consistent binning logic.
"""
from typing import List, Tuple, Dict, Optional
import pandas as pd
import numpy as np
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS


def get_dbh_bins() -> List[Tuple[float, float, str]]:
    """
    Get DBH size class bins for removal (existing trees).
    
    Returns
    -------
    List[Tuple[float, float, str]]
        List of (min_dbh, max_dbh, label) tuples
        Bins: 0-10, 10-20, 20-30, ..., 120+
    """
    bins = []
    for i in range(0, 120, 10):
        bins.append((i, i + 10, f"{i}-{i+10}"))
    bins.append((120, float('inf'), "120+"))
    return bins


def get_planting_dbh_bins() -> List[Tuple[float, float, str, str]]:
    """
    Get DBH size class bins for planting (new trees).
    These bins are optimized for typical planting sizes.
    
    Returns
    -------
    List[Tuple[float, float, str, str]]
        List of (min_dbh, max_dbh, label, description) tuples
        Bins: 0-1 (Seedling), 1-5 (Small Sapling), 5-10 (Sapling), 
              10-20 (Small Tree), 20-30 (Medium Tree), 30-50 (Large Tree),
              50-80 (Mature), 80-200 (Very Large)
    """
    return [
        (0, 1, "0-1", "Seedling"),
        (1, 5, "1-5", "Small Sapling"),
        (5, 10, "5-10", "Sapling"),
        (10, 20, "10-20", "Small Tree"),
        (20, 30, "20-30", "Medium Tree"),
        (30, 50, "30-50", "Large Tree"),
        (50, 80, "50-80", "Mature"),
        (80, 200, "80-200", "Very Large"),
    ]


def get_bin_midpoint(min_dbh: float, max_dbh: float) -> float:
    """
    Get the midpoint of a DBH bin.
    
    Parameters
    ----------
    min_dbh : float
        Minimum DBH in bin
    max_dbh : float
        Maximum DBH in bin (or inf)
        
    Returns
    -------
    float
        Midpoint DBH value
    """
    if max_dbh == float('inf'):
        # For open-ended bins, use a reasonable upper bound
        return min_dbh + 10
    return (min_dbh + max_dbh) / 2


def sample_dbh_from_bin(min_dbh: float, max_dbh: float, rng: Optional[np.random.Generator] = None) -> float:
    """
    Sample a random DBH value from within a bin (for stochastic mode).
    
    Parameters
    ----------
    min_dbh : float
        Minimum DBH in bin
    max_dbh : float
        Maximum DBH in bin (or inf)
    rng : Optional[np.random.Generator]
        Random number generator (for reproducibility)
        
    Returns
    -------
    float
        Sampled DBH value
    """
    if rng is None:
        rng = np.random.default_rng()
    
    if max_dbh == float('inf'):
        # For open-ended bins, use exponential distribution
        # Sample from [min_dbh, min_dbh + 20] with bias toward lower values
        return min_dbh + rng.exponential(scale=5)
    
    # Uniform distribution within bin
    return rng.uniform(min_dbh, max_dbh)


def get_dbh_bin_for_tree(dbh_cm: float) -> str:
    """
    Get the DBH bin label for a given DBH value.
    
    Parameters
    ----------
    dbh_cm : float
        Tree DBH in cm
        
    Returns
    -------
    str
        Bin label (e.g., "0-10", "10-20", "120+")
    """
    bins = get_dbh_bins()
    for min_dbh, max_dbh, label in bins:
        if min_dbh <= dbh_cm < max_dbh:
            return label
    # If somehow exceeds all bins, return the last one
    return bins[-1][2]


def get_removal_options(plot: str, species: str) -> Dict[str, Dict]:
    """
    Get removal options (DBH bins with tree counts) for a given plot and species.
    
    Parameters
    ----------
    plot : str
        Plot name ('Upper', 'Middle', 'Lower')
    species : str
        Species name
        
    Returns
    -------
    Dict[str, Dict]
        Dictionary mapping bin labels to:
        {
            'count': number of trees in this bin,
            'min_dbh': minimum DBH in bin,
            'max_dbh': maximum DBH in bin,
            'mean_dbh': mean DBH of trees in bin,
            'mean_carbon': mean carbon of trees in bin
        }
    """
    # Load dataset
    df = pd.read_csv(CARBON_ALL_PLOTS)
    
    # Filter to plot and species, use most recent year for each tree
    plot_species_df = df[(df['Plot'] == plot) & (df['Species'] == species)].copy()
    
    if len(plot_species_df) == 0:
        # Return empty bins
        bins = get_dbh_bins()
        return {
            label: {
                'count': 0,
                'min_dbh': min_dbh,
                'max_dbh': max_dbh if max_dbh != float('inf') else 120,
                'mean_dbh': 0,
                'mean_carbon': 0
            }
            for min_dbh, max_dbh, label in bins
        }
    
    # Use most recent year for each tree
    plot_species_df = plot_species_df.sort_values(['TreeID', 'Year']).groupby('TreeID').tail(1)
    
    # Import carbon calculation
    from models.forest_metrics import carbon_from_dbh
    
    # Calculate carbon for each tree
    plot_species_df['carbon_kgC'] = plot_species_df.apply(
        lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
        axis=1
    )
    
    # Get bins
    bins = get_dbh_bins()
    result = {}
    
    for min_dbh, max_dbh, label in bins:
        # Filter trees in this bin
        if max_dbh == float('inf'):
            bin_df = plot_species_df[plot_species_df['DBH_cm'] >= min_dbh]
        else:
            bin_df = plot_species_df[
                (plot_species_df['DBH_cm'] >= min_dbh) & 
                (plot_species_df['DBH_cm'] < max_dbh)
            ]
        
        count = len(bin_df)
        mean_dbh = bin_df['DBH_cm'].mean() if count > 0 else 0
        mean_carbon = bin_df['carbon_kgC'].mean() if count > 0 else 0
        
        result[label] = {
            'count': int(count),
            'min_dbh': min_dbh,
            'max_dbh': max_dbh if max_dbh != float('inf') else 120,
            'mean_dbh': float(mean_dbh) if count > 0 else 0,
            'mean_carbon': float(mean_carbon) if count > 0 else 0
        }
    
    return result


if __name__ == "__main__":
    # Test the functions
    bins = get_dbh_bins()
    print("DBH Bins:")
    for min_dbh, max_dbh, label in bins:
        print(f"  {label}: {min_dbh}-{max_dbh} cm")
    
    print("\nRemoval options for Upper plot, red maple:")
    options = get_removal_options("Upper", "red maple")
    for label, data in options.items():
        if data['count'] > 0:
            print(f"  {label}: {data['count']} trees (mean DBH: {data['mean_dbh']:.1f} cm, mean carbon: {data['mean_carbon']:.2f} kg C)")
