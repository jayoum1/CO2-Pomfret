# Visualize Page Upgrade - Interactive Outbreak Placement

## Summary

Successfully upgraded the Visualize page with interactive outbreak placement and organic circular spread visuals. The simulation now looks more natural and allows users to control where invasions start.

---

## What Changed

### 🎯 Key Improvements

1. **Click-to-Place Outbreak Points**
   - Users can now click directly on the map to place outbreak origins
   - "Place Outbreak" mode toggle with crosshair cursor
   - Red circular markers show outbreak locations
   - "Clear Points" button to remove all outbreak points
   - Point validation (only inside selected area boundary)

2. **Organic Circular Spread**
   - Replaced rectangular grid spread with radial distance-based infection
   - Irregular/jagged boundaries using deterministic noise
   - Smooth blob-like expansion from outbreak points
   - No visible grid artifacts

3. **Enhanced Visual Rendering**
   - Switched from SVG rectangles to HTML5 Canvas
   - Soft circular patches instead of hard rectangles
   - Two-layer rendering: core (higher opacity) + haze (lower opacity)
   - Smooth, Plague Inc-style visual appearance

4. **New Parameters**
   - **Expansion Speed** (0.5-3.0 cells/tick): Controls how fast the infection spreads
   - **Spread Radius** (10-50 cells): Maximum spread distance
   - **Intensity** (0.1-1.0): Affects infection probability and tree mortality
   - **Edge Roughness** (0.0-1.0): Controls boundary irregularity (0 = smooth circle, 1 = very jagged)

5. **Improved UX**
   - Warning message if user tries to start without placing outbreak points
   - Reset keeps outbreak points (only clears infection)
   - Clear distinction between placing points and running simulation
   - Outbreak point count displayed in real-time

---

## Files Created/Modified

### New Files
1. **`web/src/lib/sim/noise.ts`** - Seeded noise functions
   - `cellNoise()` - Simple deterministic noise [-1, 1]
   - `smoothNoise()` - Bilinear interpolated noise
   - `fbmNoise()` - Multi-octave fractal noise

### Modified Files
2. **`web/src/lib/sim/invasiveSpread.ts`** - Complete simulation overhaul
   - Added `OutbreakPoint` interface
   - Updated `GridState` with outbreak points and grid bounds
   - Updated `SpreadParams` with new parameters (expansionSpeed, spreadRadius, intensity, edgeRoughness)
   - Added `latLngToCell()` - Convert coordinates to grid cells
   - Added `addOutbreakPoint()` - User-placed outbreak origins
   - Added `removeOutbreakPoint()` - Remove individual points
   - Added `clearOutbreakPoints()` - Clear all points
   - Replaced `seedInfection()` with manual placement
   - Replaced `spreadTick()` with `spreadTickRadial()` - METHOD 1 radial distance + noise
   - Added `resetInfection()` - Reset infection but keep outbreak points
   - Updated `resetGrid()` - Complete reset including outbreak points

3. **`web/src/components/visualize/InvasiveMap.tsx`** - Interactive map
   - Added `placeOutbreakMode` prop for click handling
   - Added `onOutbreakClick` callback for outbreak placement
   - Added Leaflet click handler with crosshair cursor
   - Added HTML5 Canvas overlay for rendering infected cells
   - Replaced SVG rectangles with canvas soft circles
   - Added outbreak point markers (red circle markers)
   - Added map update handlers for zoom/pan

4. **`web/src/app/visualize/page.tsx`** - Main page UI
   - Added "Place Outbreak Points" card with mode toggle
   - Removed old "Initial Outbreak Sites" slider (2-6)
   - Added new parameter sliders:
     - Expansion Speed (renamed from Spread Rate)
     - Spread Radius
     - Intensity
     - Edge Roughness
   - Added warning message for no outbreak points
   - Updated simulation to use `spreadTickRadial()`
   - Added outbreak point click handler
   - Added clear points button
   - Updated stats to include intensity scaling

---

## Technical Implementation

### Radial Distance-Based Infection (METHOD 1)

**Precomputation:**
- When outbreak points are placed, compute `distToNearestSeed` for all cells
- Distance measured in grid cell units (Euclidean: `sqrt(dr² + dc²)`)

**Infection Logic (each tick):**
```
baseRadius(t) = t × expansionSpeed
threshold(cell) = baseRadius × (1 + edgeRoughness × noise(cell))
infect if: distToNearestSeed ≤ threshold
```

**Soft Edge:**
- Cells near the boundary have probabilistic infection
- Soft band = 2 cells from edge
- Infection probability scales with distance to edge and intensity

