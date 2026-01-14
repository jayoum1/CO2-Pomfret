"""
Forest-Wide Simulation Module for Neural Network Model

This module provides forest-wide simulation using the neural network DBH growth model
(dbh_growth_nn.py) instead of the XGBoost model. The primary purpose is to evaluate
whether neural networks produce smoother growth trajectories without fixed-point behavior.

This module mirrors forest_snapshots.py but uses predict_dbh_next_year_nn instead of
predict_dbh_next_year. Snapshots are saved with "_nn" suffix to distinguish them.

DESIGN PHILOSOPHY:
    Same as forest_snapshots.py:
    - Discrete-time simulation: apply one-year step N times
    - Function composition: encoding → prediction → metrics
    - Immutability: return new DataFrames, don't mutate inputs
    - Decoupling: export snapshots for visualization frontend

KEY DIFFERENCE:
    Uses neural network model which should produce smoother, continuous predictions
    without the piecewise constant behavior and fixed points observed in XGBoost.
"""

import sys
from pathlib import Path
from typing import List
import pandas as pd
import numpy as np

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS, PROCESSED_DATA_DIR, ensure_dir
from models.dbh_growth_nn import predict_dbh_next_year_nn
from models.dbh_increment_model import predict_dbh_next_year_from_increment
from models.forest_metrics import carbon_from_dbh
from models.dbh_residual_model import predict_delta_hybrid


def load_base_forest_df(base_year: int | None = None) -> pd.DataFrame:
    """
    Load the base forest dataset that contains one row per tree with:
    - TreeID
    - Plot
    - Species
    - DBH_cm (current DBH)
    - Any other columns we might want to carry along (e.g. x_local, y_local later).
    
    By default, uses the most recent year's data for each tree.
    If base_year is provided, uses that specific year's data.
    
    Parameters
    ----------
    base_year : int | None, optional
        If provided, use data from this specific year.
        If None, use the most recent year for each tree (default).
    
    Returns
    -------
    pd.DataFrame
        DataFrame with one row per tree, containing:
        - TreeID: Unique tree identifier
        - Plot: Plot name ('Upper', 'Middle', 'Lower')
        - Species: Species name
        - DBH_cm: Current DBH in centimeters
        - Year: Year of the data (for reference)
        - Any other columns from the original dataset
    """
    print("Loading base forest dataset...")
    df = pd.read_csv(str(CARBON_ALL_PLOTS))
    print(f"Loaded {len(df):,} rows from dataset")
    
    # If base_year is specified, filter to that year
    if base_year is not None:
        df = df[df['Year'] == base_year].copy()
        print(f"Filtered to year {base_year}: {len(df):,} trees")
    else:
        # Use the most recent year for each tree
        # Group by TreeID and take the row with maximum Year
        df = df.sort_values(['TreeID', 'Year']).groupby('TreeID').tail(1).copy()
        print(f"Using most recent year for each tree: {len(df):,} unique trees")
    
    # Ensure required columns exist
    required_cols = ['TreeID', 'Plot', 'Species', 'DBH_cm']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    # Filter out rows with missing DBH_cm (can't simulate without DBH)
    initial_count = len(df)
    df = df[df['DBH_cm'].notna()].copy()
    if len(df) < initial_count:
        print(f"Removed {initial_count - len(df)} trees with missing DBH_cm")
    
    print(f"Final base forest: {len(df):,} trees")
    
    return df


