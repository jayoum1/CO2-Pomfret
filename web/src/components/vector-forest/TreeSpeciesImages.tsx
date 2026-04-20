'use client'

import {
  TREE_SPECIES_IMAGE_PATHS,
  type TreeSpeciesKey,
} from '@/lib/vectorForest/treeSpeciesImages'
import { publicAssetUrl } from '@/lib/publicAssetUrl'

export default function TreeSpeciesImages({
  speciesKey,
  className = '',
}: {
  speciesKey?: string
  className?: string
}) {
  if (!speciesKey || !(speciesKey in TREE_SPECIES_IMAGE_PATHS)) return null

  const paths = TREE_SPECIES_IMAGE_PATHS[speciesKey as TreeSpeciesKey]
  if (!paths?.length) return null

  return (
    <div className={className}>
      <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{speciesKey}</p>
      <div className="flex gap-1.5 items-start flex-wrap">
        {paths.length === 1 ? (
          <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-alt)] flex-1 min-w-0">
            <img
              src={publicAssetUrl(paths[0])}
              alt={`${speciesKey} tree`}
              className="w-full h-auto object-contain max-h-32"
            />
          </div>
        ) : (
          <>
            <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-alt)] flex-1 min-w-0 basis-0">
              <img
                src={publicAssetUrl(paths[0])}
                alt={`${speciesKey} tree`}
                className="w-full h-auto object-contain max-h-32"
              />
              <p className="text-[10px] text-center text-[var(--text-muted)] py-0.5">Tree</p>
            </div>
            <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-alt)] flex-1 min-w-0 basis-0">
              <img
                src={publicAssetUrl(paths[1])}
                alt={`${speciesKey} leaves`}
                className="w-full h-auto object-contain max-h-32"
              />
              <p className="text-[10px] text-center text-[var(--text-muted)] py-0.5">Leaves</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
