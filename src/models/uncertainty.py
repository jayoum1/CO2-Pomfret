"""
Model Uncertainty Analysis

Converts DBH residual sigma to carbon/CO2e uncertainty and provides
analogies for understanding model uncertainty.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROCESSED_DATA_DIR, MODELS_DIR, ensure_dir
from models.forest_metrics import carbon_from_dbh
from models.baseline_growth_curve import get_residual_sigma


# Constants
CO2E_FACTOR = 3.667  # kg CO2e per kg C
CO2_PER_MILE = 0.4  # kg CO2 per mile (EPA estimate)


def dbh_sigma_to_carbon_sigma(dbh_cm: float, species: str, sigma_dbh_cm: float) -> float:
    """
    Convert DBH sigma to carbon sigma using finite difference approximation.
    
    Computes: |carbon_from_dbh(dbh + sigma) - carbon_from_dbh(dbh)|
    
    Parameters
    ----------
    dbh_cm : float
        Current DBH in cm
    species : str
        Species name
    sigma_dbh_cm : float
        DBH sigma (standard deviation) in cm/year
    
    Returns
    -------
    float
        Carbon sigma (standard deviation) in kg C/year
    """
    carbon_base = carbon_from_dbh(dbh_cm, species)
    carbon_plus_sigma = carbon_from_dbh(dbh_cm + sigma_dbh_cm, species)
    
    # Use absolute difference as approximation for sigma
    carbon_sigma = abs(carbon_plus_sigma - carbon_base)
    
    return carbon_sigma


def carbon_sigma_to_co2e(carbon_sigma_kgC: float) -> float:
    """
    Convert carbon sigma to CO2e sigma.
    
    Parameters
    ----------
    carbon_sigma_kgC : float
        Carbon sigma in kg C/year
    
    Returns
    -------
    float
        CO2e sigma in kg CO2e/year
    """
    return carbon_sigma_kgC * CO2E_FACTOR


def co2e_to_miles(co2e_kg: float) -> float:
    """
    Convert CO2e to equivalent miles driven.
    
    Uses EPA estimate: ~400 g CO2 per mile = 0.4 kg CO2 per mile
    
    Parameters
    ----------
    co2e_kg : float
        CO2e in kg
    
    Returns
    -------
    float
        Equivalent miles driven
    """
    return co2e_kg / CO2_PER_MILE


def compute_forest_uncertainty(
    forest_df: pd.DataFrame,
    sigma_df: pd.DataFrame
) -> dict:
    """
    Compute uncertainty metrics for a forest snapshot.
    
    Parameters
    ----------
    forest_df : pd.DataFrame
        Forest snapshot with columns: TreeID, Species, Plot, DBH_cm
    sigma_df : pd.DataFrame
        Residual sigma estimates with columns: Species, Plot, sigma
    
    Returns
    -------
    dict
        Dictionary with uncertainty metrics
    """
    print("\nComputing forest uncertainty metrics...")
    
    # Compute per-tree CO2e sigma
    per_tree_co2e_sigmas = []
    
    for _, tree in forest_df.iterrows():
        dbh_cm = tree['DBH_cm']
        species = tree['Species']
        plot = tree['Plot']
        
        # Get sigma for this tree's group
        sigma_dbh = get_residual_sigma(species, plot, sigma_df)
        
        # Convert DBH sigma to carbon sigma
        carbon_sigma = dbh_sigma_to_carbon_sigma(dbh_cm, species, sigma_dbh)
        
        # Convert to CO2e sigma
        co2e_sigma = carbon_sigma_to_co2e(carbon_sigma)
        
        per_tree_co2e_sigmas.append(co2e_sigma)
    
    per_tree_co2e_sigmas = np.array(per_tree_co2e_sigmas)
    
    # Compute statistics
    median_co2e_sigma = np.median(per_tree_co2e_sigmas)
    p75_co2e_sigma = np.percentile(per_tree_co2e_sigmas, 75)
    mean_co2e_sigma = np.mean(per_tree_co2e_sigmas)
    
    # Forest-wide uncertainty
    # Simple sum (conservative upper bound)
    total_forest_co2e_sigma_sum = np.sum(per_tree_co2e_sigmas)
    
    # RSS combination (statistical combination)
    total_forest_co2e_sigma_rss = np.sqrt(np.sum(per_tree_co2e_sigmas**2))
    
    # Convert to miles
    median_miles = co2e_to_miles(median_co2e_sigma)
    p75_miles = co2e_to_miles(p75_co2e_sigma)
    total_sum_miles = co2e_to_miles(total_forest_co2e_sigma_sum)
    total_rss_miles = co2e_to_miles(total_forest_co2e_sigma_rss)
    
    results = {
        'per_tree_stats': {
            'median_co2e_sigma_kg_per_year': float(median_co2e_sigma),
            'p75_co2e_sigma_kg_per_year': float(p75_co2e_sigma),
            'mean_co2e_sigma_kg_per_year': float(mean_co2e_sigma),
            'median_equivalent_miles_per_year': float(median_miles),
            'p75_equivalent_miles_per_year': float(p75_miles),
        },
        'forest_wide': {
            'total_co2e_sigma_sum_kg_per_year': float(total_forest_co2e_sigma_sum),
            'total_co2e_sigma_rss_kg_per_year': float(total_forest_co2e_sigma_rss),
            'total_equivalent_miles_sum_per_year': float(total_sum_miles),
            'total_equivalent_miles_rss_per_year': float(total_rss_miles),
        },
        'n_trees': len(forest_df),
        'methodology': {
            'dbh_sigma_source': 'baseline_residual_sigma.csv',
            'carbon_conversion': 'finite difference approximation',
            'co2e_factor': CO2E_FACTOR,
            'co2_per_mile_kg': CO2_PER_MILE,
        }
    }
    
    print(f"  Median per-tree σ_CO2e: {median_co2e_sigma:.2f} kg CO2e/year")
    print(f"  Median equivalent: {median_miles:.1f} miles/year")
    print(f"  Forest-wide σ_CO2e (sum): {total_forest_co2e_sigma_sum:.0f} kg CO2e/year")
    print(f"  Forest-wide σ_CO2e (RSS): {total_forest_co2e_sigma_rss:.0f} kg CO2e/year")
    
    return results


def generate_uncertainty_summary() -> dict:
    """
    Generate uncertainty summary for baseline forest (year 0).
    
    Returns
    -------
    dict
        Uncertainty metrics dictionary
    """
    print("\n" + "="*70)
    print("GENERATING MODEL UNCERTAINTY SUMMARY")
    print("="*70)
    
    # Load baseline snapshot (year 0)
    baseline_snapshot_path = PROCESSED_DATA_DIR / "forest_snapshots_baseline" / "forest_0_years.csv"
    
    if not baseline_snapshot_path.exists():
        raise FileNotFoundError(
            f"Baseline snapshot not found: {baseline_snapshot_path}\n"
            "Please generate baseline snapshots first."
        )
    
    forest_df = pd.read_csv(baseline_snapshot_path)
    print(f"Loaded baseline forest: {len(forest_df)} trees")
    
    # Load residual sigma
    sigma_df = pd.read_csv(MODELS_DIR / "baseline_residual_sigma.csv")
    print(f"Loaded residual sigma for {len(sigma_df)} groups")
    
    # Compute uncertainty
    results = compute_forest_uncertainty(forest_df, sigma_df)
    
    # Save to JSON
    output_dir = PROCESSED_DATA_DIR / "diagnostics"
    ensure_dir(output_dir)
    output_path = output_dir / "uncertainty_summary.json"
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✓ Saved uncertainty summary to {output_path}")
    
    return results


if __name__ == "__main__":
    generate_uncertainty_summary()