def diagnose_dbh_progression(base_forest: pd.DataFrame, years: int = 10, sample_n: int = 10) -> None:
    """
    Diagnostic function to check DBH progression during neural network simulation.
    
    Runs the year-by-year simulation and prints:
      - mean DBH each year
      - mean delta (DBH_{t+1}-DBH_t)
      - % exactly zero delta
      - % abs(delta) < 1e-6
      - % abs(delta) < 0.01
      - number of unique predicted DBH values each year
    Also prints a few random example tree trajectories to confirm progression.
    
    This diagnostic checks for fixed-point behavior and hard ceilings that were
    observed in the XGBoost model.
    
    Parameters
    ----------
    base_forest : pd.DataFrame
        Base forest state (year 0)
    years : int
        Number of years to simulate (default: 10)
    sample_n : int
        Number of sample trees to show trajectories for (default: 10)
    """
    print("\n" + "="*70)
    print("DBH PROGRESSION DIAGNOSTIC (NEURAL NETWORK MODEL)")
    print("="*70)
    
    # Track statistics per year
    current = base_forest.copy()
    
    # Store trajectories for sample trees
    sample_indices = np.random.choice(len(base_forest), size=min(sample_n, len(base_forest)), replace=False)
    sample_treeids = base_forest.iloc[sample_indices]['TreeID'].values.tolist()
    # Create a mapping from TreeID to initial index for lookup
    treeid_to_idx = {tid: idx for idx, tid in zip(sample_indices, sample_treeids)}
    trajectories = {tid: [base_forest.iloc[idx]['DBH_cm']] for idx, tid in zip(sample_indices, sample_treeids)}
    
    print(f"\nYear-by-Year DBH Statistics (full float precision):")
    print("-" * 70)
    print(f"{'Year':<6} | {'Mean DBH':<12} | {'Mean Δ':<12} | {'Med Δ':<12} | {'% Zero':<8} | {'% Tiny':<8} | {'% Small':<8} | {'Unique':<8}")
    print("-" * 70)
    
    plateau_start_year = None
    
    for t in range(1, years + 1):
        # Store previous state
        prev = current['DBH_cm'].to_numpy()
        
        # Simulate one year
        next_state, _ = simulate_forest_one_year(current, silent=True, enforce_monotonic_dbh=False)
        
        # Get next state
        nxt = next_state['DBH_cm'].to_numpy()
        
        # Compute delta
        delta = nxt - prev
        
        # Statistics
        mean_prev = prev.mean()
        mean_nxt = nxt.mean()
        mean_delta = delta.mean()
        median_delta = np.median(delta)
        pct_zero = (delta == 0).mean() * 100
        pct_tiny = (np.abs(delta) < 1e-6).mean() * 100
        pct_small = (np.abs(delta) < 0.01).mean() * 100
        n_unique = len(np.unique(np.round(nxt, 6)))
        
        # Check for plateau (mean delta near zero)
        if plateau_start_year is None and abs(mean_delta) < 1e-6:
            plateau_start_year = t
        
        print(f"{t:<6} | {mean_prev:12.6f} | {mean_delta:12.6f} | {median_delta:12.6f} | "
              f"{pct_zero:7.2f}% | {pct_tiny:7.2f}% | {pct_small:7.2f}% | {n_unique:<8}")
        
        # Update trajectories (lookup by TreeID since indices may change)
        for tid in sample_treeids:
            tid_mask = next_state['TreeID'] == tid
            if tid_mask.any():
                trajectories[tid].append(next_state[tid_mask]['DBH_cm'].values[0])
        
        # Update current state
        current = next_state
    
    print("-" * 70)
    
    # Report plateau
    if plateau_start_year is not None:
        print(f"\n⚠ PLATEAU DETECTED: Mean delta dropped near zero starting at year {plateau_start_year}")
    else:
        print(f"\n✓ No plateau detected in mean delta over {years} years")
    
    # Check for hard ceiling (many trees hitting same DBH value)
    print(f"\n{'='*70}")
    print("Hard Ceiling Check:")
    print("="*70)
    final_dbhs = current['DBH_cm'].values
    unique_dbhs = np.unique(np.round(final_dbhs, 2))
    dbh_counts = pd.Series(np.round(final_dbhs, 2)).value_counts()
    
    # Check if any single DBH value accounts for >10% of trees
    max_count_pct = (dbh_counts.max() / len(final_dbhs)) * 100
    print(f"  Unique DBH values (rounded to 0.01 cm): {len(unique_dbhs):,}")
    print(f"  Most common DBH value: {dbh_counts.index[0]:.2f} cm ({dbh_counts.iloc[0]} trees, {max_count_pct:.1f}%)")
    
    if max_count_pct > 10:
        print(f"  ⚠ WARNING: {max_count_pct:.1f}% of trees have the same DBH (rounded). Possible hard ceiling.")
    else:
        print(f"  ✓ No hard ceiling detected (no single DBH value >10% of trees)")
    
    # Print sample trajectories
    print(f"\n{'='*70}")
    print(f"Sample Tree Trajectories (DBH_0, DBH_1, ..., DBH_{years}):")
    print("="*70)
    for tid in sample_treeids[:sample_n]:
        traj = trajectories[tid]
        # Lookup original row by TreeID
        tid_mask = base_forest['TreeID'] == tid
        if tid_mask.any():
            row = base_forest[tid_mask].iloc[0]
            species = row['Species']
            plot = row['Plot']
            traj_str = ", ".join([f"{dbh:.6f}" for dbh in traj])
            print(f"TreeID {tid} ({species}, {plot}): [{traj_str}]")
            
            # Check if this tree plateaued
            if len(traj) > 1:
                deltas = [traj[i+1] - traj[i] for i in range(len(traj)-1)]
                if len(deltas) > 5 and all(abs(d) < 1e-6 for d in deltas[5:]):  # Check after year 5
                    print(f"  → This tree plateaued after year 5")
                else:
                    # Check for monotonic growth
                    if all(d >= -1e-6 for d in deltas):  # Allow tiny numerical errors
                        print(f"  → Continuous growth (no plateau)")
                    elif all(d <= 1e-6 for d in deltas):
                        print(f"  → Continuous decline (no plateau)")
    
    print("\n" + "="*70)


