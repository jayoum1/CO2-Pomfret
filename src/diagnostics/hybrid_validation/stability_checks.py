"""
Stability and Realism Checks

Long-term simulation stability analysis (20 years).
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from config import PROCESSED_DATA_DIR, ensure_dir
from models.forest_snapshots_nn import load_base_forest_df, simulate_forest_one_year
from models.dbh_residual_model import predict_delta_hybrid
from models.baseline_growth_curve import load_baseline_curves


# Global cache
_cached_curves = None


def load_curves():
    """Load and cache baseline curves."""
    global _cached_curves
    if _cached_curves is None:
        print("Loading baseline curves...")
        _cached_curves = load_baseline_curves()
    return _cached_curves


def run_stability_checks(outdir: Path, years: int = 20):
    """
    Run stability checks on long-term simulation.
    
    Parameters
    ----------
    outdir : Path
        Output directory
    years : int
        Number of years to simulate (default: 20)
    
    Returns
    -------
    dict
        Results dictionary
    """
    print("\n" + "="*70)
    print("STABILITY AND REALISM CHECKS")
    print("="*70)
    
    curves = load_curves()
    
    # Load base forest
    print("\nLoading base forest...")
    base_forest = load_base_forest_df()
    print(f"  {len(base_forest)} trees")
    
    # Simulate year by year
    print(f"\nSimulating {years} years forward...")
    current_forest = base_forest.copy()
    
    yearly_stats = []
    dbh_history = {}  # Track DBH for each tree
    
    # Initialize history
    for tree_id in base_forest['TreeID']:
        dbh_history[tree_id] = []
    
    for year in range(1, years + 1):
        # Simulate one year
        current_forest, diagnostics = simulate_forest_one_year(
            current_forest,
            silent=True,
            enforce_monotonic_dbh=True,
            max_annual_shrink_cm=0.0,
            model_type="nn_state",
            simulation_mode="hybrid",
            epsilon_cm=0.02
        )
        
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
        
        # Count unique DBH values (rounded to 6 decimals)
        unique_dbh = len(current_forest['DBH_cm'].round(6).unique())
        
        yearly_stats.append({
            'year': year,
            'mean_dbh_cm': mean_dbh,
            'mean_delta_base_cm': mean_delta_base,
            'mean_delta_resid_cm': mean_delta_resid,
            'mean_delta_used_cm': mean_delta_used,
            'pct_clamped': pct_clamped,
            'n_unique_dbh': unique_dbh
        })
        
        # Update history
        for idx, row in current_forest.iterrows():
            tree_id = row['TreeID']
            dbh_history[tree_id].append(row['DBH_cm'])
        
        if year % 5 == 0:
            print(f"  Year {year}: Mean DBH = {mean_dbh:.2f} cm, % clamped = {pct_clamped:.1f}%")
    
    yearly_df = pd.DataFrame(yearly_stats)
    
    # Save yearly dynamics
    dynamics_path = outdir / "hybrid_yearly_dynamics.csv"
    yearly_df.to_csv(dynamics_path, index=False)
    print(f"\n✓ Saved: {dynamics_path}")
    
    # Plot 1: Mean DBH vs year
    plots_dir = outdir / "plots"
    ensure_dir(plots_dir)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(yearly_df['year'], yearly_df['mean_dbh_cm'], 'b-', linewidth=2, marker='o', markersize=4)
    ax.set_xlabel('Year', fontsize=12)
    ax.set_ylabel('Mean DBH (cm)', fontsize=12)
    ax.set_title('Mean DBH Over Time (20-Year Simulation)', fontsize=14)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    dynamics_plot_path = plots_dir / "hybrid_dynamics.png"
    plt.savefig(dynamics_plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✓ Saved: {dynamics_plot_path}")
    
    # Plot 2: Clamp rate vs year
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(yearly_df['year'], yearly_df['pct_clamped'], 'r-', linewidth=2, marker='o', markersize=4)
    ax.set_xlabel('Year', fontsize=12)
    ax.set_ylabel('% Clamped', fontsize=12)
    ax.set_title('Clamp Rate Over Time (Hybrid Model)', fontsize=14)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    clamp_plot_path = plots_dir / "hybrid_clamp_rate.png"
    plt.savefig(clamp_plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✓ Saved: {clamp_plot_path}")
    
    # Plot 3: Contribution breakdown
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(yearly_df['year'], yearly_df['mean_delta_base_cm'], 'g-', linewidth=2, label='Baseline', marker='o', markersize=4)
    ax.plot(yearly_df['year'], yearly_df['mean_delta_resid_cm'], 'orange', linewidth=2, label='Residual', marker='s', markersize=4)
    ax.plot(yearly_df['year'], yearly_df['mean_delta_used_cm'], 'b-', linewidth=2, label='Total (used)', marker='^', markersize=4)
    ax.set_xlabel('Year', fontsize=12)
    ax.set_ylabel('Mean Delta (cm/year)', fontsize=12)
    ax.set_title('Growth Contribution Breakdown Over Time', fontsize=14)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    contrib_plot_path = plots_dir / "hybrid_contrib.png"
    plt.savefig(contrib_plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✓ Saved: {contrib_plot_path}")
    
    # Plateau analysis
    print("\nAnalyzing plateaus...")
    plateau_rows = []
    
    for tree_id, dbh_list in dbh_history.items():
        if len(dbh_list) < 5:
            continue
        
        # Find first plateau (5 consecutive years with < 0.01 cm change)
        year_first_plateau = None
        for i in range(len(dbh_list) - 4):
            changes = [abs(dbh_list[i+j+1] - dbh_list[i+j]) for j in range(4)]
            if all(c < 0.01 for c in changes):
                year_first_plateau = i + 1
                break
        
        if year_first_plateau is not None:
            dbh_at_plateau = dbh_list[year_first_plateau]
            plateau_rows.append({
                'TreeID': tree_id,
                'year_first_plateau': year_first_plateau,
                'dbh_at_plateau': dbh_at_plateau
            })
    
    plateau_df = pd.DataFrame(plateau_rows)
    
    if len(plateau_df) > 0:
        pct_plateaued = (len(plateau_df) / len(base_forest)) * 100
        print(f"  Trees plateaued by year {years}: {len(plateau_df)} ({pct_plateaued:.1f}%)")
        
        # Distribution of first plateau year
        plateau_year_dist = plateau_df['year_first_plateau'].value_counts().sort_index()
        print(f"\n  Plateau year distribution:")
        for year, count in plateau_year_dist.head(10).items():
            print(f"    Year {year}: {count} trees")
    else:
        pct_plateaued = 0.0
        print(f"  No trees plateaued by year {years}")
    
    # Save plateau report
    plateau_path = outdir / "hybrid_plateau_report.csv"
    if len(plateau_df) > 0:
        plateau_df.to_csv(plateau_path, index=False)
        print(f"\n✓ Saved: {plateau_path}")
    else:
        # Create empty DataFrame with columns
        empty_df = pd.DataFrame(columns=['TreeID', 'year_first_plateau', 'dbh_at_plateau'])
        empty_df.to_csv(plateau_path, index=False)
        print(f"\n✓ Saved: {plateau_path} (empty - no plateaus)")
    
    # Summary statistics
    final_mean_dbh = yearly_df.iloc[-1]['mean_dbh_cm']
    initial_mean_dbh = base_forest['DBH_cm'].mean()
    mean_dbh_change = final_mean_dbh - initial_mean_dbh
    
    avg_clamp_rate = yearly_df['pct_clamped'].mean()
    
    results = {
        'initial_mean_dbh': initial_mean_dbh,
        'final_mean_dbh': final_mean_dbh,
        'mean_dbh_change': mean_dbh_change,
        'pct_plateaued': pct_plateaued,
        'avg_clamp_rate': avg_clamp_rate,
        'yearly_stats': yearly_df,
        'plateau_df': plateau_df
    }
    
    return results


def run_stability_analysis(outdir: Path):
    """
    Run all stability checks.
    
    Parameters
    ----------
    outdir : Path
        Output directory
    """
    print("\n" + "="*70)
    print("STAGE 4: STABILITY AND REALISM CHECKS")
    print("="*70)
    
    results = run_stability_checks(outdir, years=20)
    
    return results
