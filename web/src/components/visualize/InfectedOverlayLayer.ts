/**
 * Custom Leaflet layer that draws infected cells as rectangles.
 * Stays geographically attached: redraws on move, zoom, resize (and when data changes).
 */

import type { GridState } from '@/lib/sim/invasiveSpread'

type GetData = () => GridState | null

export function createInfectedOverlayLayer(getData: GetData) {
  const layer = {
    _map: null as any,
    _canvas: null as HTMLCanvasElement | null,
    _handlers: null as (() => void) | null,

    onAdd(map: any) {
      this._map = map
      const canvas = document.createElement('canvas')
      canvas.style.pointerEvents = 'none'
      canvas.style.position = 'absolute'
      canvas.style.left = '0'
      canvas.style.top = '0'
      canvas.style.zIndex = '400'
      this._canvas = canvas

      const pane = map.getPane('overlayPane')
      if (pane) pane.appendChild(canvas)

      const draw = () => this._draw()
      this._handlers = draw
      map.on('move', draw)
      map.on('zoom', draw)
      map.on('moveend', draw)
      map.on('zoomend', draw)
      map.on('resize', draw)

      this._draw()
      return this
    },

    onRemove(map: any) {
      if (this._handlers) {
        map.off('move', this._handlers)
        map.off('zoom', this._handlers)
        map.off('moveend', this._handlers)
        map.off('zoomend', this._handlers)
        map.off('resize', this._handlers)
      }
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas)
      }
      this._canvas = null
      this._map = null
      return this
    },

    _draw() {
      const map = this._map
      const canvas = this._canvas
      if (!map || !canvas) return

      const grid = getData()
      if (!grid) {
        canvas.width = 0
        canvas.height = 0
        return
      }

      const size = map.getSize()
      canvas.width = size.x
      canvas.height = size.y
      canvas.style.width = size.x + 'px'
      canvas.style.height = size.y + 'px'

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const latStep = grid.latStep
      const lngStep = grid.lngStep

      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          const cell = grid.cells[row][col]
          if (!cell.infected || !cell.insideArea) continue

          const north = cell.lat + latStep / 2
          const south = cell.lat - latStep / 2
          const west = cell.lng - lngStep / 2
          const east = cell.lng + lngStep / 2

          const p1 = map.latLngToContainerPoint([north, west])
          const p2 = map.latLngToContainerPoint([south, east])

          const x = Math.min(p1.x, p2.x)
          const y = Math.min(p1.y, p2.y)
          const w = Math.abs(p2.x - p1.x)
          const h = Math.abs(p2.y - p1.y)

          const alpha = 0.35 + cell.severity * 0.4
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`
          ctx.fillRect(x, y, w, h)
        }
      }
    },

    redraw() {
      this._draw()
    }
  }

  return layer
}
