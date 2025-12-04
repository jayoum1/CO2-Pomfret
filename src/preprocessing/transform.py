import pandas as pd
import re
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    RAW_DATA_UPPER, RAW_DATA_MIDDLE, RAW_DATA_LOWER,
    DBH_UPPER_LONG, DBH_MIDDLE_LONG, DBH_LOWER_LONG
)

def transform_plot(path, plot_name):
    """
    Transform a raw DBH csv for one plot into long format with growth rates.

    Parameters
    ----------
    path : str
        Path to the CSV file (Upper / Middle / Lower).
    plot_name : str
        Name of the plot, e.g. 'Upper', 'Middle', 'Lower'.

    Returns
    -------
    pd.DataFrame
        Columns: ['Plot', 'TreeID', 'Species', 'Year', 'DBH',
                  'GapYears', 'PrevDBH', 'GrowthRate', 'GrowthType']
    """
    # --- 1. Load ---
    df = pd.read_csv(path)

    # --- 2. Identify TreeID and Species columns ---
    # (handles 'Tree ID Number', 'TREE ID', etc.)
    id_candidates = [c for c in df.columns
                     if 'tree' in c.lower() and 'id' in c.lower()]
    species_candidates = [c for c in df.columns
                          if 'species' in c.lower()]

    if not id_candidates:
        raise ValueError(f"Could not find a Tree ID column in {path}")
    if not species_candidates:
        raise ValueError(f"Could not find a Species column in {path}")

    tree_col = id_candidates[0]
    species_col = species_candidates[0]

    # Keep TreeID as string so things like '416 (was 683)' are preserved
    df[tree_col] = df[tree_col].astype(str)

    # --- 3. Identify DBH columns & map them to years ---
    dbh_cols = [c for c in df.columns if 'dbh' in c.lower()]
    year_map = {}  # year -> column name

    for col in dbh_cols:
        # Extract any 4-digit year starting with 20
        m = re.search(r'(20\d{2})', col)
        if m:
            year = int(m.group(1))
            # If there were duplicate years, last one would overwrite,
            # but in your data there should be only one per year.
            year_map[year] = col

    if not year_map:
        raise ValueError(f"No DBH year columns found in {path}")

    # --- 4. Subset and rename to a clean schema ---
    keep_cols = [tree_col, species_col] + list(year_map.values())
    df_small = df[keep_cols].copy()

    df_small = df_small.rename(columns={
        tree_col: 'TreeID',
        species_col: 'Species',
        **{col: f'DBH_{year}' for year, col in year_map.items()}
    })

    # --- 5. Wide -> Long (one row per tree per year) ---
    value_vars = [c for c in df_small.columns if c.startswith('DBH_')]
    df_long = df_small.melt(
        id_vars=['TreeID', 'Species'],
        value_vars=value_vars,
        var_name='DBH_Year',
        value_name='DBH'
    )

    # Extract numeric year from 'DBH_YYYY'
    df_long['Year'] = df_long['DBH_Year'].str.extract(r'(\d{4})').astype(int)
    df_long = df_long.drop(columns=['DBH_Year'])

    # Add plot label
    df_long['Plot'] = plot_name

    # Drop rows where DBH is missing (tree not measured that year)
    df_long = df_long.dropna(subset=['DBH']).copy()

    # --- 6. Sort for growth computation ---
    df_long = df_long.sort_values(['TreeID', 'Year'])

    # --- 7. Compute growth per tree ---
    def compute_growth(group: pd.DataFrame) -> pd.DataFrame:
        group = group.sort_values('Year').copy()

        # Gap in years from previous non-missing measurement
        group['GapYears'] = group['Year'].diff()

        # Previous DBH
        group['PrevDBH'] = group['DBH'].shift()

        # Initialize
        group['GrowthRate'] = pd.NA
        group['GrowthType'] = pd.NA

        # First measurement for each tree (no previous DBH)
        first_mask = group['PrevDBH'].isna()
        group.loc[first_mask, 'GrowthType'] = 'initial'

        # Subsequent measurements: annualized over k years
        mask = ~first_mask

        # (DBH_t - DBH_prev) / (k * DBH_prev)
        group.loc[mask, 'GrowthRate'] = (
            (group.loc[mask, 'DBH'] - group.loc[mask, 'PrevDBH']) /
            (group.loc[mask, 'GapYears'] * group.loc[mask, 'PrevDBH'])
        )

        # Normal vs annualized labels
        group.loc[mask & (group['GapYears'] == 1), 'GrowthType'] = 'normal'
        group.loc[mask & (group['GapYears'] > 1), 'GrowthType'] = 'annualized'

        return group

    df_out = df_long.groupby('TreeID', group_keys=False).apply(compute_growth)

    # Reorder columns for readability
    df_out = df_out[[
        'Plot', 'TreeID', 'Species', 'Year', 'DBH',
        'GapYears', 'PrevDBH', 'GrowthRate', 'GrowthType'
    ]]

    return df_out

# --- Example usage for each dataset individually ---

if __name__ == "__main__":
    upper_transformed = transform_plot(str(RAW_DATA_UPPER), "Upper")
    middle_transformed = transform_plot(str(RAW_DATA_MIDDLE), "Middle")
    lower_transformed = transform_plot(str(RAW_DATA_LOWER), "Lower")

    # Optionally, save each one:
    upper_transformed.to_csv(str(DBH_UPPER_LONG), index=False)
    middle_transformed.to_csv(str(DBH_MIDDLE_LONG), index=False)
    lower_transformed.to_csv(str(DBH_LOWER_LONG), index=False)