def simulate_forest_one_year(
    forest_df: pd.DataFrame, 
    silent: bool = True,
    enforce_monotonic_dbh: bool = True,
    max_annual_shrink_cm: float = 0.0,
    model_type: str = "nn_state",
    simulation_mode: str = "hard0",
    epsilon_cm: float = 0.02
) -> tuple[pd.DataFrame, dict]:
    """
    Simulate the forest forward by exactly one year using the neural network model.
    
    For each tree:
    - Use its current DBH_cm (prev_dbh) as input to predict next year's DBH
    - Apply monotonic DBH enforcement if enabled (prevent implausible shrinkage)
    - Compute carbon at start of year (carbon_now) and end of year (carbon_at_time)
    
    This function implements the core one-year step of the discrete-time simulation.
    It does NOT mutate the input DataFrame; instead, it returns a new DataFrame
    with updated values. This immutability makes it easier to reason about the
    simulation and allows us to keep snapshots at different time points.
    
    Parameters
    ----------
    forest_df : pd.DataFrame
        Current forest state with columns: TreeID, Plot, Species, DBH_cm, ...
        Each row represents one tree.
        DBH_cm represents the DBH at the start of the year (prev_dbh).
    silent : bool
        If True, suppress warning messages (default: True)
    enforce_monotonic_dbh : bool
        If True, enforce that DBH does not decrease below (prev_dbh - max_annual_shrink_cm)
        This prevents biologically implausible shrinkage (default: True)
    max_annual_shrink_cm : float
        Maximum allowed annual shrinkage in cm (default: 0.0)
        If enforce_monotonic_dbh=True, next_dbh will be clamped to at least (prev_dbh - max_annual_shrink_cm)
    model_type : str
        Model type to use: "nn_state" (neural network predicting next DBH) or 
        "xgb_increment" (XGBoost predicting increment) (default: "nn_state")
    simulation_mode : str
        Simulation mode for NN state model: "hard0" (no shrinkage, delta < 0 -> 0),
        "epsilon" (delta < 0 -> epsilon_cm), or "hybrid" (baseline + residual) (default: "hard0")
    epsilon_cm : float
        Minimum growth when epsilon mode is used (default: 0.02 cm)
    
    Returns
    -------
    tuple[pd.DataFrame, dict]
        - DataFrame: New DataFrame representing the forest state after one year, with updated:
          - DBH_cm: Next year's DBH (predicted, represents DBH at end of year)
          - carbon_at_time: Carbon storage at end of year (corresponds to DBH_cm)
          - All original columns are preserved
        - dict: Diagnostic information with keys:
          - 'n_clamped': Number of trees that were clamped due to monotonic enforcement
          - 'shrink_flags': List of dicts with trees that would shrink by >0.3 cm
          - 'delta_pred_list': List of raw predicted deltas (for stuck tree analysis)
          - 'delta_used_list': List of deltas actually used (after hard0/epsilon/hybrid)
          - 'n_zero_delta': Number of trees with zero delta after correction
          - 'delta_base_list': List of baseline deltas (hybrid mode only)
          - 'delta_resid_list': List of residual deltas (hybrid mode only)
          - 'was_clamped_list': List of clamp flags (hybrid mode only)
    """
    # Create a copy to avoid mutating the input
    result_df = forest_df.copy()
    
    if not silent:
        print(f"Simulating {len(result_df):,} trees forward one year (NN model)...")
    
    # Apply the one-year growth model to each tree
    # We iterate row-by-row for clarity, though this could be vectorized later
    # if performance becomes an issue
    dbh_next_list = []
    carbon_at_time_list = []
    n_clamped = 0
    shrink_flags = []
    negative_increment_flags = []
    delta_pred_list = []
    delta_used_list = []
    n_zero_delta = 0
    
    # Hybrid mode diagnostics
    delta_base_list = []
    delta_resid_list = []
    was_clamped_list = []
    
    for idx, row in result_df.iterrows():
        # prev_dbh: DBH at the start of the year (current state)
        prev_dbh = row['DBH_cm']
        species = row['Species']
        plot = row['Plot']
        tree_id = row['TreeID']
        
        # Predict next year's DBH based on model type
        if model_type == "xgb_increment":
            # Use increment model - get raw increment first for diagnostics
            from models.dbh_increment_model import predict_delta_dbh_per_year
            delta_per_year_raw = predict_delta_dbh_per_year(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0
            )
            
            # Track negative increments
            if delta_per_year_raw < -0.1:
                negative_increment_flags.append({
                    'TreeID': tree_id,
                    'Species': species,
                    'Plot': plot,
                    'prev_dbh': prev_dbh,
                    'delta_per_year_pred': delta_per_year_raw
                })
            
            # Get final prediction with clamping
            next_dbh_pred = predict_dbh_next_year_from_increment(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0,
                clamp_negative=enforce_monotonic_dbh,
                max_shrink_cm=max_annual_shrink_cm
            )
            next_dbh = next_dbh_pred  # Clamping already handled in predict_dbh_next_year_from_increment
        else:  # model_type == "nn_state"
            # Use neural network state model
            next_dbh_pred = predict_dbh_next_year_nn(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0
            )
            
            # Calculate raw predicted delta
            delta_pred = next_dbh_pred - prev_dbh
            delta_pred_list.append(delta_pred)
            
            # Apply simulation mode rule (hard0, epsilon, or hybrid) for NN state model
            if simulation_mode == "hard0":
                # HARD 0 RULE: any negative change becomes 0 growth
                delta_used = max(0.0, delta_pred)
                next_dbh = prev_dbh + delta_used
            elif simulation_mode == "epsilon":
                # EPSILON RULE: negative change becomes epsilon growth
                if delta_pred < 0:
                    delta_used = epsilon_cm
                else:
                    delta_used = delta_pred
                next_dbh = prev_dbh + delta_used
            elif simulation_mode == "hybrid":
                # HYBRID MODE: baseline + residual
                delta_base, delta_resid, delta_total_raw = predict_delta_hybrid(
                    prev_dbh_cm=prev_dbh,
                    species=species,
                    plot=plot,
                    gap_years=1.0
                )
                delta_base_list.append(delta_base)
                delta_resid_list.append(delta_resid)
                
                # Clamp to nonnegative
                delta_total_raw_val = delta_total_raw
                delta_used = max(0.0, delta_total_raw_val)
                was_clamped = 1 if delta_total_raw_val < 0 else 0
                was_clamped_list.append(was_clamped)
                
                next_dbh = prev_dbh + delta_used
                delta_pred = delta_total_raw_val  # For consistency with other modes
            else:
                # Legacy monotonic enforcement (for backward compatibility)
                if enforce_monotonic_dbh:
                    min_allowed_dbh = prev_dbh - max_annual_shrink_cm
                    if next_dbh_pred < min_allowed_dbh:
                        next_dbh = min_allowed_dbh
                        n_clamped += 1
                        delta_used = next_dbh - prev_dbh
                    else:
                        next_dbh = next_dbh_pred
                        delta_used = delta_pred
                else:
                    next_dbh = next_dbh_pred
                    delta_used = delta_pred
            
            delta_used_list.append(delta_used)
            if abs(delta_used) < 1e-6:  # Effectively zero
                n_zero_delta += 1
        
        # Track trees that would shrink significantly (for diagnostics)
        delta_pred = next_dbh_pred - prev_dbh
        if delta_pred < -0.3:  # Shrinkage of more than 0.3 cm
            shrink_flags.append({
                'TreeID': tree_id,
                'Species': species,
                'Plot': plot,
                'prev_dbh': prev_dbh,
                'next_dbh_pred': next_dbh_pred,
                'delta_pred': delta_pred,
                'next_dbh_final': next_dbh
            })
        
        # Compute carbon metrics:
        # carbon_now: carbon at start of year (using prev_dbh) - intermediate variable
        # carbon_at_time: carbon at end of year (using next_dbh) - stored in result
        carbon_now = carbon_from_dbh(prev_dbh, species)
        carbon_at_time = carbon_from_dbh(next_dbh, species)
        
        dbh_next_list.append(next_dbh)
        carbon_at_time_list.append(carbon_at_time)
    
    # Update the DataFrame with new values
    result_df['DBH_cm'] = dbh_next_list  # DBH_cm now represents DBH at end of year
    result_df['carbon_at_time'] = carbon_at_time_list  # Carbon at end of year
    
    diagnostics = {
        'n_clamped': n_clamped,
        'shrink_flags': shrink_flags,
        'negative_increment_flags': negative_increment_flags,
        'delta_pred_list': delta_pred_list,
        'delta_used_list': delta_used_list,
        'n_zero_delta': n_zero_delta
    }
    
    # Add hybrid mode diagnostics if available
    if simulation_mode == "hybrid":
        diagnostics['delta_base_list'] = delta_base_list
        diagnostics['delta_resid_list'] = delta_resid_list
        diagnostics['was_clamped_list'] = was_clamped_list
    
    if not silent:
        print(f"✓ Simulation complete. Mean DBH: {result_df['DBH_cm'].mean():.2f} cm")
        if enforce_monotonic_dbh and n_clamped > 0:
            print(f"  Clamped {n_clamped} trees ({100*n_clamped/len(result_df):.1f}%) to enforce monotonic DBH")
    
    return result_df, diagnostics


