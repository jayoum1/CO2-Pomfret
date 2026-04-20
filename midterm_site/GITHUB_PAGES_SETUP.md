# GitHub Pages Setup Instructions (Archived)

This file describes the old static deployment approach and is now archived.

## Current live deployment

GitHub Pages is now deployed from:

- `.github/workflows/deploy-pages.yml`
- Next.js static export from the `web/` app
- Published root page = `/midterm` showcase

## What this means

- Changes inside `midterm_site/` no longer control the live Pages site.
- To update the published midterm site, edit files under `web/src/app/midterm/` and push to `main`.
