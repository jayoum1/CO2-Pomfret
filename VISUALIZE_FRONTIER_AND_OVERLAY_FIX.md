# Visualize: Frontier-Based Spread + Geographically Attached Overlay

## Summary

Fixed two major issues: (1) spread now uses **frontier-based stochastic growth** so the final shape is an **irregular blob**, not a rectangle; (2) the infected overlay is a **Leaflet-aware canvas layer** that **redraws on move/zoom/resize** so patches stay **geographically attached**.

---

## Issue 1 — Spread No Longer Fills a Rectangle

### Cause
Radius-threshold logic eventually infected every cell inside the bounding box, producing a rectangular block.

### Change: Frontier-Based Stochastic Growth

- **infected**: Only cells that are actually infected (no global radius threshold).
- **frontier**: Infected cells that have at least one healthy neighbor (candidates for expansion).
- **Each tick**:
  1. **Frontier expansion**: Up to `newInfectionsPerTick` times: pick a random frontier cell, then a random healthy 8-neighbor, infect it. Update frontier implicitly via current grid state.
  2. **Spark jump** (optional): With probability `jumpChance`, pick a random infected cell and a random cell within `jumpRadiusCells` (Chebyshev), infect if valid. Adds patchiness.
- **Stop when** `infectedCount >= targetInfectedCells` (preset-driven). Simulation then pauses.

Result: Growth is **random frontier expansion** plus **spark jumps**. Final shape is an **irregular blob**, not a rectangle. Cell size is unchanged (still constant per area).

### Presets (Outcomes, Not Cell Size)

| Preset | targetInfectedCells | newInfectionsPerTick | jumpChance | jumpRadiusCells | intensity |
|--------|---------------------|----------------------|------------|-----------------|----------|
| Emerald Ash Borer 🪲 | 450 | 12 | 0.25 | 4 | 0.92 |
| Spongy Moth 🦋 | 500 | 14 | 0.35 | 5 | 0.78 |
| Hemlock Woolly Adelgid 🐛 | 280 | 6 | 0.12 | 3 | 0.82 |
| Japanese Knotweed 🌿 | 220 | 5 | 0.28 | 4 | 0.62 |
| Oriental Bittersweet 🍇 | 200 | 3 | 0.48 | 6 | 0.52 |
| Oak Wilt 🍂 | 260 | 6 | 0.30 | 4 | 0.72 |

---

## Issue 2 — Overlay Detaches on Pan/Zoom

### Cause
Overlay was drawn once in container coordinates; on pan/zoom the map moved but the canvas did not redraw, so patches stayed pinned to screen pixels.

### Change: Custom Leaflet Canvas Layer

- **New**: `web/src/components/visualize/InfectedOverlayLayer.ts`
  - Creates a layer object with `onAdd(map)`, `onRemove(map)`, `_draw()`, `redraw()`.
  - **onAdd(map)**:
    - Creates a `<canvas>`, `pointer-events: none`, appends to `map.getPane('overlayPane')`.
    - Subscribes to `move`, `zoom`, `moveend`, `zoomend`, `resize` and calls `_draw()`.
    - Calls `_draw()` once.
  - **_draw()**:
    - Reads current grid from `getData()` (ref to latest `gridState`).
    - Sets canvas size to `map.getSize()`.
    - For each infected cell: cell bounds in lat/lng → `map.latLngToContainerPoint()` for NW and SE corners → `ctx.fillRect(x, y, w, h)`.
  - **redraw()**: Called from React when `gridState` changes (each tick).
- **InvasiveMap**:
  - Keeps `gridStateRef.current = gridState` so the layer always reads latest state.
  - Creates layer with `getData: () => gridStateRef.current`, then `layer.onAdd(map)` (no `map.addLayer`).
  - On `gridState` change, `overlayLayerRef.current.redraw()`.
  - On cleanup, `layer.onRemove(map)`.

Result: Overlay is **geographically attached**; pan/zoom/resize and each sim tick trigger a redraw so patches stay aligned with the map.

---

## Files Changed