def simulate_forest_years(
    base_forest_df: pd.DataFrame,
    years: int,
    enforce_monotonic_dbh: bool = True,
    max_annual_shrink_cm: float = 0.0,
    print_diagnostics: bool = True,
    model_type: str = "nn_state",
    simulation_mode: str = "hard0",
    epsilon_cm: float = 0.02
) -> tuple[pd.DataFrame, list[dict], list[dict], dict]:
    """
    Simulate the forest forward for `years` discrete one-year steps using neural network.
    
    This is a discrete-time simulation where:
    - base_forest_df is the state at year 0
    - years >= 0
    - Returns the forest state after `years` steps
    
    Each call starts from the given base_forest_df and applies exactly `years` steps.
    This ensures that each requested horizon (5, 10, 20 years) is simulated independently
    from the base forest, not chained from previous simulations.
    
    Parameters
    ----------
    base_forest_df : pd.DataFrame
        Starting forest state (year 0). Must have columns: TreeID, Plot, Species, DBH_cm
    years : int
        Number of years to simulate (must be >= 0)
        If years=0, returns the base forest unchanged
    enforce_monotonic_dbh : bool
        If True, enforce that DBH does not decrease below (prev_dbh - max_annual_shrink_cm)
        (default: True)
    max_annual_shrink_cm : float
        Maximum allowed annual shrinkage in cm (default: 0.0)
    print_diagnostics : bool
        If True, print per-year diagnostics (default: True)
    
    simulation_mode : str
        Simulation mode for NN state model: "hard0", "epsilon", or "hybrid" (default: "hard0")
    epsilon_cm : float
        Minimum growth when epsilon mode is used (default: 0.02 cm)
    
    Returns
    -------
    tuple[pd.DataFrame, list[dict], list[dict], dict]
        - DataFrame: Forest state after `years` years with 'years_ahead' column
        - list[dict]: All shrink flags collected across all years (for CSV export)
        - list[dict]: All negative increment flags (for increment model diagnostics)
        - dict: Stuck tree diagnostics with keys:
          - 'yearly_stats': List of dicts with per-year statistics
          - 'stuck_trees': List of dicts with permanently stuck trees
          - 'dbh_history': Dict mapping TreeID to list of DBH values over years
    """
    if years < 0:
        raise ValueError("years must be non-negative")
    
    if years == 0:
        # Return base forest with years_ahead=0
        result = base_forest_df.copy()
        result['years_ahead'] = 0
        return result, [], [], {'yearly_stats': [], 'stuck_trees': [], 'dbh_history': {}}
    
    model_name = "Increment Model" if model_type == "xgb_increment" else "Neural Network Model"
    if print_diagnostics:
        print(f"\nSimulating forest forward {years} years ({model_name})...")
        print(f"Starting with {len(base_forest_df):,} trees")
        print(f"Monotonic DBH enforcement: {enforce_monotonic_dbh}, Max shrink: {max_annual_shrink_cm} cm")
        print("\n" + "="*70)
        print("YEAR-BY-YEAR DIAGNOSTICS")
        print("="*70)
        if model_type == "xgb_increment":
            print(f"{'Year':<6} | {'Mean Δ':<12} | {'Med Δ':<12} | {'% Neg':<10} | {'% Clamped':<12} | {'Min Δ':<10} | {'Max Δ':<10}")
        else:
            # NN state model with simulation mode diagnostics
            print(f"{'Year':<6} | {'Mean DBH':<12} | {'Mean Δ_pred':<12} | {'Med Δ':<12} | {'% Neg Δ':<10} | {'% Zero Δ':<10} | {'Unique DBH':<12}")
        print("-"*70)
    
    # Start with the base forest
    # IMPORTANT: Always start from base_forest_df, not from a previous simulation state
    current = base_forest_df.copy()
    
    # Collect all shrink flags across years
    all_shrink_flags = []
    all_negative_increment_flags = []
    
    # Track DBH history for stuck tree detection
    dbh_history = {tree_id: [dbh] for tree_id, dbh in zip(base_forest_df['TreeID'], base_forest_df['DBH_cm'])}
    yearly_stats = []
    
    # Apply the one-year step function exactly `years` times
    # This is a discrete-time simulation: each iteration represents one year
    for year_step in range(1, years + 1):
        prev_dbhs = current['DBH_cm'].values.copy()
        
        # Simulate one year
        current, diagnostics = simulate_forest_one_year(
            current, 
            silent=True,
            enforce_monotonic_dbh=enforce_monotonic_dbh,
            max_annual_shrink_cm=max_annual_shrink_cm,
            model_type=model_type,
            simulation_mode=simulation_mode,
            epsilon_cm=epsilon_cm
        )
        
        # Calculate deltas
        next_dbhs = current['DBH_cm'].values
        deltas = next_dbhs - prev_dbhs
        
        # Get raw predicted deltas (for diagnostics)
        delta_pred_raw = diagnostics.get('delta_pred_list', [])
        delta_used_list = diagnostics.get('delta_used_list', deltas)
        
        # Statistics
        mean_dbh = next_dbhs.mean()
        mean_delta_pred = np.mean(delta_pred_raw) if delta_pred_raw else mean_delta
        mean_delta_used = np.mean(delta_used_list) if delta_used_list else mean_delta
        median_delta = np.median(deltas)
        min_delta = deltas.min()
        max_delta = deltas.max()
        pct_shrink = (np.array(delta_pred_raw) < 0).mean() * 100 if delta_pred_raw else (deltas < 0).mean() * 100
        pct_zero_delta = (np.abs(np.array(delta_used_list)) < 1e-6).mean() * 100 if delta_used_list else 0.0
        pct_clamped = (diagnostics['n_zero_delta'] / len(current)) * 100 if len(current) > 0 else 0.0
        unique_dbhs = len(np.unique(np.round(next_dbhs, 6)))
        
        # Update DBH history
        for tree_id, dbh in zip(current['TreeID'], next_dbhs):
            if tree_id in dbh_history:
                dbh_history[tree_id].append(dbh)
        
        # Store yearly statistics
        yearly_stats.append({
            'year': year_step,
            'mean_dbh': mean_dbh,
            'mean_delta_pred': mean_delta_pred,
            'mean_delta_used': mean_delta_used,
            'median_delta': median_delta,
            'pct_delta_pred_neg': pct_shrink,
            'pct_zero_delta': pct_zero_delta,
            'unique_dbhs': unique_dbhs
        })
        
        # For increment model: collect negative increment flags
        if model_type == "xgb_increment":
            from models.dbh_increment_model import predict_delta_dbh_per_year
            for idx, row in current.iterrows():
                delta_per_year_raw = predict_delta_dbh_per_year(
                    prev_dbh_cm=prev_dbhs[current.index.get_loc(idx)],
                    species=row['Species'],
                    plot=row['Plot'],
                    gap_years=1.0
                )
                if delta_per_year_raw < -0.1:  # Negative increment threshold
                    all_negative_increment_flags.append({
                        'TreeID': row['TreeID'],
                        'Species': row['Species'],
                        'Plot': row['Plot'],
                        'prev_dbh': prev_dbhs[current.index.get_loc(idx)],
                        'delta_per_year_pred': delta_per_year_raw,
                        'year_step': year_step
                    })
        
        # Add year_step to shrink flags
        for flag in diagnostics['shrink_flags']:
            flag['year_step'] = year_step
            all_shrink_flags.append(flag)
        
        # Add year_step to negative increment flags (for increment model)
        if model_type == "xgb_increment" and 'negative_increment_flags' in diagnostics:
            for flag in diagnostics['negative_increment_flags']:
                flag['year_step'] = year_step
                all_negative_increment_flags.append(flag)
        
        if print_diagnostics:
            if model_type == "xgb_increment":
                # Count negative increments for this year
                year_neg_flags = [f for f in all_negative_increment_flags if f['year_step'] == year_step]
                pct_neg = (len(year_neg_flags) / len(current)) * 100 if len(current) > 0 else 0.0
                print(f"{year_step:<6} | {mean_delta:12.4f} | {median_delta:12.4f} | {pct_neg:9.1f}% | {pct_clamped:11.1f}% | {min_delta:10.4f} | {max_delta:10.4f}")
            else:
                # NN state model with simulation mode diagnostics
                print(f"{year_step:<6} | {mean_dbh:12.4f} | {mean_delta_pred:12.4f} | {median_delta:12.4f} | {pct_shrink:9.1f}% | {pct_zero_delta:9.1f}% | {unique_dbhs:12d}")
        
        # After each year, DBH_cm represents the DBH at that future time point
        # We use this updated DBH as input for the next iteration
    
    # Add years_ahead column to indicate time offset
    current['years_ahead'] = years
    
    # Detect permanently stuck trees
    stuck_trees = detect_stuck_trees(dbh_history, years)
    
    stuck_diagnostics = {
        'yearly_stats': yearly_stats,
        'stuck_trees': stuck_trees,
        'dbh_history': dbh_history
    }
    
    if print_diagnostics:
        print("-"*70)
        print(f"\n✓ Simulation complete: {years} years forward")
        if all_shrink_flags:
            print(f"  Found {len(all_shrink_flags)} tree-year combinations with >0.3 cm shrinkage")
        if model_type == "xgb_increment" and all_negative_increment_flags:
            print(f"  Found {len(all_negative_increment_flags)} tree-year combinations with negative increment (<-0.1 cm/year)")
        if stuck_trees:
            print(f"  Found {len(stuck_trees)} permanently stuck trees ({100*len(stuck_trees)/len(current):.1f}%)")
    
    return current, all_shrink_flags, all_negative_increment_flags, stuck_diagnostics


