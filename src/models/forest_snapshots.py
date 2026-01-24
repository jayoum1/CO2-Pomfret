"""
Forest-Wide Simulation Module for Generating Snapshots

Provides functions to simulate all trees in a forest forward in time and generate
CSV snapshots for visualization and analysis.

This module is separate from forest_simulation.py (which handles single-tree trajectories)
and focuses on forest-wide operations: simulating all trees together and exporting
snapshots at multiple time points.

DESIGN PHILOSOPHY:
    This module implements a discrete-time simulation where:
    1. We treat the growth model as a one-year step function
    2. To simulate N years, we apply the one-year step N times iteratively
    3. Each tree's DBH is updated year by year: DBH_{t+1} = f(DBH_t, species, plot, ...)
    
    FUNCTION COMPOSITION:
        The simulation uses function composition to chain together:
        - encoding.py: Maps tree attributes (species, plot, DBH) → feature vector
        - dbh_growth_model.py: Predicts next year's DBH from features
        - forest_metrics.py: Converts DBH to carbon metrics
    
    IMMUTABILITY:
        We keep the simulation "pure" by returning new DataFrames instead of mutating
        in-place. This makes it easier to reason about simulation steps and allows
        us to keep snapshots at different time points.
    
    DECOUPLING:
        By exporting snapshots to CSV files, we decouple:
        - Modeling backend (this module) from
        - Visualization frontend (R plots, web app, 3D visualization)
        This allows different tools to read the same snapshot files without
        needing to run the simulation themselves.
"""

import sys
from pathlib import Path
from typing import List, Optional
import pandas as pd
import numpy as np

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS, PROCESSED_DATA_DIR, ensure_dir
from models.dbh_growth_model import predict_dbh_next_year
from models.forest_metrics import carbon_from_dbh
from models.baseline_simulation import predict_dbh_next_year_sim


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
    Diagnostic function to check DBH progression during simulation.
    
    Runs the year-by-year simulation and prints:
      - mean DBH each year
      - mean delta (DBH_{t+1}-DBH_t)
      - % exactly zero delta
      - % abs(delta) < 1e-6
      - % abs(delta) < 0.01
      - number of unique predicted DBH values each year
    Also prints a few random example tree trajectories to confirm progression.
    
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
    print("DBH PROGRESSION DIAGNOSTIC")
    print("="*70)
    
    # Track statistics per year
    current = base_forest.copy()
    
    # Count warnings
    species_warning_count = 0
    plot_warning_count = 0
    
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
        
        # Simulate one year (with silent=False to count warnings)
        next_state = simulate_forest_one_year(current, silent=False)
        
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
    
    # Feature activation check
    print(f"\n{'='*70}")
    print("Feature Activation Check (sample rows):")
    print("="*70)
    
    # Check a few random rows
    sample_indices = np.random.choice(len(base_forest), size=min(5, len(base_forest)), replace=False)
    for idx in sample_indices:
        row = base_forest.iloc[idx]
        treeid = row['TreeID']
        species = row['Species']
        plot = row['Plot']
        dbh = row['DBH_cm']
        
        # Call predict_dbh_next_year with return_warnings to inspect features
        try:
            result = predict_dbh_next_year(
                prev_dbh_cm=dbh,
                species=species,
                plot=plot,
                gap_years=1.0,
                silent=True,
                return_warnings=True
            )
            predicted_dbh, species_warn, plot_warn, feature_dict = result
            
            # Find nonzero features
            nonzero_features = {k: v for k, v in feature_dict.items() if abs(v) > 1e-6}
            
            print(f"\nTreeID {treeid} ({species}, {plot}):")
            print(f"  DBH: {dbh:.6f} → Predicted: {predicted_dbh:.6f}")
            print(f"  Species warning: {species_warn}, Plot warning: {plot_warn}")
            print(f"  Nonzero features ({len(nonzero_features)}):")
            for feat, val in sorted(nonzero_features.items()):
                print(f"    {feat}: {val}")
        except Exception as e:
            print(f"\nTreeID {treeid}: Error checking features: {e}")
    
    print("\n" + "="*70)


