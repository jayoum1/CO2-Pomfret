# GitHub Pages Setup Instructions

The repository now deploys GitHub Pages from a Next.js static export built in CI.

## Current deployment source

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` when files under `web/**` (or the workflow) change
- Published URL: `https://jayoum1.github.io/CO2-Pomfret/`
- Published site root (`index.html`): Next.js **`/midterm`** page (new showcase). The workflow copies `out/midterm/index.html` → `out/index.html` after build. Other routes (e.g. `/vector-forest/`) remain in the export if linked.

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
- **CI builds** set `GITHUB_ACTIONS=true`, which enables `NEXT_PUBLIC_MIDTERM_STATIC_FIRST` so the midterm route never calls FastAPI; it only loads `web/public/midterm-data/*.json`.
- **Species images** in the tree inspector use `publicAssetUrl()` so `/tree-species/...` paths resolve under the repo `basePath` on Pages.

## Local development

- `next dev` does **not** set the static-only flag; the midterm page tries the API first and falls back to the JSON files if the backend is offline.
