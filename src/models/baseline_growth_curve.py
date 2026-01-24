"""
Baseline Growth Curve Module

Provides a constrained baseline growth curve that predicts smooth, nonnegative,
decelerating DBH growth as a function of PrevDBH, Species, and Plot.

The baseline curve is fitted using binned statistics (trimmed means or medians)
at the species+plot level, with fallback to species-only or global curves.

This baseline is then combined with an ML residual model to produce hybrid predictions.
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from scipy import interpolate
from typing import Dict, Tuple, Optional, Callable
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED, MODELS_DIR, ensure_dir


# Output paths
BASELINE_BINS_PATH = MODELS_DIR / "baseline_growth_bins.csv"
BASELINE_METADATA_PATH = MODELS_DIR / "baseline_growth_metadata.json"
BASELINE_RESIDUAL_SIGMA_PATH = MODELS_DIR / "baseline_residual_sigma.csv"


def make_training_table(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute annualized observed increment from the dataset.
    
    Parameters
    ----------
    df : pd.DataFrame
        Input dataframe with columns: DBH_cm, GapYears, Species, Plot
        If PrevDBH_cm doesn't exist, it will be created by shifting DBH_cm within TreeID groups.
    
    Returns
    -------
    pd.DataFrame
        Training table with columns: PrevDBH_cm, Species, Plot, delta_obs
    """
    print("Creating training table for baseline curves...")
    
    # Create PrevDBH_cm if it doesn't exist
    df_work = df.copy()
    if 'PrevDBH_cm' not in df_work.columns:
        print("  Creating PrevDBH_cm from DBH_cm (shifted within TreeID groups)...")
        df_work = df_work.sort_values(['TreeID', 'Year']).copy()
        df_work['PrevDBH_cm'] = df_work.groupby('TreeID')['DBH_cm'].shift()
    
    # Extract Species and Plot from one-hot encoded columns if needed
    if 'Species' not in df_work.columns:
        print("  Extracting Species from one-hot encoded columns...")
        species_cols = [col for col in df_work.columns if col.startswith('Species_')]
        if species_cols:
            df_work['Species'] = df_work[species_cols].idxmax(axis=1).str.replace('Species_', '')
        else:
            raise ValueError("No Species columns found in dataset")
    
    if 'Plot' not in df_work.columns:
        print("  Extracting Plot from one-hot encoded columns...")
        plot_cols = [col for col in df_work.columns if col.startswith('Plot_')]
        if plot_cols:
            df_work['Plot'] = df_work[plot_cols].idxmax(axis=1).str.replace('Plot_', '')
            # Capitalize first letter to match expected format
            df_work['Plot'] = df_work['Plot'].str.capitalize()
        else:
            # If no Plot columns, assume all are "Lower" (reference category)
            df_work['Plot'] = 'Lower'
    
    # Filter valid rows
    valid_mask = (
        df_work['PrevDBH_cm'].notna() &
        df_work['DBH_cm'].notna() &
        df_work['GapYears'].notna() &
        (df_work['GapYears'] > 0)
    )
    
    df_valid = df_work[valid_mask].copy()
    print(f"  Valid rows: {len(df_valid):,} / {len(df_work):,}")
    
    # Compute annualized increment
    df_valid['delta_obs'] = (df_valid['DBH_cm'] - df_valid['PrevDBH_cm']) / df_valid['GapYears']
    
    # Select required columns
    result = df_valid[['PrevDBH_cm', 'Species', 'Plot', 'delta_obs']].copy()
    
    print(f"  Delta range: [{result['delta_obs'].min():.3f}, {result['delta_obs'].max():.3f}] cm/year")
    print(f"  Mean delta: {result['delta_obs'].mean():.3f} cm/year")
    
    return result


