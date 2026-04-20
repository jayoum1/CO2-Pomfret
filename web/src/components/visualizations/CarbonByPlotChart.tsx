'use client'

/**
 * Presentation-only chart: all series come from parent props (no fetch).
 * Midterm page supplies snapshot-derived aggregates (live API or static JSON).
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SnapshotData } from '@/lib/visualizationData'
import { computePlotSummaries, PLOT_COLORS } from '@/lib/visualizationData'

interface CarbonByPlotChartProps {
  snapshots: SnapshotData[]
  selectedYear: number
  plots: string[]
}

export default function CarbonByPlotChart({
  snapshots,
  selectedYear,
  plots,
}: CarbonByPlotChartProps) {
  const snapshot = snapshots.find(s => s.year === selectedYear)
  if (!snapshot) return null

  const summaries = computePlotSummaries(snapshot.trees, plots)

  const data = summaries.map(s => ({
    plot: s.plot,
    carbon: Math.round(s.totalCarbon),
    fill: PLOT_COLORS[s.plot] ?? '#94a3b8',
  }))

  const config: ChartConfig = Object.fromEntries(
    plots.map(p => [p, { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }]),
  )

  const maxCarbon = Math.max(...data.map(d => d.carbon))

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        barCategoryGap="28%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 0" stroke="#f1f5f9" />

        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          domain={[0, Math.ceil(maxCarbon / 5000) * 5000]}
        />
        <YAxis
          type="category"
          dataKey="plot"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
          width={52}
        />

        <ChartTooltip
          cursor={{ fill: '#f8fafc' }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(val, name) => [
                `${val.toLocaleString()} kg C`,
                `${name} Plot`,
              ]}
            />
          }
        />

        <Bar dataKey="carbon" radius={[0, 5, 5, 0]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
