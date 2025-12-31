"""
Script to generate snapshots using the increment model and compare with NN state model.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from models.forest_snapshots_nn import generate_forest_snapshots, load_base_forest_df
import pandas as pd

print("="*70)
print("GENERATING INCREMENT MODEL SNAPSHOTS")
print("="*70)

# Generate increment model snapshots
generate_forest_snapshots(
    years_list=[0, 5, 10, 20],
    output_dir="Data/Processed Data/forest_snapshots_xgb_increment",
    enforce_monotonic_dbh=True,
    max_annual_shrink_cm=0.0,
    model_type="xgb_increment"
)

print("\n" + "="*70)
print("COMPARISON: Increment Model vs NN State Model")
print("="*70)

# Load snapshots for comparison
comparison_data = []
for years in [0, 5, 10, 20]:
    # Increment model
    inc_path = f"Data/Processed Data/forest_snapshots_xgb_increment/forest_xgb_increment_{years}_years.csv"
    inc_df = pd.read_csv(inc_path)
    
    # NN state model
    nn_path = f"Data/Processed Data/forest_snapshots_nn_state/forest_nn_{years}_years.csv"
    if Path(nn_path).exists():
        nn_df = pd.read_csv(nn_path)
    else:
        # Use existing snapshots
        nn_path = f"Data/Processed Data/forest_snapshots/forest_nn_{years}_years.csv"
        nn_df = pd.read_csv(nn_path)
    
    comparison_data.append({
        'Years': years,
        'Increment_Mean_DBH': inc_df['DBH_cm'].mean(),
        'Increment_Total_Carbon': inc_df['carbon_at_time'].sum(),
        'NN_Mean_DBH': nn_df['DBH_cm'].mean(),
        'NN_Total_Carbon': nn_df['carbon_at_time'].sum()
    })

comparison_df = pd.DataFrame(comparison_data)
print("\nComparison Table:")
print(comparison_df.to_string(index=False))



