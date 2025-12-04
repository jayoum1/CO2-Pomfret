import pandas as pd
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS, CARBON_ALL_PLOTS_ENCODED

# --- SET PATH ---
IN_PATH  = str(CARBON_ALL_PLOTS)
OUT_PATH = str(CARBON_ALL_PLOTS_ENCODED)

# Load dataset
df = pd.read_csv(IN_PATH)

# Identify categorical variables to encode
# TreeID SHOULD NOT be encoded (identifier only)
categorical_vars = ['Species', 'Plot', 'Group', 'GrowthType']

# Keep only those that actually exist in the dataframe
categorical_vars = [col for col in categorical_vars if col in df.columns]

print("Categorical variables to encode:", categorical_vars)

# One-hot encode
df_encoded = pd.get_dummies(
    df,
    columns=categorical_vars,
    drop_first=True,   # avoids multicollinearity for linear models
)

print("Original shape:", df.shape)
print("Encoded shape:", df_encoded.shape)

# Save encoded version
df_encoded.to_csv(OUT_PATH, index=False)

print("\nSaved encoded file to:")
print(OUT_PATH)

