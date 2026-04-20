/**
 * Area Boundary Definitions
 * 
 * Provides polygon boundaries for visualization and simulation.
 * These are simplified boundaries for demo purposes.
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface AreaBoundary {
  name: string
  id: string
  center: LatLng
  zoom: number
  bounds: LatLng[]
  areaM2: number
  estimatedTrees: number
  estimatedCarbonKgC: number
}

/**
 * Pomfret School Forest boundary (approximate)
 * Based on the three measurement plots located in the school forest
 * Coordinates are approximate; can be refined with actual GPS data
 */
export const POMFRET_FOREST: AreaBoundary = {
  name: 'Pomfret Forest',
  id: 'pomfret',
  center: {
    lat: 41.8967,
    lng: -71.9625
  },
  zoom: 16,
  // Approximate polygon around the forest area (adjust based on actual measurements)
  bounds: [
    { lat: 41.8985, lng: -71.9645 },
    { lat: 41.8985, lng: -71.9605 },
    { lat: 41.8949, lng: -71.9605 },
    { lat: 41.8949, lng: -71.9645 },
  ],
  areaM2: 7500, // 3 plots × 2500 m² each
  estimatedTrees: 442, // From actual data
  estimatedCarbonKgC: 98805 // From actual data (kg C)
}

/**
 * Connecticut state boundary (simplified bounding box)
 * For demo purposes - can be replaced with actual state boundary GeoJSON
 * 
 * Connecticut extent (approximate):
 * - North: 42.05° N
 * - South: 41.00° N  
 * - East: -71.79° W
 * - West: -73.73° W
 * 
 * Total forest area: ~1.8 million acres ≈ 7.3 billion m²
 */
export const CONNECTICUT: AreaBoundary = {
  name: 'Connecticut',
  id: 'connecticut',
  center: {
    lat: 41.60,
    lng: -72.70
  },
  zoom: 9,
  // Simplified bounding box for Connecticut
  bounds: [
    { lat: 42.05, lng: -73.73 }, // NW
    { lat: 42.05, lng: -71.79 }, // NE
    { lat: 41.00, lng: -71.79 }, // SE
    { lat: 41.00, lng: -73.73 }, // SW
  ],
  // Forest area estimate (~60% of CT is forested)
  // CT total area ≈ 14,357 km² = 14.357 × 10^9 m²
  // Forested area ≈ 60% = ~8.6 × 10^9 m²
  // Using conservative estimate: 7.3 × 10^9 m² (1.8 million acres)
  areaM2: 7.3e9,
  // Estimate based on Pomfret density (0.0589 trees/m²)
  // But CT forests are diverse - using lower estimate (0.04 trees/m²)
  estimatedTrees: Math.round(7.3e9 * 0.04), // ~292 million trees (conservative)
  // Carbon density: ~10 kg C/m² (lower than Pomfret's 13.17 to be conservative)
  estimatedCarbonKgC: 7.3e9 * 10 // ~73 billion kg C
}

export const AREAS: AreaBoundary[] = [POMFRET_FOREST, CONNECTICUT]

export function getAreaById(id: string): AreaBoundary | undefined {
  return AREAS.find(a => a.id === id)
}
