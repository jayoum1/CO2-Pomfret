'use client'

import { PieChart, Pie, Cell, Label } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SnapshotData } from '@/lib/visualizationData'
import { computePlotSummaries, PLOT_COLORS, CO2E_FACTOR } from '@/lib/visualizationData'

interface CompositionDonutChartProps {
  snapshots: SnapshotData[]
  selectedYear: number
  plots: string[]
}

export default function CompositionDonutChart({
  snapshots,
  selectedYear,
  plots,
}: CompositionDonutChartProps) {
  const snapshot = snapshots.find(s => s.year === selectedYear)
  if (!snapshot) return null

  const summaries = computePlotSummaries(snapshot.trees, plots)

  const data = summaries.map(s => ({
    name: s.plot,
    value: Math.round(s.totalCarbon),
    fill: PLOT_COLORS[s.plot] ?? '#94a3b8',
  }))

  const total = data.reduce((s, d) => s + d.value, 0)

  const config: ChartConfig = Object.fromEntries(
    plots.map(p => [p, { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }]),
  )

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={data}
          cx="50%"
          cy="48%"
          innerRadius="54%"
          outerRadius="78%"
          dataKey="value"
          nameKey="name"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}

          {/* Center label — total carbon */}
          <Label
            content={({ viewBox }) => {
              const cx = viewBox && 'cx' in viewBox ? (viewBox.cx ?? 0) : 0
              const cy = viewBox && 'cy' in viewBox ? (viewBox.cy ?? 0) : 0
              return (
                <g>
                  <text
                    x={cx}
                    y={cy - 9}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={700}
                    fill="#1e293b"
                  >
                    {(total / 1000).toFixed(1)}k
                  </text>
                  <text
                    x={cx}
                    y={cy + 9}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#94a3b8"
                  >
                    kg C total
                  </text>
                </g>
              )
            }}
          />
        </Pie>

        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(val, name) => [
                `${val.toLocaleString()} kg C`,
                name,
              ]}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
}
