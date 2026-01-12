"""
Generate forest snapshots for every year from 0 to 20 using the main simulation function.

Option 2: Use the Main Simulation Function
"""

import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from models.forest_snapshots_nn import generate_forest_snapshots
from config import PROCESSED_DATA_DIR

if __name__ == "__main__":
    print("="*70)
    print("Generating Forest Snapshots for Years 0-20")
    print("Using Main Simulation Function")
    print("="*70)
    
    # Generate all years 0-20
    years_list = list(range(0, 21))  # [0, 1, 2, ..., 20]
    
    output_dir = PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    
    print(f"Years to generate: {len(years_list)} years")
    print(f"Output directory: {output_dir}")
    print("="*70)
    print()
    
    try:
        results = generate_forest_snapshots(
            years_list=years_list,
            output_dir=output_dir,
            model_type="nn_state",
            simulation_mode="epsilon",
            epsilon_cm=0.02
        )
        
        print()
        print("="*70)
        print("Snapshot Generation Complete!")
        print("="*70)
        print(f"Generated snapshots for {len(years_list)} years")
        print(f"Output directory: {output_dir}")
        print()
        print("Files created:")
        for year in years_list:
            snapshot_file = output_dir / f"forest_nn_{year}_years.csv"
            if snapshot_file.exists():
                file_size = snapshot_file.stat().st_size / 1024  # KB
                print(f"  ✓ {snapshot_file.name} ({file_size:.1f} KB)")
            else:
                print(f"  ✗ {snapshot_file.name} (missing)")
        print("="*70)
        
    except Exception as e:
        print()
        print("="*70)
        print("Error during snapshot generation")
        print("="*70)
        print(f"Error: {e}")
        print()
        print("Troubleshooting:")
        print("1. Ensure the neural network model is trained")
        print("2. Check that model files exist in Models/ directory")
        print("3. Verify data files are available")
        print("="*70)
        import traceback
        traceback.print_exc()
