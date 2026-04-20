/**
 * Maps tree state (and layout hints) to SVG visual parameters.
 * Single place for DBH → pixel/size and atmospheric perspective.
 * No placement or random generation here.
 */

import type { TreeState } from './treeModel'

export interface TreeVisualParams {
  trunkWidthPx: number
  trunkHeightPx: number
  canopyScale: number
  canopyYPx: number
  hue: number
  saturation: number
  lightness: number
  alpha: number
  /** Optional CSS class for wrapper (e.g. tree-burning, tree-charred). */
  visualClass?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Derive SVG-ready visual parameters from tree state and depth.
 * Keeps current look/feel; depth used for subtle atmospheric perspective.
 */
export function visualParamsFromTreeState(
  state: TreeState,
  depth: number,
  options?: { hueBase?: number; lightnessBase?: number }
): TreeVisualParams {
  const dbhScaled = Math.min(state.dbh, 50)

  const trunkWidthPx = clamp(8 + dbhScaled, 8, 22)
  const trunkHeightPx = clamp(30 + 2.2 * dbhScaled, 30, 90)
  const canopyScale = clamp(0.7 + 0.02 * dbhScaled, 0.7, 1.35)
  const canopyYPx = 58

  const hueBase = options?.hueBase ?? 120
  const lightnessBase = options?.lightnessBase ?? 34
  const satBase = 28

  // Atmospheric perspective: farther (low depth) = slightly lighter and less saturated
  const depthFactor = 0.7 + 0.3 * depth
  const saturation = clamp(satBase * depthFactor, 12, 32)
  const lightness = clamp(lightnessBase + (1 - depth) * 8, 28, 42)
  const hue = hueBase

  let hueOut = hueBase
  let saturationOut = clamp(satBase * depthFactor, 12, 32)
  let lightnessOut = clamp(lightnessBase + (1 - depth) * 8, 28, 42)
  let alpha = state.alive ? 1 : 0.35
  let visualClass: string | undefined

  if (state.burning) {
    hueOut = 28
    saturationOut = clamp(75, 12, 90)
    lightnessOut = clamp(lightnessOut + 12, 40, 65)
    visualClass = 'tree-burning'
  } else if (state.charred) {
    hueOut = 0
    saturationOut = 4
    lightnessOut = 18
    alpha = state.alive ? 0.85 : 0.4
    visualClass = 'tree-charred'
  } else if (!state.alive) {
    lightnessOut = clamp(lightnessOut - 8, 18, 36)
  }

  return {
    trunkWidthPx,
    trunkHeightPx,
    canopyScale,
    canopyYPx,
    hue: hueOut,
    saturation: saturationOut,
    lightness: lightnessOut,
    alpha,
    visualClass,
  }
}
