import pandas as pd
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS

DATA_PATH = str(CARBON_ALL_PLOTS)

df = pd.read_csv(DATA_PATH)

# Ensure GapYears and Carbon columns exist
if not {"GapYears", "Carbon", "PrevCarbon"}.issubset(df.columns):
    raise ValueError("Expected columns 'GapYears', 'Carbon', 'PrevCarbon' not all found.")

df['CarbonGrowth'] = pd.NA

# Valid rows: have previous carbon and a positive gap
mask = df['PrevCarbon'].notna() & df['GapYears'].notna() & (df['GapYears'] > 0)

df.loc[mask, 'CarbonGrowth'] = (
    (df.loc[mask, 'Carbon'] - df.loc[mask, 'PrevCarbon']) /
    df.loc[mask, 'GapYears']
)

# First measurements (PrevCarbon NaN) stay NaN for CarbonGrowth
print("New column 'CarbonGrowth' created. Example:")
print(df[['Plot', 'TreeID', 'Year', 'Carbon', 'PrevCarbon', 'GapYears', 'CarbonGrowth']].head(10))

# Overwrite or save new – up to you:
df.to_csv(DATA_PATH, index=False)

