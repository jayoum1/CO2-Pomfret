/**
 * Point-in-Polygon Test
 * 
 * Simple ray casting algorithm to test if a point is inside a polygon.
 */

export interface Point {
  lat: number
  lng: number
}

/**
 * Test if a point is inside a polygon using ray casting algorithm.
 * 
 * @param point - Point to test (lat/lng)
 * @param polygon - Array of polygon vertices (lat/lng)
 * @returns true if point is inside polygon, false otherwise
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  const x = point.lng
  const y = point.lat
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}
