# Generating Yearly Snapshots (0-20 years)

## Current Status

The Next.js frontend now supports a **slider** that works with any available snapshots. Currently, snapshots exist for years: **0, 5, 10, 20**.

## Frontend Updates

✅ **Dashboard page** - Now uses a slider instead of buttons
✅ **Visualize page** - Updated with slider support
✅ **Dynamic year detection** - Automatically detects available years from API
✅ **Smooth transitions** - Slider snaps to closest available year

## Generating All Snapshots (0-20)

To generate snapshots for every year from 0 to 20, you have two options:

### Option 1: Use Existing Script (if model is trained)

```bash
python3 generate_yearly_snapshots.py
```

This will generate snapshots for years 0-20 in the `forest_snapshots_nn_epsilon` directory.

### Option 2: Use the Main Simulation Function

```python
from src.models.forest_snapshots_nn import generate_forest_snapshots
from config import PROCESSED_DATA_DIR

# Generate all years 0-20
years_list = list(range(0, 21))  # [0, 1, 2, ..., 20]

results = generate_forest_snapshots(
    years_list=years_list,
    output_dir=PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon",
    model_type="nn_state",
    simulation_mode="epsilon",
    epsilon_cm=0.02
)
```

### Option 3: Generate Incrementally

If you encounter memory or time issues, generate snapshots in batches:

```python
# Generate years 0-5
generate_forest_snapshots([0, 1, 2, 3, 4, 5], ...)

# Then 6-10
generate_forest_snapshots([6, 7, 8, 9, 10], ...)

# Then 11-15
generate_forest_snapshots([11, 12, 13, 14, 15], ...)

# Then 16-20
generate_forest_snapshots([16, 17, 18, 19, 20], ...)
```

## Expected Output

After generation, you should have files:
- `forest_nn_0_years.csv`
- `forest_nn_1_years.csv`
- `forest_nn_2_years.csv`
- ...
- `forest_nn_20_years.csv`

## Frontend Behavior

The slider will:
- Show all available years dynamically
- Snap to the closest available year when dragging
- Display quick-jump buttons for key years (0, 5, 10, 15, 20)
- Update charts and metrics in real-time

## API Endpoints

The backend automatically detects available snapshots:

- `GET /snapshots/years` - Returns list of available years
- `GET /summary?years_ahead=X` - Returns summary for any available year
- `GET /snapshots?years_ahead=X` - Returns full snapshot data

## Notes

- Generating 21 snapshots (0-20) may take 10-30 minutes depending on your system
- Each snapshot is generated independently from the base forest (not chained)
- The slider works with whatever snapshots are available - you don't need all 21
- For smoother visualization, having more snapshots (every year) is better
