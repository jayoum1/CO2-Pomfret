'use client'

import { useEffect, useRef } from 'react'
import { AreaBoundary } from '@/lib/geo/boundaries'
import { GridState, OutbreakPoint } from '@/lib/sim/invasiveSpread'
import { createInfectedOverlayLayer } from './InfectedOverlayLayer'

interface InvasiveMapProps {
  selectedArea: AreaBoundary
  gridState: GridState | null
  placeOutbreakMode: boolean
  onMapReady: () => void
  onOutbreakClick: (lat: number, lng: number) => void
}

export default function InvasiveMap({
  selectedArea,
  gridState,
  placeOutbreakMode,
  onMapReady,
  onOutbreakClick
}: InvasiveMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boundaryLayerRef = useRef<any>(null)
  const overlayLayerRef = useRef<any>(null)
  const outbreakMarkersRef = useRef<any[]>([])
  const initStartedRef = useRef(false)
  const LRef = useRef<any>(null)

  const placeOutbreakModeRef = useRef(placeOutbreakMode)
  const onOutbreakClickRef = useRef(onOutbreakClick)
  const gridStateRef = useRef<GridState | null>(gridState)

  useEffect(() => {
    placeOutbreakModeRef.current = placeOutbreakMode
    onOutbreakClickRef.current = onOutbreakClick
  }, [placeOutbreakMode, onOutbreakClick])

  useEffect(() => {
    gridStateRef.current = gridState
  }, [gridState])

  // Initialize map
  useEffect(() => {
    if (initStartedRef.current || typeof window === 'undefined') return
    if (!containerRef.current) return

    initStartedRef.current = true

    const initMap = async () => {
      try {
        const LModule = await import('leaflet')
        const L = LModule.default
        LRef.current = L

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })

        const map = L.map(containerRef.current!, {
          center: [selectedArea.center.lat, selectedArea.center.lng],
          zoom: selectedArea.zoom,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        map.on('click', (e: any) => {
          if (placeOutbreakModeRef.current) {
            onOutbreakClickRef.current(e.latlng.lat, e.latlng.lng)
          }
        })

        const infectedLayer = createInfectedOverlayLayer(() => gridStateRef.current)
        infectedLayer.onAdd(map)
        overlayLayerRef.current = infectedLayer

        mapRef.current = map
        onMapReady()
      } catch (error) {
        console.error('Error initializing map:', error)
      }
    }

    initMap()

    return () => {
      if (mapRef.current && overlayLayerRef.current) {
        overlayLayerRef.current.onRemove(mapRef.current)
        overlayLayerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update map view when selected area changes
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return

    const map = mapRef.current
    const L = LRef.current

    map.setView([selectedArea.center.lat, selectedArea.center.lng], selectedArea.zoom)

    // Clear old boundary
    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current)
    }

    // Draw new area boundary
    const coords = selectedArea.bounds.map(p => [p.lat, p.lng] as [number, number])
    const boundary = L.polygon(coords, {
      color: '#14b8a6',
      fillColor: '#14b8a6',
      fillOpacity: 0.1,
      weight: 3,
      dashArray: '5, 10'
    })
    boundary.addTo(map)
    boundaryLayerRef.current = boundary

    // Fit to bounds
    map.fitBounds(boundary.getBounds(), { padding: [50, 50] })

  }, [selectedArea])

  // Update map cursor based on placeOutbreakMode
  useEffect(() => {
    if (!mapRef.current) return

    const mapContainer = mapRef.current.getContainer()
    if (placeOutbreakMode) {
      mapContainer.style.cursor = 'crosshair'
    } else {
      mapContainer.style.cursor = ''
    }
  }, [placeOutbreakMode])

  // Render outbreak point markers
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !gridState) return

    const map = mapRef.current
    const L = LRef.current

    // Clear old markers
    outbreakMarkersRef.current.forEach(marker => map.removeLayer(marker))
    outbreakMarkersRef.current = []

    // Add markers for each outbreak point
    gridState.outbreakPoints.forEach((point: OutbreakPoint) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        fillColor: '#ef4444',
        color: '#dc2626',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
      })

      // Add pulsing effect
      marker.bindTooltip('Outbreak origin', { permanent: false, direction: 'top' })
      marker.addTo(map)
      outbreakMarkersRef.current.push(marker)
    })

  }, [gridState?.outbreakPoints])

  // Redraw overlay when gridState changes (each sim tick)
  useEffect(() => {
    if (overlayLayerRef.current && gridState) {
      overlayLayerRef.current.redraw()
    }
  }, [gridState])

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg border border-[var(--border)]" style={{ minHeight: '500px' }} />
  )
}
