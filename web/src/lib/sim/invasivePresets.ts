/**
 * Invasive Species Presets
 *
 * Frontier-based spread: targetInfectedCells, newInfectionsPerTick, jumpChance, jumpRadiusCells, intensity.
 */

export interface InvasivePreset {
  id: string
  name: string
  category: 'bug' | 'plant' | 'disease'
  description: string
  icon: string
  params: {
    targetInfectedCells: number
    newInfectionsPerTick: number
    jumpChance: number // 0-1 probability per tick
    jumpRadiusCells: number // max cell distance for spark jump
    intensity: number // 0-1, mortality scaling
  }
}

export const INVASIVE_PRESETS: InvasivePreset[] = [
  {
    id: 'emerald-ash-borer',
    name: 'Emerald Ash Borer',
    category: 'bug',
    description: 'Fast-moving beetle, lethal to ash trees',
    icon: '🪲',
    params: {
      targetInfectedCells: 450,
      newInfectionsPerTick: 12,
      jumpChance: 0.25,
      jumpRadiusCells: 4,
      intensity: 0.92
    }
  },
  {
    id: 'spongy-moth',
    name: 'Spongy Moth',
    category: 'bug',
    description: 'Rapid defoliation, spreads quickly',
    icon: '🦋',
    params: {
      targetInfectedCells: 500,
      newInfectionsPerTick: 14,
      jumpChance: 0.35,
      jumpRadiusCells: 5,
      intensity: 0.78
    }
  },
  {
    id: 'hemlock-woolly-adelgid',
    name: 'Hemlock Woolly Adelgid',
    category: 'bug',
    description: 'Slower but relentless, targets hemlocks',
    icon: '🐛',
    params: {
      targetInfectedCells: 280,
      newInfectionsPerTick: 6,
      jumpChance: 0.12,
      jumpRadiusCells: 3,
      intensity: 0.82
    }
  },
  {
    id: 'japanese-knotweed',
    name: 'Japanese Knotweed',
    category: 'plant',
    description: 'Aggressive plant, spreads along edges',
    icon: '🌿',
    params: {
      targetInfectedCells: 220,
      newInfectionsPerTick: 5,
      jumpChance: 0.28,
      jumpRadiusCells: 4,
      intensity: 0.62
    }
  },
  {
    id: 'oriental-bittersweet',
    name: 'Oriental Bittersweet',
    category: 'plant',
    description: 'Climbing vine, patchy spread pattern',
    icon: '🍇',
    params: {
      targetInfectedCells: 200,
      newInfectionsPerTick: 3,
      jumpChance: 0.48,
      jumpRadiusCells: 6,
      intensity: 0.52
    }
  },
  {
    id: 'oak-wilt',
    name: 'Oak Wilt',
    category: 'disease',
    description: 'Fungal disease, expanding in pockets',
    icon: '🍂',
    params: {
      targetInfectedCells: 260,
      newInfectionsPerTick: 6,
      jumpChance: 0.30,
      jumpRadiusCells: 4,
      intensity: 0.72
    }
  }
]

export const PRESET_CATEGORIES = [
  { id: 'bug', label: 'Bugs', description: 'Fast-moving insects' },
  { id: 'plant', label: 'Plants & Vines', description: 'Invasive vegetation' },
  { id: 'disease', label: 'Diseases', description: 'Fungal & bacterial' }
] as const

export function getPresetById(id: string): InvasivePreset | undefined {
  return INVASIVE_PRESETS.find(p => p.id === id)
}

export function getPresetsByCategory(category: string): InvasivePreset[] {
  return INVASIVE_PRESETS.filter(p => p.category === category)
}
