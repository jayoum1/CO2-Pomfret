# R Visualization Pipeline

This directory contains R scripts for generating high-quality visualizations from forest simulation snapshots.

## Overview

The pipeline consists of two main scripts:
1. **load_snapshots.R**: Loads and combines all snapshot CSV files into a single dataset
2. **make_plots.R**: Generates 5 visualization plots from the combined data

## Data Source

Snapshots are read from:
```
Data/Processed Data/forest_snapshots_nn_epsilon/
```

Files expected:
- `forest_nn_0_years.csv`
- `forest_nn_5_years.csv`
- `forest_nn_10_years.csv`
- `forest_nn_20_years.csv`

## Usage

Run from the project root directory:

```bash
# Step 1: Load and combine snapshots
Rscript reports/r_visuals/load_snapshots.R

# Step 2: Generate plots
Rscript reports/r_visuals/make_plots.R
```

## Output Files

### Combined Dataset
- `reports/r_visuals/combined_snapshots.csv`: Combined dataset with all snapshots

### Generated Plots
All plots are saved to `reports/r_visuals/figures/`:

1. **total_carbon_vs_years.png**: Total forest carbon over time (line chart)
2. **mean_dbh_vs_years.png**: Mean DBH over time (line chart)
3. **dbh_distribution_by_year.png**: DBH distribution faceted by year (density plots)
4. **species_carbon_over_time.png**: Top 8 species contribution to carbon (stacked area chart)
5. **carbon_by_plot_over_time.png**: Total carbon by plot (Upper/Middle/Lower) over time (line chart)

## Dependencies

Required R packages:
- `readr`: Reading CSV files
- `dplyr`: Data manipulation
- `tidyr`: Data tidying
- `ggplot2`: Plotting
- `scales`: Formatting plot labels

Install with:
```r
install.packages(c("readr", "dplyr", "tidyr", "ggplot2", "scales"))
```

## Notes

- All plots use `theme_minimal()` for consistent styling
- Units are included in axis labels (DBH in cm, carbon in kg C)
- Plots are saved at 300 DPI for high-quality output
- The pipeline uses epsilon simulation mode snapshots

