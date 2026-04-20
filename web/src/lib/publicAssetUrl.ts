/**
 * Prefix public-folder URLs with Next.js `basePath` (e.g. `/CO2-Pomfret` on GitHub Pages).
 * Use for raw <img src> and other strings; Next <Image> and <Link> handle basePath themselves.
 */
export function publicAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  if (!path) return base || '/'
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
