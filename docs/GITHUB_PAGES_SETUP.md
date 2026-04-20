# GitHub Pages Setup Instructions

The repository now deploys GitHub Pages from a Next.js static export built in CI.

## Current deployment source

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` when files under `web/**` (or the workflow) change
- Published URL: `https://jayoum1.github.io/CO2-Pomfret/`
- **Build:** `web/scripts/build-midterm-github-pages.sh` — temporarily keeps only `app/midterm` (+ root layout + globals), runs `next build`, then restores the full `src/app/` tree. The exported bundle contains **only the midterm page** (smaller `_next`, no dashboard or other routes).
- **Data:** Charts and vector forest use bundled JSON under `public/midterm-data/` (`NEXT_PUBLIC_MIDTERM_STATIC_FIRST` + `NEXT_PUBLIC_EXPORT_MIDTERM_SITE` during that build). No FastAPI.
- **Root URL:** the workflow copies `out/midterm/index.html` → `out/index.html` and prunes unused `out/Graphs`, `out/disturbances`, `out/figures` copies.

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