def simulate_forest_one_year(
    forest_df: pd.DataFrame, 
    silent: bool = True,
    mode: str = "baseline",
    seed: Optional[int] = None
) -> pd.DataFrame:
    """
    Simulate the forest forward by exactly one year.
    
    For each tree:
    - Use its current DBH_cm (prev_dbh) as input to predict next year's DBH
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
    mode : str
        Simulation mode: "baseline" (default), "baseline_stochastic", or "hybrid" (legacy)
    seed : int, optional
        Random seed for stochastic mode (for reproducibility)
    
    Returns
    -------
    pd.DataFrame
        New DataFrame representing the forest state after one year, with updated:
        - DBH_cm: Next year's DBH (predicted, represents DBH at end of year)
        - carbon_at_time: Carbon storage at end of year (corresponds to DBH_cm)
        - All original columns are preserved
    """
    # Create a copy to avoid mutating the input
    result_df = forest_df.copy()
    
    if not silent:
        print(f"Simulating {len(result_df):,} trees forward one year (mode: {mode})...")
    
    # Setup RNG for stochastic mode
    rng = None
    if mode == "baseline_stochastic" and seed is not None:
        rng = np.random.default_rng(seed)
    elif mode == "baseline_stochastic":
        rng = np.random.default_rng()
    
    # Apply the one-year growth model to each tree
    dbh_next_list = []
    carbon_at_time_list = []
    
    for idx, row in result_df.iterrows():
        # prev_dbh: DBH at the start of the year (current state)
        prev_dbh = row['DBH_cm']
        species = row['Species']
        plot = row['Plot']
        
        # Predict next year's DBH based on mode
        if mode in ["baseline", "baseline_stochastic"]:
            # Use baseline simulation
            next_dbh = predict_dbh_next_year_sim(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0,
                mode=mode,
                rng=rng
            )
        else:
            # Legacy hybrid mode (fallback to old function)
            next_dbh = predict_dbh_next_year(
                prev_dbh_cm=prev_dbh,
                species=species,
                plot=plot,
                gap_years=1.0,
                silent=silent
            )
        
        # Compute carbon metrics
        carbon_now = carbon_from_dbh(prev_dbh, species)
        carbon_at_time = carbon_from_dbh(next_dbh, species)
        
        dbh_next_list.append(next_dbh)
        carbon_at_time_list.append(carbon_at_time)
    
    # Update the DataFrame with new values
    result_df['DBH_cm'] = dbh_next_list
    result_df['carbon_at_time'] = carbon_at_time_list
    
    if not silent:
        print(f"✓ Simulation complete. Mean DBH: {result_df['DBH_cm'].mean():.2f} cm")
    
    return result_df


def simulate_forest_years(
    base_forest_df: pd.DataFrame,
    years: int,
    mode: str = "baseline",
    seed: Optional[int] = None
) -> pd.DataFrame:
    """
    Simulate the forest forward for `years` discrete one-year steps.
    
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
    mode : str
        Simulation mode: "baseline" (default), "baseline_stochastic", or "hybrid" (legacy)
    seed : int, optional
        Random seed for stochastic mode (for reproducibility)
    
    Returns
    -------
    pd.DataFrame
        DataFrame representing the forest state after `years` years.
        Includes a 'years_ahead' column indicating the time offset from the base year.
        All trees' DBH_cm values have been updated to reflect growth over `years` years.
    """
    if years < 0:
        raise ValueError("years must be non-negative")
    
    if years == 0:
        # Return base forest with years_ahead=0
        result = base_forest_df.copy()
        result['years_ahead'] = 0
        return result
    
    print(f"\nSimulating forest forward {years} years (mode: {mode})...")
    print(f"Starting with {len(base_forest_df):,} trees")
    
    # Start with the base forest
    # IMPORTANT: Always start from base_forest_df, not from a previous simulation state
    current = base_forest_df.copy()
    
    # Setup RNG for stochastic mode (use same seed for all years for reproducibility)
    rng = None
    if mode == "baseline_stochastic" and seed is not None:
        rng = np.random.default_rng(seed)
    elif mode == "baseline_stochastic":
        rng = np.random.default_rng()
    
    # Apply the one-year step function exactly `years` times
    # This is a discrete-time simulation: each iteration represents one year
    for year_idx in range(years):
        # For stochastic mode, use a different seed for each year to ensure variation
        year_seed = seed + year_idx if (seed is not None and mode == "baseline_stochastic") else None
        current = simulate_forest_one_year(current, silent=True, mode=mode, seed=year_seed)
        # After each year, DBH_cm represents the DBH at that future time point
        # We use this updated DBH as input for the next iteration
    
    # Add years_ahead column to indicate time offset
    current['years_ahead'] = years
    
    print(f"\n✓ Simulation complete: {years} years forward")
    
    return current


