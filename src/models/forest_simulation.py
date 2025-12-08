"""
Forest Simulation Module

Provides functions to simulate tree growth and carbon storage over multiple years.

These functions iteratively apply the one-year DBH growth model to project
tree metrics into the future. This will drive the time slider in the app
(e.g., "show tree in 0, 5, 10, 20 years").
"""

import sys
from pathlib import Path
from typing import List

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from models.dbh_growth_model import predict_dbh_next_year
from models.forest_metrics import carbon_from_dbh


def simulate_dbh_trajectory(
    initial_dbh_cm: float,
    species: str,
    plot: str,
    years: int,
    **kwargs
) -> List[float]:
    """
    Iteratively apply the one-year DBH growth model to simulate DBH over multiple years.
    
    This function projects tree diameter growth year by year, using the current DBH
    as input to predict next year's DBH, then using that prediction as input for
    the following year, and so on.
    
    Parameters
    ----------
    initial_dbh_cm : float
        Starting DBH in centimeters (year 0)
    species : str
        Species name (e.g., 'red oak', 'sugar maple')
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    years : int
        Number of years to simulate (returns years+1 values: year 0 through year N)
    **kwargs
        Additional optional parameters for the growth model (e.g., gap_years)
    
    Returns
    -------
    List[float]
        List of DBH values [dbh_year_0, dbh_year_1, ..., dbh_year_N]
        Length is years+1
    
    Examples
    --------
    >>> trajectory = simulate_dbh_trajectory(
    ...     initial_dbh_cm=25.0,
    ...     species='red oak',
    ...     plot='Upper',
    ...     years=10
    ... )
    >>> print(f"DBH in 10 years: {trajectory[10]:.2f} cm")
    """
    if years < 0:
        raise ValueError("years must be non-negative")
    
    # Initialize trajectory with starting DBH
    dbh_trajectory = [initial_dbh_cm]
    
    # Current DBH (starts at initial)
    current_dbh = initial_dbh_cm
    
    # Simulate year by year
    for year in range(years):
        # Predict next year's DBH
        next_dbh = predict_dbh_next_year(
            prev_dbh_cm=current_dbh,
            species=species,
            plot=plot,
            **kwargs
        )
        
        # Add to trajectory
        dbh_trajectory.append(next_dbh)
        
        # Update current DBH for next iteration
        current_dbh = next_dbh
    
    return dbh_trajectory


def simulate_carbon_trajectory(
    initial_dbh_cm: float,
    species: str,
    plot: str,
    years: int,
    **kwargs
) -> List[float]:
    """
    Simulate carbon storage trajectory over multiple years.
    
    This function:
    1. Simulates DBH trajectory using simulate_dbh_trajectory()
    2. Converts each DBH value to carbon using allometric equations
    
    Parameters
    ----------
    initial_dbh_cm : float
        Starting DBH in centimeters (year 0)
    species : str
        Species name (e.g., 'red oak', 'sugar maple')
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    years : int
        Number of years to simulate (returns years+1 values: year 0 through year N)
    **kwargs
        Additional optional parameters for the growth model
    
    Returns
    -------
    List[float]
        List of carbon values [carbon_year_0, carbon_year_1, ..., carbon_year_N]
        Units: kg C
        Length is years+1
    
    Examples
    --------
    >>> carbon_traj = simulate_carbon_trajectory(
    ...     initial_dbh_cm=25.0,
    ...     species='red oak',
    ...     plot='Upper',
    ...     years=10
    ... )
    >>> print(f"Carbon in 10 years: {carbon_traj[10]:.2f} kg C")
    """
    # Get DBH trajectory
    dbh_trajectory = simulate_dbh_trajectory(
        initial_dbh_cm=initial_dbh_cm,
        species=species,
        plot=plot,
        years=years,
        **kwargs
    )
    
    # Convert each DBH to carbon
    carbon_trajectory = [
        carbon_from_dbh(dbh, species) for dbh in dbh_trajectory
    ]
    
    return carbon_trajectory


def simulate_growth_trajectory(
    initial_dbh_cm: float,
    species: str,
    plot: str,
    years: int,
    **kwargs
) -> dict:
    """
    Simulate both DBH and carbon trajectories together.
    
    Convenience function that returns both trajectories in a dictionary.
    
    Parameters
    ----------
    initial_dbh_cm : float
        Starting DBH in centimeters (year 0)
    species : str
        Species name
    plot : str
        Plot identifier ('Upper', 'Middle', or 'Lower')
    years : int
        Number of years to simulate
    **kwargs
        Additional optional parameters for the growth model
    
    Returns
    -------
    dict
        Dictionary with keys:
        - 'dbh': List[float], DBH trajectory
        - 'carbon': List[float], Carbon trajectory
        - 'years': List[int], Year indices [0, 1, 2, ..., years]
    
    Examples
    --------
    >>> results = simulate_growth_trajectory(
    ...     initial_dbh_cm=25.0,
    ...     species='red oak',
    ...     plot='Upper',
    ...     years=10
    ... )
    >>> print(f"DBH trajectory: {results['dbh']}")
    >>> print(f"Carbon trajectory: {results['carbon']}")
    """
    dbh_traj = simulate_dbh_trajectory(
        initial_dbh_cm=initial_dbh_cm,
        species=species,
        plot=plot,
        years=years,
        **kwargs
    )
    
    carbon_traj = simulate_carbon_trajectory(
        initial_dbh_cm=initial_dbh_cm,
        species=species,
        plot=plot,
        years=years,
        **kwargs
    )
    
    return {
        'dbh': dbh_traj,
        'carbon': carbon_traj,
        'years': list(range(years + 1))
    }

