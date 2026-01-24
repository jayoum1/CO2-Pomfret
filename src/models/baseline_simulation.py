"""
Baseline Growth Simulation Module

Provides simulation functions using baseline growth curves with optional stochastic noise.
Supports modes: "baseline" (deterministic) and "baseline_stochastic" (with noise).
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.baseline_growth_curve import (
    load_baseline_curves,
    predict_baseline_delta,
    load_residual_sigma,
    get_residual_sigma
)


# Global cache
_cached_curves = None
_cached_sigma_df = None


def _get_curves():
    """Load and cache baseline curves."""
    global _cached_curves
    if _cached_curves is None:
        _cached_curves = load_baseline_curves()
    return _cached_curves


def _get_sigma_df():
    """Load and cache residual sigma."""
    global _cached_sigma_df
    if _cached_sigma_df is None:
        try:
            _cached_sigma_df = load_residual_sigma()
        except FileNotFoundError:
            # If sigma not available, return None (stochastic mode will use default)
            _cached_sigma_df = None
    return _cached_sigma_df


def predict_delta_sim(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    gap_years: float = 1.0,
    mode: str = "baseline",
    rng: Optional[np.random.Generator] = None
) -> Dict:
    """
    Predict delta (growth increment) for simulation with mode support.
    
    Modes:
    - "baseline": Deterministic baseline-only (delta_base)
    - "baseline_stochastic": Baseline + stochastic noise calibrated from residuals
    
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
    mode : str
        Simulation mode: "baseline" or "baseline_stochastic" (default: "baseline")
    rng : np.random.Generator, optional
        Random number generator for stochastic mode (if None, creates new one)
    
    Returns
    -------
    dict
        Dictionary with keys:
        - delta_base: Baseline delta prediction (cm/year)
        - noise: Stochastic noise added (0 if not stochastic mode)
        - delta_total_raw: delta_base + noise (before clamping)
        - delta_used: Final delta used (after clamp at 0)
        - was_clamped: bool indicating if delta was clamped
    """
    curves = _get_curves()
    
    # Predict baseline delta
    delta_base = predict_baseline_delta(prev_dbh_cm, species, plot, curves)
    
    # Initialize noise
    noise = 0.0
    
    if mode == "baseline_stochastic":
        # Get residual sigma for this group
        sigma_df = _get_sigma_df()
        if sigma_df is not None:
            sigma = get_residual_sigma(species, plot, sigma_df)
        else:
            # Default sigma if not available
            sigma = 3.0
        
        # Create RNG if not provided
        if rng is None:
            rng = np.random.default_rng()
        
        # Draw noise from Normal(0, sigma)
        noise = rng.normal(0.0, sigma)
        
        # Clip noise to prevent extreme excursions (±2.5*sigma)
        noise = np.clip(noise, -2.5 * sigma, 2.5 * sigma)
    
    # Compute total delta
    delta_total_raw = delta_base + noise
    
    # Clamp to nonnegative
    delta_used = max(0.0, delta_total_raw)
    was_clamped = delta_total_raw < 0.0
    
    return {
        'delta_base': delta_base,
        'noise': noise,
        'delta_total_raw': delta_total_raw,
        'delta_used': delta_used,
        'was_clamped': was_clamped
    }


def predict_dbh_next_year_sim(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    gap_years: float = 1.0,
    mode: str = "baseline",
    rng: Optional[np.random.Generator] = None
) -> float:
    """
    Predict next year's DBH using baseline simulation modes.
    
    Convenience wrapper around predict_delta_sim that returns DBH directly.
    
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
    mode : str
        Simulation mode: "baseline" or "baseline_stochastic" (default: "baseline")
    rng : np.random.Generator, optional
        Random number generator for stochastic mode
    
    Returns
    -------
    float
        Predicted DBH for next year (cm)
    """
    result = predict_delta_sim(prev_dbh_cm, species, plot, gap_years, mode, rng)
    return prev_dbh_cm + result['delta_used']
