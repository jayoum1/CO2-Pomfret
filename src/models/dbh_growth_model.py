"""
DBH Growth Model

Trains a regression model to predict tree diameter growth from one year to the next.

Model Input:
    - PrevDBH_cm: Previous year's DBH (in cm)
    - Species: One-hot encoded species features
    - Plot: One-hot encoded plot features
    - Other relevant features (GapYears, Group, GrowthType)

Model Output:
    - DBH_cm: Current year's DBH (in cm)

Usage in App:
    - User provides current DBH as prev_dbh_cm
    - Model predicts next year's DBH
"""

import pandas as pd
import numpy as np
import sys
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, MODELS_DIR

# Ensure models directory exists
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Model file path
MODEL_PATH = MODELS_DIR / "dbh_growth_model.pkl"
FEATURE_NAMES_PATH = MODELS_DIR / "dbh_growth_model_features.txt"

# Global variables for caching loaded model
_loaded_model = None
_loaded_feature_names = None


def load_and_prepare_data():
    """
    Load the processed dataset and prepare it for training.
    
    Returns:
        df: DataFrame with PrevDBH_cm created and ready for modeling
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
    
    return df


def select_features(df):
    """
    Select features for the model.
    
    Features included:
        - PrevDBH_cm: Previous year's DBH (required)
        - Species_*: One-hot encoded species columns
        - Plot_*: One-hot encoded plot columns
        - GapYears: Years between measurements (if available)
        - Group_*: Tree group (softwood/hardwood)
        - GrowthType_*: Growth type indicators
    
    Excluded (to avoid target leakage):
        - DBH_cm: This is the target variable
        - Carbon, CO2e: Derived from DBH_cm
        - CarbonGrowth, CarbonGrowthRate: Derived from future values
        - PrevCarbon: Derived from PrevDBH
        - TreeID, Year: Identifiers, not features
    
    Parameters:
        df: DataFrame with all columns
    
    Returns:
        X: Feature matrix (DataFrame)
        y: Target vector (Series)
        feature_names: List of feature names
    """
    print("\nSelecting features...")
    
    # Target variable
    y = df['DBH_cm'].copy()
    
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
    
    # Add GapYears if available (years between measurements)
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


def train_model(X, y, test_size=0.2, random_state=42):
    """
    Train a RandomForestRegressor model for DBH growth prediction.
    
    Parameters:
        X: Feature matrix (DataFrame)
        y: Target vector (Series)
        test_size: Proportion of data to use for testing (default: 0.2)
        random_state: Random seed for reproducibility (default: 42)
    
    Returns:
        model: Trained RandomForestRegressor
        X_train, X_test, y_train, y_test: Train/test splits
    """
    print("\n" + "="*60)
    print("TRAINING DBH GROWTH MODEL")
    print("="*60)
    
    # Filter rows where both PrevDBH_cm and DBH_cm are not null
    valid_mask = X['PrevDBH_cm'].notna() & y.notna()
    X_clean = X[valid_mask].copy()
    y_clean = y[valid_mask].copy()
    
    print(f"Rows with valid PrevDBH_cm and DBH_cm: {len(X_clean):,}")
    print(f"Rows dropped (missing PrevDBH_cm or DBH_cm): {(~valid_mask).sum():,}")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y_clean,
        test_size=test_size,
        random_state=random_state
    )
    
    print(f"\nTrain set: {len(X_train):,} samples")
    print(f"Test set: {len(X_test):,} samples")
    
    # Train RandomForestRegressor
    print("\nTraining RandomForestRegressor...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=random_state,
        n_jobs=-1  # Use all available cores
    )
    
    model.fit(X_train, y_train)
    
    print("✓ Model trained successfully")
    
    return model, X_train, X_test, y_train, y_test


def evaluate_model(model, X_test, y_test, X_train=None, y_train=None):
    """
    Evaluate the trained model and print metrics.
    
    Parameters:
        model: Trained model
        X_test: Test feature matrix
        y_test: Test target vector
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
    
    print(f"\nTest Set Metrics:")
    print(f"  R² Score:  {r2_test:.4f}")
    print(f"  RMSE:     {rmse_test:.4f} cm")
    print(f"  MAE:      {np.mean(np.abs(y_test - y_pred_test)):.4f} cm")
    
    # Training set metrics (if provided)
    if X_train is not None and y_train is not None:
        y_pred_train = model.predict(X_train)
        r2_train = r2_score(y_train, y_pred_train)
        rmse_train = np.sqrt(mean_squared_error(y_train, y_pred_train))
        
        print(f"\nTrain Set Metrics:")
        print(f"  R² Score:  {r2_train:.4f}")
        print(f"  RMSE:     {rmse_train:.4f} cm")
        print(f"  MAE:      {np.mean(np.abs(y_train - y_pred_train)):.4f} cm")
        
        # Check for overfitting
        if r2_train - r2_test > 0.1:
            print(f"\n⚠ Warning: Possible overfitting (train R² - test R² = {r2_train - r2_test:.4f})")
    
    # Feature importance
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
        'r2_train': r2_train if X_train is not None else None,
        'rmse_train': rmse_train if X_train is not None else None
    }