def detect_stuck_trees(dbh_history: dict, total_years: int) -> list[dict]:
    """
    Detect trees that are permanently stuck (DBH stops changing and never changes again).
    
    A tree is "permanently stuck by year k" if:
    - DBH stops changing at year k (delta == 0)
    - DBH never changes again through year total_years
    
    Parameters
    ----------
    dbh_history : dict
        Dictionary mapping TreeID to list of DBH values [year0, year1, ..., yearN]
    total_years : int
        Total number of years simulated
    
    Returns
    -------
    list[dict]
        List of stuck tree records with keys:
        - TreeID
        - Species (from base forest)
        - Plot (from base forest)
        - DBH_at_stuck
        - year_first_stuck
    """
    stuck_trees = []
    
    for tree_id, dbh_list in dbh_history.items():
        if len(dbh_list) < 2:
            continue
        
        # Find first year where DBH stops changing
        year_first_stuck = None
        for year in range(1, len(dbh_list)):
            if abs(dbh_list[year] - dbh_list[year-1]) < 1e-6:  # Effectively zero change
                # Check if it stays stuck for all remaining years
                is_permanently_stuck = True
                for future_year in range(year + 1, len(dbh_list)):
                    if abs(dbh_list[future_year] - dbh_list[year]) >= 1e-6:
                        is_permanently_stuck = False
                        break
                
                if is_permanently_stuck:
                    year_first_stuck = year
                    break
        
        if year_first_stuck is not None:
            stuck_trees.append({
                'TreeID': tree_id,
                'DBH_at_stuck': dbh_list[year_first_stuck],
                'year_first_stuck': year_first_stuck
            })
    
    return stuck_trees


