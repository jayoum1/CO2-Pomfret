"""
Baseline Curve Plausibility Checks

Validates that baseline growth curves are:
- Nonnegative
- Generally decelerating (not increasing with DBH)
- Reasonably aligned with observed data
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Dict
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, PROCESSED_DATA_DIR, ensure_dir
from models.baseline_growth_curve import (
    make_training_table,
    load_baseline_curves,
    predict_baseline_delta
)


# Global cache
_cached_df = None
_cached_curves = None


def load_data_and_curves():
    """Load and cache data and curves."""
    global _cached_df, _cached_curves
    
    if _cached_df is None:
        print("Loading dataset...")
        _cached_df = pd.read_csv(str(CARBON_ALL_PLOTS_ENCODED))
        # Create PrevDBH_cm if needed
        if 'PrevDBH_cm' not in _cached_df.columns:
            _cached_df = _cached_df.sort_values(['TreeID', 'Year']).copy()
            _cached_df['PrevDBH_cm'] = _cached_df.groupby('TreeID')['DBH_cm'].shift()
        # Extract Species and Plot
        if 'Species' not in _cached_df.columns:
            species_cols = [col for col in _cached_df.columns if col.startswith('Species_')]
            if species_cols:
                _cached_df['Species'] = _cached_df[species_cols].idxmax(axis=1).str.replace('Species_', '')
        if 'Plot' not in _cached_df.columns:
            plot_cols = [col for col in _cached_df.columns if col.startswith('Plot_')]
            if plot_cols:
                _cached_df['Plot'] = _cached_df[plot_cols].idxmax(axis=1).str.replace('Plot_', '').str.capitalize()
            else:
                _cached_df['Plot'] = 'Lower'
    
    if _cached_curves is None:
        print("Loading baseline curves...")
        _cached_curves = load_baseline_curves()
    
    return _cached_df, _cached_curves


def plot_baseline_vs_observed_bins(df, curves, outdir: Path):
    """
    Plot baseline curves vs observed data for top species.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves dictionary
    outdir : Path
        Output directory for plots
    """
    print("\n" + "="*70)
    print("BASELINE VS OBSERVED PLOTS")
    print("="*70)
    
    # Build training table
    train_table = make_training_table(df)
    
    # Get top 6 species by sample size
    species_counts = train_table['Species'].value_counts()
    top_species = species_counts.head(6).index.tolist()
    
    print(f"\nTop 6 species by sample size: {top_species}")
    
    # Create plots directory
    plots_dir = outdir / "plots"
    ensure_dir(plots_dir)
    
    for species in top_species:
        print(f"\nPlotting {species}...")
        species_data = train_table[train_table['Species'] == species].copy()
        
        if len(species_data) < 10:
            print(f"  Skipping {species}: insufficient data ({len(species_data)} rows)")
            continue
        
        # Bin PrevDBH_cm into 10 cm bins
        dbh_min = species_data['PrevDBH_cm'].min()
        dbh_max = species_data['PrevDBH_cm'].max()
        bin_edges = np.arange(
            np.floor(dbh_min / 10) * 10,
            np.ceil(dbh_max / 10) * 10 + 10,
            10
        )
        
        # Compute observed statistics per bin
        observed_bins = []
        for i in range(len(bin_edges) - 1):
            bin_min = bin_edges[i]
            bin_max = bin_edges[i + 1]
            bin_data = species_data[
                (species_data['PrevDBH_cm'] >= bin_min) &
                (species_data['PrevDBH_cm'] < bin_max)
            ]['delta_obs']
            
            if len(bin_data) > 0:
                bin_center = (bin_min + bin_max) / 2
                median_delta = bin_data.median()
                q25 = bin_data.quantile(0.25)
                q75 = bin_data.quantile(0.75)
                observed_bins.append({
                    'dbh_center': bin_center,
                    'median': median_delta,
                    'q25': q25,
                    'q75': q75,
                    'n': len(bin_data)
                })
        
        observed_df = pd.DataFrame(observed_bins)
        
        # Compute baseline predictions at bin centers
        baseline_deltas = []
        dbh_grid = np.arange(max(0, dbh_min - 5), min(150, dbh_max + 5), 1.0)
        for dbh in dbh_grid:
            # Use first plot found for this species
            plot = species_data['Plot'].iloc[0]
            delta_base = predict_baseline_delta(dbh, species, plot, curves)
            baseline_deltas.append({'dbh': dbh, 'delta_base': delta_base})
        
        baseline_df = pd.DataFrame(baseline_deltas)
        
        # Create plot
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Plot observed data (bins with IQR)
        if len(observed_df) > 0:
            ax.errorbar(
                observed_df['dbh_center'],
                observed_df['median'],
                yerr=[observed_df['median'] - observed_df['q25'], observed_df['q75'] - observed_df['median']],
                fmt='o', capsize=5, label='Observed (median ± IQR)', alpha=0.7, markersize=6
            )
        
        # Plot baseline curve
        ax.plot(baseline_df['dbh'], baseline_df['delta_base'], 'r-', linewidth=2, label='Baseline curve')
        
        ax.set_xlabel('PrevDBH (cm)', fontsize=12)
        ax.set_ylabel('Delta DBH (cm/year)', fontsize=12)
        ax.set_title(f'Baseline vs Observed: {species}\n(n={len(species_data)} observations)', fontsize=14)
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plot_path = plots_dir / f"baseline_vs_observed_{species.replace(' ', '_')}.png"
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"  ✓ Saved: {plot_path}")


def baseline_nonnegativity_and_deceleration(df, curves, outdir: Path):
    """
    Check baseline curves for nonnegativity and deceleration.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves dictionary
    outdir : Path
        Output directory for CSV
    """
    print("\n" + "="*70)
    print("BASELINE NONNEGATIVITY AND DECELERATION CHECKS")
    print("="*70)
    
    # Extract unique species+plot combinations
    train_table = make_training_table(df)
    groups = train_table.groupby(['Species', 'Plot']).size().reset_index(name='n_samples')
    
    # Evaluate on DBH grid
    dbh_grid = np.arange(0, 121, 1.0)  # 0-120 cm
    
    quality_rows = []
    warnings = []
    
    for _, group_row in groups.iterrows():
        species = group_row['Species']
        plot = group_row['Plot']
        n_samples = group_row['n_samples']
        
        # Evaluate baseline on grid
        deltas = []
        for dbh in dbh_grid:
            delta = predict_baseline_delta(dbh, species, plot, curves)
            deltas.append(delta)
        
        deltas = np.array(deltas)
        
        # Check nonnegativity
        n_negative = np.sum(deltas < 0)
        pct_negative = (n_negative / len(deltas)) * 100
        
        # Check deceleration (monotonicity)
        # Compute differences between consecutive deltas
        delta_diff = np.diff(deltas)
        # Count significant increases (> 0.01 cm/year increase)
        n_increases = np.sum(delta_diff > 0.01)
        pct_increases = (n_increases / len(delta_diff)) * 100
        
        # Check for large increases at high DBH (suspicious)
        high_dbh_mask = dbh_grid[:-1] > 60  # DBH > 60 cm
        n_high_increases = np.sum((delta_diff > 0.01) & high_dbh_mask)
        
        quality_rows.append({
            'Species': species,
            'Plot': plot,
            'n_samples': n_samples,
            'pct_negative': pct_negative,
            'n_negative': n_negative,
            'pct_increases': pct_increases,
            'n_increases': n_increases,
            'n_high_dbh_increases': n_high_increases,
            'mean_delta': np.mean(deltas),
            'max_delta': np.max(deltas),
            'min_delta': np.min(deltas)
        })
        
        # Generate warnings
        if pct_negative > 0:
            warnings.append(f"⚠ {species} ({plot}): {pct_negative:.1f}% negative baseline values")
        
        if n_high_increases > 5:
            warnings.append(f"⚠ {species} ({plot}): {n_high_increases} increases at DBH > 60 cm (suspicious)")
    
    quality_df = pd.DataFrame(quality_rows)
    
    # Save CSV
    csv_path = outdir / "baseline_curve_quality.csv"
    quality_df.to_csv(csv_path, index=False)
    print(f"\n✓ Saved: {csv_path}")
    
    # Print summary
    print(f"\nSummary:")
    print(f"  Total groups: {len(quality_df)}")
    print(f"  Groups with negative values: {(quality_df['pct_negative'] > 0).sum()}")
    print(f"  Groups with >5% increases: {(quality_df['pct_increases'] > 5).sum()}")
    print(f"  Groups with high-DBH increases: {(quality_df['n_high_dbh_increases'] > 5).sum()}")
    
    if warnings:
        print("\n⚠ Warnings:")
        for warning in warnings[:10]:  # Show first 10
            print(f"  {warning}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more warnings")
    
    return quality_df


def run_baseline_checks(outdir: Path):
    """
    Run all baseline plausibility checks.
    
    Parameters
    ----------
    outdir : Path
        Output directory
    """
    print("\n" + "="*70)
    print("STAGE 1: BASELINE CURVE PLAUSIBILITY CHECKS")
    print("="*70)
    
    df, curves = load_data_and_curves()
    
    # Plot baseline vs observed
    plot_baseline_vs_observed_bins(df, curves, outdir)
    
    # Check nonnegativity and deceleration
    quality_df = baseline_nonnegativity_and_deceleration(df, curves, outdir)
    
    return quality_df
