"""
Residual ML Model for Hybrid DBH Growth Prediction

This module trains an ML model (XGBoost) to predict residuals around the baseline
growth curve. The hybrid prediction is: delta_total = delta_base + delta_resid.

Features: PrevDBH_cm, Species_*, Plot_*, GapYears
Target: residual = delta_obs - delta_base
"""

import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
import xgboost as xgb
import sys
import warnings
warnings.filterwarnings('ignore')

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, MODELS_DIR, ensure_dir
from models.baseline_growth_curve import (
    make_training_table,
    fit_baseline_curves,
    predict_baseline_delta,
    save_baseline_curves,
    load_baseline_curves
)

# Model paths
RESIDUAL_MODEL_PATH = MODELS_DIR / "dbh_residual_model.pkl"
RESIDUAL_FEATURES_PATH = MODELS_DIR / "dbh_residual_features.txt"
RESIDUAL_METADATA_PATH = MODELS_DIR / "dbh_residual_metadata.json"

# Global cache
_loaded_residual_model = None
_loaded_residual_features = None
_loaded_residual_metadata = None
_loaded_baseline_curves = None


def load_and_prepare_data():
    """
    Load the encoded dataset.
    
    Returns
    -------
    pd.DataFrame
        Dataset with all columns
    """
    print("Loading dataset...")
    df = pd.read_csv(str(CARBON_ALL_PLOTS_ENCODED))
    print(f"Loaded {len(df):,} rows, {df.shape[1]} columns")
    return df


def build_training_table(df: pd.DataFrame, curves: dict) -> pd.DataFrame:
    """
    Build training table with baseline deltas and residuals.
    
    Parameters
    ----------
    df : pd.DataFrame
        Full dataset (with encoded columns)
    curves : dict
        Baseline curves dictionary
    
    Returns
    -------
    pd.DataFrame
        Training table with delta_base, y_resid, and all encoded columns
    """
    print("\nBuilding training table with baseline deltas...")
    
    # Create PrevDBH_cm if it doesn't exist
    df_work = df.copy()
    if 'PrevDBH_cm' not in df_work.columns:
        df_work = df_work.sort_values(['TreeID', 'Year']).copy()
        df_work['PrevDBH_cm'] = df_work.groupby('TreeID')['DBH_cm'].shift()
    
    # Extract Species and Plot from one-hot encoded columns if needed
    if 'Species' not in df_work.columns:
        species_cols = [col for col in df_work.columns if col.startswith('Species_')]
        if species_cols:
            df_work['Species'] = df_work[species_cols].idxmax(axis=1).str.replace('Species_', '')
        else:
            raise ValueError("No Species columns found in dataset")
    
    if 'Plot' not in df_work.columns:
        plot_cols = [col for col in df_work.columns if col.startswith('Plot_')]
        if plot_cols:
            df_work['Plot'] = df_work[plot_cols].idxmax(axis=1).str.replace('Plot_', '')
            df_work['Plot'] = df_work['Plot'].str.capitalize()
        else:
            df_work['Plot'] = 'Lower'
    
    # Filter valid rows (same as make_training_table)
    valid_mask = (
        df_work['PrevDBH_cm'].notna() &
        df_work['DBH_cm'].notna() &
        df_work['GapYears'].notna() &
        (df_work['GapYears'] > 0)
    )
    
    train_table = df_work[valid_mask].copy()
    
    # Compute annualized increment
    train_table['delta_obs'] = (train_table['DBH_cm'] - train_table['PrevDBH_cm']) / train_table['GapYears']
    
    # Compute baseline delta for each row
    print("Computing baseline deltas...")
    delta_base_list = []
    for idx, row in train_table.iterrows():
        delta_base = predict_baseline_delta(
            prev_dbh_cm=row['PrevDBH_cm'],
            species=row['Species'],
            plot=row['Plot'],
            curves=curves
        )
        delta_base_list.append(delta_base)
    
    train_table['delta_base'] = delta_base_list
    
    # Compute residual target
    train_table['y_resid'] = train_table['delta_obs'] - train_table['delta_base']
    
    print(f"  Rows: {len(train_table):,}")
    print(f"  Mean delta_base: {train_table['delta_base'].mean():.3f} cm/year")
    print(f"  Mean y_resid: {train_table['y_resid'].mean():.3f} cm/year")
    print(f"  Residual std: {train_table['y_resid'].std():.3f} cm/year")
    
    return train_table


