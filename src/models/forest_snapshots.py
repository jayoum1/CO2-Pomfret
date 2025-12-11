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
from typing import List
import pandas as pd
import numpy as np

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS, PROCESSED_DATA_DIR, ensure_dir
from models.dbh_growth_model import predict_dbh_next_year
from models.forest_metrics import carbon_from_dbh


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


def simulate_forest_one_year(forest_df: pd.DataFrame) -> pd.DataFrame:
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
    
    print(f"Simulating {len(result_df):,} trees forward one year...")
    
    # Apply the one-year growth model to each tree
    # We iterate row-by-row for clarity, though this could be vectorized later
    # if performance becomes an issue
    dbh_next_list = []
    carbon_at_time_list = []
    
    for idx, row in result_df.iterrows():
        # prev_dbh: DBH at the start of the year (current state)
        prev_dbh = row['DBH_cm']
        species = row['Species']
        plot = row['Plot']
        
        # Predict next year's DBH using the growth model
        # This internally uses encoding.py to build the feature vector
        next_dbh = predict_dbh_next_year(
            prev_dbh_cm=prev_dbh,
            species=species,
            plot=plot,
            gap_years=1.0
        )
        
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
    
    print(f"✓ Simulation complete. Mean DBH: {result_df['DBH_cm'].mean():.2f} cm")
    
    return result_df


def simulate_forest_years(
    base_forest_df: pd.DataFrame,
    years: int
) -> pd.DataFrame:
    """
    Simulate the forest forward for a given number of years by repeatedly applying
    `simulate_forest_one_year`.
    
    This function implements the iterative application of the one-year step function.
    It starts from the base forest state and applies the growth model N times,
    where N = years.
    
    Parameters
    ----------
    base_forest_df : pd.DataFrame
        Starting forest state (year 0). Must have columns: TreeID, Plot, Species, DBH_cm
    years : int
        Number of years to simulate (must be >= 0)
        If years=0, returns the base forest unchanged
    
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
    
    print(f"\nSimulating forest forward {years} years...")
    print(f"Starting with {len(base_forest_df):,} trees")
    
    # Start with the base forest
    current_forest = base_forest_df.copy()
    
    # Apply the one-year step function N times
    for year in range(years):
        print(f"  Year {year + 1}/{years}...", end=" ")
        current_forest = simulate_forest_one_year(current_forest)
        # After each year, DBH_cm represents the DBH at that future time point
        # We use this updated DBH as input for the next iteration
    
    # Add years_ahead column to indicate time offset
    current_forest['years_ahead'] = years
    
    print(f"\n✓ Simulation complete: {years} years forward")
    
    return current_forest


def generate_forest_snapshots(
    years_list: List[int],
    base_year: int | None = None,
    output_dir: str | Path = None
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
    
    # Load base forest
    base_forest = load_base_forest_df(base_year=base_year)
    
    # Generate snapshots for each year
    print(f"\nGenerating snapshots for years: {years_list}")
    
    for years in sorted(years_list):
        print(f"\n{'='*60}")
        print(f"Generating snapshot: {years} years ahead")
        print(f"{'='*60}")
        
        # Simulate forest forward
        forest_snapshot = simulate_forest_years(base_forest, years)
        
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
    
    # 2. Simulate 10 years
    print("\n2. Simulating forest forward 10 years...")
    forest_10_years = simulate_forest_years(base_forest, years=10)
    
    print("\nForest after 10 years summary:")
    print(f"  Number of trees: {len(forest_10_years):,}")
    print(f"  Mean DBH: {forest_10_years['DBH_cm'].mean():.2f} cm")
    print(f"  DBH range: {forest_10_years['DBH_cm'].min():.2f} - {forest_10_years['DBH_cm'].max():.2f} cm")
    if 'carbon_at_time' in forest_10_years.columns:
        print(f"  Total carbon: {forest_10_years['carbon_at_time'].sum():.2f} kg C")
    
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

