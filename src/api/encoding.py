"""
Encoding Module for User-Designed Trees

Provides functions to encode user input (species, plot, DBH) into feature vectors
that match the model's training features.

This module bridges the gap between user-friendly inputs and the model's internal
feature representation.
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import MODELS_DIR
from models.dbh_growth_model import load_dbh_growth_model, predict_dbh_next_year
from models.forest_metrics import (
    carbon_now, carbon_future, carbon_growth, carbon_growth_rate
)
from forestry.species_classifier import classify_group


# Path to selected features file
SELECTED_FEATURES_PATH = MODELS_DIR / "dbh_growth_model_selected_features.txt"
FEATURE_NAMES_PATH = MODELS_DIR / "dbh_growth_model_features.txt"


def load_feature_names():
    """
    Load the list of feature names used during model training.
    
    Returns
    -------
    list
        List of feature names in the order used for training
    """
    # Prefer selected features (from RFECV), fall back to all features
    if SELECTED_FEATURES_PATH.exists():
        with open(str(SELECTED_FEATURES_PATH), 'r') as f:
            feature_names = [line.strip() for line in f.readlines()]
    elif FEATURE_NAMES_PATH.exists():
        with open(str(FEATURE_NAMES_PATH), 'r') as f:
            feature_names = [line.strip() for line in f.readlines()]
    else:
        raise FileNotFoundError(
            f"Feature names file not found: {SELECTED_FEATURES_PATH} or {FEATURE_NAMES_PATH}\n"
            "Please train the model first."
        )
    
    return feature_names


def encode_user_input(
    prev_dbh_cm: float,
    species: str | None,
    plot: str,
    group_softw: bool | str | None = None,
    gap_years: float = 1.0
) -> np.ndarray:
    """
    Build a 1-row feature vector matching the model's training features.
    
    This function converts user-friendly inputs (species name, plot name, DBH)
    into the exact feature vector format expected by the trained model.
    
    Two main use cases are supported:
    
    1. **Specific Species Case:**
       - Provide a species name (e.g., 'sugar maple', 'red oak', 'white pine')
       - Species will be one-hot encoded into the corresponding Species_* dummy column
       - Group_softwood will be automatically inferred from the species
       - If group_softw is also provided, it will be ignored (species takes priority)
    
    2. **Generic Softwood/Hardwood Case:**
       - Provide species=None or empty string, but provide group_softw
       - No Species_* dummy features will be set (all remain 0)
       - Group_softwood will be set based on the group_softw parameter
       - Useful for generic "softwood" or "hardwood" predictions without a specific species
    
    **Priority Rule:** When both species and group_softw are provided, species takes
    priority and group_softw is derived from the species (ignoring the provided value).
    
    Parameters
    ----------
    prev_dbh_cm : float
        The user's current DBH (this will be mapped to PrevDBH_cm feature)
    species : str | None
        Species name as a string (e.g., 'sugar maple', 'red oak', 'white pine').
        If None or empty string, no Species_* features will be set (generic case).
    plot : str
        Plot name as a string (e.g., 'Upper', 'Middle', 'Lower')
        Case-insensitive; will be normalized to match feature names
    group_softw : bool | str | None, optional
        For generic case (when species is None/empty): whether the tree is softwood.
        Can be:
        - bool: True for softwood, False for hardwood
        - str: "softwood" or "hardwood" (case-insensitive)
        - None: Only valid if species is provided (will be inferred from species)
    gap_years : float, optional
        Years between measurements (default: 1.0 for annual prediction)
    
    Returns
    -------
    np.ndarray
        1D array with feature values in the exact order expected by the model
    
    Raises
    ------
    ValueError
        If both species and group_softw are None/empty (at least one must be provided)
    
    Examples
    --------
    Specific species case:
    >>> features = encode_user_input(
    ...     prev_dbh_cm=25.0,
    ...     species='sugar maple',
    ...     plot='Upper'
    ... )
    >>> print(f"Feature vector shape: {features.shape}")
    
    Generic softwood case:
    >>> features = encode_user_input(
    ...     prev_dbh_cm=25.0,
    ...     species=None,
    ...     plot='Upper',
    ...     group_softw='softwood'
    ... )
    """
    # Load feature names
    feature_names = load_feature_names()
    
    # Validate input: at least one of species or group_softw must be provided
    species_provided = species is not None and species.strip() != ""
    group_provided = group_softw is not None
    
    if not species_provided and not group_provided:
        raise ValueError(
            "At least one of 'species' or 'group_softw' must be provided. "
            "Either provide a specific species name, or provide group_softw for a generic "
            "softwood/hardwood case."
        )
    
    # Initialize feature vector with zeros
    feature_dict = {}
    
    # Set PrevDBH_cm (required feature)
    feature_dict['PrevDBH_cm'] = prev_dbh_cm
    
    # Initialize all features to 0.0
    for feat_name in feature_names:
        if feat_name not in feature_dict:
            feature_dict[feat_name] = 0.0
    
    # Handle species and group logic with priority rules
    if species_provided:
        # CASE 1: Specific species case - species has priority
        species_normalized = species.strip().lower()
        species_col = f'Species_{species_normalized}'
        if species_col in feature_names:
            feature_dict[species_col] = 1.0
        else:
            # Species not found - will use default (all species features remain 0)
            print(f"Warning: Species '{species}' not found in training data. Using default.")
        
        # Infer Group_softwood from species (ignore group_softw if provided)
        group = classify_group(species)
        group_softw_value = (group == 'softwood')
        
        if group_softw is not None:
            # Warn that group_softw was ignored in favor of species-derived group
            print(f"Note: group_softw parameter was ignored. Group derived from species '{species}': {group}")
    
    else:
        # CASE 2: Generic softwood/hardwood case (no species)
        # No Species_* features will be set (they remain 0)
        
        # Normalize group_softw to boolean
        if isinstance(group_softw, str):
            group_str = group_softw.strip().lower()
            if group_str == 'softwood':
                group_softw_value = True
            elif group_str == 'hardwood':
                group_softw_value = False
            else:
                raise ValueError(
                    f"Invalid group_softw string value: '{group_softw}'. "
                    "Must be 'softwood' or 'hardwood' (case-insensitive)."
                )
        elif isinstance(group_softw, bool):
            group_softw_value = group_softw
        else:
            # This shouldn't happen due to validation above, but just in case
            raise ValueError(f"Invalid group_softw type: {type(group_softw)}. Must be bool or str.")
    
    # Set Group_softwood feature if it exists in feature names
    if 'Group_softwood' in feature_names:
        feature_dict['Group_softwood'] = 1.0 if group_softw_value else 0.0
    
    # Set plot feature (one-hot encoding)
    # Note: "Lower" is the reference category (dropped during one-hot encoding)
    # So if plot is "Lower" or None, all Plot_* columns remain 0
    if plot is not None:
        plot_normalized = plot.strip().capitalize()  # Normalize: "middle" -> "Middle"
        if plot_normalized.lower() != 'lower':
            plot_col = f'Plot_{plot_normalized}'
            if plot_col in feature_names:
                feature_dict[plot_col] = 1.0
            else:
                print(f"Warning: Plot '{plot}' (normalized to '{plot_normalized}') not found. Using Lower (reference).")
    
    # Set GapYears if it exists in feature names
    if 'GapYears' in feature_names:
        feature_dict['GapYears'] = gap_years
    
    # Convert to numpy array in the correct order
    feature_array = np.array([feature_dict[name] for name in feature_names], dtype=np.float32)
    
    return feature_array


def predict_all_from_user_input(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    **kwargs
) -> dict:
    """
    Convenience wrapper that encodes user input and predicts all metrics.
    
    This function:
    1. Encodes user input into a feature vector
    2. Uses the DBH growth model to predict next year's DBH
    3. Uses forest_metrics to compute carbon_now, carbon_future, carbon_growth, and carbon_growth_rate
    
    This is the main function that should be called from the app backend.
    
    Parameters
    ----------
    prev_dbh_cm : float
        Current DBH in centimeters
    species : str
        Species name (e.g., 'red oak', 'sugar maple')
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional parameters (e.g., gap_years, group_softw)
    
    Returns
    -------
    dict
        Dictionary containing all predicted metrics:
        {
            "dbh_now_cm": float,
            "dbh_next_year_cm": float,
            "carbon_now_kg": float,
            "carbon_future_kg": float,
            "carbon_growth_kg": float,
            "carbon_growth_rate": float,
            "dbh_growth_cm": float,
            "dbh_growth_rate": float
        }
    
    Examples
    --------
    >>> results = predict_all_from_user_input(
    ...     prev_dbh_cm=25.0,
    ...     species='red oak',
    ...     plot='Upper'
    ... )
    >>> print(f"Next year DBH: {results['dbh_next_year_cm']:.2f} cm")
    >>> print(f"Carbon growth: {results['carbon_growth_kg']:.2f} kg C/year")
    """
    # Predict next year's DBH using the growth model
    dbh_next_year = predict_dbh_next_year(
        prev_dbh_cm=prev_dbh_cm,
        species=species,
        plot=plot,
        **kwargs
    )
    
    # Calculate DBH growth
    dbh_growth_cm = dbh_next_year - prev_dbh_cm
    dbh_growth_rate = dbh_growth_cm / prev_dbh_cm if prev_dbh_cm > 0 else 0.0
    
    # Calculate carbon metrics
    carbon_current = carbon_now(prev_dbh_cm, species)
    carbon_next = carbon_future(prev_dbh_cm, species, plot, **kwargs)
    carbon_growth_kg = carbon_growth(prev_dbh_cm, species, plot, **kwargs)
    carbon_growth_rate_val = carbon_growth_rate(prev_dbh_cm, species, plot, **kwargs)
    
    return {
        "dbh_now_cm": prev_dbh_cm,
        "dbh_next_year_cm": dbh_next_year,
        "dbh_growth_cm": dbh_growth_cm,
        "dbh_growth_rate": dbh_growth_rate,
        "carbon_now_kg": carbon_current,
        "carbon_future_kg": carbon_next,
        "carbon_growth_kg": carbon_growth_kg,
        "carbon_growth_rate": carbon_growth_rate_val
    }