def generate_forest_snapshots(
    years_list: List[int],
    base_year: int | None = None,
    output_dir: str | Path = None,
    enforce_monotonic_dbh: bool = True,
    max_annual_shrink_cm: float = 0.0,
    model_type: str = "nn_state",
    simulation_mode: str = "hard0",
    epsilon_cm: float = 0.02
) -> dict:
    """
    Generate forest snapshots at multiple time points using neural network model.
    
    For each value in `years_list` (e.g. [0, 5, 10, 20]):
    - Simulate the forest that many years into the future, starting from the base forest
    - Save a CSV snapshot to `output_dir`, e.g.:
      - forest_nn_0_years.csv
      - forest_nn_5_years.csv
      - forest_nn_10_years.csv
    
    Each snapshot includes:
    - TreeID: Unique tree identifier
    - Plot: Plot name
    - Species: Species name
    - DBH_cm: DBH at that future time point
    - carbon_at_time: Carbon storage at that time point
    - years_ahead: Time offset from base year
    - Any position columns if available (x_local, y_local) - preserved from base forest
    
    These snapshots can be used by:
    - R scripts for plotting and analysis
    - Web app for interactive visualization
    - 3D visualization tools
    
    Parameters
    ----------
    years_list : List[int]
        List of years to simulate (e.g., [0, 5, 10, 20])
        Each value must be >= 0
    base_year : int | None, optional
        Base year to use for the forest (passed to load_base_forest_df)
        If None, uses the most recent year for each tree
    output_dir : str | Path, optional
        Directory to save snapshot CSV files
        If None, defaults to "Data/Processed Data/forest_snapshots"
    enforce_monotonic_dbh : bool
        If True, enforce that DBH does not decrease below (prev_dbh - max_annual_shrink_cm)
        (default: True)
    max_annual_shrink_cm : float
        Maximum allowed annual shrinkage in cm (default: 0.0)
    model_type : str
        Model type to use: "nn_state" or "xgb_increment" (default: "nn_state")
    simulation_mode : str
        Simulation mode for NN state model: "hard0", "epsilon", or "hybrid" (default: "hard0")
    epsilon_cm : float
        Minimum growth when epsilon mode is used (default: 0.02 cm)
    
    Returns
    -------
    dict
        Dictionary with simulation results including:
        - 'snapshots': List of snapshot DataFrames
        - 'stuck_trees': List of stuck trees
        - 'yearly_stats': Yearly statistics
    """
    # Set default output directory
    if output_dir is None:
        output_dir = PROCESSED_DATA_DIR / "forest_snapshots"
    else:
        output_dir = Path(output_dir)
    
    # Ensure output directory exists
    ensure_dir(output_dir)
    
    # Ensure diagnostics directory exists
    diagnostics_dir = PROCESSED_DATA_DIR / "diagnostics"
    ensure_dir(diagnostics_dir)
    
    print(f"Output directory: {output_dir}")
    print(f"Diagnostics directory: {diagnostics_dir}")
    
    # Validate years_list
    if not years_list:
        raise ValueError("years_list cannot be empty")
    if any(y < 0 for y in years_list):
        raise ValueError("All years in years_list must be >= 0")
    
    # Load base forest once (year 0)
    # This is the starting state for all simulations
    base_forest = load_base_forest_df(base_year=base_year)
    
    # Determine model name and file suffix
    model_name = "Increment Model" if model_type == "xgb_increment" else "Neural Network Model"
    file_suffix = "xgb_increment" if model_type == "xgb_increment" else "nn"
    
    # Generate snapshots for each year
    print(f"\nGenerating snapshots for years: {years_list} ({model_name})")
    
    # Track mean DBH for consistency checking
    mean_dbh_by_year = {}
    
    # Collect all shrink flags across all years for CSV export
    all_shrink_flags = []
    all_negative_increment_flags = []
    
    # For each requested horizon, simulate from the base forest
    # IMPORTANT: Each simulation starts from base_forest, not from a previous simulation
    # This ensures that 10-year and 20-year snapshots are computed independently,
    # not chained from the 5-year state
    for years in sorted(years_list):
        print(f"\n{'='*60}")
        print(f"Generating snapshot: {years} years ahead ({model_name})")
        print(f"{'='*60}")
        
        # Simulate forest forward from base_forest
        # If years == 0, use base forest as-is
        # Otherwise, simulate exactly `years` steps from base_forest
        if years == 0:
            forest_snapshot = base_forest.copy()
            forest_snapshot['years_ahead'] = 0
            shrink_flags_year = []
            negative_increment_flags_year = []
        else:
            # Each call to simulate_forest_years starts from base_forest and applies
            # exactly `years` discrete one-year steps
            forest_snapshot, shrink_flags_year, negative_increment_flags_year, stuck_diagnostics = simulate_forest_years(
                base_forest, 
                years,
                enforce_monotonic_dbh=enforce_monotonic_dbh,
                max_annual_shrink_cm=max_annual_shrink_cm,
                print_diagnostics=True,
                model_type=model_type,
                simulation_mode=simulation_mode,
                epsilon_cm=epsilon_cm
            )
            all_shrink_flags.extend(shrink_flags_year)
            all_negative_increment_flags.extend(negative_increment_flags_year)
            
            # Store stuck trees (only for longest simulation)
            if years == max(years_list):
                final_stuck_trees = stuck_diagnostics['stuck_trees']
                final_yearly_stats = stuck_diagnostics['yearly_stats']
        
        # Track mean DBH for consistency checking
        mean_dbh_by_year[years] = forest_snapshot['DBH_cm'].mean()
        
        # For year 0, we need to compute carbon_at_time if it doesn't exist
        if years == 0 and 'carbon_at_time' not in forest_snapshot.columns:
            print("Computing carbon metrics for base forest...")
            carbon_at_time_list = []
            for idx, row in forest_snapshot.iterrows():
                carbon_at_time_list.append(carbon_from_dbh(row['DBH_cm'], row['Species']))
            forest_snapshot['carbon_at_time'] = carbon_at_time_list
        
        # Build cleaned snapshot DataFrame with only visualization-relevant columns
        # DBH_cm: DBH at years_ahead
        # carbon_at_time: carbon at that time (corresponds to DBH_cm)
        # Snapshots are meant to be consumed by R or app frontend without modeling internals
        
        # Core columns to include
        core_columns = ['TreeID', 'Plot', 'Species', 'DBH_cm', 'carbon_at_time', 'years_ahead']
        
        # Add any position/coordinate columns if they exist (e.g., x_local, y_local)
        position_cols = [col for col in forest_snapshot.columns 
                        if any(keyword in col.lower() for keyword in ['x', 'y', 'local', 'coord', 'position'])
                        and col not in core_columns]
        
        # Columns to exclude (modeling internals)
        exclude_cols = ['DBH', 'PrevDBH', 'GrowthRate', 'GapYears', 'GrowthType', 'Year', 
                       'Carbon', 'CO2e', 'PrevCarbon', 'CarbonGrowth', 'CarbonGrowthRate',
                       'carbon_now', 'carbon_future', 'carbon_growth', 'carbon_growth_rate']
        
        # Build final column list
        columns_to_save = [col for col in core_columns + position_cols 
                          if col in forest_snapshot.columns and col not in exclude_cols]
        
        # Remove duplicates while preserving order
        seen = set()
        columns_to_save = [col for col in columns_to_save if not (col in seen or seen.add(col))]
        
        # Create cleaned snapshot DataFrame (exclude modeling internals)
        cleaned_snapshot = forest_snapshot[columns_to_save].copy()
        
        # Save to CSV with appropriate suffix
        filename = f"forest_{file_suffix}_{years}_years.csv"
        filepath = output_dir / filename
        cleaned_snapshot.to_csv(filepath, index=False)
        
        print(f"✓ Saved: {filepath}")
        print(f"  Trees: {len(cleaned_snapshot):,}")
        print(f"  Mean DBH: {cleaned_snapshot['DBH_cm'].mean():.2f} cm")
        print(f"  DBH range: {cleaned_snapshot['DBH_cm'].min():.2f} - {cleaned_snapshot['DBH_cm'].max():.2f} cm")
        print(f"  Total carbon: {cleaned_snapshot['carbon_at_time'].sum():.2f} kg C")
    
    # Consistency check: verify DBH progression
    print(f"\n{'='*60}")
    print("DBH Progression Check (Neural Network Model)")
    print(f"{'='*60}")
    print("Years Ahead | Mean DBH (cm)")
    print("-" * 30)
    for years in sorted(mean_dbh_by_year.keys()):
        print(f"{years:11d} | {mean_dbh_by_year[years]:.2f}")
    
    # Check for non-monotonic or flat progression
    sorted_years = sorted(mean_dbh_by_year.keys())
    warnings = []
    for i in range(len(sorted_years) - 1):
        k1, k2 = sorted_years[i], sorted_years[i + 1]
        dbh1, dbh2 = mean_dbh_by_year[k1], mean_dbh_by_year[k2]
        
        if dbh2 < dbh1:
            warnings.append(
                f"WARNING: Mean DBH decreased from {k1} years ({dbh1:.2f} cm) "
                f"to {k2} years ({dbh2:.2f} cm). DBH should not decrease on average."
            )
        elif abs(dbh2 - dbh1) < 0.01:  # Very small difference (essentially flat)
            warnings.append(
                f"WARNING: Mean DBH is nearly identical at {k1} years ({dbh1:.2f} cm) "
                f"and {k2} years ({dbh2:.2f} cm). Possible hard ceiling."
            )
    
    if warnings:
        print("\n⚠ CONSISTENCY WARNINGS:")
        for warning in warnings:
            print(f"  {warning}")
    else:
        print("\n✓ DBH progression is consistent (monotonic or increasing)")
    
    # Check for hard ceiling across all snapshots
    print(f"\n{'='*60}")
    print("Hard Ceiling Analysis:")
    print(f"{'='*60}")
    for years in sorted(mean_dbh_by_year.keys()):
        # Load the snapshot to check for clustering
        filename = f"forest_nn_{years}_years.csv"
        filepath = output_dir / filename
        if filepath.exists():
            snapshot = pd.read_csv(filepath)
            dbhs = snapshot['DBH_cm'].values
            unique_dbhs = len(np.unique(np.round(dbhs, 2)))
            dbh_counts = pd.Series(np.round(dbhs, 2)).value_counts()
            max_count_pct = (dbh_counts.max() / len(dbhs)) * 100
            
            print(f"\n{years} years ahead:")
            print(f"  Unique DBH values (rounded to 0.01 cm): {unique_dbhs:,}")
            print(f"  Most common DBH: {dbh_counts.index[0]:.2f} cm ({dbh_counts.iloc[0]} trees, {max_count_pct:.1f}%)")
            
            if max_count_pct > 10:
                print(f"  ⚠ WARNING: {max_count_pct:.1f}% of trees have the same DBH. Possible hard ceiling.")
            else:
                print(f"  ✓ No hard ceiling detected")
    
    # Save shrink flags to CSV
    if all_shrink_flags:
        shrink_flags_df = pd.DataFrame(all_shrink_flags)
        shrink_flags_path = diagnostics_dir / f"shrink_flags_{file_suffix}.csv"
        shrink_flags_df.to_csv(shrink_flags_path, index=False)
        print(f"\n{'='*60}")
        print(f"Saved shrink flags: {shrink_flags_path}")
        print(f"  Total tree-year combinations with >0.3 cm shrinkage: {len(shrink_flags_df)}")
        print(f"{'='*60}")
    
    # Save negative increment flags for increment model
    if model_type == "xgb_increment" and all_negative_increment_flags:
        negative_increment_df = pd.DataFrame(all_negative_increment_flags)
        negative_increment_path = diagnostics_dir / "increment_negative_flags.csv"
        negative_increment_df.to_csv(negative_increment_path, index=False)
        print(f"\n{'='*60}")
        print(f"Saved negative increment flags: {negative_increment_path}")
        print(f"  Total tree-year combinations with negative increment (<-0.1 cm/year): {len(negative_increment_df)}")
        print(f"{'='*60}")
    
    # Save stuck trees CSV if available
    if 'final_stuck_trees' in locals() and final_stuck_trees:
        # Enrich stuck trees with Species and Plot from base forest
        stuck_trees_enriched = []
        for stuck_tree in final_stuck_trees:
            tree_row = base_forest[base_forest['TreeID'] == stuck_tree['TreeID']]
            if len(tree_row) > 0:
                stuck_trees_enriched.append({
                    'TreeID': stuck_tree['TreeID'],
                    'Species': tree_row.iloc[0]['Species'],
                    'Plot': tree_row.iloc[0]['Plot'],
                    'DBH_at_stuck': stuck_tree['DBH_at_stuck'],
                    'year_first_stuck': stuck_tree['year_first_stuck']
                })
        
        if stuck_trees_enriched:
            stuck_trees_df = pd.DataFrame(stuck_trees_enriched)
            stuck_trees_path = diagnostics_dir / f"stuck_trees_{simulation_mode}.csv"
            stuck_trees_df.to_csv(stuck_trees_path, index=False)
            print(f"\n{'='*60}")
            print(f"Saved stuck trees: {stuck_trees_path}")
            print(f"  Total permanently stuck trees: {len(stuck_trees_df)} ({100*len(stuck_trees_df)/len(base_forest):.1f}%)")
            print(f"{'='*60}")
    
    print(f"\n{'='*60}")
    print("All snapshots generated successfully!")
    print(f"{'='*60}")
    
    # Return results
    result_dict = {
        'snapshots': [],
        'stuck_trees': final_stuck_trees if 'final_stuck_trees' in locals() else [],
        'yearly_stats': final_yearly_stats if 'final_yearly_stats' in locals() else []
    }
    
    return result_dict


