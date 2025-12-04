"""
Allometric equations for forestry calculations.

Converts DBH (diameter at breast height) to:
- Aboveground biomass (AGB)
- Carbon storage
- Future: Volume, height, etc.
"""
import pandas as pd
import numpy as np
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import ALLOMETRIC_COEFFS, CARBON_FRACTION
from .species_classifier import classify_group


def dbh_to_biomass(dbh_cm: pd.Series, group: pd.Series) -> pd.Series:
    """
    Convert DBH (cm) to aboveground biomass (AGB) using allometric equations.

    Equation: AGB = a * (DBH_cm ** b)
    where (a, b) are coefficients that depend on hardwood/softwood group.

    Parameters
    ----------
    dbh_cm : pd.Series
        Diameter at breast height in centimeters
    group : pd.Series
        Tree group ('hardwood' or 'softwood')

    Returns
    -------
    pd.Series
        Aboveground biomass (units depend on coefficients)

    Examples
    --------
    >>> dbh = pd.Series([10, 20, 30])
    >>> group = pd.Series(['hardwood', 'hardwood', 'softwood'])
    >>> biomass = dbh_to_biomass(dbh, group)
    """
    coeffs = ALLOMETRIC_COEFFS

    # Allocate arrays for a, b coefficients
    a_vals = []
    b_vals = []
    for g in group:
        a, b = coeffs.get(g, coeffs['hardwood'])  # default to hardwood if unknown
        a_vals.append(a)
        b_vals.append(b)

    a_vals = pd.Series(a_vals, index=dbh_cm.index)
    b_vals = pd.Series(b_vals, index=dbh_cm.index)

    # Calculate AGB: AGB = a * (DBH_cm ** b)
    AGB = a_vals * (dbh_cm ** b_vals)

    return AGB


def dbh_to_carbon(dbh_cm: pd.Series, species: pd.Series) -> pd.Series:
    """
    Convert DBH (cm) to carbon storage using allometric equations.

    Steps:
    1. Classify species into hardwood/softwood group
    2. Calculate aboveground biomass (AGB)
    3. Convert AGB to carbon (carbon = AGB * carbon_fraction)

    Parameters
    ----------
    dbh_cm : pd.Series
        Diameter at breast height in centimeters
    species : pd.Series
        Species names (used to determine hardwood/softwood group)

    Returns
    -------
    pd.Series
        Carbon storage (units depend on coefficients)

    Examples
    --------
    >>> dbh_cm = pd.Series([10, 20, 30])
    >>> species = pd.Series(['red oak', 'white pine', 'maple'])
    >>> carbon = dbh_to_carbon(dbh_cm, species)
    """
    # Classify species into groups
    groups = species.apply(classify_group)

    # Calculate biomass
    AGB = dbh_to_biomass(dbh_cm, groups)

    # Convert to carbon
    carbon = AGB * CARBON_FRACTION

    return carbon


def dbh_to_carbon_from_inches(dbh_in: pd.Series, species: pd.Series) -> pd.Series:
    """
    Convert DBH (inches) to carbon storage.

    Convenience function that handles unit conversion from inches to cm,
    then calls dbh_to_carbon().

    Parameters
    ----------
    dbh_in : pd.Series
        Diameter at breast height in inches
    species : pd.Series
        Species names

    Returns
    -------
    pd.Series
        Carbon storage

    Examples
    --------
    >>> dbh_inches = pd.Series([4, 8, 12])
    >>> species = pd.Series(['red oak', 'white pine', 'maple'])
    >>> carbon = dbh_to_carbon_from_inches(dbh_inches, species)
    """
    # Convert inches to cm
    dbh_cm = dbh_in * 2.54

    # Use the cm-based function
    return dbh_to_carbon(dbh_cm, species)


# Future functions (placeholders for when height data is available)

def dbh_to_height(dbh_cm: pd.Series, species: pd.Series) -> pd.Series:
    """
    Convert DBH to tree height using allometric equations (future).

    Requires height allometric equations, which may depend on:
    - Species
    - Site conditions
    - Age

    Parameters
    ----------
    dbh_cm : pd.Series
        Diameter at breast height in centimeters
    species : pd.Series
        Species names

    Returns
    -------
    pd.Series
        Tree height (units depend on equations)
    """
    raise NotImplementedError(
        "Height allometric equations not yet implemented. "
        "Requires species-specific height equations."
    )


def dbh_to_volume(dbh_cm: pd.Series, height: pd.Series, species: pd.Series) -> pd.Series:
    """
    Convert DBH and height to tree volume (future).

    Requires volume equations, which typically need:
    - DBH
    - Height
    - Species-specific form factors

    Parameters
    ----------
    dbh_cm : pd.Series
        Diameter at breast height in centimeters
    height : pd.Series
        Tree height
    species : pd.Series
        Species names

    Returns
    -------
    pd.Series
        Tree volume (typically in cubic meters or cubic feet)
    """
    raise NotImplementedError(
        "Volume calculations not yet implemented. "
        "Requires height data and species-specific volume equations."
    )

