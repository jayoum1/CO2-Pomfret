/**
 * Invasive Species Spread — Frontier-based stochastic growth
 *
 * Infected region grows by random frontier expansion (and optional spark jumps).
 * Stops at targetInfectedCells so the final shape is an irregular blob, not a rectangle.
 */

import { isPointInPolygon, Point } from '../geo/pointInPolygon'

export interface Cell {
  row: number
  col: number
  lat: number
  lng: number
  infected: boolean
  severity: number // 0-1
  insideArea: boolean
}

export interface OutbreakPoint {
  id: string
  lat: number
  lng: number
  cellRow: number
  cellCol: number
  createdStep: number
}

export interface GridState {
  cells: Cell[][]
  rows: number
  cols: number
  infectedCount: number
  totalCellsInArea: number
  percentInfected: number
  outbreakPoints: OutbreakPoint[]
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
  latStep: number
  lngStep: number
  cellSizeMeters: number
}

export interface SpreadParams {
  targetInfectedCells: number
  newInfectionsPerTick: number
  jumpChance: number
  jumpRadiusCells: number
  intensity: number
  mortalityMultiplier: number
  tickIntervalMs: number
}

function cellId(row: number, col: number): string {
  return `${row},${col}`
}

function parseCellId(id: string): { row: number; col: number } {
  const [row, col] = id.split(',').map(Number)
  return { row, col }
}

/** Get 8-neighbors that are in bounds and insideArea (candidates for infection). */
function getHealthyNeighbors(
  grid: GridState,
  row: number,
  col: number
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr
      const c = col + dc
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue
      if (!grid.cells[r][c].insideArea || grid.cells[r][c].infected) continue
      out.push({ row: r, col: c })
    }
  }
  return out
}

/** Frontier: infected cells that have at least one healthy neighbor. */
function buildFrontier(grid: GridState): string[] {
  const frontier: string[] = []
  const seen = new Set<string>()
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.cells[r][c].infected || !grid.cells[r][c].insideArea) continue
      const neighbors = getHealthyNeighbors(grid, r, c)
      if (neighbors.length > 0 && !seen.has(cellId(r, c))) {
        seen.add(cellId(r, c))
        frontier.push(cellId(r, c))
      }
    }
  }
  return frontier
}

/**
 * Create a meter-based grid (same as before). Cell size constant per area.
 */
export function createGridMeters(
  bounds: Point[] | null,
  centerLat: number,
  centerLng: number,
  extentMeters: number,
  cellSizeMeters: number,
  constrainToBounds: boolean
): GridState {
  const numCells = Math.ceil(extentMeters * 2 / cellSizeMeters)
  const rows = numCells
  const cols = numCells

  const metersPerDegreeLat = 111320
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180)
  const latExtent = extentMeters / metersPerDegreeLat
  const lngExtent = extentMeters / metersPerDegreeLng

  const minLat = centerLat - latExtent
  const maxLat = centerLat + latExtent
  const minLng = centerLng - lngExtent
  const maxLng = centerLng + lngExtent

  const latStep = (maxLat - minLat) / rows
  const lngStep = (maxLng - minLng) / cols

  const cells: Cell[][] = []
  let totalCellsInArea = 0

  for (let row = 0; row < rows; row++) {
    const rowCells: Cell[] = []
    for (let col = 0; col < cols; col++) {
      const lat = minLat + (row + 0.5) * latStep
      const lng = minLng + (col + 0.5) * lngStep
      const insideArea =
        constrainToBounds && bounds
          ? isPointInPolygon({ lat, lng }, bounds)
          : true
      if (insideArea) totalCellsInArea++
      rowCells.push({
        row,
        col,
        lat,
        lng,
        infected: false,
        severity: 0.5,
        insideArea
      })
    }
    cells.push(rowCells)
  }

  return {
    cells,
    rows,
    cols,
    infectedCount: 0,
    totalCellsInArea,
    percentInfected: 0,
    outbreakPoints: [],
    minLat,
    maxLat,
    minLng,
    maxLng,
    latStep,
    lngStep,
    cellSizeMeters
  }
}

export function latLngToCell(
  lat: number,
  lng: number,
  grid: GridState
): { row: number; col: number } | null {
  if (lat < grid.minLat || lat > grid.maxLat || lng < grid.minLng || lng > grid.maxLng)
    return null
  const row = Math.floor((lat - grid.minLat) / grid.latStep)
  const col = Math.floor((lng - grid.minLng) / grid.lngStep)
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null
  return { row, col }
}

