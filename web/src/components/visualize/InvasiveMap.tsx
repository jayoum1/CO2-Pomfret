'use client'

import { useEffect, useRef } from 'react'
import { AreaBoundary } from '@/lib/geo/boundaries'
import { GridState, OutbreakPoint } from '@/lib/sim/invasiveSpread'

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
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null)
  const outbreakMarkersRef = useRef<any[]>([])
  const initStartedRef = useRef(false)
  const LRef = useRef<any>(null)
  
  // Use ref to avoid stale closure in click handler
  const placeOutbreakModeRef = useRef(placeOutbreakMode)
  const onOutbreakClickRef = useRef(onOutbreakClick)
  
  useEffect(() => {
    placeOutbreakModeRef.current = placeOutbreakMode
    onOutbreakClickRef.current = onOutbreakClick
  }, [placeOutbreakMode, onOutbreakClick])

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

        // Fix for default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })

        // Initialize map
        const map = L.map(containerRef.current!, {
          center: [selectedArea.center.lat, selectedArea.center.lng],
          zoom: selectedArea.zoom,
        })

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        // Add click handler for outbreak placement
        map.on('click', (e: any) => {
          console.log('[InvasiveMap] Map clicked:', {
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            placeOutbreakMode: placeOutbreakModeRef.current
          })
          
          if (placeOutbreakModeRef.current) {
            onOutbreakClickRef.current(e.latlng.lat, e.latlng.lng)
          }
        })

        // Create canvas overlay for rendering infected cells
        const canvas = document.createElement('canvas')
        canvas.style.position = 'absolute'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.pointerEvents = 'none' // Allow clicks to pass through
        canvas.style.zIndex = '400' // Above tiles, below markers
        canvasOverlayRef.current = canvas

        // Add canvas to map pane
        const mapPane = map.getPane('overlayPane')
        if (mapPane) {
          mapPane.appendChild(canvas)
        }

        mapRef.current = map
        onMapReady()
      } catch (error) {
        console.error('Error initializing map:', error)
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      if (canvasOverlayRef.current && canvasOverlayRef.current.parentNode) {
        canvasOverlayRef.current.parentNode.removeChild(canvasOverlayRef.current)
        canvasOverlayRef.current = null
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

  // Render infected cells as rectangular grid patches (expansion is circular/organic via sim logic)
  useEffect(() => {
    if (!mapRef.current || !canvasOverlayRef.current || !gridState) return

    const map = mapRef.current
    const canvas = canvasOverlayRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Update canvas size to match map
    const size = map.getSize()
    canvas.width = size.x
    canvas.height = size.y

    // Position canvas to match map
    const topLeft = map.containerPointToLayerPoint([0, 0])
    canvas.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const latStep = gridState.latStep
    const lngStep = gridState.lngStep

    // Draw each infected cell as a rectangle aligned to the grid
    for (let row = 0; row < gridState.rows; row++) {
      for (let col = 0; col < gridState.cols; col++) {
        const cell = gridState.cells[row][col]
        if (!cell.infected || !cell.insideArea) continue

        // Cell bounds in lat/lng (cell center ± half step)
        const north = cell.lat + latStep / 2
        const south = cell.lat - latStep / 2
        const west = cell.lng - lngStep / 2
        const east = cell.lng + lngStep / 2

        // Convert corners to container pixels
        const topLeftPx = map.latLngToContainerPoint([north, west])
        const bottomRightPx = map.latLngToContainerPoint([south, east])

        const x = Math.min(topLeftPx.x, bottomRightPx.x)
        const y = Math.min(topLeftPx.y, bottomRightPx.y)
        const w = Math.abs(bottomRightPx.x - topLeftPx.x)
        const h = Math.abs(bottomRightPx.y - topLeftPx.y)

        // Draw rectangular patch (opacity by severity)
        const alpha = 0.35 + cell.severity * 0.4 // 0.35–0.75
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`
        ctx.fillRect(x, y, w, h)
      }
    }

  }, [gridState, selectedArea])

  // Redraw canvas on map move/zoom
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current

    const handleMapUpdate = () => {
      // Trigger re-render by updating a dummy state or calling render directly
      // The gridState effect will handle the redraw
    }

    map.on('moveend', handleMapUpdate)
    map.on('zoomend', handleMapUpdate)

    return () => {
      map.off('moveend', handleMapUpdate)
      map.off('zoomend', handleMapUpdate)
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg border border-[var(--border)]" style={{ minHeight: '500px' }} />
  )
}
