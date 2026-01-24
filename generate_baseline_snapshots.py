"""
Generate baseline forest snapshots for default simulation mode.

This script generates snapshots using baseline-only simulation (with guardrail)
and baseline_stochastic mode for visual realism.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from config import PROCESSED_DATA_DIR, ensure_dir
from models.forest_snapshots import generate_forest_snapshots


def main():
    """
    Generate baseline snapshots for both deterministic and stochastic modes.
    """
    print("="*70)
    print("GENERATING BASELINE FOREST SNAPSHOTS")
    print("="*70)
    
    years_list = [0, 5, 10, 20]
    
    # Generate baseline (deterministic) snapshots
    print("\n" + "="*70)
    print("GENERATING BASELINE (DETERMINISTIC) SNAPSHOTS")
    print("="*70)
    
    baseline_output_dir = PROCESSED_DATA_DIR / "forest_snapshots_baseline"
    generate_forest_snapshots(
        years_list=years_list,
        output_dir=baseline_output_dir,
        mode="baseline"
    )
    
    # Generate baseline_stochastic snapshots
    print("\n" + "="*70)
    print("GENERATING BASELINE_STOCHASTIC SNAPSHOTS")
    print("="*70)
    
    stochastic_output_dir = PROCESSED_DATA_DIR / "forest_snapshots_baseline_stochastic"
    generate_forest_snapshots(
        years_list=years_list,
        output_dir=stochastic_output_dir,
        mode="baseline_stochastic",
        seed=123  # Fixed seed for reproducibility
    )
    
    print("\n" + "="*70)
    print("SNAPSHOT GENERATION COMPLETE")
    print("="*70)
    print(f"\nBaseline snapshots: {baseline_output_dir}")
    print(f"Stochastic snapshots: {stochastic_output_dir}")
    print("\n✓ All snapshots generated successfully!")


if __name__ == "__main__":
    main()
