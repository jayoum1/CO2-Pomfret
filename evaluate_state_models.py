"""
Comprehensive evaluation of state DBH models (XGBoost and Neural Network).

This script evaluates:
1. One-year prediction metrics on held-out test set
2. Iterative simulation sanity check (10 years)
3. Forest-level outcomes for multiple horizons
4. Optional epsilon correction comparison
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

sys.path.insert(0, str(Path(__file__).parent / "src"))

from config import CARBON_ALL_PLOTS_ENCODED
from models.dbh_growth_model import load_and_prepare_data, select_features, load_dbh_growth_model
from models.dbh_growth_nn import load_dbh_growth_model_nn
from models.forest_snapshots_nn import load_base_forest_df
from models.dbh_growth_nn import predict_dbh_next_year_nn
from models.dbh_growth_model import predict_dbh_next_year
from models.forest_metrics import carbon_from_dbh


def evaluate_state_models_on_test_set():
    """
    1) Print one-year prediction metrics for state models on held-out test set.
    """
    print("="*70)
    print("1. ONE-YEAR PREDICTION METRICS (HELD-OUT TEST SET)")
    print("="*70)
    
    # Load and prepare data (same as training)
    print("\nLoading data...")
    df = load_and_prepare_data()
    X, y, feature_names = select_features(df)
    
    # Filter valid rows
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].copy()
    y_clean = y[valid_mask].copy()
    
    # Use same train/test split as training (random_state=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y_clean,
        test_size=0.2,
        random_state=42
    )
    
    print(f"\nTest set size: {len(X_test):,} samples")
    
    # Load XGBoost model
    print("\n" + "-"*70)
    print("XGBOOST STATE MODEL")
    print("-"*70)
    xgb_model, xgb_features = load_dbh_growth_model()
    
    # Get selected features for XGBoost
    X_test_xgb = X_test[xgb_features]
    
    # Predict
    y_pred_xgb = xgb_model.predict(X_test_xgb)
    
    # Metrics
    rmse_xgb = np.sqrt(mean_squared_error(y_test, y_pred_xgb))
    mae_xgb = mean_absolute_error(y_test, y_pred_xgb)
    r2_xgb = r2_score(y_test, y_pred_xgb)
    
    print(f"\nTest Set Metrics:")
    print(f"  RMSE: {rmse_xgb:.4f} cm")
    print(f"  MAE:  {mae_xgb:.4f} cm")
    print(f"  R²:   {r2_xgb:.4f}")
    
    # Load Neural Network model
    print("\n" + "-"*70)
    print("NEURAL NETWORK STATE MODEL")
    print("-"*70)
    nn_model, nn_scaler, nn_features = load_dbh_growth_model_nn()
    
    # Scale features
    X_test_nn = X_test[nn_features]
    X_test_nn_scaled = nn_scaler.transform(X_test_nn)
    
    # Predict
    y_pred_nn = nn_model.predict(X_test_nn_scaled)
    y_pred_nn = np.maximum(0, y_pred_nn)  # Ensure non-negative
    
    # Metrics
    rmse_nn = np.sqrt(mean_squared_error(y_test, y_pred_nn))
    mae_nn = mean_absolute_error(y_test, y_pred_nn)
    r2_nn = r2_score(y_test, y_pred_nn)
    
    print(f"\nTest Set Metrics:")
    print(f"  RMSE: {rmse_nn:.4f} cm")
    print(f"  MAE:  {mae_nn:.4f} cm")
    print(f"  R²:   {r2_nn:.4f}")
    
    # Comparison
    print("\n" + "-"*70)
    print("COMPARISON")
    print("-"*70)
    comparison_df = pd.DataFrame({
        'Model': ['XGBoost', 'Neural Network'],
        'RMSE (cm)': [rmse_xgb, rmse_nn],
        'MAE (cm)': [mae_xgb, mae_nn],
        'R²': [r2_xgb, r2_nn]
    })
    print(comparison_df.to_string(index=False))
    
    return {
        'xgb': {'rmse': rmse_xgb, 'mae': mae_xgb, 'r2': r2_xgb},
        'nn': {'rmse': rmse_nn, 'mae': mae_nn, 'r2': r2_nn},
        'X_test': X_test,
        'y_test': y_test
    }


def iterative_simulation_sanity_check(use_epsilon_correction=False, epsilon=0.02):
    """
    2) Iterative simulation sanity report (10 years) using NN state model.
    
    Parameters:
        use_epsilon_correction: If True, apply epsilon correction (delta < 0 -> delta = epsilon)
        epsilon: Minimum delta value when correction is applied (default: 0.02 cm)
    """
    print("\n" + "="*70)
    if use_epsilon_correction:
        print(f"2. ITERATIVE SIMULATION SANITY CHECK (10 YEARS) - WITH EPSILON CORRECTION (ε={epsilon} cm)")
    else:
        print("2. ITERATIVE SIMULATION SANITY CHECK (10 YEARS) - RAW (NO CORRECTION)")
    print("="*70)
    
    # Load base forest
    print("\nLoading base forest...")
    base_forest = load_base_forest_df()
    print(f"Base forest: {len(base_forest):,} trees")
    
    # Initialize simulation state
    current = base_forest.copy()
    
    # Track statistics per year
    stats = []
    
    print("\n" + "-"*70)
    if use_epsilon_correction:
        print(f"{'Year':<6} | {'Mean DBH':<12} | {'Mean Δ':<12} | {'Med Δ':<12} | {'% Neg Δ':<10} | {'% < -0.2':<10} | {'Unique DBH':<12} | {'% ε':<10}")
    else:
        print(f"{'Year':<6} | {'Mean DBH':<12} | {'Mean Δ':<12} | {'Med Δ':<12} | {'% Neg Δ':<10} | {'% < -0.2':<10} | {'Unique DBH':<12}")
    print("-"*70)
    
    for year in range(1, 11):
        prev_dbhs = current['DBH_cm'].values.copy()
        next_dbhs = []
        num_epsilon_corrected = 0
        
        # Simulate one year for each tree
        for idx, row in current.iterrows():
            prev_dbh = row['DBH_cm']
            species = row['Species']
            plot = row['Plot']
            
            # Predict next DBH
            next_dbh_pred = predict_dbh_next_year_nn(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0
            )
            
            # Calculate delta
            delta = next_dbh_pred - prev_dbh
            
            # Apply epsilon correction if enabled
            if use_epsilon_correction and delta < 0:
                delta = epsilon
                next_dbh = prev_dbh + delta
                num_epsilon_corrected += 1
            else:
                next_dbh = next_dbh_pred
            
            next_dbhs.append(next_dbh)
        
        # Update current state
        current['DBH_cm'] = next_dbhs
        
        # Calculate statistics
        deltas = np.array(next_dbhs) - prev_dbhs
        mean_dbh = np.mean(next_dbhs)
        mean_delta = np.mean(deltas)
        median_delta = np.median(deltas)
        pct_neg = (deltas < 0).mean() * 100
        pct_strong_shrink = (deltas < -0.2).mean() * 100
        unique_dbhs = len(np.unique(np.round(next_dbhs, 6)))
        pct_epsilon_corrected = (num_epsilon_corrected / len(current)) * 100 if use_epsilon_correction else 0.0
        
        stats.append({
            'year': year,
            'mean_dbh': mean_dbh,
            'mean_delta': mean_delta,
            'median_delta': median_delta,
            'pct_neg': pct_neg,
            'pct_strong_shrink': pct_strong_shrink,
            'unique_dbhs': unique_dbhs,
            'pct_epsilon_corrected': pct_epsilon_corrected
        })
        
        # Print row
        if use_epsilon_correction:
            print(f"{year:<6} | {mean_dbh:12.4f} | {mean_delta:12.4f} | {median_delta:12.4f} | {pct_neg:9.1f}% | {pct_strong_shrink:9.1f}% | {unique_dbhs:12d} | {pct_epsilon_corrected:9.1f}% ε")
        else:
            print(f"{year:<6} | {mean_dbh:12.4f} | {mean_delta:12.4f} | {median_delta:12.4f} | {pct_neg:9.1f}% | {pct_strong_shrink:9.1f}% | {unique_dbhs:12d}")
    
    print("-"*70)
    
    return stats, current


def forest_level_outcomes():
    """
    3) Forest-level outcomes for horizons [0,5,10,20] using NN state model.
    """
    print("\n" + "="*70)
    print("3. FOREST-LEVEL OUTCOMES (NN STATE MODEL)")
    print("="*70)
    
    # Load base forest
    print("\nLoading base forest...")
    base_forest = load_base_forest_df()
    
    outcomes = []
    
    for years in [0, 5, 10, 20]:
        print(f"\nSimulating {years} years forward...")
        
        if years == 0:
            forest = base_forest.copy()
        else:
            # Simulate forward
            forest = base_forest.copy()
            for year in range(years):
                next_dbhs = []
                for idx, row in forest.iterrows():
                    next_dbh = predict_dbh_next_year_nn(
                        prev_dbh_cm=row['DBH_cm'],
                        species=row['Species'],
                        plot=row['Plot'],
                        gap_years=1.0
                    )
                    next_dbhs.append(next_dbh)
                forest['DBH_cm'] = next_dbhs
        
        # Calculate metrics
        mean_dbh = forest['DBH_cm'].mean()
        carbon_list = [carbon_from_dbh(row['DBH_cm'], row['Species']) for idx, row in forest.iterrows()]
        total_carbon = sum(carbon_list)
        num_trees = len(forest)
        
        outcomes.append({
            'Years': years,
            'Mean_DBH_cm': mean_dbh,
            'Total_Carbon_kg': total_carbon,
            'Num_Trees': num_trees
        })
        
        print(f"  Mean DBH: {mean_dbh:.2f} cm")
        print(f"  Total Carbon: {total_carbon:.2f} kg C")
        print(f"  Number of Trees: {num_trees}")
    
    # Print summary table
    print("\n" + "-"*70)
    print("SUMMARY TABLE")
    print("-"*70)
    outcomes_df = pd.DataFrame(outcomes)
    print(outcomes_df.to_string(index=False))
    
    return outcomes_df


def main():
    """
    Main evaluation function.
    """
    print("="*70)
    print("STATE MODEL EVALUATION REPORT")
    print("="*70)
    
    # 1. One-year prediction metrics
    test_results = evaluate_state_models_on_test_set()
    
    # 2. Iterative simulation sanity check (raw, no correction)
    print("\n")
    raw_stats, raw_final_state = iterative_simulation_sanity_check(use_epsilon_correction=False)
    
    # 2b. Iterative simulation sanity check (with epsilon correction)
    print("\n")
    corrected_stats, corrected_final_state = iterative_simulation_sanity_check(use_epsilon_correction=True, epsilon=0.02)
    
    # 3. Forest-level outcomes
    outcomes_df = forest_level_outcomes()
    
    # Final summary
    print("\n" + "="*70)
    print("EVALUATION SUMMARY")
    print("="*70)
    print("\n✓ One-year prediction metrics computed on held-out test set")
    print("✓ 10-year iterative simulation sanity check completed (raw and corrected)")
    print("✓ Forest-level outcomes computed for horizons [0,5,10,20]")
    print("\nKey Findings:")
    print(f"  - XGBoost RMSE: {test_results['xgb']['rmse']:.4f} cm, R²: {test_results['xgb']['r2']:.4f}")
    print(f"  - NN RMSE: {test_results['nn']['rmse']:.4f} cm, R²: {test_results['nn']['r2']:.4f}")
    
    # Compare raw vs corrected
    raw_year10 = raw_stats[9]  # Year 10 (0-indexed)
    corrected_year10 = corrected_stats[9]
    print(f"\n10-Year Simulation Comparison:")
    print(f"  Raw: Mean Δ = {raw_year10['mean_delta']:.4f} cm, % Neg = {raw_year10['pct_neg']:.1f}%")
    print(f"  Corrected: Mean Δ = {corrected_year10['mean_delta']:.4f} cm, % Epsilon = {corrected_year10['pct_epsilon_corrected']:.1f}%")


if __name__ == "__main__":
    main()