def evaluate_by_plot(model, X_test, y_test, df_test):
    """
    Evaluate model performance grouped by plot.
    
    Parameters:
        model: Trained model
        X_test: Test feature matrix
        y_test: Test target vector
        df_test: Original DataFrame for test set (to get Plot column)
    
    Returns:
        plot_metrics: DataFrame with metrics per plot
    """
    print("\n" + "="*60)
    print("EVALUATION BY PLOT")
    print("="*60)
    
    # Reconstruct plot names from one-hot encoded columns
    plot_cols = [col for col in X_test.columns if col.startswith('Plot_')]
    
    if not plot_cols:
        print("No plot columns found. Skipping plot-level evaluation.")
        return None
    
    # Get plot name for each row
    plot_series = X_test[plot_cols].idxmax(axis=1).str.replace('Plot_', '')
    # If all plot columns are False, it's the reference category (Lower)
    plot_series = plot_series.replace('', 'Lower')
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Calculate metrics per plot
    plot_metrics = []
    for plot_name in plot_series.unique():
        mask = plot_series == plot_name
        y_true_plot = y_test[mask]
        y_pred_plot = y_pred[mask]
        
        if len(y_true_plot) > 0:
            r2 = r2_score(y_true_plot, y_pred_plot)
            rmse = np.sqrt(mean_squared_error(y_true_plot, y_pred_plot))
            mae = np.mean(np.abs(y_true_plot - y_pred_plot))
            
            plot_metrics.append({
                'Plot': plot_name,
                'n_samples': len(y_true_plot),
                'R²': r2,
                'RMSE': rmse,
                'MAE': mae
            })
    
    plot_metrics_df = pd.DataFrame(plot_metrics)
    print("\nMetrics by Plot:")
    print(plot_metrics_df.to_string(index=False))
    
    return plot_metrics_df


def save_model(model, feature_names):
    """
    Save the trained model and feature names to disk.
    
    Parameters:
        model: Trained model
        feature_names: List of feature names in the order used for training
    """
    print("\n" + "="*60)
    print("SAVING MODEL")
    print("="*60)
    
    # Save model
    joblib.dump(model, str(MODEL_PATH))
    print(f"✓ Model saved to: {MODEL_PATH}")
    
    # Save feature names
    with open(str(FEATURE_NAMES_PATH), 'w') as f:
        for name in feature_names:
            f.write(f"{name}\n")
    print(f"✓ Feature names saved to: {FEATURE_NAMES_PATH}")
    
    print("\nModel and metadata saved successfully!")


