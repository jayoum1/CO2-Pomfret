'use client'

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
import VisualizationControls from '@/components/visualizations/VisualizationControls'
import VisualizationMetricCards from '@/components/visualizations/VisualizationMetricCards'
import CarbonTimeSeriesChart from '@/components/visualizations/CarbonTimeSeriesChart'
import DBHTimeSeriesChart from '@/components/visualizations/DBHTimeSeriesChart'
import DBHDistributionChart from '@/components/visualizations/DBHDistributionChart'
import PlotComparisonPanel from '@/components/visualizations/PlotComparisonPanel'
import {
  fetchVisualizationData,
  type VisualizationData,
} from '@/lib/visualizationData'

export default function Visualizations() {
  const [data, setData] = useState<VisualizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(0)
  const [selectedPlot, setSelectedPlot] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
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

  const currentSnapshot = useMemo(
    () => data?.snapshots.find(s => s.year === selectedYear),
    [data, selectedYear],
  )

  const currentTrees = useMemo(() => {
    if (!currentSnapshot) return []
    if (selectedPlot === 'all') return currentSnapshot.trees
    return currentSnapshot.trees.filter(t => t.plot === selectedPlot)
  }, [currentSnapshot, selectedPlot])

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    const isBackendDown = error.includes('Cannot reach the backend')
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {isBackendDown ? 'Backend Server Not Running' : 'Error Loading Data'}
              </h3>
              <p className="text-sm text-gray-600 mb-3">{error}</p>
              {isBackendDown && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <p className="font-medium mb-1">To start the backend:</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1">
                    cd src && uvicorn api.app:app --reload
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-white/90 p-4">
              <div className="h-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-[320px] bg-gray-100 rounded-lg animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Main content ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <VisualizationControls
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          selectedPlot={selectedPlot}
          onPlotChange={setSelectedPlot}
          plots={data.plots}
        />
      </motion.div>

      {/* Metric cards */}
      <VisualizationMetricCards
        timeSeries={data.timeSeries}
        snapshots={data.snapshots}
        selectedYear={selectedYear}
        selectedPlot={selectedPlot}
      />

      {/* Charts grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedYear}-${selectedPlot}`}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* Carbon over time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Carbon Over Time</CardTitle>
              <CardDescription>
                Total carbon stored across the 20-year projection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CarbonTimeSeriesChart
                timeSeries={data.timeSeries}
                snapshots={data.snapshots}
                selectedYear={selectedYear}
                selectedPlot={selectedPlot}
                plots={data.plots}
              />
            </CardContent>
          </Card>

          {/* Average DBH over time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Average DBH Over Time</CardTitle>
              <CardDescription>
                Mean diameter at breast height across all trees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DBHTimeSeriesChart
                timeSeries={data.timeSeries}
                snapshots={data.snapshots}
                selectedYear={selectedYear}
                selectedPlot={selectedPlot}
                plots={data.plots}
              />
            </CardContent>
          </Card>

          {/* DBH distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">DBH Distribution</CardTitle>
              <CardDescription>
                Tree diameter distribution at the selected year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DBHDistributionChart
                trees={currentSnapshot?.trees ?? []}
                selectedPlot={selectedPlot}
                plots={data.plots}
                selectedYear={selectedYear}
              />
            </CardContent>
          </Card>

          {/* Plot comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plot Comparison</CardTitle>
              <CardDescription>
                Carbon and mean DBH side-by-side across plots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlotComparisonPanel
                snapshots={data.snapshots}
                selectedYear={selectedYear}
                plots={data.plots}
              />
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function PageHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <h1 className="text-2xl font-semibold">Forest Data Explorer</h1>
      </div>
      <p className="text-[var(--text-muted)] ml-12">
        Interactive visualizations of Pomfret forest carbon and growth data
      </p>
    </motion.div>
  )
}
