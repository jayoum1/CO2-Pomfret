/**
 * Species that have image assets (PNG or JPG) in public/tree-species/.
 * Each entry: [single image] or [tree image, leaves image] for side-by-side.
 */

export const TREE_SPECIES_WITH_IMAGES = [
  'Beech',
  'Mockernut Hickory',
  'Red Maple',
  'Red Oak',
  'Shagbark Hickory',
  'Sugar Maple',
  'White Pine',
] as const

export type TreeSpeciesKey = (typeof TREE_SPECIES_WITH_IMAGES)[number]

/** Paths for each species: [tree, leaves] or [single combined image] */
export const TREE_SPECIES_IMAGE_PATHS: Record<
  TreeSpeciesKey,
  [string] | [string, string]
> = {
  'Beech': ['/tree-species/Beech/unnamed.jpg'],
  'Mockernut Hickory': ['/tree-species/Mockernut Hickory/unnamed.jpg'],
  'Red Maple': [
    '/tree-species/Red Maple/red-maple-fall.png',
    '/tree-species/Red Maple/red-maple-leaves-fruit.png',
  ],
  'Red Oak': [
    '/tree-species/Red Oak/northern-red-oak-fall.png',
    '/tree-species/Red Oak/northern-red-oak-leaf-acorn.png',
  ],
  'Shagbark Hickory': ['/tree-species/Shagbark Hickory/unnamed.jpg'],
  'Sugar Maple': [
    '/tree-species/Sugar Maple/sugar-maple-fall.png',
    '/tree-species/Sugar Maple/sugar-maple-leaves-fruit.png',
  ],
  'White Pine': [
    '/tree-species/White Pine/Eastern-White-Pine-Young-and-Old.png',
    '/tree-species/White Pine/eastern-white-pine-needles.png',
  ],
}
