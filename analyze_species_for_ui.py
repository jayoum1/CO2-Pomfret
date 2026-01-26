"""
Generate comprehensive species statistics for refining Forest Modification UI.
Outputs summary statistics and prepares data for R visualization.
"""
import pandas as pd
import sys
from pathlib import Path
sys.path.insert(0, 'src')
from config import CARBON_ALL_PLOTS, MODELS_DIR, PROCESSED_DATA_DIR

# Load data
print("Loading dataset...")
df = pd.read_csv(CARBON_ALL_PLOTS)
baseline_curves = pd.read_csv(MODELS_DIR / 'baseline_growth_bins.csv')

# Get unique species with curves
species_with_curves = set(baseline_curves['Species'].unique())

print(f"Total records: {len(df):,}")
print(f"Unique trees: {df['TreeID'].nunique():,}")
print(f"Unique species: {df['Species'].nunique()}")
print(f"Species with baseline curves: {len(species_with_curves)}\n")

# Calculate species statistics
species_stats = []

for species in sorted(df['Species'].unique()):
    species_df = df[df['Species'] == species]
    
    # Basic counts
    n_records = len(species_df)
    n_trees = species_df['TreeID'].nunique()
    n_years = species_df['Year'].nunique()
    
    # DBH statistics
    dbh_stats = species_df['DBH_cm'].describe()
    
    # Plot distribution
    plot_dist = species_df['Plot'].value_counts().to_dict()
    
    # Year range
    year_range = (species_df['Year'].min(), species_df['Year'].max())
    
    # Has baseline curve?
    has_curve = species in species_with_curves
    
    # Average records per tree
    avg_records_per_tree = n_records / n_trees if n_trees > 0 else 0
    
    species_stats.append({
        'Species': species,
        'n_records': n_records,
        'n_trees': n_trees,
        'n_years': n_years,
        'avg_records_per_tree': round(avg_records_per_tree, 2),
        'dbh_min': round(dbh_stats['min'], 2),
        'dbh_mean': round(dbh_stats['mean'], 2),
        'dbh_median': round(dbh_stats['50%'], 2),
        'dbh_max': round(dbh_stats['max'], 2),
        'dbh_std': round(dbh_stats['std'], 2),
        'plot_upper': plot_dist.get('Upper', 0),
        'plot_middle': plot_dist.get('Middle', 0),
        'plot_lower': plot_dist.get('Lower', 0),
        'year_min': int(year_range[0]),
        'year_max': int(year_range[1]),
        'has_baseline_curve': has_curve,
        'recommended_for_ui': has_curve and n_trees >= 5  # At least 5 trees and has curve
    })

# Create summary dataframe
summary_df = pd.DataFrame(species_stats)
summary_df = summary_df.sort_values('n_records', ascending=False)

# Save summary
output_dir = PROCESSED_DATA_DIR / 'diagnostics'
output_dir.mkdir(parents=True, exist_ok=True)
summary_path = output_dir / 'species_summary_for_ui.csv'
summary_df.to_csv(summary_path, index=False)
print(f"Saved species summary to: {summary_path}")

# Print summary
print("\n" + "="*100)
print("SPECIES SUMMARY FOR FOREST MODIFICATION UI")
print("="*100)
print(f"\n{'Species':<25} {'Trees':<8} {'Records':<10} {'DBH Range':<20} {'Curves':<8} {'UI Rec':<8}")
print("-"*100)

for _, row in summary_df.iterrows():
    dbh_range = f"{row['dbh_min']:.1f}-{row['dbh_max']:.1f}"
    curves = "✓" if row['has_baseline_curve'] else "✗"
    ui_rec = "✓" if row['recommended_for_ui'] else "✗"
    print(f"{row['Species']:<25} {row['n_trees']:<8} {row['n_records']:<10} {dbh_range:<20} {curves:<8} {ui_rec:<8}")

print("\n" + "="*100)
print("RECOMMENDATIONS FOR UI:")
print("="*100)

recommended = summary_df[summary_df['recommended_for_ui']].copy()
print(f"\n✓ Recommended species ({len(recommended)}):")
for _, row in recommended.iterrows():
    print(f"  - {row['Species']} ({row['n_trees']} trees, {row['n_records']} records)")

has_curves_but_low_data = summary_df[(summary_df['has_baseline_curve']) & (~summary_df['recommended_for_ui'])].copy()
if len(has_curves_but_low_data) > 0:
    print(f"\n⚠ Species with curves but low data (<5 trees):")
    for _, row in has_curves_but_low_data.iterrows():
        print(f"  - {row['Species']} ({row['n_trees']} trees, {row['n_records']} records)")

no_curves = summary_df[~summary_df['has_baseline_curve']].copy()
if len(no_curves) > 0:
    print(f"\n✗ Species without baseline curves (cannot simulate):")
    for _, row in no_curves.iterrows():
        print(f"  - {row['Species']} ({row['n_trees']} trees, {row['n_records']} records)")

# Prepare data for R visualization
r_data_path = output_dir / 'species_for_r_visualization.csv'
summary_df.to_csv(r_data_path, index=False)
print(f"\nData prepared for R visualization: {r_data_path}")

# Also create a plot distribution file
plot_dist_data = []
for species in sorted(df['Species'].unique()):
    species_df = df[df['Species'] == species]
    for plot in ['Upper', 'Middle', 'Lower']:
        plot_df = species_df[species_df['Plot'] == plot]
        plot_dist_data.append({
            'Species': species,
            'Plot': plot,
            'n_trees': plot_df['TreeID'].nunique(),
            'n_records': len(plot_df)
        })

plot_dist_df = pd.DataFrame(plot_dist_data)
plot_dist_path = output_dir / 'species_plot_distribution.csv'
plot_dist_df.to_csv(plot_dist_path, index=False)
print(f"Plot distribution data: {plot_dist_path}")

print("\n✓ Analysis complete!")
