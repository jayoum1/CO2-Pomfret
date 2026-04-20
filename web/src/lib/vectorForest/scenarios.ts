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

/** Emerald Ash Borer (clustered invasive outbreak). */
export interface EmeraldAshBorerConfig extends ScenarioConfigBase {
  id: 'emerald_ash_borer'
  startYear: number
  durationYears: number
  centerX: number
  centerDepth: number
  maxRadius: number
  maxAffectedFraction: number
  severity: number
  seed: number
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
  | EmeraldAshBorerConfig
  | TornadoConfig
  | FloodConfig
  | FireConfig

export function isEmeraldAshBorerConfig(c: ScenarioConfig): c is EmeraldAshBorerConfig {
  return c.id === 'emerald_ash_borer'
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Seeded RNG (mulberry32) for stable scenario results. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t >>> 0) / 4294967296
  }
}

/** Deterministic 0..1 per tree from id + seed. */
function hashTo01(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0
  }
  return (h % 1e6) / 1e6
}

function susceptibility(treeId: string, seed: number): number {
  const r = hashTo01(`${treeId}:suscept:${seed}`)
  return 0.8 + r * 0.4
}

function randForTree(treeId: string, pQuantized: number, seed: number): number {
  return hashTo01(`${treeId}:${pQuantized}:${seed}`)
}

/** Fall direction: -1 or 1. For tornado, bias toward +1 (wind direction). */
export function getFallDirection(treeId: string, seed: number, scenarioId?: ScenarioId): number {
  const r = hashTo01(`${treeId}:fall:${seed}`)
  if (scenarioId === 'tornado') return r < 0.85 ? 1 : -1
  return r < 0.5 ? -1 : 1
}

/** Tornado path: line from (x0, d0) to (x1, d1) in normalized coords. Distance from tree to line. */
function distToLine(x: number, d: number, x0: number, d0: number, x1: number, d1: number): number {
  const dx = x1 - x0
  const dy = d1 - d0
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-6
  const t = clamp01(((x - x0) * dx + (d - d0) * dy) / (len * len))
  const px = x0 + t * dx
  const py = d0 + t * dy
  return Math.sqrt((x - px) ** 2 + (d - py) ** 2)
}

export function getScenarioTiming(id: ScenarioId): { startYear: number; durationYears: number } {
  switch (id) {
    case 'baseline':
      return { startYear: 0, durationYears: 30 }
    case 'emerald_ash_borer':
      return { startYear: 8, durationYears: 14 }
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
    case 'emerald_ash_borer': {
      const rng = seededRandom(seed)
      return {
        id: 'emerald_ash_borer',
        startYear,
        durationYears: timing.durationYears,
        centerX: 0.15 + rng() * 0.7,
        centerDepth: 0.2 + rng() * 0.6,
        maxRadius: 0.42,
        maxAffectedFraction: 0.38,
        severity: 0.62,
        seed,
      }
    }
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
  config: ScenarioConfig
): TreeState {
  if (config.id === 'baseline') return base

  // ——— Emerald Ash Borer ———
  if (config.id === 'emerald_ash_borer') {
    const cfg = config
    if (year < cfg.startYear) return base

    const progress = clamp01((year - cfg.startYear) / Math.max(1, cfg.durationYears))
    const currentRadius = progress * cfg.maxRadius
    if (currentRadius <= 0) return base

    const dx = tree.x - cfg.centerX
    const dy = tree.depth - cfg.centerDepth
    const dist = Math.sqrt(dx * dx + dy * dy)
    const sus = susceptibility(tree.id, cfg.seed)
    const effectiveDist = dist / Math.max(0.001, sus)

    const pQuantized = Math.floor(progress * 100)
    const randVal = randForTree(tree.id, pQuantized, cfg.seed)
    const prob = clamp01(1.2 - effectiveDist / Math.max(0.001, currentRadius)) * cfg.severity
    const affected = randVal < prob

    if (!affected) return base

    const yearsIntoOutbreak = year - cfg.startYear
    const health = clamp01(
      1 - cfg.severity * 0.9 * progress - cfg.severity * 0.15 * (yearsIntoOutbreak / Math.max(1, cfg.durationYears))
    )
    const mortalityThreshold = 0.2 + 0.1 * (1 - cfg.severity)
    const alive = health > mortalityThreshold

    let carbonKgC = base.carbonKgC
    if (alive) carbonKgC = base.carbonKgC * (0.7 + 0.3 * health)
    else carbonKgC = base.carbonKgC * 0.15

    return { ...base, health, alive, carbonKgC }
  }

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
