/** @type {import('next').NextConfig} */
const repoName = 'CO2-Pomfret'
const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: isGithubActions ? `/${repoName}` : '',
  assetPrefix: isGithubActions ? `/${repoName}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubActions ? `/${repoName}` : '',
    // GitHub Pages static export: midterm demo uses JSON only, never localhost:8000
    NEXT_PUBLIC_MIDTERM_STATIC_FIRST: isGithubActions ? 'true' : '',
    // Set only by scripts/build-midterm-github-pages.sh — midterm-only route tree, no full app
    NEXT_PUBLIC_EXPORT_MIDTERM_SITE:
      process.env.MIDTERM_EXPORT_ONLY === 'true' ? 'true' : '',
  },
}

module.exports = nextConfig