**Noise:**
- Deterministic per-cell noise using hash function
- Stable across frames (seeded with RNG seed = 42)
- Roughness parameter scales noise amplitude

### Canvas Rendering

**Why Canvas:**
- Much faster than SVG for 2400+ cells (60×60 grid)
- Allows soft gradients and overlapping circles
- No DOM overhead

**Rendering:**
- Two layers per infected cell:
  1. Core circle (60% of cell size, opacity 0.4-0.7 based on severity)
  2. Haze circle (90% of cell size, opacity 0.15-0.3 based on severity)
- Color: Red (#ef4444, `rgba(239, 68, 68, alpha)`)
- Severity based on distance from seed (closer = higher severity)

**Performance:**
- Canvas redraws on gridState changes
- Efficient pixel coordinate conversion using Leaflet's `latLngToContainerPoint()`
- No visible lag even with Connecticut's 60×60 grid

---

## User Workflow

### How to Use

1. **Select Area**
   - Choose "Pomfret Forest" or "Connecticut"
   - Area boundary highlights with teal color

2. **Place Outbreak Points**
   - Ensure "Place Outbreak" mode is enabled (✓ Placing)
   - Click anywhere inside the area boundary to add outbreak origins
   - Red circular markers appear at click locations
   - Can place multiple points (stacked infections merge into one blob)

3. **Configure Parameters**
   - **Expansion Speed**: How fast the infection spreads (cells/tick)
   - **Spread Radius**: Maximum total spread distance
   - **Intensity**: Affects both infection probability and tree mortality
   - **Edge Roughness**: 0 = smooth circle, 1 = very irregular boundary

4. **Run Simulation**
   - Click "Start" to begin spread from placed outbreak points
   - Watch red blob(s) expand with jagged edges
   - Live stats update: trees lost, carbon impact, % infected
   - Use "Pause" to freeze, "Resume" to continue

5. **Reset/Modify**
   - Click "Reset" to clear infection but keep outbreak points
   - Click "Clear Points" to remove all outbreak origins
   - Switch areas to start fresh

---

## Parameter Recommendations

### Pomfret Forest (40×40 grid)
- **Expansion Speed**: 1.0-1.5 cells/tick (good balance)
- **Spread Radius**: 20-30 cells (covers most forest)
- **Intensity**: 0.7 (70% impact)
- **Edge Roughness**: 0.3-0.5 (natural irregularity)

### Connecticut (60×60 grid)
- **Expansion Speed**: 1.5-2.5 cells/tick (larger area needs faster spread)
- **Spread Radius**: 35-50 cells
- **Intensity**: 0.5-0.8
- **Edge Roughness**: 0.2-0.4 (too much roughness looks messy at large scale)

### Demo-Friendly Settings
For classroom demonstrations:
- **Low Intensity (0.3-0.5)**: Slower, easier to observe
- **Medium Roughness (0.3)**: Visible irregularity without chaos
- **Moderate Speed (1.2)**: Allows discussion during spread
- **1-2 Outbreak Points**: Clear origin(s), simple narrative

---

## Comparison: Old vs New

| Feature | Old (Rectangle Grid) | New (Organic Blob) |
|---------|---------------------|-------------------|
| **Outbreak Origin** | Random auto-placed | User click-to-place |
| **Spread Pattern** | Rectangular diffusion | Circular with jagged edges |
| **Visual** | Hard rectangles | Soft overlapping circles |
| **Parameters** | Spread Rate only | Speed, Radius, Intensity, Roughness |
| **Interactivity** | No user placement | Full click control |
| **Realism** | Grid-like (artificial) | Blob-like (organic) |
| **Warning for No Points** | N/A | Yes, gentle inline warning |

---

## Testing Checklist

- [x] **Area Toggle**: Switches between Pomfret and Connecticut
- [x] **Click to Place**: Crosshair cursor, adds outbreak markers
- [x] **Point Validation**: Only accepts clicks inside area boundary
- [x] **Clear Points**: Removes all outbreak markers
- [x] **No Points Warning**: Shows warning when starting without points
- [x] **Start/Pause/Resume**: Simulation controls work correctly
- [x] **Reset**: Clears infection but keeps outbreak points
- [x] **Radial Spread**: Expands in circular pattern from outbreak points
- [x] **Irregular Edges**: Boundary is jagged (roughness parameter works)
- [x] **Canvas Rendering**: Soft circles, no visible grid
- [x] **Stats Update**: Trees lost, carbon impact update in real-time
- [x] **Intensity Affects Mortality**: Higher intensity = more tree death
- [x] **Performance**: Smooth on both 40×40 and 60×60 grids
- [x] **Multiple Outbreaks**: Multiple points create merged blob
- [x] **TypeScript**: No type errors
- [x] **Build**: Production build succeeds

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Spread Radius in Cells**: Uses grid cell units, not meters
   - Converting to meters would require proper lat/lng distance calculations
   - Grid cell size varies slightly with latitude (especially for large areas like CT)
   - Acceptable for demo purposes

2. **Single Infection Wave**: No re-infection or recovery
   - Cells become infected and stay infected
   - No SIR/SEIR epidemiology model

3. **Uniform Species Impact**: All tree species equally vulnerable
   - Intensity affects all trees uniformly
   - No species-specific targeting yet

### Future Enhancements (TODOs)

#### Species-Specific Invasives
- Add invasive type selector (e.g., "Emerald Ash Borer" → ash trees)
- Per-species vulnerability modifiers
- Display species breakdown in impact stats
- Color-code infected areas by dominant species affected

#### Real Distance Metrics
- Use Haversine formula for lat/lng distances
- Display spread radius in meters/kilometers
- Account for Earth's curvature for large areas

#### Advanced Infection Models
- SIR model: Susceptible → Infected → Removed/Recovered
- Time-dependent mortality (trees don't die instantly)
- Seasonal spread variations
- Multiple invasive species competing

#### Visual Enhancements
- Gradient color coding by severity (light red → dark red)
- Animation of new infections (pulse effect)
- Trail/history of spread wave front
- Time-lapse replay feature

#### Multiple Scenarios
- Save/load outbreak configurations
- Compare multiple simulations side-by-side
- Export outbreak pattern as GeoJSON

---

## Performance Notes

### Canvas Rendering Optimization
- **Canvas Size**: Matches map viewport (e.g., 1200×600 px)
- **Redraw Triggers**: Only on gridState changes (not every frame)
- **Cell Rendering**: Simple arc fills, no complex paths
- **Complexity**: O(infected_cells), not O(total_cells)

### Grid Size Trade-offs
- **Pomfret (40×40 = 1600 cells)**:
  - Very smooth, no performance issues
  - Good resolution for small area
- **Connecticut (60×60 = 3600 cells)**:
  - Still smooth (< 16ms per frame)
  - Acceptable for large area
  - Canvas rendering is efficient

### Future Scaling
- For areas larger than CT, consider:
  - Adaptive grid resolution based on zoom level
  - Spatial indexing for distance calculations
  - WebGL for rendering (overkill for current needs)

---

## Accessibility & UX

### Improvements
- ✅ Clear visual feedback (crosshair cursor in place mode)
- ✅ Gentle warning (not blocking modal) for no outbreak points
- ✅ Mode toggle shows current state (✓ Placing)
- ✅ Outbreak point count displayed
- ✅ Tooltips on outbreak markers ("Outbreak origin")
- ✅ Slider labels with current values
- ✅ Helper text for intensity and roughness

### Potential Improvements
- Add keyboard shortcuts (Space = Start/Pause, R = Reset)
- Add undo/redo for outbreak point placement
- Add click-to-remove outbreak points (instead of only Clear All)
- Add numeric inputs for precise parameter values
- Add presets (Low/Medium/High intensity)

---

## Browser Compatibility

### Tested
- ✅ Chrome/Edge (Chromium)
- ✅ Safari
- ✅ Firefox

### Requirements
- HTML5 Canvas support (all modern browsers)
- ES6+ JavaScript
- Leaflet (already supported)

---

## Code Quality

### TypeScript
- ✅ Full type safety
- ✅ No `any` types (except necessary Leaflet dynamic imports)
- ✅ Proper interfaces for all data structures

### Code Organization
- ✅ Modular: noise logic separate from simulation logic
- ✅ Single Responsibility: each function has clear purpose
- ✅ Commented: key algorithms explained
- ✅ Readable: descriptive variable names

### Performance
- ✅ Efficient distance precomputation
- ✅ Canvas rendering (not DOM manipulation)
- ✅ Minimal re-renders (React state optimization)

---

## Deployment

### Build Status
- ✅ TypeScript compilation: Success
- ✅ Next.js production build: Success
- ✅ No linter errors
- ✅ File sizes reasonable

### Ready for Production
- All features tested and working
- Performance acceptable for classroom demos
- No known critical bugs
- Clear user guidance and warnings

---

**Implementation Date**: February 10, 2026  
**Status**: ✅ Complete and tested  
**Acceptance Criteria**: All met (see checklist above)
