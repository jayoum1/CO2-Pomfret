/**
 * Presentation scenario catalog for Vector Forest.
 * Images live in public/disturbances/ (e.g. tornado.png, flood.png, fire.png, baseline.png).
 */

export type ScenarioId =
  | 'baseline'
  | 'tornado'
  | 'flood'
  | 'fire'

export interface ScenarioCard {
  id: ScenarioId
  title: string
  description: string
  imageSrc: string
}

/** Ordered list for carousel. Paths under /disturbances/; add PNGs to web/public/disturbances/. */
export const SCENARIOS: ScenarioCard[] = [
  {
    id: 'baseline',
    title: 'Baseline',
    description: 'No disturbance; forest grows normally.',
    imageSrc: '/disturbances/baseline.png',
  },
  {
    id: 'tornado',
    title: 'Tornado',
    description: 'Wind damage along a path; trees fall in wind direction.',
    imageSrc: '/disturbances/tornado.png',
  },
  {
    id: 'flood',
    title: 'Flood',
    description: 'Rising water; trees in low areas are flooded and die.',
    imageSrc: '/disturbances/flood.png',
  },
  {
    id: 'fire',
    title: 'Fire',
    description: 'Fire spreads from below; trees burn, char, and collapse.',
    imageSrc: '/disturbances/fire.png',
  },
]

export function getScenarioCard(id: ScenarioId): ScenarioCard {
  const card = SCENARIOS.find((c) => c.id === id)
  if (!card) return SCENARIOS[0]
  return card
}

export function getNextScenarioId(current: ScenarioId): ScenarioId {
  const i = SCENARIOS.findIndex((c) => c.id === current)
  const next = i < 0 || i >= SCENARIOS.length - 1 ? 0 : i + 1
  return SCENARIOS[next].id
}

export function getPrevScenarioId(current: ScenarioId): ScenarioId {
  const i = SCENARIOS.findIndex((c) => c.id === current)
  const prev = i <= 0 ? SCENARIOS.length - 1 : i - 1
  return SCENARIOS[prev].id
}
