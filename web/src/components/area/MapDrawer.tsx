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
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null)
  const [mapInitialized, setMapInitialized] = useState(false)

  useEffect(() => {
    if (mapInitialized || typeof window === 'undefined') return

    // Dynamically import Leaflet to avoid SSR issues
    Promise.all([
      import('leaflet'),
      import('leaflet-draw')
    ]).then(([LModule, DrawModule]) => {
      const L = LModule.default

      // Fix for default marker icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      // Initialize map centered near Pomfret School, CT
      // Approximate coordinates: 41.8967° N, 71.9625° W
      const map = L.map('map-container', {
        center: [41.8967, -71.9625],
        zoom: 15,
      })

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Create a layer group for drawn features
      const drawnLayer = new L.LayerGroup()
      drawnLayer.addTo(map)
      drawnLayerRef.current = drawnLayer

      // Initialize draw control
      // leaflet-draw exports Draw directly, not as default
      const Draw = (DrawModule as any).default || DrawModule
      const drawControl = new Draw.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            drawError: {
              color: '#e1e100',
              message: '<strong>Oh snap!</strong> you can\'t draw that!',
            },
            shapeOptions: {
              color: '#97009c',
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
      map.on(Draw.Event.CREATED, (e: any) => {
        const layer = e.layer
        drawnLayer.addLayer(layer)

        // Calculate area
        const geoJson = layer.toGeoJSON()
        const areaM2 = area(geoJson) * 1000000 // Convert from km² to m²
        setCalculatedArea(areaM2)
        onAreaCalculated(areaM2)
      })

      // Handle polygon editing
      map.on(Draw.Event.EDITED, (e: any) => {
        const layers = e.layers
        layers.eachLayer((layer: any) => {
          if (layer instanceof L.Polygon) {
            const geoJson = layer.toGeoJSON()
            const areaM2 = area(geoJson) * 1000000
            setCalculatedArea(areaM2)
            onAreaCalculated(areaM2)
          }
        })
      })

      // Handle polygon deletion
      map.on(Draw.Event.DELETED, () => {
        setCalculatedArea(null)
      })

      mapRef.current = map
      setMapInitialized(true)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [mapInitialized, onAreaCalculated])

  const formatArea = (areaM2: number): string => {
    const hectares = (areaM2 / 10000).toFixed(2)
    const acres = (areaM2 / 4046.86).toFixed(2)
    return `${areaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m² (${hectares} ha, ${acres} acres)`
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--text-muted)]">
        <p>Draw a polygon on the map to calculate its area. Click "Use this area" to apply it to the scaling calculation.</p>
      </div>
      
      <div id="map-container" className="w-full h-96 rounded-lg border border-[var(--border)]" />
      
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
