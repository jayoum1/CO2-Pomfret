# Vector Forest — tree species missing inspector images

This list is derived from unique `Species` values in `Data/Processed Data/forest_snapshots_baseline_stochastic/forest_0_years.csv` (23 species) compared to `web/src/lib/vectorForest/treeSpeciesImages.ts`, which defines which species have assets under `web/public/tree-species/`.

## Species that already have images (7 keys)

These display tree and/or leaf images in the Tree Inspector when the backend species name maps correctly (see `SPECIES_IMAGE_MAP` in `web/src/app/vector-forest/page.tsx`).

| Display key (folder name) | Typical CSV names |
|---------------------------|-------------------|
| Beech | `beech` |
| Mockernut Hickory | `mockernut`, `mockernut hickory` |
| Red Maple | `red maple` |
| Red Oak | `red oak` |
| Shagbark Hickory | `shagbark hickory` |
| Sugar Maple | `sugar maple` |
| White Pine | `white pine` |

## Species missing images (15)

Supply photos for these (tree habit and, if helpful, leaves/fruit/bark). After assets are added, extend `TREE_SPECIES_WITH_IMAGES`, `TREE_SPECIES_IMAGE_PATHS`, and `SPECIES_IMAGE_MAP` in the web app so the CSV string maps to the new key.

1. **american hophornbeam** (`american hophornbeam`)
2. **autumn olive** (`autumn olive`)
3. **basswood** (`basswood`)
4. **black birch** (`black birch`)
5. **black oak** (`black oak`)
6. **buckthorn** (`buckthorn`)
7. **burning bush** (`burning bush`)
8. **dogwood** (`dogwood`)
9. **hophornbeam** (`hophornbeam`)
10. **musclewood** (`musclewood`)
11. **norway maple** (`norway maple`)
12. **pignut hickory** (`pignut hickory`)
13. **sassafras** (`sassafras`)
14. **white ash** (`white ash`)
15. **yellow birch** (`yellow birch`)

## Suggested asset layout

Place files under `web/public/tree-species/<Display Key>/` (folder name should match the key you add to `TREE_SPECIES_WITH_IMAGES`, e.g. `Burning Bush` or `burning-bush`—keep consistent with existing folders like `Red Maple`). Reference one or two image paths in `TREE_SPECIES_IMAGE_PATHS` like the existing species.
