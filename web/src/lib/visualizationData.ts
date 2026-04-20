/**
 * Data fetching and transformation utilities for the Visualizations page.
 *
 * All chart-ready data is derived from two real backend endpoints:
 *   - GET /summary?years_ahead=Y&mode=baseline  → aggregate metrics per keyframe year
 *   - GET /vector-forest/snapshot?years_ahead=Y → tree-level rows for distributions
 *
 * Keyframe years available in the baseline snapshot set: [0, 5, 10, 20].
 *
 * The /vector-forest/snapshot endpoint uses baseline_stochastic internally;
 * for the distribution and per-plot DBH calculations this is close enough to
 * baseline to be consistent with the summary figures at these keyframes.
 */

import {
  getSummary,
  getVectorForestSnapshot,
  type VectorForestTree,
} from './api'

// ── Constants ─────────────────────────────────────────────────────────────────

export const KEYFRAME_YEARS = [0, 5, 10, 20] as const
export type KeyframeYear = (typeof KEYFRAME_YEARS)[number]

export const PLOT_COLORS: Record<string, string> = {
  Upper: '#0d9488',   // teal-600
  Middle: '#059669',  // emerald-600
  Lower: '#2563eb',   // blue-600
}

export const TOTAL_COLOR = '#14b8a6'   // teal-500
export const CO2E_FACTOR = 3.667       // kgC → kg CO₂e

// ── Core types ────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  year: number
  totalCarbon: number       // kgC all plots
  meanDbh: number           // cm all trees
  numTrees: number
  plotCarbon: Record<string, number>   // kgC per plot
  plotCount: Record<string, number>    // tree count per plot
  plotMeanDbh: Record<string, number>  // derived from snapshot trees
}

export interface SnapshotData {
  year: number
  trees: VectorForestTree[]
}

export interface VisualizationData {
  timeSeries: TimeSeriesPoint[]
  snapshots: SnapshotData[]
  plots: string[]
}

// ── Primary data loader ───────────────────────────────────────────────────────

export async function fetchVisualizationData(
  mode = 'baseline',
): Promise<VisualizationData> {
  // Parallel fetch: summaries (aggregate) + tree-level snapshots
  const [summaries, snapshots] = await Promise.all([
    Promise.all(KEYFRAME_YEARS.map(y => getSummary(y, mode))),
    Promise.all(KEYFRAME_YEARS.map(y => getVectorForestSnapshot(y, 'all'))),
  ])

  const timeSeries: TimeSeriesPoint[] = summaries.map((s, i) => {
    const year = KEYFRAME_YEARS[i]
    const trees = snapshots[i].trees

    // Compute per-plot mean DBH from tree-level data (summary only gives global mean)
    const plotMeanDbh: Record<string, number> = {}
    const plots = [...new Set(trees.map(t => t.plot))]
    for (const p of plots) {
      const pt = trees.filter(t => t.plot === p)
      plotMeanDbh[p] = pt.length > 0
        ? pt.reduce((sum, t) => sum + t.dbh_cm, 0) / pt.length
        : 0
    }

    return {
      year,
      totalCarbon: s.total_carbon_kgC,
      meanDbh: s.mean_dbh_cm,
      numTrees: s.num_trees,
      plotCarbon: Object.fromEntries(
        Object.entries(s.plot_breakdown).map(([k, v]) => [k, v.carbon_at_time]),
      ),
      plotCount: Object.fromEntries(
        Object.entries(s.plot_breakdown).map(([k, v]) => [k, v.count]),
      ),
      plotMeanDbh,
    }
  })

  const snapshotData: SnapshotData[] = snapshots.map((s, i) => ({
    year: KEYFRAME_YEARS[i],
    trees: s.trees,
  }))

  const plots = snapshots[0]?.plots ?? ['Upper', 'Middle', 'Lower']

  return { timeSeries, snapshots: snapshotData, plots }
}

// ── DBH histogram ─────────────────────────────────────────────────────────────

export interface HistogramBin {
  label: string
  mid: number
  count: number
  plotCounts: Record<string, number>
}

export function computeDbhHistogram(
  trees: VectorForestTree[],
  plot = 'all',
  binWidth = 10,
): HistogramBin[] {
  const filtered = plot === 'all' ? trees : trees.filter(t => t.plot === plot)
  if (!filtered.length) return []

  const allDbh = filtered.map(t => t.dbh_cm)
  const minBin = Math.floor(Math.min(...allDbh) / binWidth) * binWidth
  const maxBin = Math.ceil(Math.max(...allDbh) / binWidth) * binWidth

  const bins: HistogramBin[] = []
  for (let start = minBin; start < maxBin; start += binWidth) {
    const end = start + binWidth
    const binTrees = filtered.filter(t => t.dbh_cm >= start && t.dbh_cm < end)
    if (!binTrees.length) continue   // skip empty bins for cleaner histogram

    const plotCounts: Record<string, number> = {}
    for (const t of binTrees) {
      plotCounts[t.plot] = (plotCounts[t.plot] ?? 0) + 1
    }

    bins.push({
      label: `${start}–${end}`,
      mid: start + binWidth / 2,
      count: binTrees.length,
      plotCounts,
    })
  }
  return bins
}

