'use client'

/**
 * Offline data for the midterm showcase when FastAPI is unavailable (e.g. GitHub Pages).
 *
 * Source JSON is generated from `Data/Processed Data/forest_snapshots/forest_{0,5,10,20}_years.csv`
 * at build time and shipped as static files under `web/public/midterm-data/`.
 *
 * This is GitHub Pages–safe and does not call `NEXT_PUBLIC_API_BASE_URL`.
 *
 * Live app (local): set `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` unset/false and use FastAPI for fresh data.
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

interface SnapshotFile {
  snapshots: VectorForestSnapshot[]
}

interface SummaryFile {
  summaries: Summary[]
}

const KEYFRAME_YEARS = [0, 5, 10, 20]
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

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

export async function loadStaticSnapshots(): Promise<VectorForestSnapshot[]> {
  const response = await fetch(`${BASE_PATH}/midterm-data/snapshots.json`)
  if (!response.ok) throw new Error('Failed to load static snapshots')
  const data = (await response.json()) as SnapshotFile
  return data.snapshots
}

export async function getStaticVectorForestSnapshot(
  yearsAhead: number,
  plot: string = 'all',
): Promise<VectorForestSnapshot> {
  const snapshots = await loadStaticSnapshots()
  const hit = snapshots.find((s) => s.years_ahead === yearsAhead)
  if (!hit) throw new Error(`Static snapshot missing for year ${yearsAhead}`)
  if (plot === 'all') return hit
  const trees = hit.trees.filter((t) => t.plot === plot)
  return {
    ...hit,
    plot_filter: plot,
    count: trees.length,
    trees,
  }
}

export async function loadStaticVisualizationData(): Promise<VisualizationData> {
  const [summariesRes, snapshotsRes] = await Promise.all([
    fetch(`${BASE_PATH}/midterm-data/summaries.json`),
    fetch(`${BASE_PATH}/midterm-data/snapshots.json`),
  ])
  if (!summariesRes.ok || !snapshotsRes.ok) {
    throw new Error('Failed to load static midterm data')
  }

  const summaryFile = (await summariesRes.json()) as SummaryFile
  const snapshotFile = (await snapshotsRes.json()) as SnapshotFile

  const summaries = summaryFile.summaries
  const snapshots = snapshotFile.snapshots

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