1. **`web/src/lib/sim/invasivePresets.ts`**
   - Params: `targetInfectedCells`, `newInfectionsPerTick`, `jumpChance`, `jumpRadiusCells`, `intensity`.
   - Removed: `expansionSpeed`, `maxRadiusMeters`, `edgeRoughness`.

2. **`web/src/lib/sim/invasiveSpread.ts`** (rewritten)
   - Removed radial distance/Haversine and radius-threshold infection.
   - **Frontier helpers**: `cellId`, `parseCellId`, `getHealthyNeighbors`, `buildFrontier`.
   - **spreadTickFrontier(grid, params)**:
     - Frontier expansion: up to `newInfectionsPerTick` infections via random frontier cell → random healthy neighbor.
     - Spark jump: with `jumpChance`, infect a random cell within `jumpRadiusCells` of a random infected cell.
     - Stops when `infectedCount >= targetInfectedCells` (caller clears interval and sets status to paused).
   - **SpreadParams**: `targetInfectedCells`, `newInfectionsPerTick`, `jumpChance`, `jumpRadiusCells`, `intensity`, `mortalityMultiplier`, `tickIntervalMs`.
   - **Cell**: no `distToNearestSeed`; **GridState**: still has `cellSizeMeters` (unchanged). `createGridMeters`, `addOutbreakPoint`, `clearOutbreakPoints`, `resetInfection`, `resetGrid` kept; `removeOutbreakPoint` still used.

3. **`web/src/components/visualize/InfectedOverlayLayer.ts`** (new)
   - Custom layer: canvas in `overlayPane`, redraw on map events and via `redraw()`.
   - Draws infected cells as rectangles using `map.latLngToContainerPoint` for corners.

4. **`web/src/components/visualize/InvasiveMap.tsx`**
   - Uses `createInfectedOverlayLayer(getData)` with `gridStateRef`; calls `onAdd(map)` and stores layer in `overlayLayerRef`.
   - Removed previous canvas + manual event subscription.
   - `useEffect` on `gridState`: `overlayLayerRef.current?.redraw()`.
   - Cleanup: `overlayLayerRef.current?.onRemove(map)`.

5. **`web/src/app/visualize/page.tsx`**
   - Imports `spreadTickFrontier` and `SpreadParams`.
   - Builds params from preset: `targetInfectedCells`, `newInfectionsPerTick`, `jumpChance`, `jumpRadiusCells`, `intensity`.
   - Interval: `spreadTickFrontier(prevGrid, params)`; when `next.infectedCount >= targetInfectedCells`, clears interval and calls `setSimStatus('paused')`.

---

## How to Test in the UI

1. **Constrain OFF, one point, Start, then pan + zoom while running**
   - Go to **Visualize**.
   - Leave **Constrain to boundary** unchecked.
   - Place **one** outbreak (click map with “Placing” on).
   - Pick any invasive (e.g. Emerald Ash Borer), click **Start**.
   - While the blob is growing, **pan** and **zoom**.
   - **Expect**: Red patches stay aligned with the map (glued to geography). No fixed “sticker” on the screen.

2. **Let it finish — final shape is an irregular blob**
   - Same setup (one point, Start).
   - Let the run reach the target (simulation pauses).
   - **Expect**: Final infected region is an **irregular blob** (lumpy, with possible “spark” patches), **not** a rectangle or full bounding box.

3. **Switch invasives — same cell size, different count and pattern**
   - **Reset**, place one point again.
   - Run **Emerald Ash Borer** (high target, high speed) → larger, faster blob.
   - **Reset**, place one point.
   - Run **Oriental Bittersweet** (lower target, high jumpChance) → smaller, patchier blob.
   - **Expect**: Same apparent cell size; different final infected count and spread pattern (speed, patchiness).

---

## Acceptance Checklist

- [x] Constrain OFF, one point, Start, pan+zoom while running → infection stays glued to geography.
- [x] Let it finish → final shape is an irregular blob, not a rectangle.
- [x] Switch invasives → same cell size; different final infected count and spread feel/pattern.
- [x] Overlay implemented as Leaflet-aware layer; redraw on move, zoom, resize, and each tick.
- [x] Rectangular grid patches (no per-cell circles).
- [x] UI unchanged (sidebar, click-to-place, live stats); mortality still uses intensity and infected fraction.
