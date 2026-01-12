"""
Generate forest snapshots for every year from 0 to 20.

This script generates snapshots incrementally, one year at a time,
to enable smooth year-by-year visualization in the web app.
"""

import sys
from pathlib import Path
import pandas as pd

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from models.forest_snapshots_nn import (
    load_base_forest_df,
    simulate_forest_years,
    ensure_dir
)
from models.forest_metrics import carbon_from_dbh
from config import PROCESSED_DATA_DIR

def generate_single_snapshot(year: int, base_forest: pd.DataFrame, output_dir: Path) -> bool:
    """Generate a single snapshot for a given year."""
    try:
        if year == 0:
            # Year 0: use base forest as-is
            snapshot = base_forest.copy()
            snapshot['years_ahead'] = 0
            if 'carbon_at_time' not in snapshot.columns:
                snapshot['carbon_at_time'] = snapshot.apply(
                    lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
                    axis=1
                )
        else:
            # Simulate forward from base forest
            snapshot, _, _, _ = simulate_forest_years(
                base_forest,
                year,
                enforce_monotonic_dbh=True,
                max_annual_shrink_cm=0.0,
                print_diagnostics=False,
                model_type="nn_state",
                simulation_mode="epsilon",
                epsilon_cm=0.02
            )
        
        # Ensure required columns
        required_cols = ['TreeID', 'Plot', 'Species', 'DBH_cm', 'carbon_at_time', 'years_ahead']
        for col in required_cols:
            if col not in snapshot.columns:
                if col == 'carbon_at_time':
                    snapshot['carbon_at_time'] = snapshot.apply(
                        lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
                        axis=1
                    )
                elif col == 'years_ahead':
                    snapshot['years_ahead'] = year
        
        # Save snapshot
        output_file = output_dir / f"forest_nn_{year}_years.csv"
        snapshot[required_cols].to_csv(output_file, index=False)
        
        print(f"✓ Year {year:2d}: {len(snapshot):,} trees, "
              f"Mean DBH: {snapshot['DBH_cm'].mean():.2f} cm, "
              f"Total Carbon: {snapshot['carbon_at_time'].sum():,.0f} kg C")
        
        return True
    except Exception as e:
        print(f"✗ Year {year:2d}: Error - {e}")
        return False

if __name__ == "__main__":
    # Configuration
    years_list = list(range(0, 21))  # [0, 1, 2, ..., 20]
    output_dir = PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    ensure_dir(output_dir)
    
    print("="*70)
    print("Generating Forest Snapshots for Years 0-20")
    print("="*70)
    print(f"Output directory: {output_dir}")
    print(f"Years to generate: {len(years_list)} years")
    print("="*70)
    print()
    
    # Load base forest once
    print("Loading base forest...")
    base_forest = load_base_forest_df()
    print(f"Loaded {len(base_forest):,} trees")
    print()
    
    # Generate snapshots one by one
    success_count = 0
    failed_years = []
    
    for year in years_list:
        success = generate_single_snapshot(year, base_forest, output_dir)
        if success:
            success_count += 1
        else:
            failed_years.append(year)
    
    # Summary
    print()
    print("="*70)
    print("Summary")
    print("="*70)
    print(f"Successfully generated: {success_count}/{len(years_list)} snapshots")
    if failed_years:
        print(f"Failed years: {failed_years}")
    print(f"Output directory: {output_dir}")
    print("="*70)
