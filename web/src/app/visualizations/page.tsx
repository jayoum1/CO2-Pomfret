'use client'

/**
 * Forest Data Visualizations Page
 *
 * Dashboard-style chart section powered by real backend data.
 * All values come from GET /summary and GET /vector-forest/snapshot —
 * no mock data. Chart components are stateless and receive pre-computed
 * data props; all state and fetching lives here.
 *
 * Layout:
 *  - Controls row  (year selector + plot filter)
 *  - Metric cards  (live numbers for selected year/plot)
 *  - Hero chart    (Carbon over time — full-width area chart)
 *  - Row 2         (DBH Trend | Carbon by Plot)
 *  - Row 3         (DBH Distribution | Carbon Composition Donut)
 *  - Row 4         (Forest Profile Radar | Recovery Radial)
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BarChart3, AlertTriangle } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import GraphSectionControls from '@/components/visualizations/GraphSectionControls'
import GraphMetricCards from '@/components/visualizations/GraphMetricCards'
import CarbonTrendChart from '@/components/visualizations/CarbonTrendChart'
import DBHTrendChart from '@/components/visualizations/DBHTrendChart'
import CarbonByPlotChart from '@/components/visualizations/CarbonByPlotChart'
import DBHDistributionChart from '@/components/visualizations/DBHDistributionChart'
import CompositionDonutChart from '@/components/visualizations/CompositionDonutChart'
import ForestProfileRadarChart from '@/components/visualizations/ForestProfileRadarChart'
import RecoveryRadialChart from '@/components/visualizations/RecoveryRadialChart'
import {
  fetchVisualizationData,
  type VisualizationData,
} from '@/lib/visualizationData'

// ── Skeleton for loading state ────────────────────────────────────────────────

function CardSkeleton({ className = 'h-[280px]' }: { className?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="h-4 w-36 rounded bg-slate-100 animate-pulse" />
        <div className="h-3 w-52 rounded bg-slate-100 animate-pulse mt-1" />
      </CardHeader>
      <CardContent>
        <div className={`${className} rounded-lg bg-slate-50 animate-pulse`} />
      </CardContent>
    </Card>
  )
}

// ── Error card ────────────────────────────────────────────────────────────────

function ErrorCard({ message }: { message: string }) {
  const isBackendDown = message.includes('Cannot reach the backend')
  return (
    <div className="card border-l-4 border-l-amber-400">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-slate-800 mb-1">
            {isBackendDown ? 'Backend Not Running' : 'Error Loading Data'}
          </h3>
          <p className="text-sm text-slate-500 mb-3">{message}</p>
          {isBackendDown && (
            <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-3">
              <p className="font-medium mb-1 text-slate-600">Start the backend:</p>
              <code className="text-xs bg-white border border-slate-200 px-2 py-1 rounded block">
                cd src && uvicorn api.app:app --reload
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Visualizations() {
  const [data, setData] = useState<VisualizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(0)
  const [selectedPlot, setSelectedPlot] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchVisualizationData('baseline')
        if (!cancelled) setData(result)
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load visualization data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Trees at the selected year (used by distribution + donut)
  const currentSnapshot = useMemo(
    () => data?.snapshots.find(s => s.year === selectedYear),
    [data, selectedYear],
  )

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorCard message={error} />
      </div>
    )
  }

  // ── Loading skeletons ──────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader />
        {/* Metric card skeletons */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-16 rounded bg-slate-50" />
            </div>
          ))}
        </div>
        {/* Hero skeleton */}
        <CardSkeleton className="h-[340px]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <GraphSectionControls
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          selectedPlot={selectedPlot}
          onPlotChange={setSelectedPlot}
          plots={data.plots}
        />
      </motion.div>

      {/* Metric cards */}
      <GraphMetricCards
        timeSeries={data.timeSeries}
        snapshots={data.snapshots}
        selectedYear={selectedYear}
        selectedPlot={selectedPlot}
      />

      {/* Charts — fade when year or plot changes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedYear}-${selectedPlot}`}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* ── Hero: Carbon over time ────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-slate-700">
                Carbon Over Time
              </CardTitle>
              <CardDescription className="text-xs">
                Total carbon stored across the 20-year baseline projection.
                Dashed marker shows the selected year.
                {selectedPlot !== 'all' && ` Showing ${selectedPlot} plot only.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <CarbonTrendChart
                timeSeries={data.timeSeries}
                selectedYear={selectedYear}
                selectedPlot={selectedPlot}
                plots={data.plots}
              />
            </CardContent>
          </Card>

          {/* ── Row 2: DBH Trend + Carbon by Plot ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Average DBH Over Time
                </CardTitle>
                <CardDescription className="text-xs">
                  Mean diameter at breast height across all trees. Lower plot has
                  many small-diameter trees which pulls the average down.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <DBHTrendChart
                  timeSeries={data.timeSeries}
                  selectedYear={selectedYear}
                  selectedPlot={selectedPlot}
                  plots={data.plots}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Carbon by Plot — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Carbon stored in each plot at the selected year. Middle plot
                  holds the most carbon despite having fewer trees than Lower.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <CarbonByPlotChart
                  snapshots={data.snapshots}
                  selectedYear={selectedYear}
                  plots={data.plots}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: DBH Distribution + Composition Donut ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Tree Size Distribution — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Number of trees per 10 cm DBH class. The large cohort of small
                  trees (0–20 cm) reflects natural regeneration in the Lower plot.
                  {selectedPlot !== 'all' && ` Filtered to ${selectedPlot} plot.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <DBHDistributionChart
                  trees={currentSnapshot?.trees ?? []}
                  selectedPlot={selectedPlot}
                  plots={data.plots}
                  selectedYear={selectedYear}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Carbon Composition — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Share of total carbon stored by each plot. Middle plot
                  consistently holds the largest share due to its large-diameter trees.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <CompositionDonutChart
                  snapshots={data.snapshots}
                  selectedYear={selectedYear}
                  plots={data.plots}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Row 4: Forest Profile Radar + Recovery Radial ────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Forest Profile by Plot — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Normalised comparison of four metrics per plot (max = 100).
                  Upper has the highest mean DBH but only 3 species; Lower has the
                  richest species diversity with 18 species.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ForestProfileRadarChart
                  snapshots={data.snapshots}
                  selectedYear={selectedYear}
                  plots={data.plots}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Carbon Growth Progress
                </CardTitle>
                <CardDescription className="text-xs">
                  Fraction of the total 20-year projected carbon growth that has
                  been achieved at each keyframe year. Year 0 = 0%, Year 20 = 100%.
                  {selectedPlot !== 'all' && ` Showing ${selectedPlot} plot.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <RecoveryRadialChart
                  timeSeries={data.timeSeries}
                  selectedYear={selectedYear}
                  selectedPlot={selectedPlot}
                />
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Shared page header ────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-start gap-3"
    >
      <div className="mt-0.5 rounded-full bg-[var(--primary)]/10 p-2">
        <BarChart3 className="h-5 w-5 text-[var(--primary)]" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          Forest Data Visualizations
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Interactive charts from the Pomfret forest simulation — all values
          pulled live from the backend.
        </p>
      </div>
    </motion.div>
  )
}
