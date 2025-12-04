import pandas as pd
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_MIDDLE, CARBON_ALL_PLOTS

# --- SET THESE PATHS ---
middle_path = str(CARBON_MIDDLE)
all_path    = str(CARBON_ALL_PLOTS)

TARGET_PLOT   = "Middle"
TARGET_TREEID = "639"   # TreeID is string in processed files


def fix_tree_639_in_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    For the Middle plot, TreeID 639:
    - Drop the 2022 row
    - Recompute GapYears, PrevDBH, GrowthRate, GrowthType,
      PrevCarbon, CarbonGrowthRate, CarbonGrowth for that tree only.
    """
    df = df.copy()

    # Make sure TreeID is string for safe comparison
    df["TreeID"] = df["TreeID"].astype(str)

    mask_tree = (df["Plot"] == TARGET_PLOT) & (df["TreeID"] == TARGET_TREEID)

    # Show what exists before change
    print("\nBefore fix, rows for Middle, TreeID 639:")
    cols_to_show = ["Plot", "TreeID", "Year", "DBH",
                    "GapYears", "PrevDBH", "GrowthRate", "GrowthType",
                    "Carbon", "PrevCarbon", "CarbonGrowthRate"]
    # Only include CarbonGrowth if it exists
    if "CarbonGrowth" in df.columns:
        cols_to_show.append("CarbonGrowth")
    print(df.loc[mask_tree].sort_values("Year")[cols_to_show])

    # 1) Drop the 2022 row for that tree (bad DBH)
    drop_mask = mask_tree & (df["Year"] == 2022)
    df = df.loc[~drop_mask].copy()

    # 2) Recompute metrics ONLY for this tree (remaining years)
    mask_tree_after = (df["Plot"] == TARGET_PLOT) & (df["TreeID"] == TARGET_TREEID)
    sub = df.loc[mask_tree_after].sort_values("Year").copy()

    if sub.empty:
        print("No rows left for Middle, TreeID 639 after dropping 2022.")
        return df

    # Recompute GapYears & PrevDBH
    sub["GapYears"] = sub["Year"].diff()
    sub["PrevDBH"] = sub["DBH"].shift()

    # Initialize growth fields
    sub["GrowthRate"] = pd.NA
    sub["GrowthType"] = pd.NA
    sub["PrevCarbon"] = sub["Carbon"].shift()
    sub["CarbonGrowthRate"] = pd.NA
    if "CarbonGrowth" in sub.columns:
        # If you already created CarbonGrowth before
        sub["CarbonGrowth"] = pd.NA

    # First measurement becomes "initial"
    first_mask = sub["PrevDBH"].isna()
    sub.loc[first_mask, "GrowthType"] = "initial"

    # Subsequent measurements
    mask = ~first_mask & sub["GapYears"].notna() & (sub["GapYears"] > 0)

    # DBH-based growth rate (relative, annualized)
    sub.loc[mask, "GrowthRate"] = (
        (sub.loc[mask, "DBH"] - sub.loc[mask, "PrevDBH"]) /
        (sub.loc[mask, "GapYears"] * sub.loc[mask, "PrevDBH"])
    )

    # GrowthType labels
    sub.loc[mask & (sub["GapYears"] == 1), "GrowthType"] = "normal"
    sub.loc[mask & (sub["GapYears"] > 1), "GrowthType"] = "annualized"

    # Carbon-based growth rate (relative, annualized)
    sub.loc[mask & sub["PrevCarbon"].notna(), "CarbonGrowthRate"] = (
        (sub.loc[mask, "Carbon"] - sub.loc[mask, "PrevCarbon"]) /
        (sub.loc[mask, "GapYears"] * sub.loc[mask, "PrevCarbon"])
    )

    # Absolute carbon growth per year, if column exists
    if "CarbonGrowth" in sub.columns:
        sub.loc[mask & sub["PrevCarbon"].notna(), "CarbonGrowth"] = (
            (sub.loc[mask, "Carbon"] - sub.loc[mask, "PrevCarbon"]) /
            sub.loc[mask, "GapYears"]
        )

    # Put the updated rows back into the main df
    df.loc[mask_tree_after, sub.columns] = sub

    print("\nAfter fix, rows for Middle, TreeID 639:")
    cols_to_show = ["Plot", "TreeID", "Year", "DBH",
                    "GapYears", "PrevDBH", "GrowthRate", "GrowthType",
                    "Carbon", "PrevCarbon", "CarbonGrowthRate"]
    # Only include CarbonGrowth if it exists
    if "CarbonGrowth" in df.columns:
        cols_to_show.append("CarbonGrowth")
    print(df.loc[mask_tree_after].sort_values("Year")[cols_to_show])

    return df


# --- Apply fix to middle_with_carbon.csv ---
if __name__ == "__main__":
    middle_df = pd.read_csv(middle_path)
    middle_fixed = fix_tree_639_in_df(middle_df)
    middle_fixed.to_csv(middle_path, index=False)
    print("\nSaved cleaned middle file to:", middle_path)

    # --- Apply same fix to all_plots_with_carbon.csv ---
    all_df = pd.read_csv(all_path)
    all_fixed = fix_tree_639_in_df(all_df)
    all_fixed.to_csv(all_path, index=False)
    print("Saved cleaned all-plots file to:", all_path)