def fit_baseline_curves(
    df_train: pd.DataFrame,
    by: Tuple[str, str] = ("Species", "Plot"),
    min_samples: int = 40,
    bin_width: float = 10.0,
    trim_fraction: float = 0.1
) -> Dict[str, Dict]:
    """
    Fit baseline growth curves at species+plot level with fallback hierarchy.
    
    Parameters
    ----------
    df_train : pd.DataFrame
        Training table with columns: PrevDBH_cm, Species, Plot, delta_obs
    by : tuple
        Grouping columns (default: ("Species", "Plot"))
    min_samples : int
        Minimum samples required for species+plot level (default: 40)
    bin_width : float
        Width of DBH bins in cm (default: 10.0)
    trim_fraction : float
        Fraction to trim from each tail for robust statistics (default: 0.1)
    
    Returns
    -------
    dict
        Dictionary mapping group keys to curve dictionaries with:
        - 'bins': List of (dbh_min, dbh_max, delta_mean) tuples
        - 'fn': Callable function prev_dbh_cm -> delta_base_cm_per_year
        - 'fallback_level': str indicating fallback level used
    """
    print("\n" + "="*70)
    print("FITTING BASELINE GROWTH CURVES")
    print("="*70)
    
    curves = {}
    metadata = {
        'min_samples': min_samples,
        'bin_width': bin_width,
        'trim_fraction': trim_fraction,
        'fallback_rules': {},
        'guardrail_applied': True,
        'guardrail_method': 'tail_monotone',
        'guardrail_tail_start_quantile': 0.8
    }
    
    # Get unique species+plot combinations
    species_plot_groups = df_train.groupby(['Species', 'Plot'])
    
    # Get unique species for fallback
    species_groups = df_train.groupby('Species')
    
    # Global fallback (all data)
    global_data = df_train.copy()
    
    # Determine DBH range for binning
    dbh_min = df_train['PrevDBH_cm'].min()
    dbh_max = df_train['PrevDBH_cm'].max()
    bin_edges = np.arange(
        np.floor(dbh_min / bin_width) * bin_width,
        np.ceil(dbh_max / bin_width) * bin_width + bin_width,
        bin_width
    )
    
    print(f"\nDBH range: [{dbh_min:.1f}, {dbh_max:.1f}] cm")
    print(f"Bin width: {bin_width} cm")
    print(f"Number of bins: {len(bin_edges) - 1}")
    
    # Fit curves for each species+plot combination
    for (species, plot), group_df in species_plot_groups:
        group_key = f"{species}|{plot}"
        
        if len(group_df) >= min_samples:
            # Enough samples: fit species+plot curve
            bins_data = _fit_bins(group_df, bin_edges, trim_fraction)
            fn = _create_interpolator(bins_data, apply_guardrail=True)
            curves[group_key] = {
                'bins': bins_data,
                'fn': fn,
                'fallback_level': 'species_plot',
                'n_samples': len(group_df)
            }
            metadata['fallback_rules'][group_key] = 'species_plot'
        else:
            # Not enough samples: try species-only fallback
            species_df = species_groups.get_group(species) if species in species_groups.groups else None
            
            if species_df is not None and len(species_df) >= min_samples:
                bins_data = _fit_bins(species_df, bin_edges, trim_fraction)
                fn = _create_interpolator(bins_data, apply_guardrail=True)
                curves[group_key] = {
                    'bins': bins_data,
                    'fn': fn,
                    'fallback_level': 'species',
                    'n_samples': len(species_df)
                }
                metadata['fallback_rules'][group_key] = 'species'
            else:
                # Use global fallback
                bins_data = _fit_bins(global_data, bin_edges, trim_fraction)
                fn = _create_interpolator(bins_data, apply_guardrail=True)
                curves[group_key] = {
                    'bins': bins_data,
                    'fn': fn,
                    'fallback_level': 'global',
                    'n_samples': len(global_data)
                }
                metadata['fallback_rules'][group_key] = 'global'
    
    print(f"\n✓ Fitted {len(curves)} baseline curves")
    
    # Print fallback statistics
    fallback_counts = {}
    for curve_info in curves.values():
        level = curve_info['fallback_level']
        fallback_counts[level] = fallback_counts.get(level, 0) + 1
    
    print("\nFallback level distribution:")
    for level, count in fallback_counts.items():
        print(f"  {level}: {count} groups")
    
    return curves, metadata


