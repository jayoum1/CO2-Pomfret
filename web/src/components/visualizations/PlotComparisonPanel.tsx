'use client'

import dynamic from 'next/dynamic'
import type { SnapshotData } from '@/lib/visualizationData'
import { computePlotSummaries } from '@/lib/visualizationData'
import { PLOT_COLORS, BASE_LAYOUT, PLOTLY_CONFIG } from './chartTheme'

const Plot = dynamic(() => import('./PlotlyChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-lg bg-gray-100" />
  ),
})

interface PlotComparisonPanelProps {
  snapshots: SnapshotData[]
  selectedYear: number
  plots: string[]
}

export default function PlotComparisonPanel({
  snapshots,
  selectedYear,
  plots,
}: PlotComparisonPanelProps) {
  const snapshot = snapshots.find(s => s.year === selectedYear)
  if (!snapshot) return null

  const summaries = computePlotSummaries(snapshot.trees, plots)
  const plotNames = summaries.map(s => s.plot)
  const colors = plotNames.map(p => PLOT_COLORS[p] ?? '#94a3b8')

  const carbonTrace: Record<string, any> = {
    x: plotNames,
    y: summaries.map(s => s.totalCarbon),
    type: 'bar',
    name: 'Carbon (kg C)',
    marker: { color: colors, opacity: 0.85 },
    hovertemplate: '%{x}<br>%{y:,.0f} kg C<extra></extra>',
    yaxis: 'y',
  }

  const dbhTrace: Record<string, any> = {
    x: plotNames,
    y: summaries.map(s => s.meanDbh),
    type: 'scatter',
    mode: 'markers+text',
    name: 'Mean DBH (cm)',
    text: summaries.map(s => `${s.meanDbh.toFixed(1)} cm`),
    textposition: 'top center',
    textfont: { size: 11, color: '#475569' },
    marker: { size: 10, color: '#f59e0b', symbol: 'diamond' },
    yaxis: 'y2',
    hovertemplate: '%{x}<br>%{y:.1f} cm<extra>Mean DBH</extra>',
  }

  const layout: Record<string, any> = {
    ...BASE_LAYOUT,
    margin: { ...BASE_LAYOUT.margin, r: 56 },
    xaxis: {
      ...BASE_LAYOUT.xaxis,
      type: 'category',
    },
    yaxis: {
      ...BASE_LAYOUT.yaxis,
      title: { text: 'Carbon (kg C)', standoff: 12 },
      tickformat: ',.0f',
    },
    yaxis2: {
      title: { text: 'Mean DBH (cm)', standoff: 8 },
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      tickformat: '.1f',
      gridcolor: '#f1f5f9',
      linecolor: '#e2e8f0',
      zerolinecolor: '#e2e8f0',
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
    showlegend: true,
  }

  return (
    <Plot
      data={[carbonTrace, dbhTrace]}
      layout={layout}
      config={PLOTLY_CONFIG}
      useResizeHandler
      className="w-full"
      style={{ height: 320 }}
    />
  )
}
