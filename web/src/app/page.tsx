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
import { AlertTriangle, RefreshCw } from 'lucide-react'
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
import { usePublishSync } from '@/lib/usePublishSync'

type TrendMetric = 'carbon' | 'dbh'

// ── Skeletons ─────────────────────────────────────────────────────────────────

function MetricRowSkeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className="rounded-card border border-[var(--border)] border-l-[3px] border-l-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[var(--surface)] p-4 animate-pulse shadow-[var(--shadow-soft)]"
        >
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
    <div
      role="alert"
      className="rounded-card border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_08%,var(--surface))] p-5 border-l-[3px] border-l-[var(--warning)] dark:bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface-2))]"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--warning)] mt-0.5 shrink-0" strokeWidth={1.5} />
        <div>
          <h3 className="text-sm font-display font-semibold text-[var(--text)] mb-1">
            {isBackendDown ? 'Backend Not Running' : 'Error Loading Data'}
          </h3>
          <p className="text-meta text-[var(--text-muted)] mb-3">{message}</p>
          {isBackendDown && (
            <div className="rounded-control bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5">
              <p className="text-[10px] font-mono uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Start the backend</p>
              <code className="text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 rounded block text-[var(--text)]">
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
    <div className="section-field-rule mt-2">
      <div className="flex items-baseline gap-3 mt-3 flex-wrap">
        <h2 className="text-section-title">{title}</h2>
        <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Field log
        </span>
      </div>
      {subtitle && <p className="text-meta text-[var(--text-muted)] mt-1 max-w-3xl">{subtitle}</p>}
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
    <div className="flex rounded-control border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--surface-2)] p-0.5 gap-0.5 shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            px-3 py-1 rounded-pill text-xs font-medium transition-all duration-150 whitespace-nowrap
            ${value === opt.value
              ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_1px_8px_var(--primary-glow)]'
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
  // Bumps every time a new revision is published (admin/page.tsx broadcasts
  // an event; we also poll /dataset-version as a fallback). Used as a
  // refetch key so the dashboard never silently shows stale data.
  const { version: datasetVersion, refreshKey, forceRefresh } = usePublishSync()
  const [justRefreshed, setJustRefreshed] = useState(false)

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
  }, [refreshKey])

  // Briefly highlight the freshness badge when a new publish lands so the
  // user can see the dashboard updated itself.
  useEffect(() => {
    if (refreshKey === 0) return
    setJustRefreshed(true)
    const t = window.setTimeout(() => setJustRefreshed(false), 2500)
    return () => window.clearTimeout(t)
  }, [refreshKey])

  const currentSnapshot = useMemo(
    () => data?.snapshots.find(s => s.year === selectedYear),
    [data, selectedYear],
  )

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          datasetVersion={datasetVersion}
          justRefreshed={justRefreshed}
          onRefresh={forceRefresh}
        />
        <ErrorBanner message={error} />
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          datasetVersion={datasetVersion}
          justRefreshed={justRefreshed}
          onRefresh={forceRefresh}
        />
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
    <div>
      {/* ── Band Dark: Header + Controls + Summary metrics ──────────────────── */}
      <div className="band-dark -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="space-y-6">
          <PageHeader
            datasetVersion={datasetVersion}
            justRefreshed={justRefreshed}
            onRefresh={forceRefresh}
          />

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

          <GraphMetricCards
            timeSeries={data.timeSeries}
            snapshots={data.snapshots}
            selectedYear={selectedYear}
            selectedPlot={selectedPlot}
          />
        </div>
      </div>

      {/* ── Charts — fade on year / plot change ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedYear}-${selectedPlot}`}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >

          {/* ── Band Light: Carbon Trends ────────────────────────────────────── */}
          <div className="band-light -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8">
            <div className="space-y-4">
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
            </div>
          </div>

          {/* ── Band Dark: Plot Analysis ─────────────────────────────────────── */}
          <div className="band-dark -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8">
            <div className="space-y-4">
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
            </div>
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function PageHeader({
  datasetVersion,
  justRefreshed,
  onRefresh,
}: {
  datasetVersion?: { revision_id: string | null; published_at: string | null } | null
  justRefreshed?: boolean
  onRefresh?: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1">
          Baseline simulation · observatory index
        </p>
        <h1 className="text-page-title">Forest Insights</h1>
        <p className="text-meta text-[var(--text-muted)] mt-1 max-w-2xl">
          Carbon storage, diameter structure, and plot-scale dynamics for the Pomfret School forest — grounded in inventory and growth projections.
        </p>
      </div>
      {datasetVersion?.revision_id && (
        <div className="flex items-center gap-2">
          <DatasetFreshnessBadge
            revisionId={datasetVersion.revision_id}
            publishedAt={datasetVersion.published_at}
            highlight={justRefreshed}
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-pill border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[color-mix(in_srgb,var(--primary)_50%,var(--border))] transition"
              title="Re-fetch the latest published dataset"
            >
              <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
              Sync
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DatasetFreshnessBadge({
  revisionId,
  publishedAt,
  highlight,
}: {
  revisionId: string
  publishedAt: string | null
  highlight?: boolean
}) {
  return (
    <div
      title={`Revision ${revisionId}${publishedAt ? ` · published ${publishedAt}` : ''}`}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide transition-colors duration-300 ${
        highlight
          ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--text)]'
          : 'border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,var(--surface-2))] text-[var(--text-muted)]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ring-2 ring-[color-mix(in_srgb,var(--surface)_100%,transparent)] ${
          highlight ? 'bg-[var(--primary)] shadow-[0_0_8px_var(--primary-glow)]' : 'bg-[var(--text-faint)]'
        }`}
      />
      {highlight ? 'Revised' : 'Dataset'}
      <span className="text-[var(--text-faint)] normal-case tracking-normal">·</span>
      <span className="font-mono normal-case tracking-normal">{revisionId.slice(0, 16)}…</span>
    </div>
  )
}
