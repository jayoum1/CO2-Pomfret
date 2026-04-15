'use client'

import dynamic from 'next/dynamic'
import type { TimeSeriesPoint, SnapshotData } from '@/lib/visualizationData'
import { computePlotCarbonSeries } from '@/lib/visualizationData'
import {
  PLOT_COLORS,
  AGGREGATE_COLOR,
  YEAR_MARKER_COLOR,
  BASE_LAYOUT,
  PLOTLY_CONFIG,
} from './chartTheme'

const Plot = dynamic(() => import('./PlotlyChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-lg bg-gray-100" />
  ),
})

interface CarbonTimeSeriesChartProps {
  timeSeries: TimeSeriesPoint[]
  snapshots: SnapshotData[]
  selectedYear: number
  selectedPlot: string
  plots: string[]
}

export default function CarbonTimeSeriesChart({
  timeSeries,
  snapshots,
  selectedYear,
  selectedPlot,
  plots,
}: CarbonTimeSeriesChartProps) {
  const years = timeSeries.map(p => p.year)
  const traces: Record<string, any>[] = []

  if (selectedPlot === 'all') {
    traces.push({
      x: years,
      y: timeSeries.map(p => p.totalCarbon),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'All Plots',
      line: { color: AGGREGATE_COLOR, width: 2.5, shape: 'spline' },
      marker: { size: 6, color: AGGREGATE_COLOR },
      hovertemplate: 'Year %{x}<br>%{y:,.0f} kg C<extra>All Plots</extra>',
    })

    const plotSeries = computePlotCarbonSeries(snapshots, plots)
    for (const plot of plots) {
      const series = plotSeries[plot]
      traces.push({
        x: series.map(s => s.year),
        y: series.map(s => s.totalCarbon),
        type: 'scatter',
        mode: 'lines+markers',
        name: plot,
        line: {
          color: PLOT_COLORS[plot] ?? '#94a3b8',
          width: 1.5,
          dash: 'dot',
          shape: 'spline',
        },
        marker: { size: 4, color: PLOT_COLORS[plot] ?? '#94a3b8' },
        hovertemplate: `Year %{x}<br>%{y:,.0f} kg C<extra>${plot}</extra>`,
      })
    }
  } else {
    const plotSeries = computePlotCarbonSeries(snapshots, [selectedPlot])
    const series = plotSeries[selectedPlot] ?? []
    traces.push({
      x: series.map(s => s.year),
      y: series.map(s => s.totalCarbon),
      type: 'scatter',
      mode: 'lines+markers',
      name: selectedPlot,
      line: {
        color: PLOT_COLORS[selectedPlot] ?? AGGREGATE_COLOR,
        width: 2.5,
        shape: 'spline',
      },
      marker: {
        size: 6,
        color: PLOT_COLORS[selectedPlot] ?? AGGREGATE_COLOR,
      },
      hovertemplate: `Year %{x}<br>%{y:,.0f} kg C<extra>${selectedPlot}</extra>`,
    })
  }

  const layout: Record<string, any> = {
    ...BASE_LAYOUT,
    xaxis: {
      ...BASE_LAYOUT.xaxis,
      title: { text: 'Years Ahead', standoff: 8 },
      tickvals: years,
      dtick: 5,
    },
    yaxis: {
      ...BASE_LAYOUT.yaxis,
      title: { text: 'Carbon (kg C)', standoff: 12 },
      tickformat: ',.0f',
    },
    shapes: [
      {
        type: 'line',
        x0: selectedYear,
        x1: selectedYear,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: YEAR_MARKER_COLOR, width: 2, dash: 'dash' },
      },
    ],
    annotations: [
      {
        x: selectedYear,
        y: 1.04,
        yref: 'paper',
        text: `Year ${selectedYear}`,
        showarrow: false,
        font: { size: 10, color: YEAR_MARKER_COLOR },
      },
    ],
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={PLOTLY_CONFIG}
      useResizeHandler
      className="w-full"
      style={{ height: 320 }}
    />
  )
}
