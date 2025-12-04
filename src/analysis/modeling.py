import pandas as pd
import numpy as np
import sys
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn import metrics

from scipy import stats       # For ANOVA
import statsmodels.api as sm  # Optional: more detailed ANOVA if needed
import statsmodels.formula.api as smf

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_ALL_PLOTS_ENCODED

# ------------------------------------------------------------
# 1. Load dataset
# ------------------------------------------------------------

DATA_PATH = str(CARBON_ALL_PLOTS_ENCODED)
df = pd.read_csv(DATA_PATH)

print("Data shape:", df.shape)
print("Columns:", df.columns.tolist())

# ------------------------------------------------------------
# 1b. Create PrevDBH_cm from DBH_cm
# ------------------------------------------------------------

df = df.sort_values(['TreeID', 'Year'])

if 'DBH_cm' in df.columns:
    df['PrevDBH_cm'] = df.groupby('TreeID')['DBH_cm'].shift()
    print("Created PrevDBH_cm column.")
else:
    print("WARNING: No DBH_cm found — cannot compute PrevDBH_cm.")


# ------------------------------------------------------------
# 2. Quick ANOVA — Species & Plot effects
# ------------------------------------------------------------

def run_anova(variable, target):
    """
    variable: string, like 'Species' or 'Plot'
    target: CarbonGrowth or CarbonGrowthRate
    """
    print("\n" + "="*60)
    print(f"ANOVA for {variable} effect on {target}")
    print("="*60)

    # Remove NA
    temp = df[[variable, target]].dropna()

    # One-way ANOVA using SciPy
    groups = temp.groupby(variable)[target].apply(list)
    
    # Run ANOVA
    f_stat, p_value = stats.f_oneway(*groups)

    print(f"F-statistic: {f_stat:.4f}")
    print(f"P-value:     {p_value:.6f}")

    if p_value < 0.05:
        print("➡ Significant effect detected (p < 0.05)")
    else:
        print("➡ No statistically significant effect (p >= 0.05)")

    print()


print("\nRunning Species & Plot ANOVA tests...")

# Convert Species + Plot into simple string labels for ANOVA
df["Species"] = df.filter(like="Species_").idxmax(axis=1).str.replace("Species_", "")
df["Plot"] = df.filter(like="Plot_").idxmax(axis=1).str.replace("Plot_", "")

# ANOVA tests
run_anova("Species", "CarbonGrowth")
run_anova("Species", "CarbonGrowthRate")
run_anova("Plot", "CarbonGrowth")
run_anova("Plot", "CarbonGrowthRate")


# ------------------------------------------------------------
# 3. Modeling section — Linear regression with species + plot
# ------------------------------------------------------------

TARGETS = ["CarbonGrowthRate", "CarbonGrowth"]

for TARGET_COL in TARGETS:
    print("\n" + "="*60)
    print(f"FITTING LINEAR REGRESSION FOR TARGET: {TARGET_COL}")
    print("="*60)

    df_model = df[~df[TARGET_COL].isna()].copy()
    print("Shape after dropping NaN:", df_model.shape)

    # Leakage exclusions
    base_exclude = [
        "TreeID", TARGET_COL,
        "Carbon", "CO2e", "PrevCarbon",
        "DBH", "PrevDBH",  # inch-based
        "Species", "Plot", "GrowthType_initial", "GrowthType_normal" # text versions used only for ANOVA
    ]

    if TARGET_COL == "CarbonGrowthRate":
        leakage_cols = ["GrowthRate", "CarbonGrowth"]
    else:  # CarbonGrowth target
        leakage_cols = ["GrowthRate", "CarbonGrowthRate"]

    exclude_cols = base_exclude + leakage_cols

    # Detect one-hot encoded variables
    species_cols = [c for c in df_model.columns if c.startswith("Species_")]
    plot_cols    = [c for c in df_model.columns if c.startswith("Plot_")]
    group_cols   = [c for c in df_model.columns if c.startswith("Group_")]

    # Select numeric and bool features
    numeric_cols = df_model.select_dtypes(include=[np.number, bool]).columns.tolist()
    feature_cols = [c for c in numeric_cols if c not in exclude_cols]

    # FORCE include species and plot dummy columns
    for c in species_cols + plot_cols + group_cols:
        if c not in feature_cols and c not in exclude_cols:
            feature_cols.append(c)

    print("\nTarget:", TARGET_COL)
    print("Feature count:", len(feature_cols))
    print("Feature sample:", feature_cols[:20])

    X = df_model[feature_cols]
    y = df_model[TARGET_COL]

    # Train/Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Fit regression
    linreg = LinearRegression()
    linreg.fit(X_train, y_train)

    y_pred = linreg.predict(X_test)

    # Metrics
    r2 = metrics.r2_score(y_test, y_pred)
    R = np.corrcoef(y_test, y_pred)[0, 1]
    mse = metrics.mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)

    print("\n=== Metrics ===")
    print(f"R:    {R:.4f}")
    print(f"R^2:  {r2:.4f}")
    print(f"MSE:  {mse:.4f}")
    print(f"RMSE: {rmse:.4f}")

    # Coefficients
    coef_df = pd.DataFrame({
        "feature": feature_cols,
        "coef": linreg.coef_
    }).assign(abs_coef=lambda x: x['coef'].abs()
    ).sort_values("abs_coef", ascending=False)

    print("\nTop 20 features by |coef|:")
    print(coef_df.head(20))