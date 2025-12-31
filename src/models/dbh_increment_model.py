"""
DBH Increment Model

Trains a regression model to predict annual DBH increment (growth) instead of next-year DBH.

APPROACH:
    Instead of predicting DBH_next = f(DBH_now, features), we predict:
        DeltaDBH_per_year = f(DBH_now, features)
    
    Then simulate as:
        DBH_next = DBH_now + clamp(DeltaDBH_per_year * gap_years)
    
    This approach may be more stable for multi-year simulation because:
    - Increments are typically smaller and more predictable than absolute DBH
    - Easier to enforce biological constraints (no negative growth)
    - May reduce unrealistic shrinkage predictions

Model Input Features:
    - PrevDBH_cm: Current DBH (in cm) - REQUIRED
    - Species_*: One-hot encoded species features
    - Plot_*: One-hot encoded plot features
    - Group_*: Tree group (hardwood/softwood)
    - GapYears: Years between measurements (default: 1.0)

Model Output:
    - DeltaDBH_per_year: Predicted annual DBH increment (cm/year)

Usage Example:
    >>> from src.models.dbh_increment_model import predict_dbh_next_year_from_increment
    >>> next_dbh = predict_dbh_next_year_from_increment(
    ...     prev_dbh_cm=25.0,
    ...     species='red oak',
    ...     plot='Upper'
    ... )
    >>> print(f"Predicted DBH next year: {next_dbh:.2f} cm")
"""

import pandas as pd
import numpy as np
import sys
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score, cross_validate, KFold
from sklearn.feature_selection import RFECV
from sklearn.metrics import r2_score, mean_squared_error, make_scorer, mean_absolute_error
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, MODELS_DIR
from api.encoding import encode_user_input

# Ensure models directory exists
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Model file paths
MODEL_PATH = MODELS_DIR / "dbh_increment_model.pkl"
FEATURE_NAMES_PATH = MODELS_DIR / "dbh_increment_model_features.txt"
SELECTED_FEATURES_PATH = MODELS_DIR / "dbh_increment_model_selected_features.txt"
CV_RESULTS_PATH = MODELS_DIR / "dbh_increment_model_cv_results.csv"

# Global variables for caching loaded model
_loaded_model = None
_loaded_feature_names = None


def load_and_prepare_data():
    """
    Load the processed dataset and prepare it for training.
    
    Creates the target variable: DeltaDBH_per_year (annual increment)
    If GapYears exists, uses per-year increment; otherwise uses raw delta.
    
    Returns:
        df: DataFrame with DeltaDBH_per_year created and ready for modeling
    """
    print("Loading dataset...")
    df = pd.read_csv(str(CARBON_ALL_PLOTS_ENCODED))
    print(f"Loaded {len(df):,} rows, {df.shape[1]} columns")
    
    # Sort by TreeID and Year to ensure proper ordering
    df = df.sort_values(['TreeID', 'Year']).copy()
    
    # Create PrevDBH_cm from DBH_cm (shift within each TreeID group)
    if 'PrevDBH_cm' not in df.columns:
        print("Creating PrevDBH_cm column...")
        df['PrevDBH_cm'] = df.groupby('TreeID')['DBH_cm'].shift()
        print(f"Created PrevDBH_cm. Rows with PrevDBH_cm: {df['PrevDBH_cm'].notna().sum():,}")
    
    # Create DeltaDBH_cm (raw increment)
    df['DeltaDBH_cm'] = df['DBH_cm'] - df['PrevDBH_cm']
    
    # Create DeltaDBH_per_year (annualized increment)
    if 'GapYears' in df.columns:
        print("Creating DeltaDBH_per_year (annualized increment)...")
        df['DeltaDBH_per_year'] = df['DeltaDBH_cm'] / df['GapYears']
        # Use per-year increment as target if GapYears exists
        print(f"Using DeltaDBH_per_year as target (GapYears available)")
    else:
        print("GapYears not found. Using DeltaDBH_cm as target.")
        df['DeltaDBH_per_year'] = df['DeltaDBH_cm']
    
    print(f"DeltaDBH_per_year statistics:")
    print(f"  Mean: {df['DeltaDBH_per_year'].mean():.4f} cm/year")
    print(f"  Median: {df['DeltaDBH_per_year'].median():.4f} cm/year")
    print(f"  Min: {df['DeltaDBH_per_year'].min():.4f} cm/year")
    print(f"  Max: {df['DeltaDBH_per_year'].max():.4f} cm/year")
    print(f"  Std: {df['DeltaDBH_per_year'].std():.4f} cm/year")
    
    return df


