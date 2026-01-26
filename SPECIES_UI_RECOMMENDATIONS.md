# Species Analysis for Forest Modification UI

## Executive Summary

This analysis evaluates all 23 tree species in the CO2 Pomfret dataset to refine the "Species to Plant/Remove" dropdown options in the Forest Modification page. The goal is to ensure only species with sufficient data and baseline growth curves are available for simulation.

## Dataset Overview

- **Total Records:** 3,063 measurements
- **Unique Trees:** 442 trees
- **Unique Species:** 23 species
- **Species with Baseline Growth Curves:** 22 species (95.7%)

## Species Distribution by Plot

### Summary Statistics

| Plot | Species Count | Tree Count | Record Count | Dominant Species |
|------|---------------|------------|--------------|------------------|
| **Upper** | 3 | 121 | 1,065 | sugar maple (104 trees) |
| **Middle** | 15 | 131 | 499 | sugar maple (89 trees) |
| **Lower** | 18 | 191 | 1,499 | black birch (53 trees) |

**Total:** 442 trees across 3 plots (some species appear in multiple plots)

### Upper Plot (3 species, 121 trees)

The Upper plot has the lowest species diversity but the highest record count per tree:

- **sugar maple:** 104 trees (85.9% of plot)
- **norway maple:** 15 trees (12.4% of plot)
- **red maple:** 2 trees (1.7% of plot)

**Characteristics:**
- Low species diversity (only 3 species)
- Dominated by sugar maple
- High measurement frequency (8.8 records per tree on average)

### Middle Plot (15 species, 131 trees)

The Middle plot has moderate diversity with sugar maple as the dominant species:

- **sugar maple:** 89 trees (67.9% of plot)
- **red oak:** 12 trees (9.2% of plot)
- **mockernut hickory:** 8 trees (6.1% of plot)
- **beech:** 6 trees (4.6% of plot)
- **pignut hickory:** 3 trees (2.3% of plot)
- **white ash:** 3 trees (2.3% of plot)
- **basswood:** 2 trees (1.5% of plot)
- **Other species:** 8 species with 1 tree each (american hophornbeam, black birch, black oak, hophornbeam, mockernut, norway maple, red maple, sassafras)

**Characteristics:**
- Moderate species diversity (15 species)
- Sugar maple dominant but more balanced than Upper plot
- Several species with only 1 tree (low statistical reliability)

### Lower Plot (18 species, 191 trees)

The Lower plot has the highest species diversity and tree count:

- **black birch:** 53 trees (27.7% of plot)
- **musclewood:** 46 trees (24.1% of plot)
- **sugar maple:** 29 trees (15.2% of plot)
- **red oak:** 19 trees (9.9% of plot)
- **white pine:** 10 trees (5.2% of plot)
- **shagbark hickory:** 7 trees (3.7% of plot)
- **red maple:** 6 trees (3.1% of plot)
- **beech:** 5 trees (2.6% of plot)
- **burning bush:** 3 trees (1.6% of plot)
- **pignut hickory:** 3 trees (1.6% of plot)
- **black oak:** 2 trees (1.0% of plot)
- **mockernut hickory:** 2 trees (1.0% of plot)
- **Other species:** 6 species with 1 tree each (autumn olive, white ash, norway maple, dogwood, buckthorn, yellow birch)

**Characteristics:**
- Highest species diversity (18 species)
- Most balanced species distribution
- Black birch and musclewood are dominant (not sugar maple)
- Several rare species with only 1 tree

### Cross-Plot Species Distribution

**Species found in all 3 plots:**
- sugar maple (Upper: 104, Middle: 89, Lower: 29)
- norway maple (Upper: 15, Middle: 1, Lower: 1)
- red maple (Upper: 2, Middle: 1, Lower: 6)

**Species found in 2 plots:**
- red oak (Middle: 12, Lower: 19)
- beech (Middle: 6, Lower: 5)
- mockernut hickory (Middle: 8, Lower: 2)
- pignut hickory (Middle: 3, Lower: 3)
- black oak (Middle: 1, Lower: 2)
- white ash (Middle: 3, Lower: 1)

**Plot-specific species:**
- **Upper only:** None (all species also found elsewhere)
- **Middle only:** american hophornbeam, basswood, hophornbeam, mockernut, sassafras
- **Lower only:** black birch, musclewood, white pine, shagbark hickory, burning bush, autumn olive, dogwood, buckthorn, yellow birch

### Implications for Forest Modification UI

1. **Plot Selection Matters:** Species availability varies significantly by plot:
   - Upper plot: Very limited options (only 3 species)
   - Middle plot: Moderate options (15 species, but many rare)
   - Lower plot: Most diverse (18 species)

2. **Recommended Species Distribution:**
   - All 11 recommended species appear in at least one plot
   - Some species are plot-specific (e.g., black birch and musclewood are Lower-only)
   - Users should be aware that planting certain species may not be appropriate for all plots

3. **Data Quality by Plot:**
   - Upper: High data quality but low diversity
   - Middle: Moderate diversity but many rare species
   - Lower: High diversity but includes many single-tree species

## Recommendation Criteria

A species is **recommended for UI inclusion** if it meets both criteria:
1. ✅ **Has baseline growth curves** (required for simulation)
2. ✅ **Has ≥5 unique trees** (ensures statistical reliability)

## Recommended Species (11 species)

These species should be included in the Forest Modification dropdown:

