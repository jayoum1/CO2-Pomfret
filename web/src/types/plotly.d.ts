declare module 'react-plotly.js/factory' {
  import { Component } from 'react'

  interface PlotParams {
    data: Array<Record<string, any>>
    layout?: Record<string, any>
    config?: Record<string, any>
    frames?: Array<Record<string, any>>
    useResizeHandler?: boolean
    className?: string
    style?: React.CSSProperties
    onInitialized?: (figure: any, graphDiv: any) => void
    onUpdate?: (figure: any, graphDiv: any) => void
    onPurge?: (figure: any, graphDiv: any) => void
    onError?: (err: any) => void
    divId?: string
    revision?: number
    onClick?: (event: any) => void
    onHover?: (event: any) => void
  }

  function createPlotlyComponent(plotly: any): React.ComponentType<PlotParams>
  export = createPlotlyComponent
}

declare module 'plotly.js-basic-dist-min' {
  const Plotly: any
  export = Plotly
}