def select_features(df: pd.DataFrame) -> tuple:
    """
    Select features for residual model.
    
    Parameters
    ----------
    df : pd.DataFrame
        Training table with all columns
    
    Returns
    -------
    tuple
        (X, y, feature_names)
    """
    print("\nSelecting features for residual model...")
    
    # Target: residual
    y = df['y_resid'].copy()
    
    # Start with PrevDBH_cm
    feature_cols = ['PrevDBH_cm']
    
    # Add one-hot encoded species columns
    species_cols = [col for col in df.columns if col.startswith('Species_')]
    feature_cols.extend(species_cols)
    print(f"  Added {len(species_cols)} species features")
    
    # Add one-hot encoded plot columns
    plot_cols = [col for col in df.columns if col.startswith('Plot_')]
    feature_cols.extend(plot_cols)
    print(f"  Added {len(plot_cols)} plot features")
    
    # Add GapYears if available
    if 'GapYears' in df.columns:
        feature_cols.append('GapYears')
        print("  Added GapYears feature")
    
    # Extract feature matrix
    X = df[feature_cols].copy()
    
    print(f"\nTotal features: {len(feature_cols)}")
    
    return X, y, feature_cols


def train_residual_model(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float = 0.2,
    random_state: int = 42
) -> tuple:
    """
    Train XGBoost model to predict residuals.
    
    Parameters
    ----------
    X : pd.DataFrame
        Feature matrix
    y : pd.Series
        Residual target
    test_size : float
        Test set proportion
    random_state : int
        Random seed
    
    Returns
    -------
    tuple
        (model, X_train, X_test, y_train, y_test, feature_names)
    """
    print("\n" + "="*70)
    print("TRAINING RESIDUAL MODEL")
    print("="*70)
    
    # Filter valid rows
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].copy()
    y_clean = y[valid_mask].copy()
    
    # Fill NaN with 0 (for one-hot encoded columns)
    X_clean = X_clean.fillna(0.0)
    
    print(f"Valid rows: {len(X_clean):,}")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y_clean,
        test_size=test_size,
        random_state=random_state
    )
    
    print(f"\nTrain set: {len(X_train):,} samples")
    print(f"Test set: {len(X_test):,} samples")
    
    # Train XGBoost with conservative parameters
    print("\nTraining XGBoost model...")
    print("  Parameters: shallow depth, regularization")
    
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=4,  # Shallow to prevent overfitting
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,  # L1 regularization
        reg_lambda=1.0,  # L2 regularization
        random_state=random_state,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    print("✓ Model trained")
    
    # Evaluate
    print("\nEvaluating on test set...")
    y_pred_test = model.predict(X_test)
    r2_test = r2_score(y_test, y_pred_test)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_pred_test))
    mae_test = mean_absolute_error(y_test, y_pred_test)
    
    print(f"\nTest Set Metrics:")
    print(f"  R² Score:  {r2_test:.4f}")
    print(f"  RMSE:     {rmse_test:.4f} cm/year")
    print(f"  MAE:      {mae_test:.4f} cm/year")
    
    feature_names = X_train.columns.tolist()
    
    return model, X_train, X_test, y_train, y_test, feature_names


def compute_residual_clip_bounds(y_train: pd.Series, percentile_low: float = 5.0, percentile_high: float = 95.0) -> tuple:
    """
    Compute clip bounds for residuals based on training distribution.
    
    Parameters
    ----------
    y_train : pd.Series
        Training residuals
    percentile_low : float
        Lower percentile (default: 5.0)
    percentile_high : float
        Upper percentile (default: 95.0)
    
    Returns
    -------
    tuple
        (clip_low, clip_high)
    """
    clip_low = np.percentile(y_train, percentile_low)
    clip_high = np.percentile(y_train, percentile_high)
    
    print(f"\nResidual clip bounds:")
    print(f"  {percentile_low}th percentile: {clip_low:.3f} cm/year")
    print(f"  {percentile_high}th percentile: {clip_high:.3f} cm/year")
    
    return clip_low, clip_high