def select_features(df):
    """
    Select features for the increment model.
    
    Features included:
        - PrevDBH_cm: Current DBH (required)
        - Species_*: One-hot encoded species columns
        - Plot_*: One-hot encoded plot columns
        - GapYears: Years between measurements (if available)
        - Group_*: Tree group (softwood/hardwood)
        - GrowthType_*: Growth type indicators (if available)
    
    Excluded (to avoid target leakage):
        - DBH_cm: This is used to compute the target
        - DeltaDBH_cm, DeltaDBH_per_year: These are the target variables
        - Carbon, CO2e: Derived from DBH_cm
        - TreeID, Year: Identifiers, not features
    
    Parameters:
        df: DataFrame with all columns
    
    Returns:
        X: Feature matrix (DataFrame)
        y: Target vector (Series) - DeltaDBH_per_year
        feature_names: List of feature names
    """
    print("\nSelecting features...")
    
    # Target variable: annual increment
    y = df['DeltaDBH_per_year'].copy()
    
    # Start with PrevDBH_cm (required feature)
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
    
    # Add Group columns (softwood/hardwood)
    group_cols = [col for col in df.columns if col.startswith('Group_')]
    feature_cols.extend(group_cols)
    if group_cols:
        print(f"  Added {len(group_cols)} group features")
    
    # Add GrowthType columns if available
    growthtype_cols = [col for col in df.columns if col.startswith('GrowthType_')]
    feature_cols.extend(growthtype_cols)
    if growthtype_cols:
        print(f"  Added {len(growthtype_cols)} growth type features")
    
    # Extract feature matrix
    X = df[feature_cols].copy()
    
    print(f"\nTotal features: {len(feature_cols)}")
    print(f"Feature names: {feature_cols[:5]}..." if len(feature_cols) > 5 else f"Feature names: {feature_cols}")
    
    return X, y, feature_cols


