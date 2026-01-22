/**
 * Performance optimization utilities
 * Based on analysis document patterns
 */

/**
 * Throttle function calls
 * @param func Function to throttle
 * @param delay Delay in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  return (...args: Parameters<T>) => {
    const now = performance.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}

/**
 * Debounce function calls
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Request animation frame wrapper with throttling
 */
export function throttledRAF(callback: () => void, throttleMs: number = 16) {
  let lastTick = 0
  let rafId: number | null = null

  const tick = (timestamp: number) => {
    if (timestamp - lastTick >= throttleMs) {
      callback()
      lastTick = timestamp
    }
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  }
}

/**
 * Smooth camera/animation transition using requestAnimationFrame
 * Based on analysis document pattern
 */
export function animateTransition(
  startValue: number,
  endValue: number,
  duration: number,
  callback: (value: number) => void,
  easing: (t: number) => number = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = performance.now()
    
    function step() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easing(progress)
      const currentValue = startValue + (endValue - startValue) * eased
      
      callback(currentValue)
      
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        resolve()
      }
    }
    
    requestAnimationFrame(step)
  })
}

/**
 * Score-based color function
 * Based on analysis document pattern
 */
export function colorFromScore(score: number): string {
  if (score >= 80) return '#22c55e'  // Green
  if (score >= 65) return '#4ade80'  // Light green
  if (score >= 50) return '#facc15'   // Yellow
  if (score >= 35) return '#f97316'   // Orange
  return '#ef4444'                    // Red
}

/**
 * Normalize string for search/filtering
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^\w\s]/g, '')
}
