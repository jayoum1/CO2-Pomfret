'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { area } from '@turf/turf'

interface LatLng {
    lat: number
    lng: number
}

interface MapContentProps {
    points: LatLng[]
    isPolygonComplete: boolean
    onMapClick: (lat: number, lng: number) => void
    onCompletePolygon: () => void
}

export default function MapContent({ points, isPolygonComplete, onMapClick, onCompletePolygon }: MapContentProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const linesRef = useRef<any[]>([])
    const polygonRef = useRef<any>(null)
    const LeafletRef = useRef<any>(null)

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return

        let isMounted = true

        const loadLeaflet = async () => {
            const L = (await import('leaflet')).default

            if (!isMounted || !containerRef.current) return

            LeafletRef.current = L

            // Fix icons
            delete (L.Icon.Default.prototype as any)._getIconUrl
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            })

            const map = L.map(containerRef.current, {
                center: [41.8967, -71.9625],
                zoom: 15
            })

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map)

            map.on('click', (e: any) => {
                onMapClick(e.latlng.lat, e.latlng.lng)
            })

            mapRef.current = map
        }

        loadLeaflet()

        return () => {
            isMounted = false
        }
    }, [onMapClick])

    // Update markers and shapes when points change
    useEffect(() => {
        const map = mapRef.current
        const L = LeafletRef.current
        if (!map || !L) return

        // Clear old markers and lines
        markersRef.current.forEach(m => map.removeLayer(m))
        linesRef.current.forEach(l => map.removeLayer(l))
        if (polygonRef.current) {
            map.removeLayer(polygonRef.current)
            polygonRef.current = null
        }
        markersRef.current = []
        linesRef.current = []

        const canComplete = points.length >= 3 && !isPolygonComplete

        // Add markers
        points.forEach((pt, i) => {
            const isFirst = i === 0
            const color = isFirst && canComplete ? '#10b981' : '#14b8a6'
            const cursor = isFirst && canComplete ? 'pointer' : 'default'

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${color};border:3px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:bold;font-size:12px;cursor:${cursor};
        ">${i + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            })

            const marker = L.marker([pt.lat, pt.lng], { icon })

            if (isFirst && canComplete) {
                marker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e)
                    onCompletePolygon()
                })
            }

            marker.addTo(map)
            markersRef.current.push(marker)
        })

        // Draw lines between points
        if (points.length >= 2 && !isPolygonComplete) {
            const coords = points.map(p => [p.lat, p.lng] as [number, number])
            const line = L.polyline(coords, { color: '#14b8a6', weight: 3, opacity: 0.8 })
            line.addTo(map)
            linesRef.current.push(line)
        }

        // Draw polygon if complete
        if (isPolygonComplete && points.length >= 3) {
            const coords = points.map(p => [p.lat, p.lng] as [number, number])
            const polygon = L.polygon(coords, {
                color: '#14b8a6',
                fillColor: '#14b8a6',
                fillOpacity: 0.2,
                weight: 3
            })
            polygon.addTo(map)
            polygonRef.current = polygon

            // Fit bounds
            map.fitBounds(polygon.getBounds(), { padding: [50, 50] })
        }
    }, [points, isPolygonComplete, onCompletePolygon])

    return (
        <div
            ref={containerRef}
            className="w-full h-96 rounded-lg border border-[var(--border)]"
            style={{ zIndex: 0, background: '#e5e7eb' }}
        />
    )
}
