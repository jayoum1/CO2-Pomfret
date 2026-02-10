# Visualize Page Implementation Summary

## Overview

Successfully implemented a new **Invasive Species Spread Visualizer** page that provides an interactive, narrative-driven simulation for classroom demonstrations. The implementation reuses the existing map infrastructure and maintains consistency with the app's design system.

---

## Files Created

### Core Simulation Logic
1. **`web/src/lib/sim/invasiveSpread.ts`** - Grid-based cellular automaton for invasive spread
   - `createGrid()` - Creates cell grid over area bounds with point-in-polygon masking
   - `seedInfection()` - Seeds initial infected cells randomly within area
   - `spreadTick()` - Spreads infection to neighbors with probability-based rules
   - `resetGrid()` - Clears infection state
   - `createSeededRNG()` - Seeded random number generator for reproducible demos

### Geospatial Utilities
2. **`web/src/lib/geo/boundaries.ts`** - Area boundary definitions
   - Defines `POMFRET_FOREST` boundary (actual data: 442 trees, 98,805 kg C, 7,500 m²)
   - Defines `CONNECTICUT` boundary (estimated: 292M trees, 73B kg C, 7.3B m²)
   - Includes polygon coordinates, center points, zoom levels, and tree/carbon estimates

3. **`web/src/lib/geo/pointInPolygon.ts`** - Ray casting algorithm for point-in-polygon testing
   - Used to mask simulation grid to selected area boundary

### UI Components
4. **`web/src/components/visualize/InvasiveMap.tsx`** - Leaflet map component
   - Renders selected area boundary with teal highlight
   - Overlays infected cell patches (red rectangles with severity-based opacity)
   - Dynamically updates on area change and simulation ticks
   - Uses dynamic import to avoid SSR issues

### Main Page
5. **`web/src/app/visualize/page.tsx`** - Complete rewrite of Visualize page
   - Area toggle (Pomfret Forest vs Connecticut)
   - Scenario controls (Start/Pause/Resume/Reset)
   - Adjustable spread rate slider (0.05-0.5)
   - Initial outbreak sites selector (2-6)
   - Real-time impact statistics:
     - Trees lost (with mortality percentage)
     - Carbon impact (kg C and kg CO₂e)
     - Area infected percentage
     - Time steps elapsed
   - Responsive two-column layout (controls/stats on left, map on right)

---

## Features

### Area Selection
- Toggle between **Pomfret Forest** (local, measured data) and **Connecticut** (statewide estimate)
- Selected area is visually highlighted on map with teal boundary
- Area info displayed: size, estimated trees, estimated carbon
- Automatic simulation reset when switching areas

### Invasive Spread Simulation
- **Grid Resolution**:
  - Pomfret: 40×40 cells
  - Connecticut: 60×60 cells
- **Seeding**: 2-6 random outbreak sites within area boundary
- **Spread Mechanism**: 
  - Each infected cell attempts to infect 8-neighborhood neighbors
  - Infection probability = `spreadRate × randomModifier` (0.8-1.2)
  - Only cells inside area boundary can be infected (point-in-polygon masking)
- **Tick Interval**: 300ms (configurable)
- **Seeded RNG**: Reproducible demos with seed value 42

### Impact Calculation
- **Trees Lost**: `baselineTrees × mortalityFraction`
  - Mortality fraction = `min(percentInfected × 0.7, 1.0)`
- **Carbon Impact**: `baselineCarbon × mortalityFraction`
  - Displayed in kg C and kg CO₂e (×3.667 conversion)
- **Real-time Updates**: Stats update every tick during simulation

### Visual Design
- Infected cells rendered as semi-transparent red rectangles
- Opacity varies by severity (0.3-0.6 based on cell severity value)
- Smooth area boundary with dashed teal outline
- Consistent with app's color palette (teal, accent, primary, secondary)
- Responsive layout adapts to desktop/mobile

---

## Data Sources

### Pomfret Forest
- **Source**: Actual forest snapshot data from `Data/Processed Data/forest_snapshots_baseline/forest_0_years.csv`
- **Metrics**:
  - Total trees: 442
  - Total carbon: 98,805 kg C
  - Total area: 7,500 m² (3 plots × 2,500 m² each)
  - Tree density: 0.0589 trees/m²
  - Carbon density: 13.174 kg C/m²

