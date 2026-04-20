'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { VectorForestTree } from '@/lib/api'
import { computeDbhHistogram, PLOT_COLORS, TOTAL_COLOR } from '@/lib/visualizationData'

interface DBHDistributionChartProps {
  trees: VectorForestTree[]
  selectedPlot: string
  plots: string[]
  selectedYear: number
}

export default function DBHDistributionChart({
  trees,
  selectedPlot,
  plots,
  selectedYear,
}: DBHDistributionChartProps) {
  const bins = computeDbhHistogram(trees, selectedPlot, 10)

  const showAll = selectedPlot === 'all'

  // Config: either per-plot colors or a single total color
  const config: ChartConfig = showAll
    ? Object.fromEntries(plots.map(p => [p, { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }]))
    : { count: { label: `${selectedPlot} trees`, color: PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR } }

  // Recharts wants a flat data array for stacked bars: { label, Upper, Middle, Lower }
  const data = showAll
    ? bins.map(b => {
        const row: Record<string, string | number> = { label: b.label }
        for (const p of plots) row[p] = b.plotCounts[p] ?? 0
        return row
      })
    : bins.map(b => ({ label: b.label, count: b.count }))

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} strokeDasharray="3 0" stroke="#f1f5f9" />

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={40}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={32}
        />

        <ChartTooltip
          cursor={{ fill: '#f8fafc' }}
          content={
            <ChartTooltipContent
              labelFormatter={v => `DBH ${v} cm`}
              formatter={(val, name) => [`${val} trees`, name]}
            />
          }
        />

        {showAll ? (
          <>
            {plots.map((p, i) => (
              <Bar
                key={p}
                dataKey={p}
                stackId="dist"
                fill={PLOT_COLORS[p] ?? '#94a3b8'}
                fillOpacity={0.88}
                radius={i === plots.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </>
        ) : (
          <Bar
            dataKey="count"
            radius={[3, 3, 0, 0]}
            fill={PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR}
            fillOpacity={0.85}
          />
        )}
      </BarChart>
    </ChartContainer>
  )
}
