# Plot Areas Configuration

This directory contains configuration files for the Forest Impact Generalizer.

## Setting Plot Areas

To enable area scaling calculations, you need to set the plot areas in `plot_areas.json`.

### File Structure

```json
{
  "Upper": {"area_m2": null},
  "Middle": {"area_m2": null},
  "Lower": {"area_m2": null}
}
```

### How to Set Plot Areas

1. Open `plot_areas.json` in this directory
2. Replace `null` with the actual area in square meters for each plot
3. Save the file

Example:
```json
{
  "Upper": {"area_m2": 5000},
  "Middle": {"area_m2": 4500},
  "Lower": {"area_m2": 4800}
}
```

### Area Units

All areas must be specified in **square meters (m²)**.

Common conversions:
- 1 hectare = 10,000 m²
- 1 acre ≈ 4,046.86 m²

### Requirements

- **Single plot reference**: Only that plot's area needs to be set
- **Average of plots**: All three plot areas must be set
- **Range (Min-Max)**: At least 2 plot areas must be set

### After Setting Areas

The Forest Impact Generalizer will automatically use these areas for:
- Computing carbon densities (kg C/m²)
- Computing tree densities (trees/m²)
- Scaling to target areas
- Calculating sequestration rates

No server restart is required - the API reads the file on each request.
