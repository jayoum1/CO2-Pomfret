"""
Multi-Step Backtesting

Rolling-origin backtesting for 1-3 year horizons.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from typing import List
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, PROCESSED_DATA_DIR, ensure_dir
from models.baseline_growth_curve import load_baseline_curves
from models.dbh_residual_model import predict_delta_hybrid, load_residual_model
from models.dbh_growth_nn import predict_dbh_next_year_nn


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


def prepare_backtest_pairs(df, horizon_years: int = 1, min_gap: float = 0.8, max_gap: float = 1.2):
    """
    Prepare backtest pairs for given horizon.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    horizon_years : int
        Horizon in years (1, 2, or 3)
    min_gap : float
        Minimum GapYears to accept
    max_gap : float
        Maximum GapYears to accept
    
    Returns
    -------
    pd.DataFrame
        Backtest pairs with columns: TreeID, start_year, start_dbh, target_dbh, species, plot, gap_years
    """
    # Sort by TreeID and Year
    df_sorted = df.sort_values(['TreeID', 'Year']).copy()
    
    pairs = []
    
    for tree_id in df_sorted['TreeID'].unique():
        tree_data = df_sorted[df_sorted['TreeID'] == tree_id].copy()
        tree_data = tree_data.sort_values('Year')
        
        # Look for pairs with GapYears close to horizon_years
        for i in range(len(tree_data)):
            start_row = tree_data.iloc[i]
            start_dbh = start_row['DBH_cm']
            start_year = start_row['Year']
            species = start_row['Species']
            plot = start_row['Plot']
            
            # Look ahead for target
            for j in range(i + 1, len(tree_data)):
                target_row = tree_data.iloc[j]
                gap_years = target_row['Year'] - start_year
                
                # Check if gap matches horizon (allowing some tolerance)
                if min_gap * horizon_years <= gap_years <= max_gap * horizon_years:
                    target_dbh = target_row['DBH_cm']
                    
                    # Ensure both DBH values are valid
                    if pd.notna(start_dbh) and pd.notna(target_dbh):
                        pairs.append({
                            'TreeID': tree_id,
                            'start_year': start_year,
                            'start_dbh': start_dbh,
                            'target_dbh': target_dbh,
                            'species': species,
                            'plot': plot,
                            'gap_years': gap_years,
                            'horizon': horizon_years
                        })
                    break  # Use first matching pair
    
    pairs_df = pd.DataFrame(pairs)
    
    print(f"  Prepared {len(pairs_df)} backtest pairs for {horizon_years}-year horizon")
    
    return pairs_df


def simulate_tree_forward_hybrid(start_dbh: float, species: str, plot: str, years: int, curves):
    """
    Simulate tree forward using hybrid model.
    
    Parameters
    ----------
    start_dbh : float
        Starting DBH
    species : str
        Species name
    plot : str
        Plot name
    years : int
        Number of years to simulate
    curves : dict
        Baseline curves
    
    Returns
    -------
    float
        Final DBH after simulation
    """
    current_dbh = start_dbh
    
    for _ in range(years):
        delta_base, delta_resid, delta_total = predict_delta_hybrid(
            current_dbh, species, plot, gap_years=1.0, curves=curves
        )
        # Clamp to nonnegative
        delta_used = max(0.0, delta_total)
        current_dbh = current_dbh + delta_used
    
    return current_dbh


def simulate_tree_forward_nn(start_dbh: float, species: str, plot: str, years: int):
    """
    Simulate tree forward using NN state model.
    
    Parameters
    ----------
    start_dbh : float
        Starting DBH
    species : str
        Species name
    plot : str
        Plot name
    years : int
        Number of years to simulate
    
    Returns
    -------
    float
        Final DBH after simulation
    """
    current_dbh = start_dbh
    
    for _ in range(years):
        next_dbh = predict_dbh_next_year_nn(
            prev_dbh_cm=current_dbh,
            species=species,
            plot=plot,
            gap_years=1.0
        )
        # Apply hard-0 rule (no shrinkage)
        delta = next_dbh - current_dbh
        delta_used = max(0.0, delta)
        current_dbh = current_dbh + delta_used
    
    return current_dbh


def run_backtest(df, curves, horizons: List[int] = [1, 2, 3], outdir: Path = None):
    """
    Run backtesting for multiple horizons.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves
    horizons : list
        List of horizons to test
    outdir : Path
        Output directory
    
    Returns
    -------
    dict
        Results dictionary
    """
    print("\n" + "="*70)
    print("MULTI-STEP BACKTESTING")
    print("="*70)
    
    all_metrics = []
    all_comparisons = []
    
    plots_dir = outdir / "plots"
    ensure_dir(plots_dir)
    
    for horizon in horizons:
        print(f"\n{'='*70}")
        print(f"BACKTESTING: {horizon}-YEAR HORIZON")
        print(f"{'='*70}")
        
        # Prepare pairs
        pairs_df = prepare_backtest_pairs(df, horizon_years=horizon)
        
        if len(pairs_df) == 0:
            print(f"  ⚠ No pairs found for {horizon}-year horizon, skipping...")
            continue
        
        # Simulate forward
        hybrid_predictions = []
        nn_predictions = []
        errors_hybrid = []
        errors_nn = []
        shrink_flags_hybrid = []
        
        print(f"\nSimulating {len(pairs_df)} trees...")
        
        for idx, row in pairs_df.iterrows():
            start_dbh = row['start_dbh']
            target_dbh = row['target_dbh']
            species = row['species']
            plot = row['plot']
            
            # Hybrid simulation
            pred_hybrid = simulate_tree_forward_hybrid(start_dbh, species, plot, horizon, curves)
            error_hybrid = pred_hybrid - target_dbh
            
            # Check for shrinkage before clamp
            # Simulate step-by-step to detect shrinkage
            current_dbh = start_dbh
            had_shrinkage = False
            for _ in range(horizon):
                delta_base, delta_resid, delta_total = predict_delta_hybrid(
                    current_dbh, species, plot, gap_years=1.0, curves=curves
                )
                if delta_total < 0:
                    had_shrinkage = True
                delta_used = max(0.0, delta_total)
                current_dbh = current_dbh + delta_used
            
            # NN simulation
            try:
                pred_nn = simulate_tree_forward_nn(start_dbh, species, plot, horizon)
                error_nn = pred_nn - target_dbh
            except Exception as e:
                print(f"  ⚠ NN simulation failed for TreeID {row['TreeID']}: {e}")
                pred_nn = np.nan
                error_nn = np.nan
            
            hybrid_predictions.append(pred_hybrid)
            nn_predictions.append(pred_nn)
            errors_hybrid.append(error_hybrid)
            errors_nn.append(error_nn)
            shrink_flags_hybrid.append(1 if had_shrinkage else 0)
        
        pairs_df['pred_hybrid'] = hybrid_predictions
        pairs_df['pred_nn'] = nn_predictions
        pairs_df['error_hybrid'] = errors_hybrid
        pairs_df['error_nn'] = errors_nn
        pairs_df['had_shrinkage'] = shrink_flags_hybrid
        
        # Compute metrics
        valid_hybrid = ~np.isnan(errors_hybrid)
        valid_nn = ~np.isnan(errors_nn)
        
        if valid_hybrid.sum() > 0:
            rmse_hybrid = np.sqrt(np.mean(np.array(errors_hybrid)[valid_hybrid]**2))
            mae_hybrid = np.mean(np.abs(np.array(errors_hybrid)[valid_hybrid]))
            bias_hybrid = np.mean(np.array(errors_hybrid)[valid_hybrid])
            pct_shrink = (np.sum(shrink_flags_hybrid) / len(shrink_flags_hybrid)) * 100
        else:
            rmse_hybrid = mae_hybrid = bias_hybrid = pct_shrink = np.nan
        
        if valid_nn.sum() > 0:
            rmse_nn = np.sqrt(np.mean(np.array(errors_nn)[valid_nn]**2))
            mae_nn = np.mean(np.abs(np.array(errors_nn)[valid_nn]))
            bias_nn = np.mean(np.array(errors_nn)[valid_nn])
        else:
            rmse_nn = mae_nn = bias_nn = np.nan
        
        metrics_row = {
            'horizon': horizon,
            'n_pairs': len(pairs_df),
            'hybrid_rmse': rmse_hybrid,
            'hybrid_mae': mae_hybrid,
            'hybrid_bias': bias_hybrid,
            'hybrid_pct_shrink': pct_shrink,
            'nn_rmse': rmse_nn,
            'nn_mae': mae_nn,
            'nn_bias': bias_nn
        }
        all_metrics.append(metrics_row)
        
        print(f"\nHybrid Model Metrics:")
        print(f"  RMSE: {rmse_hybrid:.4f} cm")
        print(f"  MAE:  {mae_hybrid:.4f} cm")
        print(f"  Bias: {bias_hybrid:.4f} cm")
        print(f"  % with shrinkage before clamp: {pct_shrink:.1f}%")
        
        if valid_nn.sum() > 0:
            print(f"\nNN Model Metrics:")
            print(f"  RMSE: {rmse_nn:.4f} cm")
            print(f"  MAE:  {mae_nn:.4f} cm")
            print(f"  Bias: {bias_nn:.4f} cm")
        
        # Save per-tree errors
        errors_path = outdir / f"backtest_errors_h{horizon}.csv"
        pairs_df.to_csv(errors_path, index=False)
        print(f"\n✓ Saved: {errors_path}")
        
        # Plot 1: Error distribution
        fig, ax = plt.subplots(figsize=(10, 6))
        if valid_hybrid.sum() > 0:
            ax.hist(np.array(errors_hybrid)[valid_hybrid], bins=30, alpha=0.7, label=f'Hybrid (RMSE={rmse_hybrid:.2f})', density=True)
        if valid_nn.sum() > 0:
            ax.hist(np.array(errors_nn)[valid_nn], bins=30, alpha=0.7, label=f'NN (RMSE={rmse_nn:.2f})', density=True)
        ax.axvline(0, color='k', linestyle='--', linewidth=1)
        ax.set_xlabel('Prediction Error (cm)', fontsize=12)
        ax.set_ylabel('Density', fontsize=12)
        ax.set_title(f'Error Distribution: {horizon}-Year Horizon', fontsize=14)
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        hist_path = plots_dir / f"backtest_error_hist_h{horizon}.png"
        plt.savefig(hist_path, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"✓ Saved: {hist_path}")
        
        # Plot 2: Scatter plot
        fig, ax = plt.subplots(figsize=(10, 6))
        if valid_hybrid.sum() > 0:
            targets_hybrid = np.array(pairs_df['target_dbh'])[valid_hybrid]
            preds_hybrid = np.array(hybrid_predictions)[valid_hybrid]
            ax.scatter(targets_hybrid, preds_hybrid, alpha=0.5, s=20, label='Hybrid')
        if valid_nn.sum() > 0:
            targets_nn = np.array(pairs_df['target_dbh'])[valid_nn]
            preds_nn = np.array(nn_predictions)[valid_nn]
            ax.scatter(targets_nn, preds_nn, alpha=0.5, s=20, label='NN')
        
        # Add 45-degree line
        all_targets = pairs_df['target_dbh']
        min_val = all_targets.min()
        max_val = all_targets.max()
        ax.plot([min_val, max_val], [min_val, max_val], 'r--', linewidth=2, label='Perfect prediction')
        ax.set_xlabel('Observed DBH (cm)', fontsize=12)
        ax.set_ylabel('Predicted DBH (cm)', fontsize=12)
        ax.set_title(f'Predicted vs Observed: {horizon}-Year Horizon', fontsize=14)
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        scatter_path = plots_dir / f"backtest_scatter_h{horizon}.png"
        plt.savefig(scatter_path, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"✓ Saved: {scatter_path}")
        
        # Comparison row
        if valid_nn.sum() > 0:
            all_comparisons.append({
                'horizon': horizon,
                'hybrid_rmse': rmse_hybrid,
                'hybrid_mae': mae_hybrid,
                'hybrid_bias': bias_hybrid,
                'nn_rmse': rmse_nn,
                'nn_mae': mae_nn,
                'nn_bias': bias_nn,
                'rmse_improvement': rmse_nn - rmse_hybrid,
                'mae_improvement': mae_nn - mae_hybrid
            })
    
    # Save metrics
    metrics_df = pd.DataFrame(all_metrics)
    metrics_path = outdir / "backtest_metrics.csv"
    metrics_df.to_csv(metrics_path, index=False)
    print(f"\n✓ Saved: {metrics_path}")
    
    # Save comparison
    if all_comparisons:
        comparison_df = pd.DataFrame(all_comparisons)
        comparison_path = outdir / "backtest_hybrid_vs_nn.csv"
        comparison_df.to_csv(comparison_path, index=False)
        print(f"✓ Saved: {comparison_path}")
    
    return metrics_df, comparison_df if all_comparisons else None


def run_backtesting(outdir: Path):
    """
    Run all backtesting checks.
    
    Parameters
    ----------
    outdir : Path
        Output directory
    """
    print("\n" + "="*70)
    print("STAGE 3: MULTI-STEP BACKTESTING")
    print("="*70)
    
    df, curves = load_data_and_curves()
    
    metrics_df, comparison_df = run_backtest(df, curves, horizons=[1, 2, 3], outdir=outdir)
    
    return metrics_df, comparison_df
