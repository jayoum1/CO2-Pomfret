#!/usr/bin/env python3
"""
Data Quality Check Script for Carbon DBH Project

Run this after installing packages to verify data integrity.
"""
import pandas as pd
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))
from config import (
    CARBON_UPPER, CARBON_MIDDLE, CARBON_LOWER, CARBON_ALL_PLOTS,
    CARBON_ALL_PLOTS_ENCODED
)


def check_data_quality():
    """Comprehensive data quality check."""
    
    print("=" * 70)
    print("DATA QUALITY CHECK")
    print("=" * 70)
    
    # Check 1: File existence
    print("\n1. Checking file existence...")
    files_to_check = {
        'Upper': CARBON_UPPER,
        'Middle': CARBON_MIDDLE,
        'Lower': CARBON_LOWER,
        'All Plots': CARBON_ALL_PLOTS,
        'Encoded': CARBON_ALL_PLOTS_ENCODED,
    }
    
    all_exist = True
    for name, path in files_to_check.items():
        if path.exists():
            print(f"   ✓ {name}: {path.name}")
        else:
            print(f"   ✗ {name}: NOT FOUND at {path}")
            all_exist = False
    
    if not all_exist:
        print("\n⚠ Some files are missing. Run preprocessing scripts first.")
        return
    
    # Check 2: Row counts
    print("\n2. Checking row counts...")
    try:
        upper = pd.read_csv(str(CARBON_UPPER))
        middle = pd.read_csv(str(CARBON_MIDDLE))
        lower = pd.read_csv(str(CARBON_LOWER))
        all_plots = pd.read_csv(str(CARBON_ALL_PLOTS))
        
        print(f"   Upper:   {len(upper):,} rows")
        print(f"   Middle:  {len(middle):,} rows")
        print(f"   Lower:   {len(lower):,} rows")
        print(f"   Total:   {len(upper) + len(middle) + len(lower):,} rows")
        print(f"   Combined: {len(all_plots):,} rows")
        
        total_individual = len(upper) + len(middle) + len(lower)
        if total_individual == len(all_plots):
            print(f"   ✓ Row counts match!")
        else:
            diff = abs(total_individual - len(all_plots))
            print(f"   ⚠ Row count mismatch: {diff} rows difference")
            print(f"      This might be due to filtering or data cleaning.")
    except Exception as e:
        print(f"   ✗ Error reading files: {e}")
        return
    
    # Check 3: Required columns
    print("\n3. Checking required columns...")
    required = ['Plot', 'TreeID', 'Species', 'Year', 'DBH', 'Carbon']
    missing = [col for col in required if col not in all_plots.columns]
    if not missing:
        print(f"   ✓ All required columns present")
        print(f"   Columns: {', '.join(all_plots.columns[:10])}...")
    else:
        print(f"   ⚠ Missing columns: {missing}")
    
    # Check 4: Duplicates
    print("\n4. Checking for duplicates...")
    duplicates = all_plots.duplicated(subset=['TreeID', 'Year', 'Plot'], keep=False)
    if not duplicates.any():
        print(f"   ✓ No duplicate TreeID-Year-Plot combinations")
    else:
        print(f"   ⚠ Found {duplicates.sum()} duplicate TreeID-Year-Plot combinations")
        print(f"      First few duplicates:")
        print(all_plots[duplicates][['Plot', 'TreeID', 'Year']].head())
    
    # Check 5: Carbon values
    print("\n5. Checking Carbon values...")
    carbon = all_plots['Carbon']
    print(f"   Min:  {carbon.min():.2f}")
    print(f"   Max:  {carbon.max():.2f}")
    print(f"   Mean: {carbon.mean():.2f}")
    print(f"   NaN:  {carbon.isna().sum()} ({carbon.isna().sum()/len(carbon)*100:.1f}%)")
    
    # Check for negative or zero carbon (shouldn't happen)
    negative = (carbon < 0).sum()
    zero = (carbon == 0).sum()
    if negative > 0:
        print(f"   ⚠ Found {negative} negative Carbon values")
    if zero > 0:
        print(f"   ⚠ Found {zero} zero Carbon values")
    
    # Check 6: Encoded file
    print("\n6. Checking encoded file...")
    try:
        encoded = pd.read_csv(str(CARBON_ALL_PLOTS_ENCODED))
        if len(encoded) == len(all_plots):
            print(f"   ✓ Encoded file has {len(encoded):,} rows (matches original)")
            print(f"   ✓ Encoded file has {encoded.shape[1]} columns (expanded from {all_plots.shape[1]})")
            
            # Check for one-hot encoded columns
            species_cols = [c for c in encoded.columns if c.startswith('Species_')]
            plot_cols = [c for c in encoded.columns if c.startswith('Plot_')]
            if species_cols:
                print(f"   ✓ Found {len(species_cols)} Species_* columns")
            if plot_cols:
                print(f"   ✓ Found {len(plot_cols)} Plot_* columns")
        else:
            print(f"   ⚠ Row count mismatch: {len(encoded)} vs {len(all_plots)}")
    except Exception as e:
        print(f"   ✗ Error reading encoded file: {e}")
    
    # Check 7: Plot distribution
    print("\n7. Checking plot distribution...")
    if 'Plot' in all_plots.columns:
        plot_counts = all_plots['Plot'].value_counts()
        print(f"   Plot distribution:")
        for plot, count in plot_counts.items():
            print(f"     {plot}: {count:,} rows ({count/len(all_plots)*100:.1f}%)")
    
    # Check 8: Year range
    print("\n8. Checking year range...")
    if 'Year' in all_plots.columns:
        years = sorted(all_plots['Year'].unique())
        print(f"   Years: {years}")
        print(f"   Year range: {min(years)} - {max(years)}")
    
    # Check 9: Species distribution
    print("\n9. Checking species distribution...")
    if 'Species' in all_plots.columns:
        top_species = all_plots['Species'].value_counts().head(10)
        print(f"   Top 10 species:")
        for species, count in top_species.items():
            print(f"     {species}: {count:,} rows")
    
    print("\n" + "=" * 70)
    print("Data quality check complete!")
    print("=" * 70)


if __name__ == "__main__":
    check_data_quality()