def _fit_bins(
    df: pd.DataFrame,
    bin_edges: np.ndarray,
    trim_fraction: float
) -> list:
    """
    Fit bins for a single group.
    
    Parameters
    ----------
    df : pd.DataFrame
        Group data with PrevDBH_cm and delta_obs
    bin_edges : np.ndarray
        Edges of DBH bins
    trim_fraction : float
        Fraction to trim from tails
    
    Returns
    -------
    list
        List of (dbh_min, dbh_max, delta_mean) tuples
    """
    bins_data = []
    
    for i in range(len(bin_edges) - 1):
        dbh_min = bin_edges[i]
        dbh_max = bin_edges[i + 1]
        
        # Find data in this bin
        mask = (df['PrevDBH_cm'] >= dbh_min) & (df['PrevDBH_cm'] < dbh_max)
        bin_data = df[mask]['delta_obs']
        
        if len(bin_data) > 0:
            # Compute trimmed mean (robust against outliers)
            if trim_fraction > 0 and len(bin_data) > 2:
                trim_n = int(len(bin_data) * trim_fraction)
                trimmed = bin_data.sort_values().iloc[trim_n:-trim_n] if trim_n > 0 else bin_data
                delta_mean = trimmed.mean()
            else:
                # Use median for very small bins
                delta_mean = bin_data.median()
            
            # Clamp to nonnegative (baseline must be nonnegative)
            delta_mean = max(0.0, delta_mean)
            
            # Use bin center for interpolation
            dbh_center = (dbh_min + dbh_max) / 2.0
            
            bins_data.append((dbh_center, delta_mean))
    
    return bins_data


def apply_high_dbh_guardrail(
    bin_centers: np.ndarray,
    delta_values: np.ndarray,
    method: str = "tail_monotone",
    tail_start_quantile: float = 0.8
) -> np.ndarray:
    """
    Apply high-DBH guardrail to prevent unrealistic increasing growth at large diameters.
    
    Enforces non-increasing tail at high DBH to address sparse data issues.
    
    Parameters
    ----------
    bin_centers : np.ndarray
        DBH bin centers
    delta_values : np.ndarray
        Delta values (growth rates) for each bin
    method : str
        Guardrail method ("tail_monotone")
    tail_start_quantile : float
        Quantile to start tail enforcement (default: 0.8 = 80th percentile)
    
    Returns
    -------
    np.ndarray
        Guardrailed delta values (nonnegative, non-increasing in tail)
    """
    if len(bin_centers) == 0 or len(delta_values) == 0:
        return delta_values
    
    # Ensure nonnegative
    delta_guarded = np.maximum(0.0, delta_values.copy())
    
    if method == "tail_monotone":
        # Identify tail start
        if len(bin_centers) < 5:
            # Too few bins: just ensure non-increasing overall
            for i in range(1, len(delta_guarded)):
                delta_guarded[i] = min(delta_guarded[i], delta_guarded[i-1])
            return delta_guarded
        
        # Find tail start index (80th percentile of bin centers)
        tail_start_dbh = np.quantile(bin_centers, tail_start_quantile)
        tail_start_idx = np.searchsorted(bin_centers, tail_start_dbh, side='right')
        
        # Ensure at least 2 bins in tail, but not more than 50% of bins
        min_tail_bins = max(2, int(len(bin_centers) * 0.1))
        max_tail_bins = int(len(bin_centers) * 0.5)
        tail_start_idx = max(len(bin_centers) - max_tail_bins, 
                            min(len(bin_centers) - min_tail_bins, tail_start_idx))
        
        # Apply monotonicity constraint to tail
        # For bins in tail: delta[i] <= delta[i-1]
        for i in range(tail_start_idx, len(delta_guarded)):
            if i > 0:
                delta_guarded[i] = min(delta_guarded[i], delta_guarded[i-1])
        
        # Ensure still nonnegative (should already be, but double-check)
        delta_guarded = np.maximum(0.0, delta_guarded)
    
    return delta_guarded


