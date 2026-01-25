"""
FastAPI Application for Carbon DBH Forest Simulation

Provides REST API endpoints for:
- Single tree prediction (user-designed tree)
- Planting scenario simulation and comparison
- Snapshot data access
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional, Union
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from api.encoding import predict_all_from_user_input
from scenarios.planting import (
    generate_planting_trees,
    simulate_planting_scenario,
    compare_scenarios,
    load_scenario,
    save_scenario
)
from config import PROCESSED_DATA_DIR
from models.forest_snapshots_nn import simulate_forest_years, load_base_forest_df
from models.forest_metrics import carbon_from_dbh
from models.dbh_residual_model import predict_delta_hybrid
from models.baseline_simulation import predict_delta_sim
from models.area_scaling import (
    load_plot_areas,
    set_plot_area,
    compute_all_densities,
    scale_to_area,
    get_snapshot,
    compute_plot_summaries,
    compute_plot_densities
)

app = FastAPI(
    title="Carbon DBH Forest Simulation API",
    description="API for forest growth simulation and planting scenario analysis",
    version="1.0.0"
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Snapshot Caching
# ============================================================================

_snapshot_cache: Dict[tuple, pd.DataFrame] = {}
_summary_cache: Dict[tuple, Dict] = {}


def get_snapshot_dir(mode: str = "baseline") -> Path:
    """Get snapshot directory for given mode."""
    if mode == "baseline":
        return PROCESSED_DATA_DIR / "forest_snapshots_baseline"
    elif mode == "baseline_stochastic":
        return PROCESSED_DATA_DIR / "forest_snapshots_baseline_stochastic"
    elif mode == "hybrid":
        return PROCESSED_DATA_DIR / "forest_snapshots_hybrid"
    elif mode == "nn_epsilon":
        return PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    else:
        # Default to baseline
        return PROCESSED_DATA_DIR / "forest_snapshots_baseline"


def load_snapshot(years_ahead: int, mode: str = "baseline") -> pd.DataFrame:
    """Load snapshot with caching."""
    cache_key = (mode, years_ahead)
    
    if cache_key in _snapshot_cache:
        return _snapshot_cache[cache_key]
    
    snapshots_dir = get_snapshot_dir(mode)
    # Baseline snapshots use forest_{years}_years.csv format
    if mode in ["baseline", "baseline_stochastic"]:
        snapshot_file = snapshots_dir / f"forest_{years_ahead}_years.csv"
    else:
        # Legacy format for hybrid/nn modes
        snapshot_file = snapshots_dir / f"forest_nn_{years_ahead}_years.csv"
    
    if not snapshot_file.exists():
        raise FileNotFoundError(f"Snapshot for {years_ahead} years (mode={mode}) not found: {snapshot_file}")
    
    df = pd.read_csv(snapshot_file)
    _snapshot_cache[cache_key] = df
    return df


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================

class TreePredictionRequest(BaseModel):
    """Request model for single tree prediction"""
    prev_dbh_cm: float = Field(..., description="Current DBH in cm")
    species: Optional[str] = Field(None, description="Species name (e.g., 'red oak')")
    plot: str = Field(..., description="Plot: 'Upper', 'Middle', or 'Lower'")
    group_softw: Optional[bool] = Field(None, description="True for softwood, False for hardwood")


class RecipePlantingRequest(BaseModel):
    """Request model for recipe-based planting scenario"""
    total_count: int = Field(..., gt=0, description="Total number of trees to plant")
    species_proportions: Dict[str, float] = Field(..., description="Species name -> proportion (must sum to 1.0)")
    plot: str = Field(..., description="Plot: 'Upper', 'Middle', or 'Lower'")
    initial_dbh_cm: float = Field(..., gt=0, description="Initial DBH in cm for all trees")
    years_list: List[int] = Field(default=[0, 5, 10, 20], description="Years to simulate")


class ExplicitTree(BaseModel):
    """Model for a single tree in explicit planting mode"""
    species: str
    plot: str
    dbh_cm: float = Field(..., gt=0)


class ExplicitPlantingRequest(BaseModel):
    """Request model for explicit tree list planting scenario"""
    trees: List[ExplicitTree] = Field(..., min_items=1, description="List of trees to plant")
    years_list: List[int] = Field(default=[0, 5, 10, 20], description="Years to simulate")


# ============================================================================
# Single Tree Prediction Endpoints
# ============================================================================

@app.post("/predict/tree")
async def predict_tree(request: TreePredictionRequest) -> Dict:
    """
    Predict next-year DBH and carbon for a single user-designed tree.
    
    This endpoint uses the neural network state model to predict:
    - Next year's DBH
    - Current and future carbon storage
    - Carbon growth metrics
    """
    try:
        result = predict_all_from_user_input(
            prev_dbh_cm=request.prev_dbh_cm,
            species=request.species,
            plot=request.plot,
            group_softw=request.group_softw
        )
        
        return {
            "success": True,
            "prediction": result,
            "inputs": {
                "prev_dbh_cm": request.prev_dbh_cm,
                "species": request.species,
                "plot": request.plot,
                "group_softw": request.group_softw
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Planting Scenario Endpoints
# ============================================================================

@app.post("/scenarios/planting/recipe")
async def create_recipe_scenario(request: RecipePlantingRequest) -> Dict:
    """
    Create and simulate a planting scenario using recipe mode.
    
    Recipe mode allows you to specify:
    - Total number of trees
    - Species proportions (must sum to 1.0)
    - Plot location
    - Initial DBH for all trees
    """
    try:
        # Validate proportions sum to 1.0
        prop_sum = sum(request.species_proportions.values())
        if abs(prop_sum - 1.0) > 1e-6:
            raise ValueError(f"species_proportions must sum to 1.0, got {prop_sum}")
        
        # Generate planting trees
        planting_trees = generate_planting_trees(
            mode="recipe",
            total_count=request.total_count,
            species_proportions=request.species_proportions,
            plot=request.plot,
            initial_dbh_cm=request.initial_dbh_cm
        )
        
        # Simulate scenario
        scenario_results = simulate_planting_scenario(
            planting_trees=planting_trees,
            years_list=request.years_list,
            simulation_mode="epsilon",
            epsilon_cm=0.02
        )
        
        # Generate comparison
        comparison = compare_scenarios(scenario_results, years_list=request.years_list)
        
        return {
            "success": True,
            "scenario": {
                "mode": "recipe",
                "total_count": request.total_count,
                "species_proportions": request.species_proportions,
                "plot": request.plot,
                "initial_dbh_cm": request.initial_dbh_cm
            },
            "comparison": comparison.to_dict(orient="records"),
            "planting_trees_count": len(planting_trees)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/scenarios/planting/explicit")
async def create_explicit_scenario(request: ExplicitPlantingRequest) -> Dict:
    """
    Create and simulate a planting scenario using explicit tree list mode.
    
    Explicit mode allows you to specify each tree individually with:
    - Species
    - Plot
    - Initial DBH
    """
    try:
        # Convert to list of dicts for generate_planting_trees
        explicit_trees = [
            {"species": tree.species, "plot": tree.plot, "dbh_cm": tree.dbh_cm}
            for tree in request.trees
        ]
        
        # Generate planting trees
        planting_trees = generate_planting_trees(
            mode="explicit",
            explicit_trees=explicit_trees
        )
        
        # Simulate scenario
        scenario_results = simulate_planting_scenario(
            planting_trees=planting_trees,
            years_list=request.years_list,
            simulation_mode="epsilon",
            epsilon_cm=0.02
        )
        
        # Generate comparison
        comparison = compare_scenarios(scenario_results, years_list=request.years_list)
        
        return {
            "success": True,
            "scenario": {
                "mode": "explicit",
                "tree_count": len(request.trees)
            },
            "comparison": comparison.to_dict(orient="records"),
            "planting_trees_count": len(planting_trees)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/scenarios/presets")
async def list_preset_scenarios() -> Dict:
    """
    List all available preset scenarios.
    """
    scenarios_dir = Path(__file__).parent.parent.parent / "Data" / "Scenarios"
    preset_files = list(scenarios_dir.glob("*.json"))
    
    presets = []
    for filepath in preset_files:
        try:
            scenario = load_scenario(filepath.name)
            presets.append({
                "name": scenario.get("name", filepath.stem),
                "description": scenario.get("description", ""),
                "filename": filepath.name
            })
        except Exception:
            continue
    
    return {
        "success": True,
        "presets": presets
    }


@app.get("/scenarios/presets/{filename}")
async def get_preset_scenario(filename: str) -> Dict:
    """
    Get a preset scenario configuration.
    """
    try:
        scenario = load_scenario(filename)
        return {
            "success": True,
            "scenario": scenario
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Scenario '{filename}' not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/scenarios/presets/{filename}/simulate")
async def simulate_preset_scenario(filename: str, years_list: Optional[List[int]] = None) -> Dict:
    """
    Load and simulate a preset scenario.
    """
    try:
        scenario = load_scenario(filename)
        
        if years_list is None:
            years_list = [0, 5, 10, 20]
        
        # Generate planting trees based on scenario config
        if scenario.get("mode") == "recipe":
            planting_trees = generate_planting_trees(
                mode="recipe",
                total_count=scenario["total_count"],
                species_proportions=scenario["species_proportions"],
                plot=scenario["plot"],
                initial_dbh_cm=scenario["initial_dbh_cm"]
            )
        elif scenario.get("mode") == "explicit":
            planting_trees = generate_planting_trees(
                mode="explicit",
                explicit_trees=scenario.get("trees", [])
            )
        else:
            raise ValueError(f"Unknown scenario mode: {scenario.get('mode')}")
        
        # Simulate scenario
        scenario_results = simulate_planting_scenario(
            planting_trees=planting_trees,
            years_list=years_list,
            simulation_mode="epsilon",
            epsilon_cm=0.02
        )
        
        # Generate comparison
        comparison = compare_scenarios(scenario_results, years_list=years_list)
        
        return {
            "success": True,
            "scenario_name": scenario.get("name", filename),
            "comparison": comparison.to_dict(orient="records"),
            "planting_trees_count": len(planting_trees)
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Scenario '{filename}' not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/scenarios/save")
async def save_custom_scenario(scenario_config: Dict, filename: str) -> Dict:
    """
    Save a custom scenario configuration to JSON.
    """
    try:
        filepath = save_scenario(scenario_config, filename)
        return {
            "success": True,
            "filename": filepath.name,
            "message": f"Scenario saved to {filepath}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Simplified Scenario Endpoint (for Next.js frontend)
# ============================================================================

class PlantingGroup(BaseModel):
    """Model for a group of trees with same species, plot, and DBH"""
    plot: str = Field(..., description="Plot: 'Upper', 'Middle', or 'Lower'")
    species: str
    dbh_cm: float = Field(..., gt=0, description="Initial DBH in cm")
    count: int = Field(..., gt=0, description="Number of trees in this group")


class ScenarioSimulateRequest(BaseModel):
    """Request model for scenario simulation"""
    mode: str = Field(default="baseline", description="Simulation mode: 'baseline' (default), 'baseline_stochastic', 'hybrid' (legacy), or 'nn_epsilon' (legacy)")
    years_list: List[int] = Field(default=[0, 5, 10, 20], description="Years to simulate")
    plantings: List[PlantingGroup] = Field(..., min_items=1, description="List of planting groups")


def simulate_cohort_forward(
    plantings: List[PlantingGroup],
    years_ahead: int,
    mode: str = "baseline"
) -> Dict:
    """
    Simulate a cohort of planted trees forward efficiently.
    
    Aggregates by (species, plot, dbh_cm) and simulates one representative tree per group,
    then multiplies by count.
    
    Parameters
    ----------
    plantings : List[PlantingGroup]
        List of planting groups
    years_ahead : int
        Number of years to simulate forward
    mode : str
        Simulation mode: "baseline" (default), "baseline_stochastic", "hybrid" (legacy), or "nn_epsilon" (legacy)
    
    Returns
    -------
    Dict
        Summary with total_carbon_kgC, num_trees, mean_dbh_cm
    """
    if years_ahead == 0:
        # Year 0: just sum up initial carbon
        total_carbon = 0.0
        total_trees = 0
        weighted_dbh_sum = 0.0
        
        for group in plantings:
            carbon_per_tree = carbon_from_dbh(group.dbh_cm, group.species)
            total_carbon += carbon_per_tree * group.count
            total_trees += group.count
            weighted_dbh_sum += group.dbh_cm * group.count
        
        mean_dbh = weighted_dbh_sum / total_trees if total_trees > 0 else 0.0
        
        return {
            "total_carbon_kgC": total_carbon,
            "num_trees": total_trees,
            "mean_dbh_cm": mean_dbh
        }
    
    # For years > 0, simulate each unique (species, plot, dbh_cm) group
    total_carbon = 0.0
    total_trees = 0
    weighted_dbh_sum = 0.0
    
    # Aggregate by unique (species, plot, dbh_cm)
    groups = {}
    for planting in plantings:
        key = (planting.species, planting.plot, planting.dbh_cm)
        if key not in groups:
            groups[key] = {
                'species': planting.species,
                'plot': planting.plot,
                'dbh_cm': planting.dbh_cm,
                'count': 0
            }
        groups[key]['count'] += planting.count
    
    # Simulate each unique group
    for key, group_data in groups.items():
        species = group_data['species']
        plot = group_data['plot']
        start_dbh = group_data['dbh_cm']
        count = group_data['count']
        
        # Simulate forward years_ahead steps
        current_dbh = start_dbh
        
        # Setup RNG for stochastic mode
        import numpy as np
        rng = None
        if mode == "baseline_stochastic":
            rng = np.random.default_rng(123)  # Fixed seed for reproducibility
        
        for year_idx in range(years_ahead):
            if mode in ["baseline", "baseline_stochastic"]:
                # Use baseline simulation
                result = predict_delta_sim(
                    prev_dbh_cm=current_dbh,
                    species=species,
                    plot=plot,
                    gap_years=1.0,
                    mode=mode,
                    rng=rng
                )
                delta_used = result['delta_used']
            elif mode == "hybrid":
                # Legacy hybrid mode
                delta_base, delta_resid, delta_total = predict_delta_hybrid(
                    prev_dbh_cm=current_dbh,
                    species=species,
                    plot=plot,
                    gap_years=1.0
                )
                delta_used = max(0.0, delta_total)
            else:
                # Fallback to NN state model (legacy)
                from models.dbh_growth_nn import predict_dbh_next_year_nn
                next_dbh = predict_dbh_next_year_nn(
                    prev_dbh_cm=current_dbh,
                    species=species,
                    plot=plot,
                    gap_years=1.0
                )
                delta_used = max(0.0, next_dbh - current_dbh)
            
            current_dbh = current_dbh + delta_used
        
        # Compute carbon at final DBH
        carbon_per_tree = carbon_from_dbh(current_dbh, species)
        total_carbon += carbon_per_tree * count
        total_trees += count
        weighted_dbh_sum += current_dbh * count
    
    mean_dbh = weighted_dbh_sum / total_trees if total_trees > 0 else 0.0
    
    return {
        "total_carbon_kgC": total_carbon,
        "num_trees": total_trees,
        "mean_dbh_cm": mean_dbh
    }


@app.post("/scenario/simulate")
async def simulate_scenario(request: ScenarioSimulateRequest) -> Dict:
    """
    Simulate a planting scenario and return comparison summaries.
    
    This endpoint efficiently simulates planting scenarios by:
    - Loading baseline snapshots (cached)
    - Simulating cohort forward for each horizon
    - Combining baseline + cohort to get scenario totals
    - Computing deltas
    
    Returns summaries organized by year with baseline, cohort, scenario, and delta metrics.
    """
    try:
        mode = request.mode
        years_list = sorted(request.years_list)
        
        # Get baseline summaries for each year
        baseline_by_year = {}
        for years_ahead in years_list:
            baseline_summary = await get_summary(years_ahead=years_ahead, mode=mode)
            baseline_by_year[str(years_ahead)] = {
                "num_trees": baseline_summary["num_trees"],
                "mean_dbh_cm": baseline_summary["mean_dbh_cm"],
                "total_carbon_kgC": baseline_summary["total_carbon_kgC"]
            }
        
        # Simulate cohort for each horizon
        cohort_by_year = {}
        scenario_by_year = {}
        delta_by_year = {}
        
        for years_ahead in years_list:
            # Simulate cohort forward
            cohort_summary = simulate_cohort_forward(
                plantings=request.plantings,
                years_ahead=years_ahead,
                mode=mode
            )
            cohort_by_year[str(years_ahead)] = cohort_summary
            
            # Combine baseline + cohort
            baseline = baseline_by_year[str(years_ahead)]
            scenario_summary = {
                "num_trees": baseline["num_trees"] + cohort_summary["num_trees"],
                "total_carbon_kgC": baseline["total_carbon_kgC"] + cohort_summary["total_carbon_kgC"]
            }
            
            # Weighted mean DBH
            baseline_weight = baseline["num_trees"]
            cohort_weight = cohort_summary["num_trees"]
            total_weight = baseline_weight + cohort_weight
            
            if total_weight > 0:
                scenario_summary["mean_dbh_cm"] = (
                    baseline["mean_dbh_cm"] * baseline_weight +
                    cohort_summary["mean_dbh_cm"] * cohort_weight
                ) / total_weight
            else:
                scenario_summary["mean_dbh_cm"] = 0.0
            
            scenario_by_year[str(years_ahead)] = scenario_summary
            
            # Compute delta
            delta_by_year[str(years_ahead)] = {
                "num_trees": cohort_summary["num_trees"],
                "mean_dbh_cm": scenario_summary["mean_dbh_cm"] - baseline["mean_dbh_cm"],
                "total_carbon_kgC": cohort_summary["total_carbon_kgC"]
            }
        
        return {
            "success": True,
            "baseline_by_year": baseline_by_year,
            "cohort_by_year": cohort_by_year,
            "scenario_by_year": scenario_by_year,
            "delta_by_year": delta_by_year
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Snapshot Endpoints (for time slider)
# ============================================================================

@app.get("/snapshots/years")
async def get_available_years() -> Dict:
    """
    Get list of available snapshot years for hybrid mode.
    Returns [0, 5, 10, 20] for hybrid snapshots.
    """
    return {
        "success": True,
        "years": [0, 5, 10, 20]
    }


@app.get("/snapshots")
async def get_snapshot(years_ahead: int = 0) -> Dict:
    """
    Get forest snapshot for a specific year.
    """
    snapshots_dir = PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    snapshot_file = snapshots_dir / f"forest_nn_{years_ahead}_years.csv"
    
    if not snapshot_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot for {years_ahead} years not found"
        )
    
    try:
        df = pd.read_csv(snapshot_file)
        return {
            "success": True,
            "years_ahead": years_ahead,
            "data": df.to_dict(orient="records"),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/summary")
async def get_summary(years_ahead: int = 0, mode: str = "baseline") -> Dict:
    """
    Get summary metrics for a specific snapshot year.
    
    Parameters
    ----------
    years_ahead : int
        Years ahead to get summary for (0, 5, 10, or 20)
    mode : str
        Simulation mode: "baseline" (default), "baseline_stochastic", "hybrid" (legacy), or "nn_epsilon" (legacy)
    """
    cache_key = (mode, years_ahead)
    
    if cache_key in _summary_cache:
        return _summary_cache[cache_key]
    
    try:
        df = load_snapshot(years_ahead, mode=mode)
        
        # Calculate summary metrics
        total_carbon = df['carbon_at_time'].sum()
        mean_dbh = df['DBH_cm'].mean()
        
        # Plot breakdown
        plot_breakdown = df.groupby('Plot').agg({
            'carbon_at_time': 'sum',
            'TreeID': 'count'
        }).rename(columns={'TreeID': 'count'}).to_dict(orient='index')
        
        # Convert plot breakdown to simpler format
        plot_breakdown_simple = {
            k: {
                'carbon_at_time': float(v['carbon_at_time']),
                'count': int(v['count'])
            }
            for k, v in plot_breakdown.items()
        }
        
        # Species breakdown (top 10 by carbon)
        species_breakdown = df.groupby('Species').agg({
            'carbon_at_time': 'sum'
        }).sort_values('carbon_at_time', ascending=False).head(10).to_dict(orient='index')
        
        result = {
            "success": True,
            "years_ahead": years_ahead,
            "num_trees": len(df),
            "mean_dbh_cm": float(mean_dbh),
            "total_carbon_kgC": float(total_carbon),
            "plot_breakdown": plot_breakdown_simple,
            "species_breakdown": {k: float(v['carbon_at_time']) for k, v in species_breakdown.items()}
        }
        
        _summary_cache[cache_key] = result
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health Check
# ============================================================================

# ============================================================================
# Area Scaling Endpoints
# ============================================================================

@app.get("/area/plot-areas")
async def get_plot_areas() -> Dict:
    """
    Get current plot areas configuration.
    
    Returns
    -------
    Dict
        Dictionary mapping plot names to area dictionaries
    """
    try:
        areas = load_plot_areas()
        return {
            "success": True,
            "plot_areas": areas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/area/densities")
async def get_area_densities(mode: str = Query("baseline", description="Simulation mode")) -> Dict:
    """
    Get carbon and tree densities by plot at all horizons.
    
    Parameters
    ----------
    mode : str
        Simulation mode ('baseline' or 'baseline_stochastic')
    
    Returns
    -------
    Dict
        Dictionary with densities by plot and horizon, plus sequestration rates
    """
    try:
        result = compute_all_densities(mode=mode)
        return {
            "success": True,
            "mode": mode,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ScaleAreaRequest(BaseModel):
    mode: str = Field("baseline", description="Simulation mode")
    target_area_m2: float = Field(..., description="Target area in square meters")
    reference: str = Field(..., description="Reference: plot name, 'Average', or 'Range'")


@app.post("/area/scale")
async def scale_area(request: ScaleAreaRequest) -> Dict:
    """
    Scale carbon densities to a target area.
    
    Parameters
    ----------
    request : ScaleAreaRequest
        Request body with mode, target_area_m2, and reference
    
    Returns
    -------
    Dict
        Scaled totals at horizons 0/5/10/20, plus sequestration rates
    """
    try:
        plot_areas = load_plot_areas()
        densities_data = compute_all_densities(mode=request.mode)
        densities_by_horizon = densities_data["densities_by_horizon"]
        sequestration_rates = densities_data["sequestration_rates"]
        
        horizons = [0, 5, 10, 20]
        scaled_results = {}
        
        if request.reference == "Average":
            # Check if all plot areas are available
            plots_with_areas = densities_data["plots_with_areas"]
            if len(plots_with_areas) < 3:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot compute average: not all plot areas are configured"
                )
            
            # Average densities across plots
            for horizon in horizons:
                carbon_densities = [
                    densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"]
                    for p in plots_with_areas
                    if densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"] is not None
                ]
                
                if carbon_densities:
                    avg_density = np.mean(carbon_densities)
                    scaled_results[horizon] = {
                        "total_carbon_kgC": scale_to_area(avg_density, request.target_area_m2),
                        "reference_density_kgC_per_m2": avg_density,
                        "reference_type": "Average"
                    }
        
        elif request.reference == "Range":
            # Use min/max densities
            plots_with_areas = densities_data["plots_with_areas"]
            if len(plots_with_areas) < 2:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot compute range: need at least 2 plots with areas configured"
                )
            
            for horizon in horizons:
                carbon_densities = [
                    densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"]
                    for p in plots_with_areas
                    if densities_by_horizon[horizon][p]["carbon_density_kgC_per_m2"] is not None
                ]
                
                if carbon_densities:
                    min_density = min(carbon_densities)
                    max_density = max(carbon_densities)
                    scaled_results[horizon] = {
                        "low": {
                            "total_carbon_kgC": scale_to_area(min_density, request.target_area_m2),
                            "reference_density_kgC_per_m2": min_density
                        },
                        "high": {
                            "total_carbon_kgC": scale_to_area(max_density, request.target_area_m2),
                            "reference_density_kgC_per_m2": max_density
                        },
                        "reference_type": "Range"
                    }
        
        else:
            # Single plot reference
            if request.reference not in ["Upper", "Middle", "Lower"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid reference: {request.reference}. Must be 'Upper', 'Middle', 'Lower', 'Average', or 'Range'"
                )
            
            plot_area = plot_areas.get(request.reference, {}).get("area_m2")
            if plot_area is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Plot area not configured for {request.reference}"
                )
            
            for horizon in horizons:
                density_data = densities_by_horizon[horizon].get(request.reference)
                if density_data and density_data["carbon_density_kgC_per_m2"] is not None:
                    density = density_data["carbon_density_kgC_per_m2"]
                    scaled_results[horizon] = {
                        "total_carbon_kgC": scale_to_area(density, request.target_area_m2),
                        "reference_density_kgC_per_m2": density,
                        "reference_type": request.reference
                    }
        
        # Compute annual sequestration (0→20)
        annual_sequestration = None
        if request.reference == "Range":
            # For range, compute sequestration for both low and high
            seq_0_20 = sequestration_rates.get("0→20", {})
            plots_with_areas = densities_data["plots_with_areas"]
            seq_densities = [
                seq_0_20.get(p) for p in plots_with_areas
                if seq_0_20.get(p) is not None
            ]
            if seq_densities:
                min_seq = min(seq_densities)
                max_seq = max(seq_densities)
                annual_sequestration = {
                    "low": {
                        "kgC_per_year": scale_to_area(min_seq, request.target_area_m2),
                        "kgCO2e_per_year": scale_to_area(min_seq, request.target_area_m2) * 3.667
                    },
                    "high": {
                        "kgC_per_year": scale_to_area(max_seq, request.target_area_m2),
                        "kgCO2e_per_year": scale_to_area(max_seq, request.target_area_m2) * 3.667
                    }
                }
        else:
            # Single reference or average
            if request.reference == "Average":
                seq_0_20 = sequestration_rates.get("0→20", {})
                plots_with_areas = densities_data["plots_with_areas"]
                seq_densities = [
                    seq_0_20.get(p) for p in plots_with_areas
                    if seq_0_20.get(p) is not None
                ]
                if seq_densities:
                    avg_seq = np.mean(seq_densities)
                    annual_sequestration = {
                        "kgC_per_year": scale_to_area(avg_seq, request.target_area_m2),
                        "kgCO2e_per_year": scale_to_area(avg_seq, request.target_area_m2) * 3.667
                    }
            else:
                seq_0_20 = sequestration_rates.get("0→20", {})
                seq_density = seq_0_20.get(request.reference)
                if seq_density is not None:
                    annual_sequestration = {
                        "kgC_per_year": scale_to_area(seq_density, request.target_area_m2),
                        "kgCO2e_per_year": scale_to_area(seq_density, request.target_area_m2) * 3.667
                    }
        
        # Format results by horizon
        results_by_horizon = {}
        for horizon in horizons:
            if horizon in scaled_results:
                result = scaled_results[horizon]
                if request.reference == "Range":
                    results_by_horizon[horizon] = {
                        "low": {
                            "total_carbon_kgC": result["low"]["total_carbon_kgC"],
                            "total_co2e_kg": result["low"]["total_carbon_kgC"] * 3.667
                        },
                        "high": {
                            "total_carbon_kgC": result["high"]["total_carbon_kgC"],
                            "total_co2e_kg": result["high"]["total_carbon_kgC"] * 3.667
                        }
                    }
                else:
                    results_by_horizon[horizon] = {
                        "total_carbon_kgC": result["total_carbon_kgC"],
                        "total_co2e_kg": result["total_carbon_kgC"] * 3.667
                    }
        
        return {
            "success": True,
            "mode": request.mode,
            "target_area_m2": request.target_area_m2,
            "reference": request.reference,
            "results_by_horizon": results_by_horizon,
            "annual_sequestration": annual_sequestration,
            "metadata": {
                "densities_used": scaled_results
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uncertainty/summary")
async def get_uncertainty_summary() -> Dict:
    """
    Get model uncertainty summary with CO2e and miles driven analogies.
    
    Returns
    -------
    Dict
        Uncertainty metrics including per-tree and forest-wide statistics
    """
    import json
    
    uncertainty_path = PROCESSED_DATA_DIR / "diagnostics" / "uncertainty_summary.json"
    
    if not uncertainty_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Uncertainty summary not found. Please generate it first."
        )
    
    try:
        with open(uncertainty_path, 'r') as f:
            data = json.load(f)
        return {
            "success": True,
            **data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "name": "Carbon DBH Forest Simulation API",
        "version": "1.0.0",
        "endpoints": {
            "single_tree": "/predict/tree",
            "planting_recipe": "/scenarios/planting/recipe",
            "planting_explicit": "/scenarios/planting/explicit",
            "presets": "/scenarios/presets",
            "snapshots": "/snapshots",
            "summary": "/summary"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
