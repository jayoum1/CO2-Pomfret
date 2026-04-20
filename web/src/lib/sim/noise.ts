/**
 * Seeded Noise Functions
 * 
 * Simple deterministic noise for creating irregular/organic boundaries
 * in the invasive spread simulation.
 */

/**
 * Simple hash function for seeded pseudo-random values.
 * Returns a value between 0 and 1.
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param seed - Random seed
 * @returns Pseudo-random value [0, 1]
 */
function hash2D(x: number, y: number, seed: number): number {
  // Mix x, y, and seed using prime numbers
  let h = seed
  h = (h ^ (x * 73856093)) >>> 0
  h = (h ^ (y * 19349663)) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  h = (h * 2654435761) >>> 0
  return (h >>> 0) / 4294967296
}

/**
 * Get signed noise value [-1, 1] for a grid cell.
 * Deterministic based on cell coordinates and seed.
 * 
 * @param cellX - Cell X index
 * @param cellY - Cell Y index
 * @param seed - Random seed
 * @returns Noise value in range [-1, 1]
 */
export function cellNoise(cellX: number, cellY: number, seed: number): number {
  const h = hash2D(cellX, cellY, seed)
  return h * 2 - 1 // Map [0,1] to [-1,1]
}

/**
 * Smooth interpolation (cosine interpolation).
 * 
 * @param t - Value [0, 1]
 * @returns Smoothed value [0, 1]
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Perlin-like noise with bilinear interpolation.
 * Smoother than raw cell noise.
 * 
 * @param x - Continuous x coordinate
 * @param y - Continuous y coordinate
 * @param seed - Random seed
 * @returns Smooth noise value [-1, 1]
 */
export function smoothNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1

  const fx = x - x0
  const fy = y - y0

  // Get corner values
  const v00 = hash2D(x0, y0, seed) * 2 - 1
  const v10 = hash2D(x1, y0, seed) * 2 - 1
  const v01 = hash2D(x0, y1, seed) * 2 - 1
  const v11 = hash2D(x1, y1, seed) * 2 - 1

  // Interpolate
  const sx = smoothstep(fx)
  const sy = smoothstep(fy)

  const v0 = v00 * (1 - sx) + v10 * sx
  const v1 = v01 * (1 - sx) + v11 * sx

  return v0 * (1 - sy) + v1 * sy
}

/**
 * Multi-octave noise for more organic patterns.
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param seed - Random seed
 * @param octaves - Number of octaves (layers)
 * @returns Noise value [-1, 1]
 */
export function fbmNoise(
  x: number,
  y: number,
  seed: number,
  octaves: number = 2
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, seed + i) * amplitude
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / maxValue
}
