/**
 * Midterm / GitHub Pages demo mode (set at build time via next.config.js when CI builds the static export).
 *
 * `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` (GitHub Actions build):
 * - When true: skip FastAPI; use JSON under `/midterm-data/` only (offline demo).
 * - When false: try live API first (local `next dev`), then static fallback if the backend is down.
 *
 * `NEXT_PUBLIC_EXPORT_MIDTERM_SITE` (midterm-only export via scripts/build-midterm-github-pages.sh):
 * - When true: this bundle is only the midterm marketing page — hide links to the rest of the SPA.
 */
export function isMidtermStaticDemoBuild(): boolean {
  return process.env.NEXT_PUBLIC_MIDTERM_STATIC_FIRST === 'true'
}

/** True when CI built only `/midterm` for GitHub Pages (no dashboard, scenarios, etc.). */
export function isMidtermGithubPagesExport(): boolean {
  return process.env.NEXT_PUBLIC_EXPORT_MIDTERM_SITE === 'true'
}
