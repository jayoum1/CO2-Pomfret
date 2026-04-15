'use client'

import dynamic from 'next/dynamic'
import type { TimeSeriesPoint, SnapshotData } from '@/lib/visualizationData'
import { computePlotDbhSeries } from '@/lib/visualizationData'
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

interface DBHTimeSeriesChartProps {
  timeSeries: TimeSeriesPoint[]
  snapshots: SnapshotData[]
  selectedYear: number
  selectedPlot: string
  plots: string[]
}

export default function DBHTimeSeriesChart({
  timeSeries,
  snapshots,
  selectedYear,
  selectedPlot,
  plots,
}: DBHTimeSeriesChartProps) {
  const years = timeSeries.map(p => p.year)
  const traces: Record<string, any>[] = []

  if (selectedPlot === 'all') {
    traces.push({
      x: years,
      y: timeSeries.map(p => p.meanDbh),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'All Plots',
      line: { color: AGGREGATE_COLOR, width: 2.5, shape: 'spline' },
      marker: { size: 6, color: AGGREGATE_COLOR },
      hovertemplate: 'Year %{x}<br>%{y:.1f} cm<extra>All Plots</extra>',
    })

    const plotSeries = computePlotDbhSeries(snapshots, plots)
    for (const plot of plots) {
      const series = plotSeries[plot]
      traces.push({
        x: series.map(s => s.year),
        y: series.map(s => s.meanDbh),
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
        hovertemplate: `Year %{x}<br>%{y:.1f} cm<extra>${plot}</extra>`,
      })
    }
  } else {
    const plotSeries = computePlotDbhSeries(snapshots, [selectedPlot])
    const series = plotSeries[selectedPlot] ?? []
    traces.push({
      x: series.map(s => s.year),
      y: series.map(s => s.meanDbh),
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
      hovertemplate: `Year %{x}<br>%{y:.1f} cm<extra>${selectedPlot}</extra>`,
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
      title: { text: 'Mean DBH (cm)', standoff: 12 },
      tickformat: '.1f',
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
