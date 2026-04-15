'use client'

import dynamic from 'next/dynamic'
import type { VectorForestTree } from '@/lib/api'
import { computeDbhHistogram } from '@/lib/visualizationData'
import {
  PLOT_COLORS,
  AGGREGATE_COLOR,
  BASE_LAYOUT,
  PLOTLY_CONFIG,
} from './chartTheme'

const Plot = dynamic(() => import('./PlotlyChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-lg bg-gray-100" />
  ),
})

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
  const bins = computeDbhHistogram(trees, selectedPlot, 5)
  const traces: Record<string, any>[] = []

  if (selectedPlot === 'all') {
    for (const plot of plots) {
      traces.push({
        x: bins.map(b => b.label),
        y: bins.map(b => b.plotCounts[plot] ?? 0),
        type: 'bar',
        name: plot,
        marker: { color: PLOT_COLORS[plot] ?? '#94a3b8', opacity: 0.85 },
        hovertemplate: `%{x} cm<br>%{y} trees<extra>${plot}</extra>`,
      })
    }
  } else {
    traces.push({
      x: bins.map(b => b.label),
      y: bins.map(b => b.count),
      type: 'bar',
      name: selectedPlot,
      marker: {
        color: PLOT_COLORS[selectedPlot] ?? AGGREGATE_COLOR,
        opacity: 0.85,
      },
      hovertemplate: `%{x} cm<br>%{y} trees<extra>${selectedPlot}</extra>`,
    })
  }

  const layout: Record<string, any> = {
    ...BASE_LAYOUT,
    barmode: 'stack',
    xaxis: {
      ...BASE_LAYOUT.xaxis,
      title: { text: 'DBH Range (cm)', standoff: 8 },
      type: 'category',
    },
    yaxis: {
      ...BASE_LAYOUT.yaxis,
      title: { text: 'Number of Trees', standoff: 12 },
    },
    annotations: [
      {
        x: 1,
        y: 1,
        xref: 'paper',
        yref: 'paper',
        text: `Year ${selectedYear}`,
        showarrow: false,
        font: { size: 10, color: '#94a3b8' },
        xanchor: 'right',
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