| Species | Trees | Records | DBH Range (cm) | Notes |
|---------|-------|---------|----------------|-------|
| **sugar maple** | 222 | 1,496 | 0.7 - 76.2 | Most abundant species |
| **black birch** | 54 | 436 | 2.0 - 53.6 | Strong data coverage |
| **musclewood** | 46 | 326 | 0.8 - 49.8 | Good temporal coverage |
| **red oak** | 31 | 218 | 6.2 - 154.9 | Large size range |
| **norway maple** | 17 | 146 | 3.9 - 50.2 | Moderate abundance |
| **white pine** | 10 | 90 | 7.4 - 59.7 | Coniferous species |
| **red maple** | 9 | 64 | 1.3 - 84.2 | Wide DBH range |
| **beech** | 11 | 50 | 2.3 - 15.8 | Small-medium trees |
| **mockernut hickory** | 10 | 46 | 2.5 - 54.6 | Hickory species |
| **shagbark hickory** | 7 | 44 | 1.8 - 43.6 | Hickory species |
| **pignut hickory** | 6 | 39 | 4.9 - 24.0 | Hickory species |

**Total:** 416 trees (94.1% of dataset), 2,935 records (95.8% of dataset)

## Species with Curves but Low Data (<5 trees)

These species have baseline growth curves but insufficient data for reliable simulation:

| Species | Trees | Records | DBH Range (cm) | Recommendation |
|---------|-------|---------|----------------|----------------|
| **black oak** | 3 | 22 | 5.3 - 55.1 | ⚠️ Consider including (close to threshold) |
| **white ash** | 4 | 18 | 7.1 - 39.1 | ⚠️ Consider including (close to threshold) |
| **burning bush** | 3 | 16 | 3.5 - 16.1 | ❌ Exclude (invasive, low data) |
| **yellow birch** | 1 | 9 | 10.3 - 28.9 | ❌ Exclude (single tree) |
| **dogwood** | 1 | 9 | 3.0 - 8.4 | ❌ Exclude (single tree) |
| **basswood** | 2 | 8 | 34.8 - 44.7 | ❌ Exclude (only 2 trees) |
| **autumn olive** | 1 | 5 | 2.3 - 2.8 | ❌ Exclude (invasive, single tree) |
| **buckthorn** | 1 | 5 | 3.1 - 6.1 | ❌ Exclude (invasive, single tree) |
| **mockernut** | 1 | 4 | 26.9 - 27.2 | ❌ Exclude (single tree) |
| **sassafras** | 1 | 4 | 41.9 - 43.4 | ❌ Exclude (single tree) |
| **hophornbeam** | 1 | 4 | 9.1 - 9.9 | ❌ Exclude (single tree) |

**Special Cases:**
- **black oak** and **white ash**: Close to the 5-tree threshold. Consider including if they're ecologically important, but note limited statistical reliability.
- **burning bush**, **autumn olive**, **buckthorn**: Invasive species - may want to exclude from planting options but allow for removal.

## Species Without Baseline Curves

| Species | Trees | Records | Status |
|---------|-------|---------|--------|
| **american hophornbeam** | 1 | 4 | ❌ Cannot simulate (no baseline curve) |

## Current UI Status

The current `AVAILABLE_SPECIES` list includes:
- ✅ **Included correctly:** red oak, sugar maple, black oak, white pine, yellow birch, red maple
- ❌ **Missing recommended species:** black birch, musclewood, norway maple, beech, mockernut hickory, shagbark hickory, pignut hickory
- ❌ **Included but not in dataset:** white oak, eastern hemlock, tulip poplar, american beech, black cherry

## Recommendations

### Immediate Actions

1. **Add missing recommended species** to `AVAILABLE_SPECIES`:
   - black birch
   - musclewood
   - norway maple
   - beech
   - mockernut hickory
   - shagbark hickory
   - pignut hickory

2. **Remove species not in dataset**:
   - white oak
   - eastern hemlock
   - tulip poplar
   - american beech (note: "beech" exists, not "american beech")
   - black cherry

3. **Consider adding** (close to threshold):
   - white ash (4 trees, has curves)
   - black oak (3 trees, has curves)

### Long-term Considerations

- Monitor species with <5 trees as more data becomes available
- Consider separate "Invasive Species" category for removal-only options
- Update species list annually as dataset grows

## Visualizations

All visualizations are saved in `Graphs/Species_Analysis/`:

1. **1_species_by_tree_count.png** - Bar chart showing tree counts with recommendation status
2. **2_species_by_record_count.png** - Bar chart showing measurement records
3. **3_dbh_range_by_species.png** - DBH range visualization
4. **4_species_plot_heatmap.png** - Distribution across Upper/Middle/Lower plots
5. **5_data_quality_scatter.png** - Trees vs Records scatter plot
6. **6_recommendation_comparison.png** - Recommended vs Not Recommended comparison
7. **7_top_recommended_species.png** - Focused view of top 15 recommended species

## Data Files

- **Summary CSV:** `Data/Processed Data/diagnostics/species_summary_for_ui.csv`
- **Plot Distribution:** `Data/Processed Data/diagnostics/species_plot_distribution.csv`

## Methodology

1. Loaded all measurement records from `all_plots_with_carbon.csv`
2. Calculated statistics per species: tree count, record count, DBH ranges, plot distribution
3. Cross-referenced with baseline growth curves (`baseline_growth_bins.csv`)
4. Applied recommendation criteria (≥5 trees AND has baseline curve)
5. Generated R visualizations using ggplot2

---

**Generated:** $(date)
**Dataset:** CO2 Pomfret - All Plots
**Analysis Scripts:** `analyze_species_for_ui.py`, `visualize_species_stats.R`
