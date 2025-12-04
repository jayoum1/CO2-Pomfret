"""
Species classification functions for forestry analysis.

Provides functions to classify tree species into groups (hardwood/softwood)
and validate species names.
"""
import sys
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def classify_group(species: str) -> str:
    """
    Classify species into 'hardwood' or 'softwood' based on its name.

    This is a simple keyword-based classifier:
    - Anything with 'pine', 'spruce', 'fir', 'hemlock', 'cedar' -> softwood
    - Everything else -> hardwood

    Parameters
    ----------
    species : str
        Species name (case-insensitive)

    Returns
    -------
    str
        Either 'hardwood' or 'softwood'

    Examples
    --------
    >>> classify_group("red oak")
    'hardwood'
    >>> classify_group("white pine")
    'softwood'
    >>> classify_group("Eastern Hemlock")
    'softwood'
    """
    if not isinstance(species, str):
        return 'hardwood'  # default

    s = species.strip().lower()

    softwood_keywords = ['pine', 'spruce', 'fir', 'hemlock', 'cedar']
    if any(kw in s for kw in softwood_keywords):
        return 'softwood'
    else:
        return 'hardwood'


def get_species_info(species: str) -> dict:
    """
    Get information about a species (future enhancement).
    
    Parameters
    ----------
    species : str
        Species name
        
    Returns
    -------
    dict
        Dictionary with species information:
        - 'group': 'hardwood' or 'softwood'
        - 'name': normalized species name
        - Future: 'common_name', 'scientific_name', etc.
    """
    return {
        'group': classify_group(species),
        'name': species.strip().lower(),
    }


def validate_species_name(species: str) -> bool:
    """
    Validate that a species name is acceptable (future enhancement).
    
    Parameters
    ----------
    species : str
        Species name to validate
        
    Returns
    -------
    bool
        True if species name is valid, False otherwise
    """
    if not isinstance(species, str):
        return False
    
    if len(species.strip()) == 0:
        return False
    
    # Future: Add more validation rules
    # - Check against known species database
    # - Validate format
    # - Check for typos
    
    return True

