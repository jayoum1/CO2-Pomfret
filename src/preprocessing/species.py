import os
import pandas as pd
import sys
import re
from pathlib import Path

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CARBON_PROCESSED_DIR


def clean_species_name(species: str) -> str:
    """
    Clean and standardize species names by:
    1. Removing parenthetical notes (e.g., "(says osully)")
    2. Lowercasing and stripping whitespace
    3. Handling common inconsistencies
    
    Parameters
    ----------
    species : str
        Raw species name
        
    Returns
    -------
    str
        Cleaned species name
    """
    if not isinstance(species, str) or pd.isna(species):
        return species
    
    # Convert to string and strip whitespace
    cleaned = str(species).strip()
    
    # Remove parenthetical notes: (says X), (X), etc.
    # Pattern matches: (says osully), (osully), (note), etc.
    cleaned = re.sub(r'\s*\([^)]*\)', '', cleaned)
    
    # Remove common prefixes/suffixes that are notes
    # e.g., "the american hophorn beam" -> "american hophorn beam"
    cleaned = re.sub(r'^the\s+', '', cleaned, flags=re.IGNORECASE)
    
    # Handle common inconsistencies
    # "muscle wood" -> "musclewood" (remove space)
    cleaned = re.sub(r'\bmuscle\s+wood\b', 'musclewood', cleaned, flags=re.IGNORECASE)
    
    # "hop hornbeam" -> "hophornbeam" (standardize spacing)
    cleaned = re.sub(r'\bhop\s+hornbeam\b', 'hophornbeam', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bhophorn\s+beam\b', 'hophornbeam', cleaned, flags=re.IGNORECASE)
    
    # "mocker nut hickory" -> "mockernut hickory" (standardize)
    cleaned = re.sub(r'\bmocker\s+nut\b', 'mockernut', cleaned, flags=re.IGNORECASE)
    
    # Lowercase and strip again after replacements
    cleaned = cleaned.lower().strip()
    
    # Remove multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    return cleaned


# --- SET THIS TO YOUR PROCESSED FOLDER ---
FOLDER = str(CARBON_PROCESSED_DIR)

print("=" * 70)
print("STANDARDIZING SPECIES NAMES")
print("=" * 70)

# Track changes for reporting
total_changes = 0

# Loop through all CSVs in the folder
for filename in os.listdir(FOLDER):
    if filename.endswith(".csv"):
        path = os.path.join(FOLDER, filename)

        # Load CSV
        df = pd.read_csv(path)

        # Standardize species column if present
        if "Species" in df.columns:
            # Count unique species before cleaning
            species_before = df["Species"].nunique()
            
            # Apply cleaning function
            df["Species"] = df["Species"].apply(clean_species_name)
            
            # Count unique species after cleaning
            species_after = df["Species"].nunique()
            
            # Save back (overwrite original)
            df.to_csv(path, index=False)
            
            changes = species_before - species_after
            total_changes += changes
            
            print(f"✓ {filename}")
            print(f"  Species before: {species_before}, after: {species_after}")
            if changes > 0:
                print(f"  → Merged {changes} species variant(s)")

print("\n" + "=" * 70)
print(f"Done! All species names cleaned. Merged {total_changes} species variant(s) total.")
print("=" * 70)