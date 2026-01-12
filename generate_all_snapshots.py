"""
Generate forest snapshots for every year from 0 to 20.

This script creates snapshots for years 0, 1, 2, ..., 20 to enable
smooth year-by-year visualization in the web app.
"""

import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from models.forest_snapshots_nn import generate_forest_snapshots
from config import PROCESSED_DATA_DIR

if __name__ == "__main__":
    # Generate snapshots for every year from 0 to 20
    years_list = list(range(0, 21))  # [0, 1, 2, ..., 20]
    
    output_dir = PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    
    print("="*70)
    print("Generating Forest Snapshots for Years 0-20")
    print("="*70)
    print(f"Output directory: {output_dir}")
    print(f"Years to generate: {years_list}")
    print("="*70)
    
    results = generate_forest_snapshots(
        years_list=years_list,
        output_dir=output_dir,
        model_type="nn_state",
        simulation_mode="epsilon",
        epsilon_cm=0.02
    )
    
    print("\n" + "="*70)
    print("Snapshot Generation Complete!")
    print("="*70)
    print(f"Generated {len(years_list)} snapshots")
    print(f"Output directory: {output_dir}")
    print("\nFiles created:")
    for year in years_list:
        snapshot_file = output_dir / f"forest_nn_{year}_years.csv"
        if snapshot_file.exists():
            print(f"  ✓ {snapshot_file.name}")
        else:
            print(f"  ✗ {snapshot_file.name} (missing)")