def train_model(X, y, test_size=0.2, random_state=42, cv_folds=5, use_rfecv=True):
    """
    Train an XGBoost model to predict annual DBH increment.
    
    Parameters:
        X: Feature matrix (DataFrame)
        y: Target vector (Series) - DeltaDBH_per_year
        test_size: Proportion of data to use for testing (default: 0.2)
        random_state: Random seed for reproducibility (default: 42)
        cv_folds: Number of CV folds (default: 5)
        use_rfecv: Whether to use RFECV for feature selection (default: True)
    
    Returns:
        model: Trained XGBoost model
        X_train, X_test, y_train, y_test: Train/test splits
        selected_features: List of selected feature names
        rfecv: RFECV object (or None if use_rfecv=False)
        cv_results: DataFrame with CV results
    """
    print("\n" + "="*60)
    print("TRAINING XGBOOST DBH INCREMENT MODEL")
    print("="*60)
    
    # Filter rows where both PrevDBH_cm and DeltaDBH_per_year are not null
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].copy()
    y_clean = y[valid_mask].copy()
    
    print(f"Rows with valid PrevDBH_cm and DeltaDBH_per_year: {len(X_clean):,}")
    print(f"Rows dropped (missing PrevDBH_cm or DeltaDBH_per_year): {(~valid_mask).sum():,}")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y_clean,
        test_size=test_size,
        random_state=random_state
    )
    
    print(f"\nTrain set: {len(X_train):,} samples")
    print(f"Test set: {len(X_test):,} samples")
    
    selected_features = X_train.columns.tolist()
    rfecv = None
    
    if use_rfecv:
        # Base XGBoost estimator for RFECV
        print(f"\nPerforming RFECV with {cv_folds}-fold cross-validation...")
        base_estimator = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_state,
            n_jobs=-1
        )
        
        # RFECV with 5-fold CV
        kfold = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
        scorer = make_scorer(r2_score)
        
        rfecv = RFECV(
            estimator=base_estimator,
            step=1,
            cv=kfold,
            scoring=scorer,
            n_jobs=-1,
            verbose=1
        )
        
        print("Fitting RFECV...")
        rfecv.fit(X_train, y_train)
        
        # Get selected features
        selected_mask = rfecv.support_
        selected_features = X_train.columns[selected_mask].tolist()
        
        print(f"\n✓ RFECV completed")
        print(f"  Original features: {len(X_train.columns)}")
        print(f"  Selected features: {len(selected_features)}")
        print(f"  Optimal number of features: {rfecv.n_features_}")
    else:
        print("\nSkipping RFECV (use_rfecv=False)")
    
    # Train final model on selected features
    print("\nTraining final XGBoost model on selected features...")
    X_train_selected = X_train[selected_features]
    X_test_selected = X_test[selected_features]
    
    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=random_state,
        n_jobs=-1
    )
    
    model.fit(X_train_selected, y_train)
    
    print("✓ Model trained successfully")
    
    # Perform 5-fold CV on final model
    print(f"\nPerforming {cv_folds}-fold cross-validation on final model...")
    kfold = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
    
    cv_results_dict = cross_validate(
        model, X_train_selected, y_train,
        cv=kfold,
        scoring={
            'r2': make_scorer(r2_score),
            'neg_mean_squared_error': 'neg_mean_squared_error',
            'neg_mean_absolute_error': 'neg_mean_absolute_error'
        },
        n_jobs=-1,
        return_train_score=False
    )
    
    # Extract scores
    cv_r2_scores = cv_results_dict['test_r2']
    cv_mse_scores = -cv_results_dict['test_neg_mean_squared_error']
    cv_rmse_scores = np.sqrt(cv_mse_scores)
    cv_mae_scores = -cv_results_dict['test_neg_mean_absolute_error']
    
    cv_results = pd.DataFrame({
        'fold': range(1, cv_folds + 1),
        'r2_score': cv_r2_scores,
        'mse': cv_mse_scores,
        'rmse': cv_rmse_scores,
        'mae': cv_mae_scores
    })
    
    print(f"CV R² scores: {cv_r2_scores}")
    print(f"Mean CV R²: {cv_r2_scores.mean():.4f} (+/- {cv_r2_scores.std() * 2:.4f})")
    print(f"CV RMSE scores: {cv_rmse_scores}")
    print(f"Mean CV RMSE: {cv_rmse_scores.mean():.4f} cm/year (+/- {cv_rmse_scores.std() * 2:.4f} cm/year)")
    print(f"CV MAE scores: {cv_mae_scores}")
    print(f"Mean CV MAE: {cv_mae_scores.mean():.4f} cm/year (+/- {cv_mae_scores.std() * 2:.4f} cm/year)")
    
    return model, X_train_selected, X_test_selected, y_train, y_test, selected_features, rfecv, cv_results