// ── Per-plot summary at a single year ─────────────────────────────────────────

export interface PlotSummary {
  plot: string
  totalCarbon: number
  meanDbh: number
  treeCount: number
}

export function computePlotSummaries(
  trees: VectorForestTree[],
  plots: string[],
): PlotSummary[] {
  return plots.map(plot => {
    const pt = trees.filter(t => t.plot === plot)
    return {
      plot,
      totalCarbon: pt.reduce((s, t) => s + t.carbon_kgC, 0),
      meanDbh: pt.length > 0 ? pt.reduce((s, t) => s + t.dbh_cm, 0) / pt.length : 0,
      treeCount: pt.length,
    }
  })
}

// ── Radar chart data (normalized per-plot profiles) ───────────────────────────

export interface RadarDataPoint {
  subject: string
  [plot: string]: number | string
}

/**
 * Normalise 4 per-plot metrics to a 0–100 scale for radar comparison.
 * Metrics: Carbon, Mean DBH, Tree Count, Species Richness.
 * Each metric is max-normalised: best plot = 100, others proportional.
 */
export function computeRadarData(
  snapshots: SnapshotData[],
  plots: string[],
  selectedYear: number,
): RadarDataPoint[] {
  const snapshot = snapshots.find(s => s.year === selectedYear)
  if (!snapshot || !plots.length) return []

  type PlotMetrics = {
    carbon: number
    meanDbh: number
    treeCount: number
    speciesCount: number
  }

  const perPlot: Record<string, PlotMetrics> = {}
  for (const plot of plots) {
    const pt = snapshot.trees.filter(t => t.plot === plot)
    perPlot[plot] = {
      carbon: pt.reduce((s, t) => s + t.carbon_kgC, 0),
      meanDbh: pt.length > 0 ? pt.reduce((s, t) => s + t.dbh_cm, 0) / pt.length : 0,
      treeCount: pt.length,
      speciesCount: new Set(pt.map(t => t.species)).size,
    }
  }

  const maxNorm = (key: keyof PlotMetrics): Record<string, number> => {
    const vals = plots.map(p => perPlot[p]?.[key] ?? 0)
    const maxVal = Math.max(...vals)
    const result: Record<string, number> = {}
    for (const p of plots) {
      result[p] = maxVal > 0 ? Math.round(((perPlot[p]?.[key] ?? 0) / maxVal) * 100) : 0
    }
    return result
  }

  const metrics: Array<{ key: keyof PlotMetrics; subject: string }> = [
    { key: 'carbon', subject: 'Carbon' },
    { key: 'meanDbh', subject: 'Mean DBH' },
    { key: 'treeCount', subject: 'Tree Count' },
    { key: 'speciesCount', subject: 'Species Richness' },
  ]

  return metrics.map(({ key, subject }) => {
    const norm = maxNorm(key)
    const point: RadarDataPoint = { subject }
    for (const p of plots) {
      point[p] = norm[p] ?? 0
    }
    return point
  })
}

// ── Recovery radial data ──────────────────────────────────────────────────────

export interface RadialPoint {
  year: number
  label: string
  /** % of total 20-year carbon growth that has been achieved */
  value: number
  /** Absolute carbon at this year (kgC) */
  carbon: number
}

/**
 * For each keyframe year compute the fraction of the total 20-year carbon
 * growth that has been achieved, expressed as 0–100%.
 *
 * year 0  →  0%  (no growth yet)
 * year 20 → 100% (all projected growth achieved)
 *
 * This is more visually spread (0 → 29 → 54 → 100) than % of absolute stock.
 */
export function computeRecoveryRadialData(
  timeSeries: TimeSeriesPoint[],
  selectedPlot: string,
): RadialPoint[] {
  const getCarbon = (p: TimeSeriesPoint) =>
    selectedPlot === 'all' ? p.totalCarbon : (p.plotCarbon[selectedPlot] ?? 0)

  const base = timeSeries.find(p => p.year === 0)
  const top = timeSeries.find(p => p.year === 20)
  if (!base || !top) return []

  const carbonBase = getCarbon(base)
  const carbonTop = getCarbon(top)
  const totalGrowth = carbonTop - carbonBase

  return KEYFRAME_YEARS.map(year => {
    const point = timeSeries.find(p => p.year === year)
    const carbon = point ? getCarbon(point) : 0
    const value =
      totalGrowth > 0
        ? Math.round(((carbon - carbonBase) / totalGrowth) * 100)
        : year === 20 ? 100 : 0
    return { year, label: `Year ${year}`, value, carbon }
  })
}
