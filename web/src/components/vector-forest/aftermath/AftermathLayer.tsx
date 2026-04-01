/**
 * Renders scenario-specific aftermath and recovery props.
 * Positioned deterministically via seeded RNG so they don't shift on re-render.
 * Lives in its own layer between the ground and tree layers.
 */

import { useMemo } from 'react'
import type { ScenarioId } from '@/lib/vectorForest/scenarioCatalog'

import BurntGroundPatch from './BurntGroundPatch'
import CharredStump from './CharredStump'
import Sapling from './Sapling'
import DebrisBranch from './DebrisBranch'
import FallenLog from './FallenLog'
import WaterPool from './WaterPool'
import MudPatch from './MudPatch'
import ReedCluster from './ReedCluster'

interface AftermathLayerProps {
  scenarioId: ScenarioId
  year: number
  startYear: number
  containerWidth: number
  containerHeight: number
  groundY: number
  seed?: number
}

interface AftermathProp {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  /** Year offset after startYear when this prop first appears */
  appearsAt: number
  /** Year offset after startYear when this prop starts fading (null = never fades) */
  fadesAt: number | null
  /** Duration in years for opacity fade (in or out) */
  fadeDuration: number
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function generateFireProps(rng: () => number, cw: number, ch: number, groundY: number): AftermathProp[] {
  const props: AftermathProp[] = []
  const pad = 30

  for (let i = 0; i < 8; i++) {
    props.push({
      id: `fire-ground-${i}`,
      type: 'burnt_ground',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 20 - rng() * (ch * 0.4),
      width: 100 + rng() * 60,
      height: 35 + rng() * 15,
      zIndex: 5,
      appearsAt: 1,
      fadesAt: 18,
      fadeDuration: 10,
    })
  }

  for (let i = 0; i < 10; i++) {
    props.push({
      id: `fire-stump-${i}`,
      type: 'charred_stump',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 40 - rng() * (ch * 0.35),
      width: 28 + rng() * 16,
      height: 40 + rng() * 20,
      zIndex: 15 + Math.floor(rng() * 40),
      appearsAt: 1,
      fadesAt: 20,
      fadeDuration: 8,
    })
  }

  for (let i = 0; i < 5; i++) {
    props.push({
      id: `fire-log-${i}`,
      type: 'fallen_log',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 15 - rng() * (ch * 0.25),
      width: 80 + rng() * 50,
      height: 28 + rng() * 12,
      zIndex: 12 + Math.floor(rng() * 30),
      appearsAt: 1,
      fadesAt: 16,
      fadeDuration: 8,
    })
  }

  for (let i = 0; i < 12; i++) {
    props.push({
      id: `fire-sapling-${i}`,
      type: 'sapling',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 50 - rng() * (ch * 0.35),
      width: 22 + rng() * 14,
      height: 40 + rng() * 25,
      zIndex: 20 + Math.floor(rng() * 50),
      appearsAt: 8,
      fadesAt: null,
      fadeDuration: 8,
    })
  }

  return props
}

function generateTornadoProps(rng: () => number, cw: number, ch: number, groundY: number): AftermathProp[] {
  const props: AftermathProp[] = []
  const pad = 30

  for (let i = 0; i < 10; i++) {
    props.push({
      id: `tornado-debris-${i}`,
      type: 'debris_branch',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 10 - rng() * (ch * 0.3),
      width: 60 + rng() * 50,
      height: 25 + rng() * 15,
      zIndex: 10 + Math.floor(rng() * 35),
      appearsAt: 1,
      fadesAt: 14,
      fadeDuration: 8,
    })
  }

  for (let i = 0; i < 6; i++) {
    props.push({
      id: `tornado-log-${i}`,
      type: 'fallen_log',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 12 - rng() * (ch * 0.25),
      width: 80 + rng() * 55,
      height: 28 + rng() * 12,
      zIndex: 12 + Math.floor(rng() * 30),
      appearsAt: 1,
      fadesAt: 16,
      fadeDuration: 8,
    })
  }

  for (let i = 0; i < 6; i++) {
    props.push({
      id: `tornado-stump-${i}`,
      type: 'charred_stump',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 35 - rng() * (ch * 0.3),
      width: 24 + rng() * 14,
      height: 36 + rng() * 18,
      zIndex: 14 + Math.floor(rng() * 35),
      appearsAt: 1,
      fadesAt: 22,
      fadeDuration: 6,
    })
  }

  for (let i = 0; i < 12; i++) {
    props.push({
      id: `tornado-sapling-${i}`,
      type: 'sapling',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 50 - rng() * (ch * 0.35),
      width: 22 + rng() * 14,
      height: 40 + rng() * 25,
      zIndex: 20 + Math.floor(rng() * 50),
      appearsAt: 6,
      fadesAt: null,
      fadeDuration: 8,
    })
  }

  return props
}

function generateFloodProps(rng: () => number, cw: number, ch: number, groundY: number): AftermathProp[] {
  const props: AftermathProp[] = []
  const pad = 30

  for (let i = 0; i < 6; i++) {
    props.push({
      id: `flood-pool-${i}`,
      type: 'water_pool',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 15 - rng() * (ch * 0.25),
      width: 90 + rng() * 60,
      height: 30 + rng() * 15,
      zIndex: 5,
      appearsAt: 2,
      fadesAt: 18,
      fadeDuration: 10,
    })
  }

  for (let i = 0; i < 6; i++) {
    props.push({
      id: `flood-mud-${i}`,
      type: 'mud_patch',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 18 - rng() * (ch * 0.3),
      width: 80 + rng() * 50,
      height: 28 + rng() * 12,
      zIndex: 4,
      appearsAt: 2,
      fadesAt: 16,
      fadeDuration: 10,
    })
  }

  for (let i = 0; i < 8; i++) {
    props.push({
      id: `flood-reed-${i}`,
      type: 'reed_cluster',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 45 - rng() * (ch * 0.3),
      width: 26 + rng() * 16,
      height: 45 + rng() * 25,
      zIndex: 16 + Math.floor(rng() * 40),
      appearsAt: 5,
      fadesAt: null,
      fadeDuration: 6,
    })
  }

  for (let i = 0; i < 10; i++) {
    props.push({
      id: `flood-sapling-${i}`,
      type: 'sapling',
      x: pad + rng() * (cw - 2 * pad),
      y: groundY - 50 - rng() * (ch * 0.35),
      width: 22 + rng() * 14,
      height: 40 + rng() * 25,
      zIndex: 20 + Math.floor(rng() * 50),
      appearsAt: 8,
      fadesAt: null,
      fadeDuration: 8,
    })
  }

  return props
}

function getPropOpacity(prop: AftermathProp, yearsAfterEvent: number): number {
  if (yearsAfterEvent < prop.appearsAt) return 0

  const fadeInEnd = prop.appearsAt + prop.fadeDuration
  const fadeInOpacity = fadeInEnd > prop.appearsAt
    ? clamp01((yearsAfterEvent - prop.appearsAt) / prop.fadeDuration)
    : 1

  if (prop.fadesAt === null) return fadeInOpacity

  if (yearsAfterEvent < prop.fadesAt) return fadeInOpacity

  const fadeOutProgress = clamp01((yearsAfterEvent - prop.fadesAt) / prop.fadeDuration)
  return fadeInOpacity * (1 - fadeOutProgress)
}

const COMPONENT_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  burnt_ground: BurntGroundPatch,
  charred_stump: CharredStump,
  sapling: Sapling,
  debris_branch: DebrisBranch,
  fallen_log: FallenLog,
  water_pool: WaterPool,
  mud_patch: MudPatch,
  reed_cluster: ReedCluster,
}

