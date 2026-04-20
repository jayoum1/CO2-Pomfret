'use client'

import { RadialBarChart, RadialBar, Cell } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import type { TimeSeriesPoint } from '@/lib/visualizationData'
import { computeRecoveryRadialData } from '@/lib/visualizationData'

interface RecoveryRadialChartProps {
  timeSeries: TimeSeriesPoint[]
  selectedYear: number
  selectedPlot: string
}

const ACTIVE_COLOR = '#14b8a6'
const INACTIVE_COLOR = '#e2e8f0'
const BG_COLOR = '#f8fafc'

export default function RecoveryRadialChart({
  timeSeries,
  selectedYear,
  selectedPlot,
}: RecoveryRadialChartProps) {
  const radialData = computeRecoveryRadialData(timeSeries, selectedPlot)

  // Outermost to innermost: year 20 → 10 → 5 → 0
  // Each arc shows % of the total 20-year carbon growth achieved
  const data = radialData.map(d => ({
    ...d,
    fill: d.year === selectedYear ? ACTIVE_COLOR : INACTIVE_COLOR,
  }))

  const selectedPoint = data.find(d => d.year === selectedYear)
  const pct = selectedPoint?.value ?? 0

  const config: ChartConfig = {
    value: { label: 'Progress', color: ACTIVE_COLOR },
  }

  return (
    <div className="relative">
      <ChartContainer config={config} className="h-[280px] w-full">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="22%"
          outerRadius="85%"
          startAngle={90}
          endAngle={-270}
          data={data}
          barSize={16}
          barGap={4}
        >
          <RadialBar
            dataKey="value"
            background={{ fill: BG_COLOR }}
            cornerRadius={6}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} opacity={entry.year === selectedYear ? 1 : 0.55} />
            ))}
          </RadialBar>
        </RadialBarChart>
      </ChartContainer>

      {/* Center overlay: show % for selected year */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">
          {pct === 0 ? '0%' : pct >= 100 ? '100%' : `${pct}%`}
        </span>
        <span className="text-xs text-slate-400 mt-0.5">Year {selectedYear}</span>
        <span className="text-[10px] text-slate-300 mt-0.5">growth progress</span>
      </div>
    </div>
  )
}