def evaluate_model(model, X_test, y_test, X_train=None, y_train=None):
    """
    Evaluate the trained increment model and print metrics.
    
    Parameters:
        model: Trained model
        X_test: Test feature matrix
        y_test: Test target vector (DeltaDBH_per_year)
        X_train: Optional training feature matrix for train metrics
        y_train: Optional training target vector for train metrics
    """
    print("\n" + "="*60)
    print("MODEL EVALUATION")
    print("="*60)
    
    # Test set predictions
    y_pred_test = model.predict(X_test)
    r2_test = r2_score(y_test, y_pred_test)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_pred_test))
    mae_test = mean_absolute_error(y_test, y_pred_test)
    
    print(f"\nTest Set Metrics:")
    print(f"  R² Score:  {r2_test:.4f}")
    print(f"  RMSE:     {rmse_test:.4f} cm/year")
    print(f"  MAE:      {mae_test:.4f} cm/year")
    
    # Histogram summary of predicted deltas
    print(f"\nPredicted Delta Distribution (Test Set):")
    print(f"  Min:    {np.min(y_pred_test):.4f} cm/year")
    print(f"  25%:    {np.percentile(y_pred_test, 25):.4f} cm/year")
    print(f"  Median: {np.median(y_pred_test):.4f} cm/year")
    print(f"  75%:    {np.percentile(y_pred_test, 75):.4f} cm/year")
    print(f"  Max:    {np.max(y_pred_test):.4f} cm/year")
    
    # Training set metrics (if provided)
    if X_train is not None and y_train is not None:
        y_pred_train = model.predict(X_train)
        r2_train = r2_score(y_train, y_pred_train)
        rmse_train = np.sqrt(mean_squared_error(y_train, y_pred_train))
        mae_train = mean_absolute_error(y_train, y_pred_train)
        
        print(f"\nTrain Set Metrics:")
        print(f"  R² Score:  {r2_train:.4f}")
        print(f"  RMSE:     {rmse_train:.4f} cm/year")
        print(f"  MAE:      {mae_train:.4f} cm/year")
        
        # Check for overfitting
        if r2_train - r2_test > 0.1:
            print(f"\n⚠ Warning: Possible overfitting (train R² - test R² = {r2_train - r2_test:.4f})")
    
    # Feature importance (XGBoost)
    print(f"\nTop 10 Most Important Features:")
    feature_importance = pd.DataFrame({
        'feature': X_test.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for idx, row in feature_importance.head(10).iterrows():
        print(f"  {row['feature']:30s} {row['importance']:.4f}")
    
    return {
        'r2_test': r2_test,
        'rmse_test': rmse_test,
        'mae_test': mae_test,
        'r2_train': r2_train if X_train is not None else None,
        'rmse_train': rmse_train if X_train is not None else None,
        'mae_train': mae_train if X_train is not None else None,
        'feature_importance': feature_importance
    }


def save_model(model, selected_features, cv_results=None):
    """
    Save the trained increment model, selected features, and CV results.
    
    Parameters:
        model: Trained XGBoost model
        selected_features: List of selected feature names
        cv_results: DataFrame with CV results (optional)
    """
    print("\n" + "="*60)
    print("SAVING MODEL")
    print("="*60)
    
    # Save model
    joblib.dump(model, str(MODEL_PATH))
    print(f"✓ Saved model to {MODEL_PATH}")
    
    # Save selected feature names
    with open(str(SELECTED_FEATURES_PATH), 'w') as f:
        for feature in selected_features:
            f.write(f"{feature}\n")
    print(f"✓ Saved selected features to {SELECTED_FEATURES_PATH}")
    
    # Save CV results
    if cv_results is not None:
        cv_results.to_csv(str(CV_RESULTS_PATH), index=False)
        print(f"✓ Saved CV results to {CV_RESULTS_PATH}")
    
    print("\nModel and metadata saved successfully!")


def load_dbh_increment_model():
    """
    Load and return the trained DBH increment model and selected feature names.
    
    Returns:
        model: Trained XGBoost model
        selected_features: List of selected feature names in the order used for training
    """
    global _loaded_model, _loaded_feature_names
    
    # Return cached model if already loaded
    if _loaded_model is not None and _loaded_feature_names is not None:
        return _loaded_model, _loaded_feature_names
    
    # Load model
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}\n"
            "Please train the model first by running this script."
        )
    
    _loaded_model = joblib.load(str(MODEL_PATH))
    
    # Load selected feature names
    if SELECTED_FEATURES_PATH.exists():
        with open(str(SELECTED_FEATURES_PATH), 'r') as f:
            _loaded_feature_names = [line.strip() for line in f.readlines()]
    else:
        raise FileNotFoundError(
            f"Feature names file not found: {SELECTED_FEATURES_PATH}\n"
            "Please train the model first by running this script."
        )
    
    print(f"✓ Loaded model from {MODEL_PATH}")
    print(f"✓ Loaded {len(_loaded_feature_names)} feature names")
    
    return _loaded_model, _loaded_feature_names