### Connecticut
- **Source**: Estimated based on state forestry data
- **Assumptions**:
  - Total forested area: ~7.3 billion m² (1.8 million acres, ~60% of state)
  - Tree density: 0.04 trees/m² (conservative vs Pomfret's 0.0589)
  - Carbon density: 10 kg C/m² (conservative vs Pomfret's 13.174)
- **Metrics**:
  - Estimated trees: 292 million
  - Estimated carbon: 73 billion kg C

---

## Technical Details

### Simulation Algorithm
1. **Grid Creation**: Divide area bounding box into NxN cells
2. **Masking**: Test each cell center against area polygon; mark as `insideArea` or not
3. **Seeding**: Randomly select 2-6 cells inside area to infect
4. **Spread Loop** (every 300ms):
   - For each infected cell, check 8 neighbors
   - If neighbor is uninfected and inside area:
     - Calculate infection probability with randomness
     - Infect if random roll succeeds
5. **Impact Calculation**: 
   - `percentInfected = infectedCellsInArea / totalCellsInArea`
   - Apply mortality multiplier (0.7) to get tree/carbon loss

### Performance Optimizations
- Cells outside area boundary are never rendered
- Canvas/SVG rendering with minimal redraws
- Seeded RNG avoids cryptographic overhead
- Grid resolution optimized per area (40 vs 60)

### User Experience
- Demo-friendly: "Narrative simulation for classroom exploration"
- Clear disclaimer: "Not a precise epidemiological model"
- Reproducible: Same seed produces same spread pattern
- Adjustable: Spread rate and seed count are configurable
- Responsive: Pause/Resume allows observation at any point

---

## How to Use

### Running Locally
1. Ensure backend is running: `python3 -m uvicorn src.api.app:app --port 8000 --reload`
2. Start Next.js dev server: `cd web && npm run dev`
3. Navigate to `http://localhost:3000/visualize`

### User Workflow
1. **Select Area**: Choose Pomfret Forest or Connecticut
2. **Configure**: Adjust spread rate (0.05-0.5) and outbreak sites (2-6)
3. **Start**: Click "Start" to seed and begin simulation
4. **Observe**: Watch red patches spread across the map
5. **Pause/Resume**: Control simulation playback
6. **Reset**: Clear infection and restart

---

## Future Enhancements (Placeholders)

### Species-Specific Invasives (TODO)
- Current implementation applies uniform mortality regardless of species
- **Future**: 
  - Add species-level vulnerability modifiers
  - Different invasives target different species (e.g., Emerald Ash Borer → ash trees)
  - Display species breakdown in impact stats

### Real Boundary Data (TODO)
- Pomfret Forest boundary is approximate (rectangular)
- Connecticut boundary is simplified bounding box
- **Future**:
  - Add actual GeoJSON for Pomfret School forest parcel
  - Use official CT state boundary shapefile
  - Support loading custom area polygons

### Additional Scenarios (TODO)
- Current: Single "Invasive Species Spread" scenario
- **Future**:
  - Fire spread simulation
  - Disease outbreak (species-specific)
  - Climate stress zones
  - Deforestation patterns

### Enhanced Visuals (TODO)
- Current: Simple red rectangles with opacity
- **Future**:
  - Gradient/blur effects for smoother patches
  - Color coding by severity stages
  - Animation of spread wave fronts
  - 3D terrain visualization

---

## Design Decisions

### Why Grid-Based?
- Simple, performant, visually clear
- Easy to understand for classroom audience
- Stable and reproducible
- No external epidemiology dependencies

### Why Seeded RNG?
- Reproducible demos for teaching
- Same seed = same pattern
- Helps with debugging and testing
- Still looks random enough for visual realism

### Why Two Areas?
- Pomfret: Real data, local relevance, measurable scale
- Connecticut: Statewide context, demonstrates scalability
- Shows orders-of-magnitude differences effectively

### Why Mortality Multiplier?
- Prevents 100% mortality at full infection (unrealistic)
- Multiplier of 0.7 represents typical invasive impact
- Can be adjusted per species/scenario in future

---

## Testing

### Build Status
- ✅ TypeScript compilation successful
- ✅ Next.js production build successful
- ✅ No linter errors
- ✅ All imports resolved correctly

### Runtime Status
- ✅ Backend API running on port 8000
- ✅ Next.js dev server running on port 3000
- ✅ Visualize page accessible at `/visualize`
- ✅ Page compiled successfully (216ms)
- ✅ Map loads and renders correctly
- ✅ Dynamic imports working (no SSR issues)

### Manual Testing Checklist
- [x] Area toggle switches between Pomfret and Connecticut
- [x] Map view updates and fits bounds correctly
- [x] Area boundary highlights with teal color
- [x] Start button seeds infection and begins simulation
- [x] Red patches appear and spread visibly
- [x] Stats update in real-time (trees, carbon, %, steps)
- [x] Pause freezes simulation
- [x] Resume continues from paused state
- [x] Reset clears overlay and resets stats
- [x] Spread rate slider adjusts infection speed
- [x] No console errors or warnings
- [x] Performance is smooth (no lag or stuttering)

---

## Acceptance Criteria

All deliverables completed:
- ✅ Functioning Visualize page route
- ✅ Area toggle (Pomfret Forest / Connecticut)
- ✅ Visual area highlighting on map
- ✅ Scenario controls (Start/Pause/Reset, Spread Rate slider)
- ✅ Stats panel (Trees dead, Carbon impact, % infected, Time steps)
- ✅ Map overlay with animated infection patches
- ✅ Readable, typed TypeScript code with comments
- ✅ Reuses existing map components and design system
- ✅ Self-contained (no refactoring of unrelated code)
- ✅ Smooth performance
- ✅ Demo-friendly and classroom-ready

---

## Browser Compatibility

Tested on:
- Chrome/Edge (Chromium)
- Safari
- Firefox

All modern browsers with ES6+ support should work correctly.

---

## Deployment Notes

### Production Build
- Run `npm run build` in `web/` directory
- No additional dependencies required
- All new files are client-side only (no server-side changes needed)

### Environment Variables
- None required for Visualize page
- Uses existing API base URL from `.env.local`

---

## Contact & Support

For questions or issues with the Visualize page implementation:
- See code comments in each file for detailed documentation
- Refer to existing Area Generalizer page (`/area`) for similar map patterns
- Check `SPECIES_UI_RECOMMENDATIONS.md` for species data references

---

**Implementation Date**: February 10, 2026  
**Status**: ✅ Complete and functional  
**Next Steps**: User testing and feedback for future enhancements
