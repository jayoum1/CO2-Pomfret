'use client'

/**
 * Offline data for the midterm showcase when FastAPI is unavailable (e.g. GitHub Pages).
 *
 * Data is **bundled at build time** by importing `public/midterm-data/*.json` (same source CSVs
 * as before). No runtime `fetch()` — avoids wrong `basePath` on GitHub Pages and works offline.
 *
 * Snapshots exist only for keyframe years **0, 5, 10, 20**. The forest year slider is 0–20,
 * so we map any slider year to the **nearest** keyframe for tree rows (same forest, interpolated UX).
 *
 * Live app: `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` off — try FastAPI first, then fall back to this bundle.
 */

import type {
  Summary,
  VectorForestSnapshot,
  VectorForestTree,
} from '@/lib/api'
import type {
  SnapshotData,
  TimeSeriesPoint,
  VisualizationData,
} from '@/lib/visualizationData'

import snapshotsJson from '../../public/midterm-data/snapshots.json'
import summariesJson from '../../public/midterm-data/summaries.json'

interface SnapshotFile {
  snapshots: VectorForestSnapshot[]
}

interface SummaryFile {
  summaries: Summary[]
}

const BUNDLED_SNAPSHOTS = (snapshotsJson as SnapshotFile).snapshots
const BUNDLED_SUMMARIES = (summariesJson as SummaryFile).summaries

const KEYFRAME_YEARS = [0, 5, 10, 20] as const
export type MidtermKeyframeYear = (typeof KEYFRAME_YEARS)[number]

/**
 * Map slider year (0–20) to the nearest stored snapshot keyframe.
 * Static data only has four horizons; forest DBH “steps” at those years for the demo.
 */
export function nearestKeyframeYear(sliderYear: number): MidtermKeyframeYear {
  let best: MidtermKeyframeYear = KEYFRAME_YEARS[0]
  let bestDist = Math.abs(sliderYear - best)
  for (const k of KEYFRAME_YEARS) {
    const d = Math.abs(sliderYear - k)
    if (d < bestDist) {
      best = k
      bestDist = d
    }
  }
  return best
}

function meanDbhByPlot(trees: VectorForestTree[]): Record<string, number> {
  const byPlot: Record<string, number[]> = {}
  for (const t of trees) {
    if (!byPlot[t.plot]) byPlot[t.plot] = []
    byPlot[t.plot].push(t.dbh_cm)
  }
  const out: Record<string, number> = {}
  for (const [plot, vals] of Object.entries(byPlot)) {
    out[plot] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  return out
}

function getBundledSnapshots(): VectorForestSnapshot[] {
  return BUNDLED_SNAPSHOTS
}

/** @deprecated Prefer sync bundle; kept for any external await callers */
export async function loadStaticSnapshots(): Promise<VectorForestSnapshot[]> {
  return getBundledSnapshots()
}

/**
 * Snapshot rows for the requested slider year: uses nearest keyframe data, preserves
 * `years_ahead` as the **slider** value so the scene/inspector match the UI year.
 */
export async function getStaticVectorForestSnapshot(
  yearsAhead: number,
  plot: string = 'all',
): Promise<VectorForestSnapshot> {
  const keyYear = nearestKeyframeYear(Math.max(0, Math.min(20, yearsAhead)))
  const snapshots = getBundledSnapshots()
  const hit = snapshots.find((s) => s.years_ahead === keyYear)
  if (!hit) {
    throw new Error(`Bundled snapshot missing for keyframe year ${keyYear}`)
  }

  const base: VectorForestSnapshot = {
    ...hit,
    years_ahead: yearsAhead,
  }

  if (plot === 'all') return base

  const trees = hit.trees.filter((t) => t.plot === plot)
  return {
    ...base,
    plot_filter: plot,
    count: trees.length,
    trees,
  }
}

export async function loadStaticVisualizationData(): Promise<VisualizationData> {
  const summaries = BUNDLED_SUMMARIES
  const snapshots = getBundledSnapshots()

  const timeSeries: TimeSeriesPoint[] = KEYFRAME_YEARS.map((year) => {
    const summary = summaries.find((s) => s.years_ahead === year)
    const snapshot = snapshots.find((s) => s.years_ahead === year)
    if (!summary || !snapshot) {
      throw new Error(`Missing static summary/snapshot for year ${year}`)
    }

    const plotMeanDbh = meanDbhByPlot(snapshot.trees)
    return {
      year,
      totalCarbon: summary.total_carbon_kgC,
      meanDbh: summary.mean_dbh_cm,
      numTrees: summary.num_trees,
      plotCarbon: Object.fromEntries(
        Object.entries(summary.plot_breakdown).map(([k, v]) => [k, v.carbon_at_time]),
      ),
      plotCount: Object.fromEntries(
        Object.entries(summary.plot_breakdown).map(([k, v]) => [k, v.count]),
      ),
      plotMeanDbh,
    }
  })

  const snapshotData: SnapshotData[] = KEYFRAME_YEARS.map((year) => {
    const snapshot = snapshots.find((s) => s.years_ahead === year)
    if (!snapshot) throw new Error(`Missing static snapshot for year ${year}`)
    return { year, trees: snapshot.trees }
  })

  const plots = snapshots[0]?.plots ?? ['Upper', 'Middle', 'Lower']
  return { timeSeries, snapshots: snapshotData, plots }
}
