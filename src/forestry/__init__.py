"""
Forestry domain-specific modules for Carbon DBH project.

This package contains:
- Species classification (hardwood/softwood)
- Allometric equations (DBH → biomass/carbon)
- Valuation calculations (timber value, carbon value)
"""

# Import species classifier (no pandas dependency)
from .species_classifier import classify_group

# Lazy import allometry functions (require pandas)
# Users can import directly: from forestry.allometry import dbh_to_carbon
# Or import from package after pandas is available

__all__ = ['classify_group']

