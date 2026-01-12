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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd

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

class ScenarioTreeRequest(BaseModel):
    """Model for a single tree in scenario simulation"""
    species: str
    plot: str = Field(..., description="Plot: 'Upper', 'Middle', or 'Lower'")
    dbh_cm: float = Field(..., gt=0, description="Initial DBH in cm")


class ScenarioSimulateRequest(BaseModel):
    """Request model for scenario simulation (simplified for frontend)"""
    years_list: List[int] = Field(default=[0, 5, 10, 20], description="Years to simulate")
    new_trees: List[ScenarioTreeRequest] = Field(..., min_items=1, description="List of trees to plant")


@app.post("/scenario/simulate")
async def simulate_scenario(request: ScenarioSimulateRequest) -> Dict:
    """
    Simulate a planting scenario and return comparison summaries.
    
    This endpoint is optimized for the Next.js frontend:
    - Takes a simple list of new trees
    - Returns baseline vs scenario summaries at each horizon
    - Efficiently simulates only new trees and adds to baseline snapshots
    """
    try:
        # Convert to explicit trees format
        explicit_trees = [
            {"species": tree.species, "plot": tree.plot, "dbh_cm": tree.dbh_cm}
            for tree in request.new_trees
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
        comparison_df = compare_scenarios(scenario_results, years_list=request.years_list)
        
        # Format summaries for frontend
        summaries = []
        for _, row in comparison_df.iterrows():
            summaries.append({
                "years_ahead": int(row["years_ahead"]),
                "baseline_total_carbon": float(row["baseline_total_carbon"]),
                "scenario_total_carbon": float(row["with_planting_total_carbon"]),
                "delta_carbon": float(row["carbon_added"]),
                "baseline_mean_dbh": float(row["baseline_mean_dbh"]),
                "scenario_mean_dbh": float(row["with_planting_mean_dbh"]),
                "baseline_num_trees": int(row["baseline_num_trees"]),
                "scenario_num_trees": int(row["with_planting_num_trees"]),
            })
        
        return {
            "success": True,
            "summaries": summaries
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Snapshot Endpoints (for time slider)
# ============================================================================

@app.get("/snapshots/years")
async def get_available_years() -> Dict:
    """
    Get list of available snapshot years.
    """
    snapshots_dir = PROCESSED_DATA_DIR / "forest_snapshots_nn_epsilon"
    if not snapshots_dir.exists():
        return {
            "success": True,
            "years": []
        }
    
    # Find all snapshot files
    snapshot_files = list(snapshots_dir.glob("forest_nn_*_years.csv"))
    years = []
    for filepath in snapshot_files:
        # Extract year from filename like "forest_nn_5_years.csv"
        try:
            year_str = filepath.stem.split("_")[2]  # Gets "5" from "forest_nn_5_years"
            years.append(int(year_str))
        except (IndexError, ValueError):
            continue
    
    return {
        "success": True,
        "years": sorted(years)
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
async def get_summary(years_ahead: int = 0) -> Dict:
    """
    Get summary metrics for a specific snapshot year.
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
        
        # Calculate summary metrics
        total_carbon = df['carbon_at_time'].sum()
        mean_dbh = df['DBH_cm'].mean()
        
        # Plot breakdown
        plot_breakdown = df.groupby('Plot').agg({
            'carbon_at_time': 'sum',
            'TreeID': 'count'
        }).rename(columns={'TreeID': 'count'}).to_dict(orient='index')
        
        # Species breakdown (top 10 by carbon)
        species_breakdown = df.groupby('Species').agg({
            'carbon_at_time': 'sum'
        }).sort_values('carbon_at_time', ascending=False).head(10).to_dict(orient='index')
        
        return {
            "success": True,
            "years_ahead": years_ahead,
            "num_trees": len(df),
            "mean_dbh_cm": float(mean_dbh),
            "total_carbon_kgC": float(total_carbon),
            "plot_breakdown": plot_breakdown,
            "species_breakdown": {k: float(v['carbon_at_time']) for k, v in species_breakdown.items()}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health Check
# ============================================================================

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