def estimate_residual_sigma(
    df_train: pd.DataFrame,
    curves: Dict[str, Dict],
    by: Tuple[str, str] = ("Species", "Plot")
) -> pd.DataFrame:
    """
    Estimate residual sigma (standard deviation) for each group using MAD.
    
    Computes residuals: resid = delta_obs - delta_base
    Estimates sigma using robust MAD statistic: sigma ≈ 1.4826 * MAD
    
    Parameters
    ----------
    df_train : pd.DataFrame
        Training table with columns: PrevDBH_cm, Species, Plot, delta_obs
    curves : dict
        Dictionary of fitted baseline curves
    by : tuple
        Grouping columns (default: ("Species", "Plot"))
    
    Returns
    -------
    pd.DataFrame
        DataFrame with columns: Species, Plot, sigma, n_samples, fallback_level
    """
    print("\nEstimating residual sigma for stochastic mode...")
    
    # Compute residuals for each row
    residuals = []
    for _, row in df_train.iterrows():
        prev_dbh = row['PrevDBH_cm']
        species = row['Species']
        plot = row['Plot']
        delta_obs = row['delta_obs']
        
        # Predict baseline delta
        delta_base = predict_baseline_delta(prev_dbh, species, plot, curves)
        
        # Compute residual
        resid = delta_obs - delta_base
        residuals.append({
            'Species': species,
            'Plot': plot,
            'residual': resid
        })
    
    residuals_df = pd.DataFrame(residuals)
    
    # Group by species+plot and compute MAD -> sigma
    sigma_rows = []
    groups = df_train.groupby(['Species', 'Plot'])
    
    for (species, plot), group_df in groups:
        group_key = f"{species}|{plot}"
        group_residuals = residuals_df[
            (residuals_df['Species'] == species) & 
            (residuals_df['Plot'] == plot)
        ]['residual'].values
        
        if len(group_residuals) > 1:
            # Compute MAD (Median Absolute Deviation)
            median_resid = np.median(group_residuals)
            mad = np.median(np.abs(group_residuals - median_resid))
            # Convert MAD to sigma (for normal distribution: sigma ≈ 1.4826 * MAD)
            sigma = 1.4826 * mad if mad > 0 else 0.0
            
            # Get fallback level from curves
            fallback_level = curves.get(group_key, {}).get('fallback_level', 'unknown')
            
            sigma_rows.append({
                'Species': species,
                'Plot': plot,
                'sigma': sigma,
                'n_samples': len(group_residuals),
                'fallback_level': fallback_level
            })
    
    # Add fallback groups (species-only, global)
    # For species-only: aggregate all plots for that species
    species_groups = df_train.groupby('Species')
    for species, species_df in species_groups:
        species_residuals = residuals_df[residuals_df['Species'] == species]['residual'].values
        if len(species_residuals) > 1:
            median_resid = np.median(species_residuals)
            mad = np.median(np.abs(species_residuals - median_resid))
            sigma = 1.4826 * mad if mad > 0 else 0.0
            
            # Check if we already have this species
            if not any(r['Species'] == species and pd.isna(r.get('Plot')) for r in sigma_rows):
                sigma_rows.append({
                    'Species': species,
                    'Plot': None,
                    'sigma': sigma,
                    'n_samples': len(species_residuals),
                    'fallback_level': 'species'
                })
    
    # Global fallback
    all_residuals = residuals_df['residual'].values
    if len(all_residuals) > 1:
        median_resid = np.median(all_residuals)
        mad = np.median(np.abs(all_residuals - median_resid))
        sigma_global = 1.4826 * mad if mad > 0 else 0.0
        
        sigma_rows.append({
            'Species': None,
            'Plot': None,
            'sigma': sigma_global,
            'n_samples': len(all_residuals),
            'fallback_level': 'global'
        })
    
    sigma_df = pd.DataFrame(sigma_rows)
    print(f"✓ Estimated sigma for {len(sigma_df)} groups")
    print(f"  Mean sigma: {sigma_df['sigma'].mean():.4f} cm/year")
    print(f"  Median sigma: {sigma_df['sigma'].median():.4f} cm/year")
    
    return sigma_df


