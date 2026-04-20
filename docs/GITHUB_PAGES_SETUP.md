# GitHub Pages Setup Instructions

The repository now deploys GitHub Pages from a Next.js static export built in CI.

## Current deployment source

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` when files under `web/**` (or the workflow) change
- Published URL: `https://jayoum1.github.io/CO2-Pomfret/`
- Published page root: Next.js `/midterm` page (copied to exported `/index.html` in CI)

## One-time repository setting

In GitHub repository settings:

1. Go to **Settings** → **Pages**
2. Set **Source** to **GitHub Actions**

## How updates work

1. Make changes under `web/src/app/midterm/` or related midterm components.
2. Commit and push to `main`.
3. The `Deploy Midterm Site to GitHub Pages` workflow builds and redeploys automatically.

## Notes

- The old static `midterm_site/` files are kept as archived/reference material.
- Midterm charts and vector forest have static JSON fallback data in `web/public/midterm-data/`, so they continue to render on Pages even without a live local backend.
