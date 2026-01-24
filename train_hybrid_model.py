"""
Entry script to train hybrid DBH growth model and generate snapshots.

This script:
1. Fits baseline growth curves
2. Trains residual ML model
3. Runs diagnostics
4. Generates snapshots for years 0-20
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from config import CARBON_ALL_PLOTS_ENCODED, MODELS_DIR, PROCESSED_DATA_DIR, ensure_dir
from models.baseline_growth_curve import (
    make_training_table,
    fit_baseline_curves,
    save_baseline_curves
)
from models.dbh_residual_model import (
    load_and_prepare_data,
    build_training_table,
    select_features,
    train_residual_model,
    compute_residual_clip_bounds,
    save_residual_model
)
from models.forest_snapshots_nn import generate_forest_snapshots
from diagnostics.hybrid_diagnostics import generate_diagnostic_reports


def main():
    """
    Main execution function.
    """
    print("="*70)
    print("HYBRID DBH GROWTH MODEL TRAINING")
    print("="*70)
    
    # Step 1: Fit baseline curves
    print("\n" + "="*70)
    print("STEP 1: FITTING BASELINE GROWTH CURVES")
    print("="*70)
    
    df = load_and_prepare_data()
    train_table = make_training_table(df)
    curves, metadata = fit_baseline_curves(train_table)
    
    # Estimate residual sigma for stochastic mode
    from models.baseline_growth_curve import estimate_residual_sigma
    sigma_df = estimate_residual_sigma(train_table, curves)
    
    save_baseline_curves(curves, metadata, sigma_df)
    
    # Step 2: Train residual model
    print("\n" + "="*70)
    print("STEP 2: TRAINING RESIDUAL ML MODEL")
    print("="*70)
    
    residual_train_table = build_training_table(df, curves)
    X, y, feature_names = select_features(residual_train_table)
    model, X_train, X_test, y_train, y_test, feature_names = train_residual_model(X, y)
    
    clip_bounds = compute_residual_clip_bounds(y_train)
    baseline_metadata_path = MODELS_DIR / "baseline_growth_metadata.json"
    save_residual_model(model, feature_names, clip_bounds, baseline_metadata_path)
    
    # Step 3: Run diagnostics
    print("\n" + "="*70)
    print("STEP 3: RUNNING DIAGNOSTICS")
    print("="*70)
    
    diagnostic_results = generate_diagnostic_reports()
    
    # Step 4: Generate snapshots
    print("\n" + "="*70)
    print("STEP 4: GENERATING SNAPSHOTS")
    print("="*70)
    
    years_list = list(range(0, 21))  # Years 0-20
    output_dir = PROCESSED_DATA_DIR / "forest_snapshots_hybrid"
    
    snapshot_results = generate_forest_snapshots(
        years_list=years_list,
        output_dir=output_dir,
        enforce_monotonic_dbh=True,
        max_annual_shrink_cm=0.0,
        model_type="nn_state",
        simulation_mode="hybrid",
        epsilon_cm=0.02
    )
    
    print("\n" + "="*70)
    print("TRAINING COMPLETE")
    print("="*70)
    print("\nOutputs:")
    print(f"  Baseline curves: {MODELS_DIR / 'baseline_growth_bins.csv'}")
    print(f"  Residual model: {MODELS_DIR / 'dbh_residual_model.pkl'}")
    print(f"  Diagnostics: {PROCESSED_DATA_DIR / 'diagnostics'}")
    print(f"  Snapshots: {output_dir}")
    print("\n✓ All steps completed successfully!")


if __name__ == "__main__":
    main()