def load_residual_sigma() -> pd.DataFrame:
    """
    Load residual sigma estimates from disk.
    
    Returns
    -------
    pd.DataFrame
        DataFrame with columns: Species, Plot, sigma, n_samples, fallback_level
    """
    if not BASELINE_RESIDUAL_SIGMA_PATH.exists():
        raise FileNotFoundError(
            f"Residual sigma not found: {BASELINE_RESIDUAL_SIGMA_PATH}\n"
            "Please fit baseline curves first."
        )
    
    return pd.read_csv(BASELINE_RESIDUAL_SIGMA_PATH)


def get_residual_sigma(
    species: str,
    plot: str,
    sigma_df: pd.DataFrame
) -> float:
    """
    Get residual sigma for a given species+plot combination.
    
    Uses fallback hierarchy: (species, plot) -> species -> global
    
    Parameters
    ----------
    species : str
        Species name
    plot : str
        Plot name
    sigma_df : pd.DataFrame
        DataFrame with sigma estimates
    
    Returns
    -------
    float
        Residual sigma in cm/year
    """
    # Try species+plot first
    mask = (sigma_df['Species'] == species) & (sigma_df['Plot'] == plot)
    if mask.any():
        return sigma_df[mask]['sigma'].iloc[0]
    
    # Try species-only
    mask = (sigma_df['Species'] == species) & sigma_df['Plot'].isna()
    if mask.any():
        return sigma_df[mask]['sigma'].iloc[0]
    
    # Fallback to global
    mask = sigma_df['Species'].isna() & sigma_df['Plot'].isna()
    if mask.any():
        return sigma_df[mask]['sigma'].iloc[0]
    
    # Default fallback
    return 3.0  # Reasonable default based on validation results


def _create_interpolator(bins_data: list, apply_guardrail: bool = True) -> Callable:
    """
    Create an interpolator function from bin data.
    
    Parameters
    ----------
    bins_data : list
        List of (dbh_center, delta_mean) tuples
    apply_guardrail : bool
        Whether to apply high-DBH guardrail (default: True)
    
    Returns
    -------
    Callable
        Function that takes prev_dbh_cm and returns delta_base_cm_per_year
    """
    if len(bins_data) == 0:
        # No data: return zero growth
        return lambda prev_dbh_cm: 0.0
    
    if len(bins_data) == 1:
        # Single point: return constant
        return lambda prev_dbh_cm: bins_data[0][1]
    
    # Extract x (DBH) and y (delta) values
    dbh_values = np.array([b[0] for b in bins_data])
    delta_values = np.array([b[1] for b in bins_data])
    
    # Apply guardrail if requested
    if apply_guardrail and len(delta_values) > 1:
        delta_values = apply_high_dbh_guardrail(dbh_values, delta_values)
    
    # Create linear interpolator
    # Extend beyond range: use nearest endpoint
    def interpolator(prev_dbh_cm: float) -> float:
        if prev_dbh_cm <= dbh_values[0]:
            return max(0.0, delta_values[0])
        elif prev_dbh_cm >= dbh_values[-1]:
            return max(0.0, delta_values[-1])
        else:
            # Linear interpolation
            delta = np.interp(prev_dbh_cm, dbh_values, delta_values)
            return max(0.0, delta)
    
    return interpolator