def predict_delta_dbh_per_year(prev_dbh_cm, species=None, plot=None, gap_years=1.0, **kwargs) -> float:
    """
    Predict annual DBH increment (cm/year) using the increment model.
    
    Parameters:
        prev_dbh_cm: Current DBH in cm
        species: Species name (optional, for encoding)
        plot: Plot name (optional, for encoding)
        gap_years: Years between measurements (default: 1.0)
        **kwargs: Additional keyword arguments (ignored for now)
    
    Returns:
        float: Predicted annual DBH increment (cm/year)
    """
    model, feature_names = load_dbh_increment_model()
    
    # Build feature vector using encoding module
    encoded_features = encode_user_input(
        prev_dbh_cm=prev_dbh_cm,
        species=species,
        plot=plot,
        gap_years=gap_years
    )
    
    # Load the full feature list from the encoding module to map correctly
    from api.encoding import load_feature_names
    encoding_feature_names = load_feature_names()
    
    # Create a dictionary mapping feature names to values
    feature_dict = dict(zip(encoding_feature_names, encoded_features))
    
    # Build feature vector matching model's expected features
    feature_vector = []
    for feat_name in feature_names:
        if feat_name in feature_dict:
            feature_vector.append(feature_dict[feat_name])
        else:
            feature_vector.append(0.0)
    
    # Create DataFrame with correct columns
    feature_df = pd.DataFrame([feature_vector], columns=feature_names)
    
    # Predict increment
    delta_pred = model.predict(feature_df)[0]
    
    return float(delta_pred)


def predict_dbh_next_year_from_increment(
    prev_dbh_cm, 
    species=None, 
    plot=None, 
    gap_years=1.0, 
    clamp_negative=True, 
    max_shrink_cm=0.0,
    **kwargs
) -> float:
    """
    Predict next DBH using the increment model with optional clamping.
    
    Formula:
        delta = delta_pred * gap_years
        if clamp_negative:
            delta = max(delta, -max_shrink_cm)
        next_dbh = prev_dbh_cm + delta
    
    Parameters:
        prev_dbh_cm: Current DBH in cm
        species: Species name (optional)
        plot: Plot name (optional)
        gap_years: Years between measurements (default: 1.0)
        clamp_negative: If True, prevent negative growth (default: True)
        max_shrink_cm: Maximum allowed shrinkage per year in cm (default: 0.0)
        **kwargs: Additional keyword arguments
    
    Returns:
        float: Predicted next DBH (cm)
    """
    # Predict annual increment
    delta_per_year = predict_delta_dbh_per_year(
        prev_dbh_cm=prev_dbh_cm,
        species=species,
        plot=plot,
        gap_years=gap_years,
        **kwargs
    )
    
    # Scale by gap_years
    delta = delta_per_year * gap_years
    
    # Apply clamping
    if clamp_negative:
        delta = max(delta, -max_shrink_cm)
    
    # Compute next DBH
    next_dbh = prev_dbh_cm + delta
    
    return float(next_dbh)


# ==============================================================================
# Main Training Script
# ==============================================================================

if __name__ == "__main__":
    print("="*60)
    print("DBH INCREMENT MODEL TRAINING")
    print("="*60)
    
    # 1. Load and prepare data
    df = load_and_prepare_data()
    
    # 2. Select features
    X, y, feature_names = select_features(df)
    
    # 3. Train model (with RFECV by default, but can disable for speed)
    model, X_train, X_test, y_train, y_test, selected_features, rfecv, cv_results = train_model(
        X, y, 
        use_rfecv=True  # Set to False for faster training
    )
    
    # 4. Evaluate model
    eval_results = evaluate_model(model, X_test, y_test, X_train, y_train)
    
    # 5. Save model
    save_model(model, selected_features, cv_results)
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("  - Use predict_delta_dbh_per_year() to predict increments")
    print("  - Use predict_dbh_next_year_from_increment() for simulation")
    print("  - Compare with state-based models (XGBoost, NN)")

