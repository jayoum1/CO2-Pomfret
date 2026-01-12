"""
Planting Scenario Module

Functions to generate and simulate tree planting scenarios for school benefit analysis.
Supports explicit tree lists and recipe-based generation.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
import json
from typing import List, Dict, Optional, Union

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROCESSED_DATA_DIR, ensure_dir
from models.forest_snapshots_nn import (
    load_base_forest_df,
    simulate_forest_years,
    generate_forest_snapshots
)
from models.forest_metrics import carbon_from_dbh


# Scenario directory
SCENARIOS_DIR = Path(__file__).parent.parent.parent / "Data" / "Scenarios"
ensure_dir(SCENARIOS_DIR)


def generate_planting_trees(
    mode: str = "recipe",
    total_count: Optional[int] = None,
    species_proportions: Optional[Dict[str, float]] = None,
    plot: Optional[str] = None,
    initial_dbh_cm: Optional[float] = None,
    explicit_trees: Optional[List[Dict[str, Union[str, float]]]] = None
) -> pd.DataFrame:
    """
    Generate a dataframe of new trees for planting scenarios.
    
    Supports two modes:
    1. Recipe mode: Specify species proportions + total count + plot + initial DBH
    2. Explicit mode: Provide a list of individual trees with species, plot, DBH
    
    Parameters
    ----------
    mode : str
        "recipe" or "explicit" (default: "recipe")
    total_count : int, optional
        Total number of trees to generate (recipe mode only)
    species_proportions : dict, optional
        Dictionary mapping species names to proportions (must sum to 1.0)
        Example: {"red oak": 0.4, "sugar maple": 0.3, "white pine": 0.3}
        (recipe mode only)
    plot : str, optional
        Plot name ("Upper", "Middle", or "Lower") (recipe mode only)
    initial_dbh_cm : float, optional
        Initial DBH in cm for all trees (recipe mode only)
    explicit_trees : list of dict, optional
        List of tree dictionaries, each with keys: "species", "plot", "dbh_cm"
        Example: [
            {"species": "red oak", "plot": "Upper", "dbh_cm": 5.0},
            {"species": "sugar maple", "plot": "Middle", "dbh_cm": 4.5}
        ]
        (explicit mode only)
    
    Returns
    -------
    pd.DataFrame
        DataFrame with columns: TreeID, Plot, Species, DBH_cm, years_ahead=0
        TreeID will be generated as "PLANTED_001", "PLANTED_002", etc.
    
    Examples
    --------
    >>> # Recipe mode
    >>> trees = generate_planting_trees(
    ...     mode="recipe",
    ...     total_count=100,
    ...     species_proportions={"red oak": 0.5, "sugar maple": 0.5},
    ...     plot="Upper",
    ...     initial_dbh_cm=5.0
    ... )
    
    >>> # Explicit mode
    >>> trees = generate_planting_trees(
    ...     mode="explicit",
    ...     explicit_trees=[
    ...         {"species": "red oak", "plot": "Upper", "dbh_cm": 5.0},
    ...         {"species": "sugar maple", "plot": "Middle", "dbh_cm": 4.5}
    ...     ]
    ... )
    """
    if mode == "recipe":
        if total_count is None:
            raise ValueError("total_count is required for recipe mode")
        if species_proportions is None:
            raise ValueError("species_proportions is required for recipe mode")
        if plot is None:
            raise ValueError("plot is required for recipe mode")
        if initial_dbh_cm is None:
            raise ValueError("initial_dbh_cm is required for recipe mode")
        
        # Validate proportions sum to 1.0
        prop_sum = sum(species_proportions.values())
        if abs(prop_sum - 1.0) > 1e-6:
            raise ValueError(f"species_proportions must sum to 1.0, got {prop_sum}")
        
        # Generate trees based on proportions
        trees_list = []
        species_list = list(species_proportions.keys())
        proportions_list = list(species_proportions.values())
        
        # Calculate counts per species (distribute rounding errors)
        counts = np.zeros(len(species_list), dtype=int)
        cumulative = 0.0
        for i, prop in enumerate(proportions_list):
            cumulative += prop * total_count
            counts[i] = int(round(cumulative)) - sum(counts[:i])
        
        # Ensure total matches (adjust if needed due to rounding)
        total_generated = sum(counts)
        if total_generated < total_count:
            # Add remaining trees to largest proportion species
            diff = total_count - total_generated
            max_idx = np.argmax(proportions_list)
            counts[max_idx] += diff
        elif total_generated > total_count:
            # Remove excess from largest proportion species
            diff = total_generated - total_count
            max_idx = np.argmax(proportions_list)
            counts[max_idx] = max(0, counts[max_idx] - diff)
        
        # Generate tree records
        tree_id_counter = 1
        for species, count in zip(species_list, counts):
            for _ in range(count):
                trees_list.append({
                    "TreeID": f"PLANTED_{tree_id_counter:06d}",
                    "Plot": plot,
                    "Species": species,
                    "DBH_cm": initial_dbh_cm,
                    "years_ahead": 0
                })
                tree_id_counter += 1
        
        df = pd.DataFrame(trees_list)
        
    elif mode == "explicit":
        if explicit_trees is None:
            raise ValueError("explicit_trees is required for explicit mode")
        
        trees_list = []
        for i, tree in enumerate(explicit_trees, start=1):
            if "species" not in tree or "plot" not in tree or "dbh_cm" not in tree:
                raise ValueError(f"Tree {i} must have 'species', 'plot', and 'dbh_cm' keys")
            
            trees_list.append({
                "TreeID": f"PLANTED_{i:06d}",
                "Plot": tree["plot"],
                "Species": tree["species"],
                "DBH_cm": tree["dbh_cm"],
                "years_ahead": 0
            })
        
        df = pd.DataFrame(trees_list)
        
    else:
        raise ValueError(f"Invalid mode: {mode}. Must be 'recipe' or 'explicit'")
    
    # Add carbon_at_time column
    df['carbon_at_time'] = df.apply(
        lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
        axis=1
    )
    
    return df


def simulate_planting_scenario(
    planting_trees: pd.DataFrame,
    years_list: List[int] = [0, 5, 10, 20],
    simulation_mode: str = "epsilon",
    epsilon_cm: float = 0.02
) -> Dict[str, pd.DataFrame]:
    """
    Simulate a planting scenario by combining baseline forest with new trees.
    
    Parameters
    ----------
    planting_trees : pd.DataFrame
        DataFrame of new trees (from generate_planting_trees)
    years_list : list of int
        List of years to simulate (default: [0, 5, 10, 20])
    simulation_mode : str
        Simulation mode: "epsilon" or "hard0" (default: "epsilon")
    epsilon_cm : float
        Minimum growth for epsilon mode (default: 0.02 cm)
    
    Returns
    -------
    dict
        Dictionary with keys:
        - "baseline": Dict mapping years to baseline snapshots
        - "with_planting": Dict mapping years to snapshots with new trees
        - "planting_only": Dict mapping years to snapshots of only new trees
    """
    # Load baseline forest
    baseline_forest = load_base_forest_df()
    
    # Combine baseline + planting trees
    combined_forest = pd.concat([baseline_forest, planting_trees], ignore_index=True)
    
    # Generate snapshots for baseline
    baseline_snapshots = {}
    for years in years_list:
        if years == 0:
            snapshot = baseline_forest.copy()
            snapshot['years_ahead'] = 0
            if 'carbon_at_time' not in snapshot.columns:
                snapshot['carbon_at_time'] = snapshot.apply(
                    lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
                    axis=1
                )
        else:
            snapshot, _, _, _ = simulate_forest_years(
                baseline_forest,
                years,
                enforce_monotonic_dbh=True,
                max_annual_shrink_cm=0.0,
                print_diagnostics=False,
                model_type="nn_state",
                simulation_mode=simulation_mode,
                epsilon_cm=epsilon_cm
            )
        baseline_snapshots[years] = snapshot
    
    # Generate snapshots for combined forest
    with_planting_snapshots = {}
    for years in years_list:
        if years == 0:
            snapshot = combined_forest.copy()
            snapshot['years_ahead'] = 0
            if 'carbon_at_time' not in snapshot.columns:
                snapshot['carbon_at_time'] = snapshot.apply(
                    lambda row: carbon_from_dbh(row['DBH_cm'], row['Species']),
                    axis=1
                )
        else:
            snapshot, _, _, _ = simulate_forest_years(
                combined_forest,
                years,
                enforce_monotonic_dbh=True,
                max_annual_shrink_cm=0.0,
                print_diagnostics=False,
                model_type="nn_state",
                simulation_mode=simulation_mode,
                epsilon_cm=epsilon_cm
            )
        with_planting_snapshots[years] = snapshot
    
    # Extract only planted trees from combined snapshots
    planting_only_snapshots = {}
    for years in years_list:
        snapshot = with_planting_snapshots[years]
        planted_mask = snapshot['TreeID'].str.startswith('PLANTED_')
        planting_only_snapshots[years] = snapshot[planted_mask].copy()
    
    return {
        "baseline": baseline_snapshots,
        "with_planting": with_planting_snapshots,
        "planting_only": planting_only_snapshots
    }


def compare_scenarios(
    scenario_results: Dict[str, Dict[int, pd.DataFrame]],
    years_list: List[int] = [0, 5, 10, 20]
) -> pd.DataFrame:
    """
    Compare baseline vs planting scenario results.
    
    Parameters
    ----------
    scenario_results : dict
        Results from simulate_planting_scenario()
    years_list : list of int
        List of years to compare (default: [0, 5, 10, 20])
    
    Returns
    -------
    pd.DataFrame
        Comparison table with columns:
        - years_ahead
        - baseline_total_carbon
        - with_planting_total_carbon
        - carbon_added
        - baseline_mean_dbh
        - with_planting_mean_dbh
        - planting_only_mean_dbh
        - baseline_num_trees
        - with_planting_num_trees
        - planting_num_trees
    """
    comparison_rows = []
    
    for years in years_list:
        baseline = scenario_results["baseline"][years]
        with_planting = scenario_results["with_planting"][years]
        planting_only = scenario_results["planting_only"][years]
        
        baseline_total_carbon = baseline['carbon_at_time'].sum()
        with_planting_total_carbon = with_planting['carbon_at_time'].sum()
        carbon_added = with_planting_total_carbon - baseline_total_carbon
        
        baseline_mean_dbh = baseline['DBH_cm'].mean()
        with_planting_mean_dbh = with_planting['DBH_cm'].mean()
        planting_only_mean_dbh = planting_only['DBH_cm'].mean() if len(planting_only) > 0 else 0.0
        
        comparison_rows.append({
            "years_ahead": years,
            "baseline_total_carbon": baseline_total_carbon,
            "with_planting_total_carbon": with_planting_total_carbon,
            "carbon_added": carbon_added,
            "baseline_mean_dbh": baseline_mean_dbh,
            "with_planting_mean_dbh": with_planting_mean_dbh,
            "planting_only_mean_dbh": planting_only_mean_dbh,
            "baseline_num_trees": len(baseline),
            "with_planting_num_trees": len(with_planting),
            "planting_num_trees": len(planting_only)
        })
    
    return pd.DataFrame(comparison_rows)


def save_scenario(
    scenario_config: Dict,
    filename: str
) -> Path:
    """
    Save a scenario configuration to JSON.
    
    Parameters
    ----------
    scenario_config : dict
        Scenario configuration dictionary
    filename : str
        Filename (will be saved to Data/Scenarios/)
    
    Returns
    -------
    Path
        Path to saved file
    """
    filepath = SCENARIOS_DIR / filename
    if not filename.endswith('.json'):
        filepath = SCENARIOS_DIR / f"{filename}.json"
    
    with open(filepath, 'w') as f:
        json.dump(scenario_config, f, indent=2)
    
    return filepath


def load_scenario(filename: str) -> Dict:
    """
    Load a scenario configuration from JSON.
    
    Parameters
    ----------
    filename : str
        Filename (will be loaded from Data/Scenarios/)
    
    Returns
    -------
    dict
        Scenario configuration dictionary
    """
    filepath = SCENARIOS_DIR / filename
    if not filename.endswith('.json'):
        filepath = SCENARIOS_DIR / f"{filename}.json"
    
    if not filepath.exists():
        raise FileNotFoundError(f"Scenario file not found: {filepath}")
    
    with open(filepath, 'r') as f:
        return json.load(f)