def generate_forest_snapshots(
    years_list: List[int],
    base_year: int | None = None,
    output_dir: str | Path = None,
    mode: str = "baseline",
    seed: Optional[int] = None
) -> None:
    """
    Generate forest snapshots at multiple time points and save them to CSV files.
    
    For each value in `years_list` (e.g. [0, 5, 10, 20]):
    - Simulate the forest that many years into the future, starting from the base forest
    - Save a CSV snapshot to `output_dir`, e.g.:
      - forest_0_years.csv
      - forest_5_years.csv
      - forest_10_years.csv
    
    Each snapshot includes:
    - TreeID: Unique tree identifier
    - Plot: Plot name
    - Species: Species name
    - DBH_cm: DBH at that future time point
    - carbon_now: Carbon storage at that time point
    - carbon_future: Carbon storage one year later (for reference)
    - carbon_growth: Carbon growth rate at that time point
    - carbon_growth_rate: Relative carbon growth rate
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
    mode : str
        Simulation mode: "baseline" (default), "baseline_stochastic", or "hybrid" (legacy)
    seed : int, optional
        Random seed for stochastic mode (for reproducibility)
    """
    # Set default output directory
    if output_dir is None:
        output_dir = PROCESSED_DATA_DIR / "forest_snapshots"
    else:
        output_dir = Path(output_dir)
    
    # Ensure output directory exists
    ensure_dir(output_dir)
    print(f"Output directory: {output_dir}")
    
    # Validate years_list
    if not years_list:
        raise ValueError("years_list cannot be empty")
    if any(y < 0 for y in years_list):
        raise ValueError("All years in years_list must be >= 0")
    
    # Load base forest once (year 0)
    # This is the starting state for all simulations
    base_forest = load_base_forest_df(base_year=base_year)
    
    # Generate snapshots for each year
    print(f"\nGenerating snapshots for years: {years_list}")
    
    # Track mean DBH for consistency checking
    mean_dbh_by_year = {}
    
    # For each requested horizon, simulate from the base forest
    # IMPORTANT: Each simulation starts from base_forest, not from a previous simulation
    # This ensures that 10-year and 20-year snapshots are computed independently,
    # not chained from the 5-year state
    for years in sorted(years_list):
        print(f"\n{'='*60}")
        print(f"Generating snapshot: {years} years ahead")
        print(f"{'='*60}")
        
        # Simulate forest forward from base_forest
        # If years == 0, use base forest as-is
        # Otherwise, simulate exactly `years` steps from base_forest
        if years == 0:
            forest_snapshot = base_forest.copy()
            forest_snapshot['years_ahead'] = 0
        else:
            # Each call to simulate_forest_years starts from base_forest and applies
            # exactly `years` discrete one-year steps
            forest_snapshot = simulate_forest_years(base_forest, years, mode=mode, seed=seed)
        
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
        
        # Save to CSV
        filename = f"forest_{years}_years.csv"
        filepath = output_dir / filename
        cleaned_snapshot.to_csv(filepath, index=False)
        
        print(f"✓ Saved: {filepath}")
        print(f"  Trees: {len(cleaned_snapshot):,}")
        print(f"  Mean DBH: {cleaned_snapshot['DBH_cm'].mean():.2f} cm")
        print(f"  DBH range: {cleaned_snapshot['DBH_cm'].min():.2f} - {cleaned_snapshot['DBH_cm'].max():.2f} cm")
        print(f"  Total carbon: {cleaned_snapshot['carbon_at_time'].sum():.2f} kg C")
    
    # Consistency check: verify DBH progression
    print(f"\n{'='*60}")
    print("DBH Progression Check")
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
        elif dbh2 == dbh1:
            warnings.append(
                f"WARNING: Mean DBH is identical at {k1} years ({dbh1:.2f} cm) "
                f"and {k2} years ({dbh2:.2f} cm). Simulation may not be progressing."
            )
    
    if warnings:
        print("\n⚠ CONSISTENCY WARNINGS:")
        for warning in warnings:
            print(f"  {warning}")
    else:
        print("\n✓ DBH progression is consistent (monotonic or increasing)")
    
    print(f"\n{'='*60}")
    print("All snapshots generated successfully!")
    print(f"{'='*60}")


# ==============================================================================
# Example Usage and Testing
# ==============================================================================

if __name__ == "__main__":
    print("="*60)
    print("FOREST-WIDE SIMULATION EXAMPLE")
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
        output_dir="Data/Processed Data/forest_snapshots"
    )
    
    print("\n" + "="*60)
    print("SIMULATION COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("  - Use R scripts to visualize snapshots")
    print("  - Load snapshots in web app for interactive visualization")
    print("  - Use snapshots for 3D forest visualization")

