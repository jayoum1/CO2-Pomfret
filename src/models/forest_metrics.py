"""
Forest Metrics Module

Provides functions to compute carbon, carbon growth, and growth rate using the DBH growth model.

Key Concepts:
    - DBH growth is the primary ML prediction (from dbh_growth_model.py)
    - Carbon metrics are derived from DBH using allometric equations (not predicted directly)
    - All functions use the one-year growth model to predict future DBH, then convert to carbon
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from forestry.allometry import dbh_to_carbon
from forestry.species_classifier import classify_group
from models.dbh_growth_model import predict_dbh_next_year


def carbon_from_dbh(dbh_cm: float, species: str) -> float:
    """
    Estimate aboveground carbon (kg C) from DBH and species using an allometric equation.
    
    This function uses species-specific allometric equations to convert DBH to carbon.
    The equations are based on hardwood/softwood classification.
    
    TODO: In the future, we can plug in more precise species-specific coefficients
    from published allometric equations (e.g., Jenkins et al., Chojnacky et al.).
    
    Parameters
    ----------
    dbh_cm : float
        Diameter at breast height in centimeters
    species : str
        Species name (e.g., 'red oak', 'sugar maple', 'white pine')
    
    Returns
    -------
    float
        Aboveground carbon in kg C
    
    Examples
    --------
    >>> carbon = carbon_from_dbh(25.0, 'red oak')
    >>> print(f"Carbon: {carbon:.2f} kg C")
    """
    # Convert to Series for compatibility with allometry functions
    dbh_series = pd.Series([dbh_cm])
    species_series = pd.Series([species])
    
    # Use the allometric equation from forestry.allometry
    carbon_series = dbh_to_carbon(dbh_series, species_series)
    
    return float(carbon_series.iloc[0])


def carbon_now(dbh_cm: float, species: str) -> float:
    """
    Calculate current carbon storage for a tree.
    
    This is a convenience wrapper around carbon_from_dbh().
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name
    
    Returns
    -------
    float
        Current aboveground carbon in kg C
    
    Examples
    --------
    >>> carbon_current = carbon_now(25.0, 'red oak')
    """
    return carbon_from_dbh(dbh_cm, species)


def carbon_future(dbh_cm: float, species: str, plot: str, **kwargs) -> float:
    """
    Predict carbon storage one year in the future.
    
    Uses the DBH growth model to predict next year's DBH, then converts to carbon.
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name (e.g., 'red oak', 'sugar maple')
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional features for the growth model (e.g., gap_years, group)
    
    Returns
    -------
    float
        Predicted aboveground carbon one year from now (kg C)
    
    Examples
    --------
    >>> carbon_next_year = carbon_future(25.0, 'red oak', 'Upper')
    """
    # Predict next year's DBH using the growth model
    dbh_next_year = predict_dbh_next_year(
        prev_dbh_cm=dbh_cm,
        species=species,
        plot=plot,
        **kwargs
    )
    
    # Convert predicted DBH to carbon
    return carbon_from_dbh(dbh_next_year, species)


def carbon_growth(dbh_cm: float, species: str, plot: str, **kwargs) -> float:
    """
    Calculate carbon added over one year.
    
    This is the absolute increase in carbon storage: carbon_future - carbon_now.
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional features for the growth model
    
    Returns
    -------
    float
        Carbon growth (increase in kg C over one year)
    
    Examples
    --------
    >>> growth = carbon_growth(25.0, 'red oak', 'Upper')
    >>> print(f"Carbon growth: {growth:.2f} kg C/year")
    """
    carbon_current = carbon_now(dbh_cm, species)
    carbon_next = carbon_future(dbh_cm, species, plot, **kwargs)
    
    return carbon_next - carbon_current


def carbon_growth_rate(dbh_cm: float, species: str, plot: str, **kwargs) -> float:
    """
    Calculate relative carbon growth rate (as a proportion).
    
    This is the relative growth: carbon_growth / carbon_now.
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional features for the growth model
    
    Returns
    -------
    float
        Relative carbon growth rate (dimensionless, typically 0.01-0.10 for 1-10% growth)
    
    Examples
    --------
    >>> rate = carbon_growth_rate(25.0, 'red oak', 'Upper')
    >>> print(f"Carbon growth rate: {rate*100:.2f}% per year")
    """
    carbon_current = carbon_now(dbh_cm, species)
    
    # Avoid division by zero
    if carbon_current <= 0:
        return 0.0
    
    growth = carbon_growth(dbh_cm, species, plot, **kwargs)
    
    return growth / carbon_current


def dbh_growth(dbh_cm: float, species: str, plot: str, **kwargs) -> float:
    """
    Calculate absolute DBH growth over one year (in cm).
    
    Convenience function that directly uses the growth model.
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional features for the growth model
    
    Returns
    -------
    float
        DBH growth (increase in cm over one year)
    
    Examples
    --------
    >>> growth = dbh_growth(25.0, 'red oak', 'Upper')
    >>> print(f"DBH growth: {growth:.2f} cm/year")
    """
    dbh_next = predict_dbh_next_year(
        prev_dbh_cm=dbh_cm,
        species=species,
        plot=plot,
        **kwargs
    )
    
    return dbh_next - dbh_cm


def dbh_growth_rate(dbh_cm: float, species: str, plot: str, **kwargs) -> float:
    """
    Calculate relative DBH growth rate (as a proportion).
    
    Parameters
    ----------
    dbh_cm : float
        Current diameter at breast height in centimeters
    species : str
        Species name
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    **kwargs
        Additional optional features for the growth model
    
    Returns
    -------
    float
        Relative DBH growth rate (dimensionless)
    
    Examples
    --------
    >>> rate = dbh_growth_rate(25.0, 'red oak', 'Upper')
    >>> print(f"DBH growth rate: {rate*100:.2f}% per year")
    """
    if dbh_cm <= 0:
        return 0.0
    
    growth = dbh_growth(dbh_cm, species, plot, **kwargs)
    
    return growth / dbh_cm

