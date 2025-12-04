import pandas as pd
import numpy as np
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    DBH_UPPER_LONG, DBH_MIDDLE_LONG, DBH_LOWER_LONG,
    CARBON_UPPER, CARBON_MIDDLE, CARBON_LOWER, CARBON_ALL_PLOTS,
    CO2E_FACTOR
)

# Import forestry domain functions
from forestry.species_classifier import classify_group
from forestry.allometry import dbh_to_carbon_from_inches


# ----------------------------------------------------------------------
# 3. Add carbon + carbon growth rate to a processed plot dataframe
# ----------------------------------------------------------------------

def add_carbon_and_carbon_growth(df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a processed long-format DF for one or more plots
    (with DBH-based growth and GapYears already computed),
    add:

        - DBH_cm
        - Group (hardwood / softwood)
        - Carbon
        - CO2e
        - PrevCarbon
        - CarbonGrowthRate

    Uses the same k-year annualized logic as for DBH.
    """
    df = df.copy()

    # Ensure proper sorting
    df = df.sort_values(['TreeID', 'Year'])

    # --- Convert DBH from inches to cm ---
    df['DBH_cm'] = df['DBH'] * 2.54

    # --- Species group (hardwood / softwood) ---
    df['Group'] = df['Species'].apply(classify_group)

    # --- Carbon per year ---
    # Use forestry.allometry module for DBH → Carbon conversion
    df['Carbon'] = dbh_to_carbon_from_inches(df['DBH'], df['Species'])

    # Also compute CO2 equivalent if you want it:
    df['CO2e'] = df['Carbon'] * CO2E_FACTOR

    # --- Previous carbon per tree ---
    df['PrevCarbon'] = df.groupby('TreeID')['Carbon'].shift()

    # --- Carbon growth rate (annualized over GapYears) ---
    df['CarbonGrowthRate'] = pd.NA

    # Use same GapYears as DBH growth logic
    valid = (
        df['PrevCarbon'].notna() &
        df['GapYears'].notna() &
        (df['GapYears'] > 0)
    )

    df.loc[valid, 'CarbonGrowthRate'] = (
        (df.loc[valid, 'Carbon'] - df.loc[valid, 'PrevCarbon']) /
        (df.loc[valid, 'GapYears'] * df.loc[valid, 'PrevCarbon'])
    )

    # First measurement per tree (PrevCarbon is NaN) stays as NA for CarbonGrowthRate.

    return df


# ----------------------------------------------------------------------
# 4. Load each processed plot, add carbon, save back out
# ----------------------------------------------------------------------

if __name__ == "__main__":
    upper_df  = pd.read_csv(str(DBH_UPPER_LONG))
    middle_df = pd.read_csv(str(DBH_MIDDLE_LONG))
    lower_df  = pd.read_csv(str(DBH_LOWER_LONG))

    upper_with_carbon  = add_carbon_and_carbon_growth(upper_df)
    middle_with_carbon = add_carbon_and_carbon_growth(middle_df)
    lower_with_carbon  = add_carbon_and_carbon_growth(lower_df)

    # Combine if you want a single full dataset:
    combined_with_carbon = pd.concat(
        [upper_with_carbon, middle_with_carbon, lower_with_carbon],
        ignore_index=True
    )

    # Save outputs
    upper_with_carbon.to_csv(str(CARBON_UPPER), index=False)
    middle_with_carbon.to_csv(str(CARBON_MIDDLE), index=False)
    lower_with_carbon.to_csv(str(CARBON_LOWER), index=False)
    combined_with_carbon.to_csv(str(CARBON_ALL_PLOTS), index=False)

