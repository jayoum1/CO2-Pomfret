"""
Configuration file for CO2 Pomfret project.
Centralizes all file paths and project constants.
"""
import os
from pathlib import Path

# -----------------------------------------------------------------------------
# Project Root Detection
# -----------------------------------------------------------------------------
# Get the project root directory (parent of 'src' folder)
# This file should be located at: project_root/src/config.py
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# -----------------------------------------------------------------------------
# Data Paths
# -----------------------------------------------------------------------------
DATA_DIR = PROJECT_ROOT / "Data"

# Raw Data
RAW_DATA_DIR = DATA_DIR / "Raw Data"
RAW_DATA_UPPER = RAW_DATA_DIR / "CO2 Pomfret Raw Data - Upper.csv"
RAW_DATA_MIDDLE = RAW_DATA_DIR / "CO2 Pomfret Raw Data - Middle.csv"
RAW_DATA_LOWER = RAW_DATA_DIR / "CO2 Pomfret Raw Data - Lower.csv"

# Processed Data
PROCESSED_DATA_DIR = DATA_DIR / "Processed Data"
DBH_PROCESSED_DIR = PROCESSED_DATA_DIR / "DBH"
CARBON_PROCESSED_DIR = PROCESSED_DATA_DIR / "Carbon"

# Processed DBH files
DBH_UPPER_LONG = DBH_PROCESSED_DIR / "upper_long_with_growth.csv"
DBH_MIDDLE_LONG = DBH_PROCESSED_DIR / "middle_long_with_growth.csv"
DBH_LOWER_LONG = DBH_PROCESSED_DIR / "lower_long_with_growth.csv"

# Processed Carbon files
CARBON_UPPER = CARBON_PROCESSED_DIR / "upper_with_carbon.csv"
CARBON_MIDDLE = CARBON_PROCESSED_DIR / "middle_with_carbon.csv"
CARBON_LOWER = CARBON_PROCESSED_DIR / "lower_with_carbon.csv"
CARBON_ALL_PLOTS = CARBON_PROCESSED_DIR / "all_plots_with_carbon.csv"
CARBON_ALL_PLOTS_ENCODED = CARBON_PROCESSED_DIR / "all_plots_with_carbon_encoded.csv"

# -----------------------------------------------------------------------------
# Output Paths
# -----------------------------------------------------------------------------
GRAPHS_DIR = PROJECT_ROOT / "Graphs"
GRAPHS_EDA_DIR = GRAPHS_DIR / "EDA_Figures"
GRAPHS_MODELING_DIR = GRAPHS_DIR / "Modeling"
GRAPHS_LINEAR_REGRESSION_DIR = GRAPHS_MODELING_DIR / "Linear Regression"

MODELS_DIR = PROJECT_ROOT / "Models"

# -----------------------------------------------------------------------------
# Forestry Constants
# -----------------------------------------------------------------------------
# Allometric equation coefficients: AGB = a * (DBH_cm ** b)
ALLOMETRIC_COEFFS = {
    'hardwood': (0.15, 2.3),
    'softwood': (0.05, 2.5)
}

# Carbon conversion factor (50% of biomass is carbon)
CARBON_FRACTION = 0.5

# CO2 equivalent conversion (1 kg carbon = 3.67 kg CO2e)
CO2E_FACTOR = 3.67

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
def ensure_dir(path: Path) -> Path:
    """Ensure a directory exists, create if it doesn't."""
    path.mkdir(parents=True, exist_ok=True)
    return path

# Ensure output directories exist
ensure_dir(GRAPHS_EDA_DIR)
ensure_dir(GRAPHS_LINEAR_REGRESSION_DIR)
ensure_dir(MODELS_DIR)
ensure_dir(DBH_PROCESSED_DIR)
ensure_dir(CARBON_PROCESSED_DIR)

