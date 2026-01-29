'use client'

import { useEffect, useRef, useState } from 'react'
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
  const initStartedRef = useRef(false)

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

        // Handle polygon drawing completion
        map.on((L.Draw as any).Event.CREATED, (e: any) => {
          const layer = e.layer
          drawnLayer.addLayer(layer)

          // Calculate area - Turf returns area in m² directly
          const geoJson = layer.toGeoJSON()
          const areaM2 = area(geoJson)
          setCalculatedArea(areaM2)
          onAreaCalculated(areaM2)
        })

        // Handle polygon editing
        map.on((L.Draw as any).Event.EDITED, (e: any) => {
          const layers = e.layers
          layers.eachLayer((layer: any) => {
            if (layer instanceof L.Polygon) {
              const geoJson = layer.toGeoJSON()
              const areaM2 = area(geoJson)
              setCalculatedArea(areaM2)
              onAreaCalculated(areaM2)
            }
          })
        })

        // Handle polygon deletion
        map.on((L.Draw as any).Event.DELETED, () => {
          setCalculatedArea(null)
          onAreaCalculated(0) // Reset area when deleted
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
  }, [onAreaCalculated])

  const formatArea = (areaM2: number): string => {
    const hectares = (areaM2 / 10000).toFixed(2)
    const acres = (areaM2 / 4046.86).toFixed(2)
    return `${areaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m² (${hectares} ha, ${acres} acres)`
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-muted)]">
        <p>Draw a polygon on the map to calculate its area. Click "Use this area" to apply it to the scaling calculation.</p>
        <p className="mt-2 text-xs">
          <strong>How to draw:</strong> Click the polygon tool in the top-right corner of the map, then click on the map to place vertices.
          Double-click or click the first point to finish drawing.
        </p>
      </div>

      <div ref={containerRef} className="w-full h-96 rounded-lg border border-[var(--border)]" />

      {calculatedArea !== null && (
        <div className="p-4 bg-[var(--primary-light)] rounded-lg border border-[var(--primary)]/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Calculated Area</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--teal-600)' }}>
                {formatArea(calculatedArea)}
              </p>
            </div>
            <button
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
      )}
    </div>
  )
}
