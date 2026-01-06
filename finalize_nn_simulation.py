"""
Finalize NN-based multi-year forest simulation with biologically plausible no-shrinkage rules.

This script:
1. Runs hard-0 simulation (no shrinkage allowed)
2. Detects permanently stuck trees
3. If too many trees get stuck, runs epsilon simulation
4. Compares results and saves snapshots
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent / "src"))

from models.forest_snapshots_nn import (
    load_base_forest_df,
    generate_forest_snapshots,
    simulate_forest_years
)
from models.forest_metrics import carbon_from_dbh
from config import PROCESSED_DATA_DIR, ensure_dir


def run_hard0_simulation(years_list=[0, 5, 10, 20], stuck_threshold=0.25):
    """
    Run hard-0 simulation and check for stuck trees.
    
    Parameters
    ----------
    years_list : list
        List of years to simulate
    stuck_threshold : float
        Threshold for % stuck trees to trigger epsilon mode (default: 0.25 = 25%)
    
    Returns
    -------
    dict
        Results dictionary with keys:
        - 'snapshots': List of snapshot DataFrames
        - 'stuck_trees': List of stuck trees
        - 'yearly_stats': Yearly statistics
        - 'pct_stuck': Percentage of trees permanently stuck
    """
    print("="*70)
    print("HARD-0 SIMULATION (NO SHRINKAGE ALLOWED)")
    print("="*70)
    
    # Generate snapshots with hard0 mode
    results = generate_forest_snapshots(
        years_list=years_list,
        output_dir=PROCESSED_DATA_DIR / "forest_snapshots_nn_hard0",
        model_type="nn_state",
        simulation_mode="hard0",
        epsilon_cm=0.02
    )
    
    # Calculate stuck percentage
    base_forest = load_base_forest_df()
    num_trees = len(base_forest)
    num_stuck = len(results['stuck_trees'])
    pct_stuck = (num_stuck / num_trees) * 100 if num_trees > 0 else 0.0
    
    print(f"\n{'='*70}")
    print("STUCK TREE ANALYSIS (HARD-0)")
    print(f"{'='*70}")
    print(f"Total trees: {num_trees}")
    print(f"Permanently stuck by year {max(years_list)}: {num_stuck} ({pct_stuck:.1f}%)")
    
    if num_stuck > 0:
        # Distribution of year first stuck
        year_dist = {}
        for stuck_tree in results['stuck_trees']:
            year = stuck_tree['year_first_stuck']
            year_dist[year] = year_dist.get(year, 0) + 1
        
        print("\nDistribution of 'year first stuck':")
        for year in sorted(year_dist.keys()):
            print(f"  Year {year}: {year_dist[year]} trees")
    
    results['pct_stuck'] = pct_stuck
    results['should_use_epsilon'] = pct_stuck >= (stuck_threshold * 100)
    
    return results


def run_epsilon_simulation(years_list=[0, 5, 10, 20], epsilon_cm=0.02):
    """
    Run epsilon simulation (negative delta -> epsilon growth).
    
    Parameters
    ----------
    years_list : list
        List of years to simulate
    epsilon_cm : float
        Minimum growth when model predicts negative delta (default: 0.02 cm)
    
    Returns
    -------
    dict
        Results dictionary
    """
    print("\n" + "="*70)
    print(f"EPSILON SIMULATION (ε={epsilon_cm} cm)")
    print("="*70)
    
    # Generate snapshots with epsilon mode
    results = generate_forest_snapshots(
        years_list=years_list,
        output_dir=PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon",
        model_type="nn_state",
        simulation_mode="epsilon",
        epsilon_cm=epsilon_cm
    )
    
    # Calculate stuck percentage
    base_forest = load_base_forest_df()
    num_trees = len(base_forest)
    num_stuck = len(results['stuck_trees'])
    pct_stuck = (num_stuck / num_trees) * 100 if num_trees > 0 else 0.0
    
    print(f"\n{'='*70}")
    print("STUCK TREE ANALYSIS (EPSILON)")
    print(f"{'='*70}")
    print(f"Total trees: {num_trees}")
    print(f"Permanently stuck by year {max(years_list)}: {num_stuck} ({pct_stuck:.1f}%)")
    
    results['pct_stuck'] = pct_stuck
    
    return results


def compare_simulations(hard0_results, epsilon_results, years_list=[0, 5, 10, 20]):
    """
    Compare hard0 and epsilon simulation results.
    
    Parameters
    ----------
    hard0_results : dict
        Results from hard0 simulation
    epsilon_results : dict
        Results from epsilon simulation
    years_list : list
        List of years to compare
    """
    print("\n" + "="*70)
    print("COMPARISON: HARD-0 vs EPSILON")
    print("="*70)
    
    base_forest = load_base_forest_df()
    
    comparison_data = []
    
    for years in years_list:
        # Load snapshots
        hard0_path = PROCESSED_DATA_DIR / f"forest_snapshots_nn_hard0/forest_nn_{years}_years.csv"
        epsilon_path = PROCESSED_DATA_DIR / f"forest_snapshots_nn_epsilon/forest_nn_{years}_years.csv"
        
        hard0_df = pd.read_csv(hard0_path)
        epsilon_df = pd.read_csv(epsilon_path)
        
        # Calculate metrics
        hard0_mean_dbh = hard0_df['DBH_cm'].mean()
        hard0_total_carbon = hard0_df['carbon_at_time'].sum()
        
        epsilon_mean_dbh = epsilon_df['DBH_cm'].mean()
        epsilon_total_carbon = epsilon_df['carbon_at_time'].sum()
        
        # Calculate % delta_pred < 0 (from yearly stats)
        if years > 0 and hard0_results['yearly_stats']:
            # Find stats for this year
            hard0_stats = [s for s in hard0_results['yearly_stats'] if s['year'] == years]
            epsilon_stats = [s for s in epsilon_results['yearly_stats'] if s['year'] == years]
            
            hard0_pct_neg = hard0_stats[0]['pct_delta_pred_neg'] if hard0_stats else 0.0
            epsilon_pct_neg = epsilon_stats[0]['pct_delta_pred_neg'] if epsilon_stats else 0.0
        else:
            hard0_pct_neg = 0.0
            epsilon_pct_neg = 0.0
        
        comparison_data.append({
            'Years': years,
            'Hard0_Mean_DBH': hard0_mean_dbh,
            'Hard0_Total_Carbon': hard0_total_carbon,
            'Hard0_Pct_Neg': hard0_pct_neg,
            'Epsilon_Mean_DBH': epsilon_mean_dbh,
            'Epsilon_Total_Carbon': epsilon_total_carbon,
            'Epsilon_Pct_Neg': epsilon_pct_neg
        })
    
    comparison_df = pd.DataFrame(comparison_data)
    
    # Add stuck tree percentages
    comparison_df['Hard0_Pct_Stuck'] = hard0_results['pct_stuck']
    comparison_df['Epsilon_Pct_Stuck'] = epsilon_results['pct_stuck']
    
    print("\nComparison Table:")
    print(comparison_df.to_string(index=False))
    
    return comparison_df


def main():
    """
    Main execution function.
    """
    print("="*70)
    print("NN-BASED MULTI-YEAR FOREST SIMULATION FINALIZATION")
    print("="*70)
    
    years_list = [0, 5, 10, 20]
    stuck_threshold = 0.25  # 25% threshold
    
    # 1. Run hard0 simulation
    print("\n" + "="*70)
    print("STEP 1: RUNNING HARD-0 SIMULATION")
    print("="*70)
    hard0_results = run_hard0_simulation(years_list=years_list, stuck_threshold=stuck_threshold)
    
    # 2. Check if epsilon is needed
    print("\n" + "="*70)
    print("STEP 2: DECISION RULE")
    print("="*70)
    print(f"Stuck threshold: {stuck_threshold*100:.0f}%")
    print(f"Actual stuck %: {hard0_results['pct_stuck']:.1f}%")
    
    if hard0_results['should_use_epsilon']:
        print(f"\n⚠ DECISION: {hard0_results['pct_stuck']:.1f}% >= {stuck_threshold*100:.0f}%")
        print("  → Too many trees permanently stuck. Running epsilon simulation...")
        
        # 3. Run epsilon simulation
        epsilon_results = run_epsilon_simulation(years_list=years_list, epsilon_cm=0.02)
        
        # 4. Compare results
        comparison_df = compare_simulations(hard0_results, epsilon_results, years_list)
        
        # Save comparison
        comparison_path = PROCESSED_DATA_DIR / "diagnostics" / "simulation_comparison.csv"
        ensure_dir(comparison_path.parent)
        comparison_df.to_csv(comparison_path, index=False)
        print(f"\n✓ Saved comparison to: {comparison_path}")
        
    else:
        print(f"\n✓ DECISION: {hard0_results['pct_stuck']:.1f}% < {stuck_threshold*100:.0f}%")
        print("  → Hard-0 simulation is acceptable. No epsilon simulation needed.")
    
    print("\n" + "="*70)
    print("SIMULATION FINALIZATION COMPLETE")
    print("="*70)
    print("\nSnapshots saved to:")
    print(f"  - Hard0: {PROCESSED_DATA_DIR / 'forest_snapshots_nn_hard0'}")
    if hard0_results['should_use_epsilon']:
        print(f"  - Epsilon: {PROCESSED_DATA_DIR / 'forest_snapshots_nn_epsilon'}")


if __name__ == "__main__":
    main()