def load_dbh_growth_model():
    """
    Load and return the trained DBH growth model and feature names.
    
    Returns:
        model: Trained RandomForestRegressor
        feature_names: List of feature names in the order used for training
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
    
    # Load feature names
    if not FEATURE_NAMES_PATH.exists():
        raise FileNotFoundError(
            f"Feature names file not found: {FEATURE_NAMES_PATH}\n"
            "Please train the model first by running this script."
        )
    
    with open(str(FEATURE_NAMES_PATH), 'r') as f:
        _loaded_feature_names = [line.strip() for line in f.readlines()]
    
    print(f"✓ Loaded model from {MODEL_PATH}")
    print(f"✓ Loaded {len(_loaded_feature_names)} feature names")
    
    return _loaded_model, _loaded_feature_names


def predict_dbh_next_year(prev_dbh_cm, species=None, plot=None, gap_years=1.0, **kwargs):
    """
    Predict next year's DBH for a single tree.
    
    IMPORTANT INTERPRETATION:
    - During training, `PrevDBH_cm` was last year's DBH and `DBH_cm` was this year's DBH.
    - In the app, we will pass the user's *current* DBH as `prev_dbh_cm`.
    - Therefore, the output of this function will be interpreted as NEXT YEAR'S DBH in the app.
    
    Parameters:
        prev_dbh_cm: float, current DBH (treated as PrevDBH_cm in the model).
        species: str, species identifier (e.g., "red oak", "sugar maple").
                  If None, will use the most common species in training data.
        plot: str, plot identifier ("Upper", "Middle", or "Lower").
               If None, will use "Lower" (reference category).
        gap_years: float, years between measurements (default: 1.0 for annual prediction).
        **kwargs: optional additional features if needed (e.g., group, growthtype).
    
    Returns:
        predicted_dbh_next_year_cm: float, predicted DBH for next year (in cm).
    """
    # Load model and feature names
    model, feature_names = load_dbh_growth_model()
    
    # Create a single-row feature vector
    feature_dict = {}
    
    # Required feature: PrevDBH_cm
    feature_dict['PrevDBH_cm'] = prev_dbh_cm
    
    # Initialize all features to 0 (or False for boolean)
    for feat_name in feature_names:
        if feat_name not in feature_dict:
            if feat_name.startswith('Species_') or feat_name.startswith('Plot_') or \
               feat_name.startswith('Group_') or feat_name.startswith('GrowthType_'):
                feature_dict[feat_name] = False
            else:
                feature_dict[feat_name] = 0.0
    
    # Set species feature
    if species is not None:
        species_col = f'Species_{species.lower()}'
        if species_col in feature_names:
            feature_dict[species_col] = True
        else:
            print(f"Warning: Species '{species}' not found in training data. Using default.")
    
    # Set plot feature
    # Note: "Lower" is the reference category (dropped during one-hot encoding)
    # So if plot is "Lower" or None, all Plot_* columns remain False
    if plot is not None and plot.lower() != 'lower':
        plot_col = f'Plot_{plot}'
        if plot_col in feature_names:
            feature_dict[plot_col] = True
        elif plot.lower() == 'lower':
            # Lower is the reference category - all Plot_* columns should be False
            pass
        else:
            print(f"Warning: Plot '{plot}' not found in training data. Using Lower (reference category).")
    
    # Set GapYears
    if 'GapYears' in feature_names:
        feature_dict['GapYears'] = gap_years
    
    # Set any additional kwargs
    for key, value in kwargs.items():
        if key in feature_names:
            feature_dict[key] = value
    
    # Build feature vector as a DataFrame with proper column names
    feature_df = pd.DataFrame([feature_dict], columns=feature_names)
    
    # Predict
    predicted_dbh = model.predict(feature_df)[0]
    
    return predicted_dbh


# ==============================================================================
# Main Training Script
# ==============================================================================

if __name__ == "__main__":
    print("="*60)
    print("DBH GROWTH MODEL TRAINING")
    print("="*60)
    
    # 1. Load and prepare data
    df = load_and_prepare_data()
    
    # 2. Select features
    X, y, feature_names = select_features(df)
    
    # 3. Train model
    model, X_train, X_test, y_train, y_test = train_model(X, y)
    
    # 4. Evaluate model
    metrics = evaluate_model(model, X_test, y_test, X_train, y_train)
    
    # 5. Evaluate by plot
    # Need to reconstruct test DataFrame for plot evaluation
    test_indices = X_test.index
    df_test = df.loc[test_indices].copy()
    evaluate_by_plot(model, X_test, y_test, df_test)
    
    # 6. Save model
    save_model(model, feature_names)
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE")
    print("="*60)
    print(f"\nModel saved to: {MODEL_PATH}")
    print(f"Feature names saved to: {FEATURE_NAMES_PATH}")
    print("\nTo use the model for prediction:")
    print("  from src.models.dbh_growth_model import predict_dbh_next_year")
    print("  next_dbh = predict_dbh_next_year(prev_dbh_cm=25.0, species='red oak', plot='Upper')")

