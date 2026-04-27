'use client'

/**
 * Forest Insights — unified data page.
 *
 * Merges the old Dashboard + Visualizations pages into a single,
 * narrative-driven hierarchy:
 *
 *   1. Controls  — year pill selector + plot filter
 *   2. Summary   — 4 live metric cards
 *   3. Trends    — full-width Carbon OR DBH over time (toggle)
 *   4. Analysis  — Carbon by Plot (breakdown) + Tree Size Distribution
 *
 * Data source: fetchVisualizationData() — one parallel fetch for all charts.
 * No mock values; all numbers come from the FastAPI backend.
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle } from 'lucide-react'
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
import {
  fetchVisualizationData,
  type VisualizationData,
} from '@/lib/visualizationData'

type TrendMetric = 'carbon' | 'dbh'

// ── Skeletons ─────────────────────────────────────────────────────────────────

function MetricRowSkeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
          <div className="h-3 w-20 rounded bg-[var(--surface-2)] mb-4" />
          <div className="h-7 w-24 rounded bg-[var(--surface-2)] mb-2" />
          <div className="h-2.5 w-12 rounded bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton({ height = 'h-[340px]' }: { height?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-36 rounded bg-[var(--surface-2)] animate-pulse" />
        <div className="h-3 w-52 rounded bg-[var(--surface-2)] animate-pulse mt-1" />
      </CardHeader>
      <CardContent>
        <div className={`${height} rounded-control bg-[var(--surface-2)] animate-pulse`} />
      </CardContent>
    </Card>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  const isBackendDown = message.includes('Cannot reach the backend')
  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/60 p-5 border-l-4 border-l-amber-400">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-1">
            {isBackendDown ? 'Backend Not Running' : 'Error Loading Data'}
          </h3>
          <p className="text-meta text-[var(--text-muted)] mb-3">{message}</p>
          {isBackendDown && (
            <div className="rounded-control bg-[var(--surface)] border border-amber-200/60 px-3 py-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Start the backend:</p>
              <code className="text-xs bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 rounded block text-[var(--text)]">
                cd src && uvicorn api.app:app --reload
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-t border-[var(--border)] pt-2">
      <h2 className="text-section-title mt-4">{title}</h2>
      {subtitle && <p className="text-meta text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Pill toggle ───────────────────────────────────────────────────────────────

interface PillToggleProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

function PillToggle<T extends string>({ value, options, onChange }: PillToggleProps<T>) {
  return (
    <div className="flex rounded-control bg-[var(--surface-2)] p-0.5 gap-0.5 shrink-0">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            px-3 py-1 rounded-pill text-xs font-medium transition-all duration-150 whitespace-nowrap
            ${value === opt.value
              ? 'bg-[var(--accent)] text-white shadow-[0_1px_6px_var(--accent-glow)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ForestInsights() {
  const [data, setData]               = useState<VisualizationData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(0)
  const [selectedPlot, setSelectedPlot] = useState('all')
  const [trendMetric, setTrendMetric]   = useState<TrendMetric>('carbon')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchVisualizationData('baseline')
        if (!cancelled) setData(result)
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const currentSnapshot = useMemo(
    () => data?.snapshots.find(s => s.year === selectedYear),
    [data, selectedYear],
  )

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorBanner message={error} />
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader />
        {/* Controls placeholder */}
        <div className="h-9 w-64 rounded-control bg-[var(--surface-2)] animate-pulse" />
        <MetricRowSkeleton />
        <SectionDivider title="Carbon Trends" subtitle="20-year baseline projection" />
        <CardSkeleton height="h-[340px]" />
        <SectionDivider title="Plot Analysis" subtitle="Breakdown and size distribution" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton height="h-[280px]" />
          <CardSkeleton height="h-[280px]" />
        </div>
      </div>
    )
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────

  const trendTitle = trendMetric === 'carbon' ? 'Carbon Over Time' : 'Average DBH Over Time'
  const trendDescription = trendMetric === 'carbon'
    ? `Total carbon stored across all plots, 0–20 years. Dashed marker shows Year ${selectedYear}.${selectedPlot !== 'all' ? ` Filtered to ${selectedPlot} plot.` : ''}`
    : `Mean diameter at breast height across the simulation horizon. Lower plot has many small-diameter trees that pull the average down.`

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* ── Controls ── */}
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

      {/* ── 1. Summary metrics ── */}
      <GraphMetricCards
        timeSeries={data.timeSeries}
        snapshots={data.snapshots}
        selectedYear={selectedYear}
        selectedPlot={selectedPlot}
      />

      {/* ── All charts fade when year / plot changes ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedYear}-${selectedPlot}`}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >

          {/* ── 2. Trends ── */}
          <SectionDivider
            title="Carbon Trends"
            subtitle="How carbon and tree diameter change across the 20-year simulation."
          />

          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-card-title">{trendTitle}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {trendDescription}
                  </CardDescription>
                </div>
                <PillToggle
                  value={trendMetric}
                  options={[
                    { value: 'carbon', label: 'Carbon' },
                    { value: 'dbh',    label: 'Avg DBH' },
                  ]}
                  onChange={setTrendMetric}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={trendMetric}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {trendMetric === 'carbon' ? (
                    <CarbonTrendChart
                      timeSeries={data.timeSeries}
                      selectedYear={selectedYear}
                      selectedPlot={selectedPlot}
                      plots={data.plots}
                    />
                  ) : (
                    <DBHTrendChart
                      timeSeries={data.timeSeries}
                      selectedYear={selectedYear}
                      selectedPlot={selectedPlot}
                      plots={data.plots}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* ── 3. Plot analysis ── */}
          <SectionDivider
            title="Plot Analysis"
            subtitle={`Carbon distribution and tree sizes across the three forest plots — Year ${selectedYear}.`}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Carbon by plot */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-card-title">
                  Carbon by Plot — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Carbon stored in each plot. Middle holds the most carbon despite
                  having fewer trees than Lower, due to its larger-diameter trees.
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

            {/* Tree size distribution */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-card-title">
                  Tree Size Distribution — Year {selectedYear}
                </CardTitle>
                <CardDescription className="text-xs">
                  Trees per 10 cm DBH class. The large cohort of 0–20 cm trees
                  reflects natural regeneration, concentrated in the Lower plot.
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

          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <h1 className="text-page-title">Forest Insights</h1>
      <p className="text-meta text-[var(--text-muted)] mt-1">
        Carbon analysis and forest data — Pomfret School Forest
      </p>
    </div>
  )
}