# ==============================================================================
# Example Usage and Testing
# ==============================================================================

if __name__ == "__main__":
    print("="*60)
    print("FOREST-WIDE SIMULATION EXAMPLE (NEURAL NETWORK MODEL)")
    print("="*60)
    
    # 1. Load base forest
    print("\n1. Loading base forest...")
    base_forest = load_base_forest_df()
    
    # Print summary statistics
    print("\nBase forest summary:")
    print(f"  Number of trees: {len(base_forest):,}")
    print(f"  Mean DBH: {base_forest['DBH_cm'].mean():.2f} cm")
    print(f"  DBH range: {base_forest['DBH_cm'].min():.2f} - {base_forest['DBH_cm'].max():.2f} cm")
    print(f"  Total carbon: {base_forest['Carbon'].sum():.2f} kg C" if 'Carbon' in base_forest.columns else "")
    print(f"  Plots: {base_forest['Plot'].value_counts().to_dict()}")
    print(f"  Top species: {base_forest['Species'].value_counts().head(5).to_dict()}")
    
    # 2. Run diagnostics
    print("\n2. Running DBH progression diagnostics...")
    diagnose_dbh_progression(base_forest, years=10, sample_n=10)
    
    # 3. Generate snapshots
    print("\n3. Generating forest snapshots...")
    generate_forest_snapshots(
        years_list=[0, 5, 10, 20],
        output_dir="Data/Processed Data/forest_snapshots",
        enforce_monotonic_dbh=True,
        max_annual_shrink_cm=0.0
    )
    
    print("\n" + "="*60)
    print("SIMULATION COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("  - Compare NN snapshots with XGBoost snapshots")
    print("  - Evaluate trajectory smoothness")
    print("  - Check for absence of fixed points and hard ceilings")

