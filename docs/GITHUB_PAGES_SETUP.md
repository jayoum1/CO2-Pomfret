# GitHub Pages Setup Instructions

The repository now deploys GitHub Pages from a Next.js static export built in CI.

## Current deployment source

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` when files under `web/**` (or the workflow) change
- Published URL: `https://jayoum1.github.io/CO2-Pomfret/`
- Published page root: Next.js `/` (dashboard — same as `http://localhost:3000/`). The full static export includes other routes (e.g. `/midterm/`, `/vector-forest/`) under the repo base path.

## One-time repository setting

In GitHub repository settings:

1. Go to **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).

If **Source** is still **Deploy from a branch** and the folder is **`/midterm_site`** (or `/docs`), GitHub will keep serving that **old static site**. You must switch the source to **GitHub Actions** so the workflow in `.github/workflows/deploy-pages.yml` controls what is published.

After changing the source, open the **Actions** tab, confirm the **Deploy Web App to GitHub Pages** workflow ran successfully on your latest push, then refresh `https://jayoum1.github.io/CO2-Pomfret/` (hard refresh or wait a minute for cache).

## How updates work

1. Make changes under `web/` (e.g. `web/src/app/`).
2. Commit and push to `main`.
3. The **Deploy Web App to GitHub Pages** workflow builds and redeploys automatically.

## Notes

- The old static `midterm_site/` files are kept as archived/reference material.
- Midterm charts and vector forest have static JSON fallback data in `web/public/midterm-data/`, so they continue to render on Pages even without a live local backend.
