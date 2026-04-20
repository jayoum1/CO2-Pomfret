/**
 * Tree data and state model for Vector Forest.
 * Supports both real backend snapshot data and the scenario/disturbance system.
 */

export type TreeSpecies = 'generic'

export interface TreeInstance {
  id: string
  species: TreeSpecies
  /** Display species name from the backend (e.g. "sugar maple") */
  speciesName: string
  /** Plot the tree belongs to */
  plot: string
  /** 0..1 normalized across width */
  x: number
  /** 0 = far, 1 = near */
  depth: number
  /** Current DBH (cm) — from the snapshot for the active year */
  dbh0: number
  /** cm/year — kept for compatibility but 0 when using snapshot data */
  growthRate: number
  /** Optional per-tree variance 0..1 */
  jitter?: number
  /** Optional base hue for canopy */
  hueBase?: number
  /** Optional base lightness % for canopy */
  lightnessBase?: number
  /** Optional display species key for inspector images */
  speciesKey?: string
}

export interface TreeState {
  year: number
  /** DBH in cm */
  dbh: number
  /** Estimated aboveground carbon (kg C) */
  carbonKgC: number
  alive: boolean
  /** 0..1, 1 = healthy */
  health: number
  /** Fire scenario: tree is on fire */
  burning?: boolean
  /** Fire scenario: tree is charred */
  charred?: boolean
}

/**
 * Build TreeState directly from a snapshot-backed TreeInstance.
 * Growth is already baked into dbh0 (set per year from the backend).
 */
export function getTreeState(tree: TreeInstance, year: number): TreeState {
  return {
    year,
    dbh: tree.dbh0,
    carbonKgC: tree.dbh0 > 0 ? 0.8 * Math.pow(tree.dbh0, 2.3) : 0,
    alive: true,
    health: 1,
  }
}
