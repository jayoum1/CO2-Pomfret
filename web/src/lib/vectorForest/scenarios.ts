/**
 * Scenario system for Vector Forest.
 * Modifies TreeState over time (health, alive, carbon, burning, charred) without changing DBH growth.
 */

import type { TreeInstance, TreeState } from './treeModel'
import type { ScenarioId } from './scenarioCatalog'

export type { ScenarioId }

export interface ScenarioConfigBase {
  id: ScenarioId
}

/** Tornado: path-based wind damage. */
export interface TornadoConfig extends ScenarioConfigBase {
  id: 'tornado'
  seed: number
  startYear: number
  durationYears: number
}

/** Flood: water rises from bottom; trees in depth band die. */
export interface FloodConfig extends ScenarioConfigBase {
  id: 'flood'
  seed: number
  startYear: number
  durationYears: number
}

/** Fire: spreads from bottom; trees burn, char, die. */
export interface FireConfig extends ScenarioConfigBase {
  id: 'fire'
  seed: number
  startYear: number
  durationYears: number
}

export type ScenarioConfig =
  | (ScenarioConfigBase & { id: 'baseline' })
  | TornadoConfig
  | FloodConfig
  | FireConfig

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/** Deterministic 0..1 per tree from id + seed. */
function hashTo01(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0
  }
  return (h % 1e6) / 1e6
}

/** Fall direction: -1 or 1. For tornado, bias toward +1 (wind direction). */
export function getFallDirection(treeId: string, seed: number, scenarioId?: ScenarioId): number {
  const r = hashTo01(`${treeId}:fall:${seed}`)
  if (scenarioId === 'tornado') return r < 0.85 ? 1 : -1
  return r < 0.5 ? -1 : 1
}

export function getScenarioTiming(id: ScenarioId): { startYear: number; durationYears: number } {
  switch (id) {
    case 'baseline':
      return { startYear: 0, durationYears: 30 }
    case 'tornado':
    case 'flood':
    case 'fire':
      return { startYear: 3, durationYears: 22 }
    default:
      return { startYear: 0, durationYears: 30 }
  }
}

/** Build config for a scenario (for applyScenario and overlays). startYearOverride applies to all disturbance scenarios. */
export function getScenarioConfig(id: ScenarioId, seed: number, startYearOverride?: number): ScenarioConfig {
  const timing = getScenarioTiming(id)
  const startYear = startYearOverride ?? timing.startYear
  switch (id) {
    case 'baseline':
      return { id: 'baseline' }
    case 'tornado':
      return { id: 'tornado', seed, startYear, durationYears: timing.durationYears }
    case 'flood':
      return { id: 'flood', seed, startYear, durationYears: timing.durationYears }
    case 'fire':
      return { id: 'fire', seed, startYear, durationYears: timing.durationYears }
    default:
      return { id: 'baseline' }
  }
}

/**
 * Apply scenario to base state. Does not change DBH; only health, alive, carbonKgC, burning, charred.
 */
export function applyScenario(
  base: TreeState,
  tree: TreeInstance,
  year: number,
  config: ScenarioConfig,
): TreeState {
  if (config.id === 'baseline') return base

  // ——— Tornado (Type B: startYear = active event, after = all destroyed) ———
  if (config.id === 'tornado') {
    const cfg = config
    if (year < cfg.startYear) return base
    if (year === cfg.startYear) {
      return { ...base, health: 0.1, alive: true, carbonKgC: base.carbonKgC * 0.3 }
    }
    return { ...base, health: 0, alive: false, carbonKgC: base.carbonKgC * 0.1 }
  }

  // ——— Flood (Type B: before startYear = normal, startYear+ = all destroyed/flooded) ———
  if (config.id === 'flood') {
    const cfg = config
    if (year <= cfg.startYear) return base
    return { ...base, health: 0, alive: false, carbonKgC: base.carbonKgC * 0.1 }
  }

  // ——— Fire (Type B: startYear = all burning, after = all destroyed/charred) ———
  if (config.id === 'fire') {
    const cfg = config
    if (year < cfg.startYear) return base
    if (year === cfg.startYear) {
      return {
        ...base,
        health: 0.1,
        alive: true,
        carbonKgC: base.carbonKgC * 0.4,
        burning: true,
        charred: false,
      }
    }
    return {
      ...base,
      health: 0,
      alive: false,
      carbonKgC: base.carbonKgC * 0.1,
      burning: false,
      charred: true,
    }
  }

  return base
}
