'use client'

import { useEffect, useRef, useState } from 'react'
import { AreaBoundary } from '@/lib/geo/boundaries'
import { GridState } from '@/lib/sim/invasiveSpread'

interface InvasiveMapProps {
  selectedArea: AreaBoundary
  gridState: GridState | null
  onMapReady: () => void
}

export default function InvasiveMap({ selectedArea, gridState, onMapReady }: InvasiveMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boundaryLayerRef = useRef<any>(null)
  const overlayLayerRef = useRef<any>(null)
  const initStartedRef = useRef(false)
  const LRef = useRef<any>(null)

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

  // Render infected cells overlay
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !gridState) return

    const map = mapRef.current
    const L = LRef.current

    // Clear old overlay
    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current)
    }

    // Create layer group for infected cells
    const overlayLayer = L.layerGroup()

    // Render infected cells
    for (let row = 0; row < gridState.rows; row++) {
      for (let col = 0; col < gridState.cols; col++) {
        const cell = gridState.cells[row][col]
        if (!cell.infected || !cell.insideArea) continue

        // Compute cell bounds
        const latMargin = (selectedArea.bounds[0].lat - selectedArea.bounds[2].lat) / gridState.rows
        const lngMargin = (selectedArea.bounds[1].lng - selectedArea.bounds[0].lng) / gridState.cols

        const cellBounds: [number, number][] = [
          [cell.lat - latMargin / 2, cell.lng - lngMargin / 2],
          [cell.lat - latMargin / 2, cell.lng + lngMargin / 2],
          [cell.lat + latMargin / 2, cell.lng + lngMargin / 2],
          [cell.lat + latMargin / 2, cell.lng - lngMargin / 2]
        ]

        // Draw infected cell patch
        const patch = L.rectangle(cellBounds, {
          color: '#ef4444', // Red
          fillColor: '#ef4444',
          fillOpacity: 0.3 + cell.severity * 0.3, // 0.3-0.6 opacity based on severity
          weight: 0,
          interactive: false
        })

        patch.addTo(overlayLayer)
      }
    }

    overlayLayer.addTo(map)
    overlayLayerRef.current = overlayLayer

  }, [gridState, selectedArea])

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg border border-[var(--border)]" style={{ minHeight: '500px' }} />
  )
}
