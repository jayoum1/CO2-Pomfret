'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SnapshotData } from '@/lib/visualizationData'
import { computeRadarData, PLOT_COLORS } from '@/lib/visualizationData'

interface ForestProfileRadarChartProps {
  snapshots: SnapshotData[]
  selectedYear: number
  plots: string[]
}

// Custom radar tooltip
function RadarTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const subject = payload[0]?.payload?.subject as string
  return (
    <div className="min-w-[10rem] rounded-lg border border-[var(--border)] dark:border-[var(--border-strong)] bg-[var(--surface)] dark:bg-[var(--surface-3)] px-3 py-2 text-xs shadow-xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
      <p className="mb-1.5 font-semibold text-[var(--text)]">{subject}</p>
      <div className="grid gap-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: PLOT_COLORS[item.dataKey] ?? '#94a3b8' }}
            />
            <span className="text-[var(--text-muted)]">{item.dataKey}</span>
            <span className="ml-auto font-mono font-semibold text-slate-800">
              {item.value}/100
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ForestProfileRadarChart({
  snapshots,
  selectedYear,
  plots,
}: ForestProfileRadarChartProps) {
  const data = computeRadarData(snapshots, plots, selectedYear)

  const config: ChartConfig = Object.fromEntries(
    plots.map(p => [p, { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }]),
  )

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
          tickLine={false}
        />

        {plots.map(plot => (
          <Radar
            key={plot}
            name={plot}
            dataKey={plot}
            stroke={PLOT_COLORS[plot] ?? '#94a3b8'}
            strokeWidth={1.8}
            fill={PLOT_COLORS[plot] ?? '#94a3b8'}
            fillOpacity={0.12}
            dot={{ r: 3, strokeWidth: 0, fill: PLOT_COLORS[plot] }}
          />
        ))}

        <Tooltip content={<RadarTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </RadarChart>
    </ChartContainer>
  )
}
