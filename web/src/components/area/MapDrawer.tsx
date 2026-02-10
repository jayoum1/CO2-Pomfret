'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { area } from '@turf/turf'

interface MapDrawerProps {
  onAreaCalculated: (areaM2: number) => void
}

export default function MapDrawer({ onAreaCalculated }: MapDrawerProps) {
  const mapRef = useRef<any>(null)
  const drawControlRef = useRef<any>(null)
  const drawnLayerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null)
  const [polygonCount, setPolygonCount] = useState(0)
  const initStartedRef = useRef(false)
  const onAreaCalculatedRef = useRef(onAreaCalculated)
  onAreaCalculatedRef.current = onAreaCalculated

  const clearAllPolygons = useCallback(() => {
    const layerGroup = drawnLayerRef.current
    if (layerGroup) {
      layerGroup.clearLayers()
      setCalculatedArea(null)
      setPolygonCount(0)
      onAreaCalculatedRef.current(0)
    }
  }, [])

  useEffect(() => {
    // Guard against double initialization in React Strict Mode
    if (initStartedRef.current || typeof window === 'undefined') return
    if (!containerRef.current) return

    initStartedRef.current = true

    // Dynamically import Leaflet first, then leaflet-draw
    // leaflet-draw expects L to be globally available
    const initMap = async () => {
      try {
        const LModule = await import('leaflet')
        const L = LModule.default

          // Assign L to window so leaflet-draw can find it
          ; (window as any).L = L

        // Now import leaflet-draw - it will attach to window.L
        await import('leaflet-draw')

        // Fix for default marker icons in Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })

        // Initialize map centered near Pomfret School, CT
        const map = L.map(containerRef.current!, {
          center: [41.8967, -71.9625],
          zoom: 15,
        })

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        // Create a FeatureGroup for drawn features (NOT LayerGroup - leaflet-draw requires FeatureGroup)
        const drawnLayer = new L.FeatureGroup()
        drawnLayer.addTo(map)
        drawnLayerRef.current = drawnLayer

        // Recompute total area from all polygons in the layer (areas stack up)
        const updateTotalFromDrawnLayer = () => {
          const layers = drawnLayer.getLayers()
          let total = 0
          layers.forEach((layer: any) => {
            if (layer.toGeoJSON) {
              total += area(layer.toGeoJSON())
            }
          })
          setPolygonCount(layers.length)
          if (total === 0) {
            setCalculatedArea(null)
            onAreaCalculatedRef.current(0)
          } else {
            setCalculatedArea(total)
          }
        }

        // Initialize draw control
        const DrawControl = (L.Control as any).Draw
        if (!DrawControl) {
          console.error('Leaflet Draw not available. Make sure leaflet-draw is imported.')
          return
        }

        const drawControl = new DrawControl({
          draw: {
            polygon: {
              allowIntersection: false,
              showArea: false,
              drawError: {
                color: '#e1e100',
                message: '<strong>Oh snap!</strong> you can\'t draw that!',
              },
              shapeOptions: {
                color: '#14b8a6', // Teal color to match theme
                fillColor: '#14b8a6',
                fillOpacity: 0.2,
                weight: 3,
              },
            },
            polyline: false,
            circle: false,
            rectangle: false,
            marker: false,
            circlemarker: false,
          },
          edit: {
            featureGroup: drawnLayer,
            remove: true,
          },
        })

        map.addControl(drawControl)
        drawControlRef.current = drawControl

        // When a new polygon is drawn, add it to the layer; total area = sum of all polygons
        map.on((L.Draw as any).Event.CREATED, (e: any) => {
          const layer = e.layer
          drawnLayer.addLayer(layer)
          updateTotalFromDrawnLayer()
        })

        // When a polygon is edited, recalculate total from all layers
        map.on((L.Draw as any).Event.EDITED, () => {
          updateTotalFromDrawnLayer()
        })

        // When one or more polygons are deleted (individual or multi), recalculate from remaining layers
        map.on((L.Draw as any).Event.DELETED, () => {
          updateTotalFromDrawnLayer()
        })

        mapRef.current = map
      } catch (error) {
        console.error('Error initializing map:', error)
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        if (drawControlRef.current) {
          mapRef.current.removeControl(drawControlRef.current)
        }
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const formatArea = (areaM2: number): string => {
    const hectares = (areaM2 / 10000).toFixed(2)
    const acres = (areaM2 / 4046.86).toFixed(2)
    return `${areaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m² (${hectares} ha, ${acres} acres)`
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-muted)]">
        <p>Draw one or more polygons on the map; their areas add up. Click &quot;Use this area&quot; to apply the total to the scaling calculation.</p>
        <p className="mt-2 text-xs">
          <strong>Draw:</strong> Click the polygon tool (top-right), place vertices on the map, then double-click or click the first point to finish.
        </p>
        <p className="mt-1 text-xs">
          <strong>Delete one polygon:</strong> Click the edit (pencil) tool, click a polygon to select it, then click the delete (trash) tool.
        </p>
      </div>

      <div ref={containerRef} className="w-full h-96 rounded-lg border border-[var(--border)]" />

      {calculatedArea !== null && calculatedArea > 0 && (
        <div className="p-4 bg-[var(--primary-light)] rounded-lg border border-[var(--primary)]/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">
                Total area {polygonCount > 1 ? `(${polygonCount} polygons)` : ''}
              </p>
              <p className="text-lg font-semibold" style={{ color: 'var(--teal-600)' }}>
                {formatArea(calculatedArea)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAllPolygons}
                className="btn border border-[var(--border)] bg-[var(--bg-alt)] hover:bg-[var(--border)] text-[var(--text)]"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => {
                  if (calculatedArea !== null) {
                    onAreaCalculated(calculatedArea)
                  }
                }}
                className="btn btn-primary"
              >
                Use this area
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