def save_residual_model(model, feature_names: list, clip_bounds: tuple, baseline_metadata_path: Path):
    """
    Save residual model and metadata.
    
    Parameters
    ----------
    model : XGBRegressor
        Trained model
    feature_names : list
        List of feature names
    clip_bounds : tuple
        (clip_low, clip_high)
    baseline_metadata_path : Path
        Path to baseline metadata JSON
    """
    print("\nSaving residual model...")
    
    # Save model
    joblib.dump(model, str(RESIDUAL_MODEL_PATH))
    print(f"✓ Saved model to {RESIDUAL_MODEL_PATH}")
    
    # Save feature names
    with open(str(RESIDUAL_FEATURES_PATH), 'w') as f:
        for feat_name in feature_names:
            f.write(f"{feat_name}\n")
    print(f"✓ Saved feature names to {RESIDUAL_FEATURES_PATH}")
    
    # Save metadata
    metadata = {
        'clip_low': float(clip_bounds[0]),
        'clip_high': float(clip_bounds[1]),
        'baseline_metadata_path': str(baseline_metadata_path),
        'n_features': len(feature_names)
    }
    
    with open(str(RESIDUAL_METADATA_PATH), 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Saved metadata to {RESIDUAL_METADATA_PATH}")


def load_residual_model():
    """
    Load residual model, features, and metadata.
    
    Returns
    -------
    tuple
        (model, feature_names, metadata)
    """
    global _loaded_residual_model, _loaded_residual_features, _loaded_residual_metadata
    
    if _loaded_residual_model is not None:
        return _loaded_residual_model, _loaded_residual_features, _loaded_residual_metadata
    
    if not RESIDUAL_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Residual model not found: {RESIDUAL_MODEL_PATH}\n"
            "Please train the model first."
        )
    
    _loaded_residual_model = joblib.load(str(RESIDUAL_MODEL_PATH))
    
    with open(str(RESIDUAL_FEATURES_PATH), 'r') as f:
        _loaded_residual_features = [line.strip() for line in f.readlines()]
    
    with open(str(RESIDUAL_METADATA_PATH), 'r') as f:
        _loaded_residual_metadata = json.load(f)
    
    print(f"✓ Loaded residual model from {RESIDUAL_MODEL_PATH}")
    return _loaded_residual_model, _loaded_residual_features, _loaded_residual_metadata


def predict_delta_hybrid(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    gap_years: float = 1.0,
    curves: dict = None
) -> tuple:
    """
    Predict hybrid delta (baseline + residual).
    
    Parameters
    ----------
    prev_dbh_cm : float
        Previous DBH in cm
    species : str
        Species name
    plot : str
        Plot name
    gap_years : float
        Gap years (default: 1.0)
    curves : dict
        Baseline curves (if None, loads from disk and caches)
    
    Returns
    -------
    tuple
        (delta_base, delta_resid, delta_total)
    """
    global _loaded_baseline_curves
    
    # Load baseline curves if not provided (use cache)
    if curves is None:
        if _loaded_baseline_curves is None:
            _loaded_baseline_curves = load_baseline_curves()
        curves = _loaded_baseline_curves
    
    # Predict baseline delta
    delta_base = predict_baseline_delta(prev_dbh_cm, species, plot, curves)
    
    # Load residual model
    model, feature_names, metadata = load_residual_model()
    
    # Build feature vector
    feature_dict = {}
    feature_dict['PrevDBH_cm'] = prev_dbh_cm
    
    # Initialize all features to 0
    for feat_name in feature_names:
        if feat_name not in feature_dict:
            feature_dict[feat_name] = 0.0
    
    # Set species feature
    if species is not None:
        species_col = f'Species_{species.lower()}'
        if species_col in feature_names:
            feature_dict[species_col] = 1.0
    
    # Set plot feature
    if plot is not None and plot.lower() != 'lower':
        plot_normalized = plot.capitalize()
        plot_col = f'Plot_{plot_normalized}'
        if plot_col in feature_names:
            feature_dict[plot_col] = 1.0
    
    # Set GapYears
    if 'GapYears' in feature_names:
        feature_dict['GapYears'] = gap_years
    
    # Build feature DataFrame
    feature_df = pd.DataFrame([feature_dict], columns=feature_names)
    
    # Predict residual
    delta_resid_raw = model.predict(feature_df)[0]
    
    # Clip residual
    clip_low = metadata['clip_low']
    clip_high = metadata['clip_high']
    delta_resid = np.clip(delta_resid_raw, clip_low, clip_high)
    
    # Total delta
    delta_total = delta_base + delta_resid
    
    return delta_base, delta_resid, delta_total


def predict_dbh_next_year_hybrid(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    gap_years: float = 1.0,
    curves: dict = None
) -> float:
    """
    Predict next year's DBH using hybrid model.
    
    Parameters
    ----------
    prev_dbh_cm : float
        Previous DBH in cm
    species : str
        Species name
    plot : str
        Plot name
    gap_years : float
        Gap years (default: 1.0)
    curves : dict
        Baseline curves (if None, loads from disk and caches)
    
    Returns
    -------
    float
        Predicted DBH for next year (cm)
    """
    delta_base, delta_resid, delta_total = predict_delta_hybrid(
        prev_dbh_cm, species, plot, gap_years, curves
    )
    
    # Clamp to nonnegative
    delta_used = max(0.0, delta_total)
    
    next_dbh = prev_dbh_cm + delta_used
    
    return next_dbh