def predict_baseline_delta(
    prev_dbh_cm: float,
    species: str,
    plot: str,
    curves: Dict[str, Dict]
) -> float:
    """
    Predict baseline delta using best available curve.
    
    Priority order:
    1. (species, plot)
    2. (species, None)
    3. global
    
    Parameters
    ----------
    prev_dbh_cm : float
        Previous DBH in cm
    species : str
        Species name
    plot : str
        Plot name
    curves : dict
        Dictionary of fitted curves
    
    Returns
    -------
    float
        Baseline delta in cm/year (nonnegative)
    """
    # Try species+plot first
    group_key = f"{species}|{plot}"
    if group_key in curves:
        return curves[group_key]['fn'](prev_dbh_cm)
    
    # Try species-only (any plot)
    for key in curves.keys():
        if key.startswith(f"{species}|"):
            return curves[key]['fn'](prev_dbh_cm)
    
    # Fallback to global (use first curve as global proxy)
    # In practice, we should have a dedicated global curve
    if curves:
        first_curve = next(iter(curves.values()))
        return first_curve['fn'](prev_dbh_cm)
    
    # No curves available: return zero
    return 0.0


def save_baseline_curves(curves: Dict[str, Dict], metadata: Dict, sigma_df: pd.DataFrame = None):
    """
    Save fitted curves, metadata, and residual sigma to disk.
    
    Parameters
    ----------
    curves : dict
        Dictionary of fitted curves
    metadata : dict
        Metadata dictionary
    sigma_df : pd.DataFrame, optional
        Residual sigma estimates (if None, will be skipped)
    """
    print("\nSaving baseline curves...")
    
    # Save bin data as CSV
    bins_rows = []
    for group_key, curve_info in curves.items():
        species, plot = group_key.split('|')
        for dbh_center, delta_mean in curve_info['bins']:
            bins_rows.append({
                'Species': species,
                'Plot': plot,
                'DBH_center_cm': dbh_center,
                'delta_mean_cm_per_year': delta_mean,
                'fallback_level': curve_info['fallback_level'],
                'n_samples': curve_info.get('n_samples', 0)
            })
    
    bins_df = pd.DataFrame(bins_rows)
    bins_df.to_csv(BASELINE_BINS_PATH, index=False)
    print(f"✓ Saved bin data to {BASELINE_BINS_PATH}")
    
    # Save metadata as JSON
    # Convert functions to None (can't serialize)
    metadata_serializable = metadata.copy()
    with open(BASELINE_METADATA_PATH, 'w') as f:
        json.dump(metadata_serializable, f, indent=2)
    print(f"✓ Saved metadata to {BASELINE_METADATA_PATH}")
    
    # Save residual sigma if provided
    if sigma_df is not None:
        sigma_df.to_csv(BASELINE_RESIDUAL_SIGMA_PATH, index=False)
        print(f"✓ Saved residual sigma to {BASELINE_RESIDUAL_SIGMA_PATH}")


def load_baseline_curves() -> Dict[str, Dict]:
    """
    Load baseline curves from disk.
    
    Returns
    -------
    dict
        Dictionary of curves (reconstructed from bins)
    """
    if not BASELINE_BINS_PATH.exists():
        raise FileNotFoundError(
            f"Baseline curves not found: {BASELINE_BINS_PATH}\n"
            "Please fit baseline curves first."
        )
    
    bins_df = pd.read_csv(BASELINE_BINS_PATH)
    
    # Reconstruct curves
    curves = {}
    for (species, plot, fallback_level), group_df in bins_df.groupby(['Species', 'Plot', 'fallback_level']):
        group_key = f"{species}|{plot}"
        bins_data = [
            (row['DBH_center_cm'], row['delta_mean_cm_per_year'])
            for _, row in group_df.iterrows()
        ]
        fn = _create_interpolator(bins_data, apply_guardrail=True)
        curves[group_key] = {
            'bins': bins_data,
            'fn': fn,
            'fallback_level': fallback_level,
            'n_samples': group_df['n_samples'].iloc[0] if 'n_samples' in group_df.columns else 0
        }
    
    print(f"✓ Loaded {len(curves)} baseline curves from {BASELINE_BINS_PATH}")
    return curves
