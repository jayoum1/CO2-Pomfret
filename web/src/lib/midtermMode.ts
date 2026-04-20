/**
 * Midterm / GitHub Pages demo mode (set at build time via next.config.js when CI builds the static export).
 *
 * - When true: skip FastAPI; use JSON under `/midterm-data/` only (offline demo).
 * - When false: try live API first (local dev and local `next dev`), then static fallback if the backend is down.
 */
export function isMidtermStaticDemoBuild(): boolean {
  return process.env.NEXT_PUBLIC_MIDTERM_STATIC_FIRST === 'true'
}
