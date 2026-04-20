'use client'

/**
 * Presentation-only chart: all series come from parent props (no fetch).
 * Midterm page supplies data from FastAPI in dev or `/midterm-data/` JSON on GitHub Pages.
 */
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
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

interface CarbonTrendChartProps {
  timeSeries: TimeSeriesPoint[]
  selectedYear: number
  selectedPlot: string
  plots: string[]
}

// Build a chart config object for the current view mode
function buildConfig(selectedPlot: string, plots: string[]): ChartConfig {
  if (selectedPlot !== 'all') {
    return {
      [selectedPlot]: {
        label: `${selectedPlot} Plot`,
        color: PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR,
      },
    }
  }
  const cfg: ChartConfig = {
    total: { label: 'All Plots', color: TOTAL_COLOR },
  }
  for (const p of plots) {
    cfg[p] = { label: p, color: PLOT_COLORS[p] ?? '#94a3b8' }
  }
  return cfg
}

// Format carbon values on Y axis and tooltip (e.g. "99k")
function fmtCarbon(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return v.toFixed(0)
}

export default function CarbonTrendChart({
  timeSeries,
  selectedYear,
  selectedPlot,
  plots,
}: CarbonTrendChartProps) {
  const config = buildConfig(selectedPlot, plots)

  // Build flat data for Recharts: { year, total?, Upper?, Middle?, Lower? }
  const data = timeSeries.map(p => {
    const row: Record<string, number> = { year: p.year, total: p.totalCarbon }
    for (const pl of plots) {
      row[pl] = p.plotCarbon[pl] ?? 0
    }
    return row
  })

  const showAllPlots = selectedPlot === 'all'

  return (
    <ChartContainer config={config} className="h-[340px] w-full">
      <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 16 }}>
        {/* Gradient fills */}
        <defs>
          <linearGradient id="carbonGradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={TOTAL_COLOR} stopOpacity={0.22} />
            <stop offset="95%" stopColor={TOTAL_COLOR} stopOpacity={0.02} />
          </linearGradient>
          {plots.map(p => (
            <linearGradient key={p} id={`carbonGrad${p}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PLOT_COLORS[p] ?? '#94a3b8'} stopOpacity={0.15} />
              <stop offset="95%" stopColor={PLOT_COLORS[p] ?? '#94a3b8'} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

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
          tickFormatter={fmtCarbon}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={48}
          unit=" kgC"
        />

        {/* Selected-year vertical marker */}
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
              formatter={(val, name) => [
                `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`,
                name,
              ]}
            />
          }
        />

        {showAllPlots ? (
          <>
            {/* Total aggregate — hero area */}
            <Area
              type="monotone"
              dataKey="total"
              stroke={TOTAL_COLOR}
              strokeWidth={2.5}
              fill="url(#carbonGradTotal)"
              dot={{ r: 4, fill: TOTAL_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            {/* Per-plot dotted lines */}
            {plots.map(p => (
              <Area
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLOT_COLORS[p] ?? '#94a3b8'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                dot={false}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </>
        ) : (
          <>
            <Area
              type="monotone"
              dataKey={selectedPlot}
              stroke={PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR}
              strokeWidth={2.5}
              fill={`url(#carbonGrad${selectedPlot})`}
              dot={{ r: 4, fill: PLOT_COLORS[selectedPlot] ?? TOTAL_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </>
        )}
      </AreaChart>
    </ChartContainer>
  )
}