export default function AftermathLayer({
  scenarioId,
  year,
  startYear,
  containerWidth,
  containerHeight,
  groundY,
  seed = 99,
}: AftermathLayerProps) {
  const props = useMemo(() => {
    if (scenarioId === 'baseline' || scenarioId === 'emerald_ash_borer') return []
    const rng = seededRandom(seed + scenarioId.charCodeAt(0))
    switch (scenarioId) {
      case 'fire':
        return generateFireProps(rng, containerWidth, containerHeight, groundY)
      case 'tornado':
        return generateTornadoProps(rng, containerWidth, containerHeight, groundY)
      case 'flood':
        return generateFloodProps(rng, containerWidth, containerHeight, groundY)
      default:
        return []
    }
  }, [scenarioId, containerWidth, containerHeight, groundY, seed])

  const yearsAfterEvent = year - startYear
  if (yearsAfterEvent < 1 || props.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {props.map((prop) => {
        const opacity = getPropOpacity(prop, yearsAfterEvent)
        if (opacity < 0.01) return null
        const Comp = COMPONENT_MAP[prop.type]
        if (!Comp) return null
        return (
          <div
            key={prop.id}
            className="absolute"
            style={{
              left: prop.x - prop.width / 2,
              top: prop.y - prop.height / 2,
              width: prop.width,
              height: prop.height,
              zIndex: prop.zIndex,
              opacity,
              transition: 'opacity 600ms ease',
            }}
          >
            <Comp style={{ width: '100%', height: '100%' }} />
          </div>
        )
      })}
    </div>
  )
}
