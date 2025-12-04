# STEP 3: Modularization Opportunities Analysis

## Current Code Organization

### Forestry Domain Logic (Currently Mixed)

**Location:** `src/preprocessing/carbon_calc.py`

**Functions to Extract:**
1. `classify_group(species: str) -> str` (lines 18-37)
   - Classifies species as hardwood/softwood
   - Uses keyword matching
   - **Should move to:** `src/forestry/species_classifier.py`

2. `dbh_to_carbon_from_inches(dbh_in, species)` (lines 44-85)
   - Converts DBH (inches) → Carbon using allometric equations
   - Uses `classify_group()` internally
   - **Should move to:** `src/forestry/allometry.py`

### Growth Rate Calculations (Currently Duplicated)

**Locations:**
- `src/preprocessing/transform.py` - DBH growth rate calculation (lines 100-130)
- `src/preprocessing/carbon_calc.py` - Carbon growth rate calculation (lines 127-140)
- `src/preprocessing/growth.py` - CarbonGrowth absolute calculation
- `src/preprocessing/outliers.py` - Recomputes growth rates for specific trees

**Pattern Identified:**
All use similar logic:
- Calculate gap years
- Compute relative growth: `(current - previous) / (gap_years * previous)`
- Handle initial measurements vs subsequent measurements

**Should extract to:** `src/utils/growth_calculations.py` or `src/forestry/growth.py`

### Statistical Analysis (Currently Mixed)

**Location:** `src/analysis/modeling.py`

**Functions:**
- `run_anova()` (lines 45-71)
- Linear regression training
- Model evaluation

**Consider:** Split ANOVA into `src/analysis/anova.py` for better organization

---

## Recommended Module Structure

### 1. `src/forestry/` - Domain-Specific Forestry Logic

```
src/forestry/
├── __init__.py
├── allometry.py          # DBH → biomass/carbon conversions
├── species_classifier.py # Hardwood/softwood classification
├── growth.py             # Growth rate calculations (optional)
└── valuation.py          # Future: timber value calculations
```

**Benefits:**
- Separates domain knowledge from data processing
- Reusable across different analysis pipelines
- Easy to extend with new allometric equations
- Can be tested independently

### 2. `src/utils/` - Shared Utilities

```
src/utils/
├── __init__.py
├── growth_calculations.py  # Generic growth rate functions
└── helpers.py              # Other shared utilities
```

**Functions to Extract:**
- Generic growth rate calculation (relative, annualized)
- Growth type classification (initial, normal, annualized)
- Can be used by both DBH and Carbon growth calculations

### 3. `src/crawling/` - External Data Integration (Future)

```
src/crawling/
├── __init__.py
└── timber_prices_crawler.py  # Web scraping for timber prices
```

**Purpose:**
- Fetch real-time timber prices
- Update valuation models
- Integrate external market data

---

## Detailed Extraction Plan

### Phase 1: Extract Species Classification

**From:** `src/preprocessing/carbon_calc.py`
**To:** `src/forestry/species_classifier.py`

**Functions:**
- `classify_group(species: str) -> str`
- Future: `get_species_info(species: str) -> dict`
- Future: `validate_species_name(species: str) -> bool`

**Dependencies:**
- None (pure function)

**Impact:**
- `carbon_calc.py` will import from `forestry.species_classifier`
- No breaking changes if done correctly

### Phase 2: Extract Allometric Equations

**From:** `src/preprocessing/carbon_calc.py`
**To:** `src/forestry/allometry.py`

**Functions:**
- `dbh_to_carbon_from_inches(dbh_in, species)` → `dbh_to_carbon()`
- Future: `dbh_to_biomass(dbh_cm, group)` 
- Future: `dbh_to_volume(dbh_cm, height, group)` (if height data available)
- Future: `dbh_to_height(dbh_cm, species)` (if allometric height equations available)

**Dependencies:**
- `forestry.species_classifier.classify_group`
- `config.ALLOMETRIC_COEFFS`
- `config.CARBON_FRACTION`

**Impact:**
- `carbon_calc.py` will import from `forestry.allometry`
- Can add more allometric equations without touching preprocessing code

### Phase 3: Extract Growth Rate Calculations

**From:** Multiple files
**To:** `src/utils/growth_calculations.py`

**Functions:**
- `calculate_growth_rate(current, previous, gap_years)` → relative annualized
- `calculate_absolute_growth(current, previous, gap_years)` → absolute per year
- `classify_growth_type(gap_years)` → 'initial', 'normal', 'annualized'

**Dependencies:**
- None (pure functions)

**Impact:**
- All growth calculations use same logic
- Easier to maintain and test
- Consistent behavior across DBH and Carbon growth

### Phase 4: Create Valuation Module (Future)

**To:** `src/forestry/valuation.py`

**Functions (Future):**
- `calculate_timber_value(volume, species, market_prices)`
- `calculate_carbon_value(carbon_kg, carbon_price_per_kg)`
- `calculate_total_tree_value(timber_value, carbon_value)`

**Dependencies:**
- `forestry.allometry` (for volume calculations)
- `crawling.timber_prices_crawler` (for market prices)

---

## Implementation Priority

### High Priority (Do Now)
1. ✅ Extract `classify_group()` → `forestry/species_classifier.py`
2. ✅ Extract `dbh_to_carbon_from_inches()` → `forestry/allometry.py`
3. ✅ Create `forestry/valuation.py` placeholder

### Medium Priority (Do Soon)
4. Extract growth rate calculations → `utils/growth_calculations.py`
5. Split ANOVA from modeling → `analysis/anova.py`

### Low Priority (Future)
6. Create `crawling/timber_prices_crawler.py` placeholder
7. Add height/biomass/volume allometric equations
8. Add species validation and standardization

---

## Benefits of This Structure

1. **Separation of Concerns**
   - Domain logic (forestry) separate from data processing
   - Reusable functions across different scripts
   - Easier to test individual components

2. **Extensibility**
   - Add new allometric equations without touching preprocessing
   - Add new species classifications easily
   - Integrate external data sources cleanly

3. **Maintainability**
   - Single source of truth for allometric equations
   - Consistent growth rate calculations
   - Clear module boundaries

4. **Future-Proof**
   - Ready for web app integration
   - Can expose forestry functions as API endpoints
   - Easy to add new valuation models

---

## Next Steps

1. Create `src/forestry/` directory structure
2. Extract species classification
3. Extract allometric equations
4. Update imports in `carbon_calc.py`
5. Create placeholder modules for future use
6. Test that everything still works

