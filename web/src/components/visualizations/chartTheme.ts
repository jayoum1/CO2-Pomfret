/**
 * Shared Plotly layout defaults and color constants for every chart
 * on the Visualizations page.
 *
 * Forest-inspired palette with strong contrast on a clean white background.
 */

export const PLOT_COLORS: Record<string, string> = {
  Upper: '#0d9488',   // teal-600
  Middle: '#059669',  // emerald-600
  Lower: '#2563eb',   // blue-600
}

export const AGGREGATE_COLOR = '#14b8a6' // teal-500

export const YEAR_MARKER_COLOR = '#f59e0b' // amber-500

export const BASE_LAYOUT: Record<string, any> = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#475569',
    size: 12,
  },
  margin: { l: 64, r: 16, t: 28, b: 52 },
  xaxis: {
    gridcolor: '#f1f5f9',
    linecolor: '#e2e8f0',
    zerolinecolor: '#e2e8f0',
  },
  yaxis: {
    gridcolor: '#f1f5f9',
    linecolor: '#e2e8f0',
    zerolinecolor: '#e2e8f0',
  },
  hoverlabel: {
    bgcolor: 'white',
    bordercolor: '#e2e8f0',
    font: { color: '#1e293b', size: 12 },
  },
  legend: {
    orientation: 'h',
    yanchor: 'bottom',
    y: -0.25,
    xanchor: 'center',
    x: 0.5,
    font: { size: 11 },
  },
  modebar: { orientation: 'v' },
}

export const PLOTLY_CONFIG: Record<string, any> = {
  displayModeBar: false,
  responsive: true,
}
