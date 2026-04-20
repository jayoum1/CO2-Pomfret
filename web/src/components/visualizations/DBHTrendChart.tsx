'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TimeSeriesPoint } from '@/lib/visualizationData'
import { PLOT_COLORS, TOTAL_COLOR } from '@/lib/visualizationData'

interface DBHTrendChartProps {
  timeSeries: TimeSeriesPoint[]
  selectedYear: number
  selectedPlot: string
  plots: string[]
}

function buildConfig(selectedPlot: string, plots: string[]): ChartConfig {
  if (selectedPlot !== 'all') {
    return {
      [selectedPlot]: {
        label: `${selectedPlot} Plot`,
        color: PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR,
      },
    }
  }
  const cfg: ChartConfig = { total: { label: 'All Trees', color: TOTAL_COLOR } }
  for (const p of plots) {
    cfg[p] = { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }
  }
  return cfg
}

export default function DBHTrendChart({
  timeSeries,
  selectedYear,
  selectedPlot,
  plots,
}: DBHTrendChartProps) {
  const config = buildConfig(selectedPlot, plots)

  const data = timeSeries.map(p => {
    const row: Record<string, number> = { year: p.year, total: p.meanDbh }
    for (const pl of plots) {
      row[pl] = p.plotMeanDbh[pl] ?? 0
    }
    return row
  })

  const showAll = selectedPlot === 'all'

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 0" stroke="#f1f5f9" />

        <XAxis
          dataKey="year"
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `Yr ${v}`}
          ticks={[0, 5, 10, 20]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickFormatter={v => `${v.toFixed(0)}`}
          width={36}
          unit=" cm"
        />

        <ReferenceLine
          x={selectedYear}
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          label={{
            value: `Yr ${selectedYear}`,
            position: 'top',
            fill: '#f59e0b',
            fontSize: 10,
          }}
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={v => `Year ${v} ahead`}
              formatter={(val, name) => [`${val.toFixed(2)} cm`, name]}
            />
          }
        />

        {showAll ? (
          <>
            {/* Aggregate mean */}
            <Line
              type="monotone"
              dataKey="total"
              stroke={TOTAL_COLOR}
              strokeWidth={2.5}
              dot={{ r: 4, fill: TOTAL_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            {/* Per-plot lines, dashed */}
            {plots.map(p => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLOT_COLORS[p] ?? '#94a3b8'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </>
        ) : (
          <>
            <Line
              type="monotone"
              dataKey={selectedPlot}
              stroke={PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR}
              strokeWidth={2.5}
              dot={{ r: 4, fill: PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </>
        )}
      </LineChart>
    </ChartContainer>
  )
}
