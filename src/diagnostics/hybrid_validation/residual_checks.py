"""
Residual ML Model Performance Checks

Validates residual model performance and clipping behavior.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, PROCESSED_DATA_DIR, MODELS_DIR, ensure_dir
from models.baseline_growth_curve import (
    make_training_table,
    load_baseline_curves,
    predict_baseline_delta
)
from models.dbh_residual_model import (
    load_and_prepare_data,
    build_training_table,
    select_features,
    train_residual_model,
    compute_residual_clip_bounds,
    load_residual_model,
    predict_delta_hybrid
)
from models.baseline_growth_curve import predict_baseline_delta
from models.dbh_growth_nn import predict_dbh_next_year_nn


# Global cache
_cached_residual_model = None
_cached_residual_features = None
_cached_residual_metadata = None


def evaluate_residual_model(df, curves, outdir: Path, retrain: bool = False):
    """
    Evaluate residual model performance.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves dictionary
    outdir : Path
        Output directory
    retrain : bool
        Whether to retrain the model (default: False, load existing)
    
    Returns
    -------
    dict
        Metrics dictionary
    """
    print("\n" + "="*70)
    print("RESIDUAL MODEL PERFORMANCE EVALUATION")
    print("="*70)
    
    # Build training table
    print("\nBuilding training table...")
    train_table = build_training_table(df, curves)
    
    # Select features
    X, y, feature_names = select_features(train_table)
    
    # Calculate mean residual of baseline curve on full dataset (before train/test split)
    # This is the mean of the actual residuals (delta_obs - delta_base) - the target for XGBoost
    valid_mask_full = X['PrevDBH_cm'].notna() & y.notna()
    y_full = y[valid_mask_full]
    mean_baseline_residual_full = np.mean(y_full)
    
    # Check if model exists
    model_path = MODELS_DIR / "dbh_residual_model.pkl"
    
    if retrain or not model_path.exists():
        print("\nTraining residual model...")
        model, X_train, X_test, y_train, y_test, feature_names = train_residual_model(X, y)
        clip_bounds = compute_residual_clip_bounds(y_train)
    else:
        print("\nLoading existing residual model...")
        model, feature_names, metadata = load_residual_model()
        
        # Split data
        valid_mask = X['PrevDBH_cm'].notna() & y.notna()
        X_clean = X[valid_mask].fillna(0.0)
        y_clean = y[valid_mask]
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_clean, y_clean, test_size=0.2, random_state=42
        )
        
        clip_bounds = (metadata['clip_low'], metadata['clip_high'])
    
    # Evaluate on test set
    print("\nEvaluating on test set...")
    y_pred_test = model.predict(X_test)
    
    # Clip predictions
    clip_low, clip_high = clip_bounds
    y_pred_test_clipped = np.clip(y_pred_test, clip_low, clip_high)
    
    # Compute metrics
    rmse = np.sqrt(mean_squared_error(y_test, y_pred_test_clipped))
    mae = mean_absolute_error(y_test, y_pred_test_clipped)
    r2 = r2_score(y_test, y_pred_test_clipped)
    bias = np.mean(y_pred_test_clipped - y_test)
    
    # Calculate mean residual of baseline curve on test set
    # This is the mean of the actual residuals (delta_obs - delta_base)
    mean_baseline_residual = np.mean(y_test)
    
    # Baseline-only: predict 0 residual always
    y_pred_baseline_only = np.zeros_like(y_test)
    rmse_baseline_only = np.sqrt(mean_squared_error(y_test, y_pred_baseline_only))
    mae_baseline_only = mean_absolute_error(y_test, y_pred_baseline_only)
    std_baseline_residual = np.std(y_test)
    
    metrics = {
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'bias': bias,
        'mean_baseline_residual': mean_baseline_residual,  # Mean residual on test set
        'mean_baseline_residual_full': mean_baseline_residual_full,  # Mean residual on full dataset
        'std_baseline_residual': std_baseline_residual,  # Std of residuals (baseline-only error)
        'baseline_only_rmse': rmse_baseline_only,
        'baseline_only_mae': mae_baseline_only,
        'clip_low': clip_low,
        'clip_high': clip_high,
        'n_train': len(X_train),
        'n_test': len(X_test)
    }
    
    print(f"\nTest Set Metrics (Residual Prediction):")
    print(f"  RMSE: {rmse:.4f} cm/year")
    print(f"  MAE:  {mae:.4f} cm/year")
    print(f"  R²:   {r2:.4f}")
    print(f"  Bias: {bias:.4f} cm/year")
    print(f"\nBaseline-Only (predicting 0 residual always):")
    print(f"  RMSE: {rmse_baseline_only:.4f} cm/year")
    print(f"  MAE:  {mae_baseline_only:.4f} cm/year")
    print(f"  Std:  {std_baseline_residual:.4f} cm/year")
    print(f"\nBaseline Curve Residual Statistics:")
    print(f"  Mean residual (test set): {mean_baseline_residual:.4f} cm/year")
    print(f"  Mean residual (full dataset): {mean_baseline_residual_full:.4f} cm/year")
    
    # Create plots directory
    plots_dir = outdir / "plots"
    ensure_dir(plots_dir)
    
    # Plot 1: Histogram of residuals
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(y_test, bins=50, alpha=0.5, label='True residuals', density=True)
    ax.hist(y_pred_test_clipped, bins=50, alpha=0.5, label='Predicted residuals', density=True)
    ax.axvline(clip_low, color='r', linestyle='--', label=f'Clip bounds ({clip_low:.2f}, {clip_high:.2f})')
    ax.axvline(clip_high, color='r', linestyle='--')
    ax.set_xlabel('Residual (cm/year)', fontsize=12)
    ax.set_ylabel('Density', fontsize=12)
    ax.set_title('Residual Distribution: True vs Predicted', fontsize=14)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    hist_path = plots_dir / "residual_hist.png"
    plt.savefig(hist_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\n✓ Saved: {hist_path}")
    
    # Plot 2: Scatter plot
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.scatter(y_test, y_pred_test_clipped, alpha=0.3, s=10)
    # Add 45-degree line
    min_val = min(y_test.min(), y_pred_test_clipped.min())
    max_val = max(y_test.max(), y_pred_test_clipped.max())
    ax.plot([min_val, max_val], [min_val, max_val], 'r--', linewidth=2, label='Perfect prediction')
    ax.set_xlabel('True Residual (cm/year)', fontsize=12)
    ax.set_ylabel('Predicted Residual (cm/year)', fontsize=12)
    ax.set_title(f'Residual Prediction: R² = {r2:.4f}', fontsize=14)
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    scatter_path = plots_dir / "residual_scatter.png"
    plt.savefig(scatter_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✓ Saved: {scatter_path}")
    
    # Save metrics CSV
    metrics_df = pd.DataFrame([metrics])
    metrics_path = outdir / "residual_metrics.csv"
    metrics_df.to_csv(metrics_path, index=False)
    print(f"✓ Saved: {metrics_path}")
    
    return metrics


def evaluate_one_step_models(df, curves, outdir: Path):
    """
    Evaluate one-step models: baseline-only, hybrid, and optionally NN.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves dictionary
    outdir : Path
        Output directory
    
    Returns
    -------
    pd.DataFrame
        Comparison metrics
    """
    print("\n" + "="*70)
    print("ONE-STEP MODEL EVALUATION")
    print("="*70)
    
    # Build training table
    train_table = build_training_table(df, curves)
    
    # Select features
    X, y, feature_names = select_features(train_table)
    
    # Split data (same split as residual model)
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].fillna(0.0).reset_index(drop=True)
    y_clean = y[valid_mask].reset_index(drop=True)
    train_table_clean = train_table[valid_mask].reset_index(drop=True).copy()
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y_clean, test_size=0.2, random_state=42
    )
    # Get test indices (they are now 0-based after reset_index)
    test_indices = X_test.index
    train_table_test = train_table_clean.iloc[test_indices].copy()
    
    # Get observed delta and next DBH
    delta_obs = y_test.values
    prev_dbh = train_table_test['PrevDBH_cm'].values
    next_dbh_obs = prev_dbh + delta_obs
    
    # Extract species and plot
    species_list = train_table_test['Species'].values
    plot_list = train_table_test['Plot'].values
    
    # Predictions
    delta_pred_baseline_only = []
    delta_pred_hybrid = []
    delta_pred_nn = []
    next_dbh_pred_baseline_only = []
    next_dbh_pred_hybrid = []
    next_dbh_pred_nn = []
    
    print(f"\nEvaluating {len(X_test)} test samples...")
    
    for i in range(len(X_test)):
        prev_dbh_val = prev_dbh[i]
        species = species_list[i]
        plot = plot_list[i]
        
        # Baseline-only: delta_pred = delta_base
        delta_base = predict_baseline_delta(prev_dbh_val, species, plot, curves)
        delta_pred_baseline_only.append(delta_base)
        next_dbh_pred_baseline_only.append(prev_dbh_val + max(0.0, delta_base))
        
        # Hybrid: delta_pred = delta_base + resid_hat
        delta_base_hybrid, delta_resid, delta_total = predict_delta_hybrid(
            prev_dbh_val, species, plot, gap_years=1.0, curves=curves
        )
        delta_pred_hybrid.append(delta_total)
        next_dbh_pred_hybrid.append(prev_dbh_val + max(0.0, delta_total))
        
        # NN (optional)
        try:
            next_dbh_nn = predict_dbh_next_year_nn(
                prev_dbh_cm=prev_dbh_val,
                species=species,
                plot=plot,
                gap_years=1.0
            )
            delta_nn = max(0.0, next_dbh_nn - prev_dbh_val)
            delta_pred_nn.append(delta_nn)
            next_dbh_pred_nn.append(next_dbh_nn)
        except Exception:
            delta_pred_nn.append(np.nan)
            next_dbh_pred_nn.append(np.nan)
    
    # Convert to arrays
    delta_pred_baseline_only = np.array(delta_pred_baseline_only)
    delta_pred_hybrid = np.array(delta_pred_hybrid)
    delta_pred_nn = np.array(delta_pred_nn)
    next_dbh_pred_baseline_only = np.array(next_dbh_pred_baseline_only)
    next_dbh_pred_hybrid = np.array(next_dbh_pred_hybrid)
    next_dbh_pred_nn = np.array(next_dbh_pred_nn)
    
    # Compute metrics for delta
    rmse_delta_baseline = np.sqrt(mean_squared_error(delta_obs, delta_pred_baseline_only))
    mae_delta_baseline = mean_absolute_error(delta_obs, delta_pred_baseline_only)
    
    rmse_delta_hybrid = np.sqrt(mean_squared_error(delta_obs, delta_pred_hybrid))
    mae_delta_hybrid = mean_absolute_error(delta_obs, delta_pred_hybrid)
    
    valid_nn = ~np.isnan(delta_pred_nn)
    if valid_nn.sum() > 0:
        rmse_delta_nn = np.sqrt(mean_squared_error(delta_obs[valid_nn], delta_pred_nn[valid_nn]))
        mae_delta_nn = mean_absolute_error(delta_obs[valid_nn], delta_pred_nn[valid_nn])
    else:
        rmse_delta_nn = mae_delta_nn = np.nan
    
    # Compute metrics for next-year DBH
    rmse_dbh_baseline = np.sqrt(mean_squared_error(next_dbh_obs, next_dbh_pred_baseline_only))
    mae_dbh_baseline = mean_absolute_error(next_dbh_obs, next_dbh_pred_baseline_only)
    
    rmse_dbh_hybrid = np.sqrt(mean_squared_error(next_dbh_obs, next_dbh_pred_hybrid))
    mae_dbh_hybrid = mean_absolute_error(next_dbh_obs, next_dbh_pred_hybrid)
    
    if valid_nn.sum() > 0:
        rmse_dbh_nn = np.sqrt(mean_squared_error(next_dbh_obs[valid_nn], next_dbh_pred_nn[valid_nn]))
        mae_dbh_nn = mean_absolute_error(next_dbh_obs[valid_nn], next_dbh_pred_nn[valid_nn])
    else:
        rmse_dbh_nn = mae_dbh_nn = np.nan
    
    # Create comparison DataFrame
    comparison_data = {
        'model': ['baseline_only', 'hybrid', 'nn'],
        'rmse_delta': [rmse_delta_baseline, rmse_delta_hybrid, rmse_delta_nn],
        'mae_delta': [mae_delta_baseline, mae_delta_hybrid, mae_delta_nn],
        'rmse_dbh': [rmse_dbh_baseline, rmse_dbh_hybrid, rmse_dbh_nn],
        'mae_dbh': [mae_dbh_baseline, mae_dbh_hybrid, mae_dbh_nn],
        'n_samples': [len(X_test), len(X_test), valid_nn.sum() if valid_nn.sum() > 0 else 0]
    }
    comparison_df = pd.DataFrame(comparison_data)
    
    print(f"\nDelta Prediction Metrics:")
    print(f"  Baseline-only: RMSE={rmse_delta_baseline:.4f}, MAE={mae_delta_baseline:.4f}")
    print(f"  Hybrid:        RMSE={rmse_delta_hybrid:.4f}, MAE={mae_delta_hybrid:.4f}")
    if valid_nn.sum() > 0:
        print(f"  NN:            RMSE={rmse_delta_nn:.4f}, MAE={mae_delta_nn:.4f}")
    
    print(f"\nNext-Year DBH Prediction Metrics:")
    print(f"  Baseline-only: RMSE={rmse_dbh_baseline:.4f}, MAE={mae_dbh_baseline:.4f}")
    print(f"  Hybrid:        RMSE={rmse_dbh_hybrid:.4f}, MAE={mae_dbh_hybrid:.4f}")
    if valid_nn.sum() > 0:
        print(f"  NN:            RMSE={rmse_dbh_nn:.4f}, MAE={mae_dbh_nn:.4f}")
    
    # Save CSV
    comparison_path = outdir / "one_step_model_comparison.csv"
    comparison_df.to_csv(comparison_path, index=False)
    print(f"\n✓ Saved: {comparison_path}")
    
    return comparison_df


def residual_clip_rate(df, curves, model, feature_names, metadata, outdir: Path):
    """
    Analyze residual clipping rates.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset
    curves : dict
        Baseline curves dictionary
    model : object
        Trained residual model
    feature_names : list
        Feature names
    metadata : dict
        Model metadata
    outdir : Path
        Output directory
    """
    print("\n" + "="*70)
    print("RESIDUAL CLIP RATE ANALYSIS")
    print("="*70)
    
    # Build training table
    train_table = build_training_table(df, curves)
    
    # Select features
    X, y, _ = select_features(train_table)
    
    # Filter valid rows
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].fillna(0.0)
    y_clean = y[valid_mask]
    train_table_clean = train_table[valid_mask].copy()
    
    # Predict residuals
    y_pred = model.predict(X_clean)
    
    # Check clipping
    clip_low = metadata['clip_low']
    clip_high = metadata['clip_high']
    
    clipped_low = y_pred < clip_low
    clipped_high = y_pred > clip_high
    clipped_any = clipped_low | clipped_high
    
    # Overall clip rate
    pct_clipped = (clipped_any.sum() / len(y_pred)) * 100
    
    print(f"\nOverall clip rate: {pct_clipped:.2f}%")
    print(f"  Clipped low: {(clipped_low.sum() / len(y_pred)) * 100:.2f}%")
    print(f"  Clipped high: {(clipped_high.sum() / len(y_pred)) * 100:.2f}%")
    
    # By species
    clip_rows = []
    for species in train_table_clean['Species'].unique():
        species_mask = train_table_clean['Species'] == species
        species_clipped = clipped_any[species_mask].sum()
        species_total = species_mask.sum()
        pct_species = (species_clipped / species_total * 100) if species_total > 0 else 0
        
        clip_rows.append({
            'Species': species,
            'n_samples': species_total,
            'n_clipped': species_clipped,
            'pct_clipped': pct_species
        })
    
    clip_df = pd.DataFrame(clip_rows).sort_values('pct_clipped', ascending=False)
    
    # Save CSV
    clip_path = outdir / "residual_clip_rates.csv"
    clip_df.to_csv(clip_path, index=False)
    print(f"\n✓ Saved: {clip_path}")
    
    return clip_df


def run_residual_checks(outdir: Path, retrain: bool = False):
    """
    Run all residual model checks.
    
    Parameters
    ----------
    outdir : Path
        Output directory
    retrain : bool
        Whether to retrain model
    """
    print("\n" + "="*70)
    print("STAGE 2: RESIDUAL ML PERFORMANCE CHECKS")
    print("="*70)
    
    # Load data
    df = load_and_prepare_data()
    curves = load_baseline_curves()
    
    # Evaluate model
    metrics = evaluate_residual_model(df, curves, outdir, retrain=retrain)
    
    # Evaluate one-step models
    one_step_comparison = evaluate_one_step_models(df, curves, outdir)
    
    # Load model for clip analysis
    model, feature_names, metadata = load_residual_model()
    
    # Analyze clip rates
    clip_df = residual_clip_rate(df, curves, model, feature_names, metadata, outdir)
    
    return metrics, clip_df, one_step_comparison
