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
  },
}

module.exports = nextConfig
