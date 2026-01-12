"""
Scenarios Module

Provides functions for creating and simulating tree planting scenarios.
"""

from .planting import (
    generate_planting_trees,
    simulate_planting_scenario,
    compare_scenarios,
    load_scenario,
    save_scenario
)

__all__ = [
    'generate_planting_trees',
    'simulate_planting_scenario',
    'compare_scenarios',
    'load_scenario',
    'save_scenario'
]