export function addOutbreakPoint(
  grid: GridState,
  lat: number,
  lng: number,
  bounds: Point[] | null
): GridState | null {
  if (bounds && !isPointInPolygon({ lat, lng }, bounds)) return null

  const cellCoords = latLngToCell(lat, lng, grid)
  if (!cellCoords) return null

  const { row, col } = cellCoords
  if (!grid.cells[row][col].insideArea) return null

  const newPoint: OutbreakPoint = {
    id: `outbreak-${Date.now()}-${Math.random()}`,
    lat,
    lng,
    cellRow: row,
    cellCol: col,
    createdStep: 0
  }

  const cells = grid.cells.map((r) => r.map((cell) => ({ ...cell })))
  cells[row][col].infected = true
  cells[row][col].severity = 0.8

  const outbreakPoints = [...grid.outbreakPoints, newPoint]
  const infectedCount = grid.infectedCount + 1
  const percentInfected =
    grid.totalCellsInArea > 0 ? infectedCount / grid.totalCellsInArea : 0

  return {
    ...grid,
    cells,
    outbreakPoints,
    infectedCount,
    percentInfected
  }
}

export function removeOutbreakPoint(
  grid: GridState,
  pointId: string
): GridState {
  const outbreakPoints = grid.outbreakPoints.filter((p) => p.id !== pointId)
  const cells = grid.cells.map((r) => r.map((c) => ({ ...c })))
  let infectedCount = 0
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (cells[r][c].infected) infectedCount++
    }
  }
  const percentInfected =
    grid.totalCellsInArea > 0 ? infectedCount / grid.totalCellsInArea : 0
  return { ...grid, cells, outbreakPoints, infectedCount, percentInfected }
}

export function clearOutbreakPoints(grid: GridState): GridState {
  const cells = grid.cells.map((r) =>
    r.map((c) => ({ ...c, infected: false, severity: 0 }))
  )
  return {
    ...grid,
    cells,
    outbreakPoints: [],
    infectedCount: 0,
    percentInfected: 0
  }
}

/**
 * One tick of frontier-based spread. Stops when infectedCount >= targetInfectedCells.
 */
export function spreadTickFrontier(
  grid: GridState,
  params: SpreadParams
): GridState {
  if (grid.outbreakPoints.length === 0) return grid

  const cells = grid.cells.map((r) => r.map((c) => ({ ...c })))
  let infectedCount = grid.infectedCount

  const target = params.targetInfectedCells

  // Frontier expansion: up to newInfectionsPerTick new infections
  for (let i = 0; i < params.newInfectionsPerTick; i++) {
    if (infectedCount >= target) break

    const frontier = buildFrontier({ ...grid, cells, infectedCount, percentInfected: 0 })
    if (frontier.length === 0) break

    const fid = frontier[Math.floor(Math.random() * frontier.length)]
    const { row: fr, col: fc } = parseCellId(fid)
    const neighbors = getHealthyNeighbors({ ...grid, cells }, fr, fc)
    if (neighbors.length === 0) continue

    const n = neighbors[Math.floor(Math.random() * neighbors.length)]
    cells[n.row][n.col].infected = true
    cells[n.row][n.col].severity = 0.3 + Math.random() * 0.6
    infectedCount++
  }

  // Spark jump: with probability jumpChance, infect a random cell within jumpRadiusCells
  if (infectedCount < target && Math.random() < params.jumpChance) {
    const infectedList: { row: number; col: number }[] = []
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (cells[r][c].infected && cells[r][c].insideArea)
          infectedList.push({ row: r, col: c })
      }
    }
    if (infectedList.length > 0) {
      const src = infectedList[Math.floor(Math.random() * infectedList.length)]
      const R = params.jumpRadiusCells
      const nr = src.row + Math.floor((Math.random() * (2 * R + 1)) - R)
      const nc = src.col + Math.floor((Math.random() * (2 * R + 1)) - R)
      if (
        nr >= 0 &&
        nr < grid.rows &&
        nc >= 0 &&
        nc < grid.cols &&
        cells[nr][nc].insideArea &&
        !cells[nr][nc].infected
      ) {
        cells[nr][nc].infected = true
        cells[nr][nc].severity = 0.4 + Math.random() * 0.5
        infectedCount++
      }
    }
  }

  const percentInfected =
    grid.totalCellsInArea > 0 ? infectedCount / grid.totalCellsInArea : 0

  return {
    ...grid,
    cells,
    infectedCount,
    percentInfected
  }
}

export function resetInfection(grid: GridState): GridState {
  const cells = grid.cells.map((r) =>
    r.map((c) => ({ ...c, infected: false, severity: 0 }))
  )
  return {
    ...grid,
    cells,
    infectedCount: 0,
    percentInfected: 0
  }
}

export function resetGrid(grid: GridState): GridState {
  const cells = grid.cells.map((r) =>
    r.map((c) => ({ ...c, infected: false, severity: 0 }))
  )
  return {
    ...grid,
    cells,
    outbreakPoints: [],
    infectedCount: 0,
    percentInfected: 0
  }
}
