'use client'

import { motion } from 'motion/react'
import { Leaf, Ruler, Trees, Wind } from 'lucide-react'
import type { TimeSeriesPoint, SnapshotData } from '@/lib/visualizationData'
import { CO2E_FACTOR } from '@/lib/visualizationData'

interface GraphMetricCardsProps {
  timeSeries: TimeSeriesPoint[]
  snapshots: SnapshotData[]
  selectedYear: number
  selectedPlot: string
}

export default function GraphMetricCards({
  timeSeries,
  snapshots,
  selectedYear,
  selectedPlot,
}: GraphMetricCardsProps) {
  const point = timeSeries.find(p => p.year === selectedYear)
  const base = timeSeries.find(p => p.year === 0)
  const snapshot = snapshots.find(s => s.year === selectedYear)

  if (!point || !base || !snapshot) return null

  const trees =
    selectedPlot === 'all'
      ? snapshot.trees
      : snapshot.trees.filter(t => t.plot === selectedPlot)

  const baseCarbon =
    selectedPlot === 'all'
      ? base.totalCarbon
      : (snapshots.find(s => s.year === 0)?.trees ?? [])
          .filter(t => selectedPlot === 'all' || t.plot === selectedPlot)
          .reduce((s, t) => s + t.carbon_kgC, 0)

  const totalCarbon = trees.reduce((s, t) => s + t.carbon_kgC, 0)
  const meanDbh =
    trees.length > 0 ? trees.reduce((s, t) => s + t.dbh_cm, 0) / trees.length : 0
  const carbonChange =
    baseCarbon > 0 ? ((totalCarbon - baseCarbon) / baseCarbon) * 100 : 0

  const co2e = totalCarbon * CO2E_FACTOR

  const cards = [
    {
      label: 'Total Carbon',
      value: `${(totalCarbon / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`,
      unit: 'kg C',
      icon: Leaf,
      accent: '#0d9488',
      change:
        selectedYear > 0
          ? `${carbonChange >= 0 ? '+' : ''}${carbonChange.toFixed(1)}% since year 0`
          : null,
      changePositive: carbonChange >= 0,
    },
    {
      label: 'Mean DBH',
      value: meanDbh.toFixed(1),
      unit: 'cm',
      icon: Ruler,
      accent: '#059669',
      change: null,
    },
    {
      label: 'Trees',
      value: trees.length.toLocaleString(),
      unit: selectedPlot === 'all' ? 'across all plots' : selectedPlot + ' plot',
      icon: Trees,
      accent: '#2563eb',
      change: null,
    },
    {
      label: 'CO₂ Equivalent',
      value: `${(co2e / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`,
      unit: 'kg CO₂e',
      icon: Wind,
      accent: '#7c3aed',
      change: null,
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">{c.label}</span>
            <div
              className="rounded-md p-1.5"
              style={{ backgroundColor: c.accent + '18' }}
            >
              <c.icon className="w-3.5 h-3.5" style={{ color: c.accent }} />
            </div>
          </div>

          <motion.div
            key={c.value}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <span className="text-xl font-bold text-slate-800">{c.value}</span>
            <span className="ml-1.5 text-xs text-slate-400">{c.unit}</span>
          </motion.div>

          {c.change && (
            <div
              className={`mt-1.5 text-xs font-medium ${
                c.changePositive ? 'text-emerald-600' : 'text-rose-500'
              }`}
            >
              {c.change}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
