"""
Hybrid Model Diagnostics

Runs 10-year simulation using hybrid mode and compares to epsilon mode.
Generates diagnostic reports and CSV files.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config import PROCESSED_DATA_DIR, ensure_dir
from models.forest_snapshots_nn import (
    load_base_forest_df,
    simulate_forest_years,
    simulate_forest_one_year
)
from models.forest_metrics import carbon_from_dbh


def run_hybrid_simulation(years: int = 10) -> dict:
    """
    Run hybrid mode simulation for specified years.
    
    Parameters
    ----------
    years : int
        Number of years to simulate (default: 10)
    
    Returns
    -------
    dict
        Dictionary with simulation results and diagnostics
    """
    print("="*70)
    print(f"RUNNING HYBRID MODE SIMULATION ({years} YEARS)")
    print("="*70)
    
    base_forest = load_base_forest_df()
    
    # Run simulation
    forest_result, shrink_flags, neg_flags, stuck_diagnostics = simulate_forest_years(
        base_forest,
        years=years,
        enforce_monotonic_dbh=True,
        max_annual_shrink_cm=0.0,
        print_diagnostics=True,
        model_type="nn_state",
        simulation_mode="hybrid",
        epsilon_cm=0.02
    )
    
    # Collect per-year statistics
    yearly_stats = []
    
    # Simulate year by year to collect diagnostics
    current_forest = base_forest.copy()
    
    for year in range(1, years + 1):
        current_forest, diagnostics = simulate_forest_one_year_hybrid(current_forest, silent=True)
        
        # Extract diagnostics
        delta_base_list = diagnostics.get('delta_base_list', [])
        delta_resid_list = diagnostics.get('delta_resid_list', [])
        delta_used_list = diagnostics.get('delta_used_list', [])
        was_clamped_list = diagnostics.get('was_clamped_list', [])
        
        # Compute statistics
        mean_dbh = current_forest['DBH_cm'].mean()
        mean_delta_base = np.mean(delta_base_list) if delta_base_list else 0.0
        mean_delta_resid = np.mean(delta_resid_list) if delta_resid_list else 0.0
        mean_delta_used = np.mean(delta_used_list) if delta_used_list else 0.0
        pct_clamped = (np.mean(was_clamped_list) * 100) if was_clamped_list else 0.0
        
        yearly_stats.append({
            'year': year,
            'mean_dbh_cm': mean_dbh,
            'mean_delta_base_cm': mean_delta_base,
            'mean_delta_resid_cm': mean_delta_resid,
            'mean_delta_used_cm': mean_delta_used,
            'pct_clamped': pct_clamped
        })
    
    return {
        'final_forest': forest_result,
        'yearly_stats': yearly_stats,
        'stuck_trees': stuck_diagnostics.get('stuck_trees', [])
    }


def simulate_forest_one_year_hybrid(forest_df: pd.DataFrame, silent: bool = True):
    """
    Helper function to simulate one year with hybrid mode and return diagnostics.
    
    This is a wrapper around the main simulate_forest_one_year function.
    """
    result_df, diagnostics = simulate_forest_one_year(
        forest_df,
        silent=silent,
        enforce_monotonic_dbh=True,
        max_annual_shrink_cm=0.0,
        model_type="nn_state",
        simulation_mode="hybrid",
        epsilon_cm=0.02
    )
    
    return result_df, diagnostics


def run_epsilon_simulation(years: int = 10) -> dict:
    """
    Run epsilon mode simulation for comparison.
    
    Parameters
    ----------
    years : int
        Number of years to simulate (default: 10)
    
    Returns
    -------
    dict
        Dictionary with simulation results
    """
    print("\n" + "="*70)
    print(f"RUNNING EPSILON MODE SIMULATION ({years} YEARS)")
    print("="*70)
    
    base_forest = load_base_forest_df()
    
    # Run simulation
    forest_result, shrink_flags, neg_flags, stuck_diagnostics = simulate_forest_years(
        base_forest,
        years=years,
        enforce_monotonic_dbh=True,
        max_annual_shrink_cm=0.0,
        print_diagnostics=True,
        model_type="nn_state",
        simulation_mode="epsilon",
        epsilon_cm=0.02
    )
    
    return {
        'final_forest': forest_result,
        'stuck_trees': stuck_diagnostics.get('stuck_trees', [])
    }


def compute_forest_metrics(forest_df: pd.DataFrame) -> dict:
    """
    Compute forest-level metrics.
    
    Parameters
    ----------
    forest_df : pd.DataFrame
        Forest snapshot DataFrame
    
    Returns
    -------
    dict
        Dictionary with metrics
    """
    mean_dbh = forest_df['DBH_cm'].mean()
    
    # Compute total carbon
    carbon_list = []
    for idx, row in forest_df.iterrows():
        carbon = carbon_from_dbh(row['DBH_cm'], row['Species'])
        carbon_list.append(carbon)
    
    total_carbon = sum(carbon_list)
    num_trees = len(forest_df)
    
    return {
        'mean_dbh_cm': mean_dbh,
        'total_carbon_kgC': total_carbon,
        'num_trees': num_trees
    }


def compare_modes(hybrid_results: dict, epsilon_results: dict, horizons: list = [0, 5, 10, 20]) -> pd.DataFrame:
    """
    Compare hybrid and epsilon modes at different horizons.
    
    Parameters
    ----------
    hybrid_results : dict
        Results from hybrid simulation
    epsilon_results : dict
        Results from epsilon simulation
    horizons : list
        List of years to compare (default: [0, 5, 10, 20])
    
    Returns
    -------
    pd.DataFrame
        Comparison DataFrame
    """
    print("\n" + "="*70)
    print("COMPARING HYBRID vs EPSILON MODES")
    print("="*70)
    
    base_forest = load_base_forest_df()
    
    comparison_rows = []
    
    for horizon in horizons:
        print(f"\nHorizon: {horizon} years")
        
        # Hybrid mode
        if horizon == 0:
            hybrid_forest = base_forest.copy()
        else:
            hybrid_forest, _, _, _ = simulate_forest_years(
                base_forest,
                years=horizon,
                print_diagnostics=False,
                model_type="nn_state",
                simulation_mode="hybrid"
            )
        
        hybrid_metrics = compute_forest_metrics(hybrid_forest)
        
        # Epsilon mode
        if horizon == 0:
            epsilon_forest = base_forest.copy()
        else:
            epsilon_forest, _, _, _ = simulate_forest_years(
                base_forest,
                years=horizon,
                print_diagnostics=False,
                model_type="nn_state",
                simulation_mode="epsilon"
            )
        
        epsilon_metrics = compute_forest_metrics(epsilon_forest)
        
        comparison_rows.append({
            'years_ahead': horizon,
            'hybrid_mean_dbh_cm': hybrid_metrics['mean_dbh_cm'],
            'hybrid_total_carbon_kgC': hybrid_metrics['total_carbon_kgC'],
            'hybrid_num_trees': hybrid_metrics['num_trees'],
            'epsilon_mean_dbh_cm': epsilon_metrics['mean_dbh_cm'],
            'epsilon_total_carbon_kgC': epsilon_metrics['total_carbon_kgC'],
            'epsilon_num_trees': epsilon_metrics['num_trees']
        })
        
        print(f"  Hybrid:   DBH={hybrid_metrics['mean_dbh_cm']:.2f} cm, Carbon={hybrid_metrics['total_carbon_kgC']:.1f} kg C")
        print(f"  Epsilon:  DBH={epsilon_metrics['mean_dbh_cm']:.2f} cm, Carbon={epsilon_metrics['total_carbon_kgC']:.1f} kg C")
    
    comparison_df = pd.DataFrame(comparison_rows)
    return comparison_df


def analyze_growth_contribution(hybrid_results: dict) -> dict:
    """
    Analyze contribution of baseline vs residual to growth.
    
    Parameters
    ----------
    hybrid_results : dict
        Results from hybrid simulation
    
    Returns
    -------
    dict
        Analysis results
    """
    print("\n" + "="*70)
    print("ANALYZING GROWTH CONTRIBUTION")
    print("="*70)
    
    # Simulate year by year to collect delta_base and delta_used
    base_forest = load_base_forest_df()
    current_forest = base_forest.copy()
    
    total_delta_base = []
    total_delta_used = []
    
    for year in range(1, 11):
        current_forest, diagnostics = simulate_forest_one_year_hybrid(current_forest, silent=True)
        
        delta_base_list = diagnostics.get('delta_base_list', [])
        delta_used_list = diagnostics.get('delta_used_list', [])
        
        total_delta_base.extend(delta_base_list)
        total_delta_used.extend(delta_used_list)
    
    # Compute fraction of growth from baseline
    total_base_sum = sum(total_delta_base)
    total_used_sum = sum(total_delta_used)
    
    if total_used_sum > 0:
        baseline_fraction = total_base_sum / total_used_sum
    else:
        baseline_fraction = 0.0
    
    # Count trees where baseline > 80% of total growth
    mostly_baseline_count = 0
    for i in range(len(total_delta_base)):
        if total_delta_used[i] > 0:
            if total_delta_base[i] / total_delta_used[i] > 0.8:
                mostly_baseline_count += 1
    
    mostly_baseline_pct = (mostly_baseline_count / len(total_delta_base) * 100) if total_delta_base else 0.0
    
    print(f"\nTotal growth contribution:")
    print(f"  Baseline: {total_base_sum:.3f} cm")
    print(f"  Total:    {total_used_sum:.3f} cm")
    print(f"  Baseline fraction: {baseline_fraction:.1%}")
    print(f"\nTrees with >80% baseline growth: {mostly_baseline_pct:.1f}%")
    
    return {
        'baseline_fraction': baseline_fraction,
        'mostly_baseline_pct': mostly_baseline_pct,
        'total_base_sum': total_base_sum,
        'total_used_sum': total_used_sum
    }


def generate_diagnostic_reports():
    """
    Generate all diagnostic reports.
    """
    print("\n" + "="*70)
    print("GENERATING HYBRID DIAGNOSTIC REPORTS")
    print("="*70)
    
    # Ensure output directory exists
    diagnostics_dir = PROCESSED_DATA_DIR / "diagnostics"
    ensure_dir(diagnostics_dir)
    
    # Run hybrid simulation
    hybrid_results = run_hybrid_simulation(years=10)
    
    # Run epsilon simulation for comparison
    epsilon_results = run_epsilon_simulation(years=10)
    
    # Save yearly summary
    yearly_df = pd.DataFrame(hybrid_results['yearly_stats'])
    yearly_path = diagnostics_dir / "hybrid_yearly_summary.csv"
    yearly_df.to_csv(yearly_path, index=False)
    print(f"\n✓ Saved yearly summary to {yearly_path}")
    
    # Compare modes
    comparison_df = compare_modes(hybrid_results, epsilon_results, horizons=[0, 5, 10, 20])
    comparison_path = diagnostics_dir / "hybrid_vs_epsilon_summary.csv"
    comparison_df.to_csv(comparison_path, index=False)
    print(f"✓ Saved comparison to {comparison_path}")
    
    # Analyze growth contribution
    contribution_analysis = analyze_growth_contribution(hybrid_results)
    
    # Print summary report
    print("\n" + "="*70)
    print("DIAGNOSTIC SUMMARY")
    print("="*70)
    print("\nYearly Summary (Hybrid Mode):")
    print(yearly_df.to_string(index=False))
    
    print("\n\nComparison Summary:")
    print(comparison_df.to_string(index=False))
    
    print("\n\nGrowth Contribution Analysis:")
    print(f"  Baseline fraction: {contribution_analysis['baseline_fraction']:.1%}")
    print(f"  Trees with >80% baseline: {contribution_analysis['mostly_baseline_pct']:.1f}%")
    
    return {
        'yearly_summary': yearly_df,
        'comparison': comparison_df,
        'contribution': contribution_analysis
    }


if __name__ == "__main__":
    generate_diagnostic_reports()
