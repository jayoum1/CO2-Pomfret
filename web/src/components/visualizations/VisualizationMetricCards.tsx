'use client'

import { motion } from 'motion/react'
import { TreePine, Ruler, TrendingUp, Trees } from 'lucide-react'
import type { TimeSeriesPoint, SnapshotData } from '@/lib/visualizationData'

interface VisualizationMetricCardsProps {
  timeSeries: TimeSeriesPoint[]
  snapshots: SnapshotData[]
  selectedYear: number
  selectedPlot: string
}

export default function VisualizationMetricCards({
  timeSeries,
  snapshots,
  selectedYear,
  selectedPlot,
}: VisualizationMetricCardsProps) {
  const currentPoint = timeSeries.find(p => p.year === selectedYear)
  const baselinePoint = timeSeries.find(p => p.year === 0)
  const snapshot = snapshots.find(s => s.year === selectedYear)

  if (!currentPoint || !baselinePoint || !snapshot) return null

  const filteredTrees =
    selectedPlot === 'all'
      ? snapshot.trees
      : snapshot.trees.filter(t => t.plot === selectedPlot)

  const totalCarbon =
    selectedPlot === 'all'
      ? currentPoint.totalCarbon
      : filteredTrees.reduce((s, t) => s + t.carbon_kgC, 0)

  const baselineCarbon =
    selectedPlot === 'all'
      ? baselinePoint.totalCarbon
      : (snapshots.find(s => s.year === 0)?.trees ?? [])
          .filter(t => selectedPlot === 'all' || t.plot === selectedPlot)
          .reduce((s, t) => s + t.carbon_kgC, 0)

  const meanDbh =
    filteredTrees.length > 0
      ? filteredTrees.reduce((s, t) => s + t.dbh_cm, 0) / filteredTrees.length
      : 0

  const carbonChange =
    baselineCarbon > 0
      ? ((totalCarbon - baselineCarbon) / baselineCarbon) * 100
      : 0

  const metrics = [
    {
      label: 'Total Carbon',
      value: `${totalCarbon.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      unit: 'kg C',
      icon: TreePine,
      color: 'var(--teal-600)',
    },
    {
      label: 'Mean DBH',
      value: meanDbh.toFixed(1),
      unit: 'cm',
      icon: Ruler,
      color: 'var(--accent)',
    },
    {
      label: 'Trees',
      value: filteredTrees.length.toLocaleString(),
      unit: selectedPlot === 'all' ? 'all plots' : selectedPlot,
      icon: Trees,
      color: 'var(--green-600)',
    },
    {
      label: 'Change from Year 0',
      value: `${carbonChange >= 0 ? '+' : ''}${carbonChange.toFixed(1)}%`,
      unit: 'carbon',
      icon: TrendingUp,
      color: carbonChange >= 0 ? 'var(--green-600)' : 'var(--error)',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06 }}
          className="rounded-xl border border-[var(--border)] bg-white/90 backdrop-blur-sm p-4"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <m.icon className="w-4 h-4" style={{ color: m.color }} />
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {m.label}
            </span>
          </div>
          <motion.div
            key={`${m.label}-${m.value}`}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-xl font-bold"
            style={{ color: m.color }}
          >
            {m.value}
          </motion.div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">{m.unit}</div>
        </motion.div>
      ))}
    </div>
  )
}
