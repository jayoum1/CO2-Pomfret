'use client'

import type { ScenarioConfig, InvasiveOutbreakConfig } from '@/lib/vectorForest/scenarios'

const CO2E_FACTOR = 3.667
const SEVERITY_OPTIONS = [
  { value: 0.35, label: 'Low' },
  { value: 0.65, label: 'Med' },
  { value: 1.0, label: 'High' },
] as const

export default function VectorForestScenarioOverlay({
  year,
  scenarioId,
  onScenarioIdChange,
  invasiveConfig,
  onInvasiveConfigChange,
  onResetScenario,
  onNewOutbreakLocation,
  stats,
}: {
  year: number
  scenarioId: 'baseline' | 'invasive_outbreak'
  onScenarioIdChange: (id: 'baseline' | 'invasive_outbreak') => void
  invasiveConfig: InvasiveOutbreakConfig
  onInvasiveConfigChange: (c: InvasiveOutbreakConfig) => void
  onResetScenario: () => void
  onNewOutbreakLocation: () => void
  stats: {
    baselineCarbon: number
    baselineAlive: number
    scenarioCarbon: number
    scenarioAlive: number
  }
}) {
  const deadCount = stats.baselineAlive - stats.scenarioAlive
  const carbonDelta = stats.scenarioCarbon - stats.baselineCarbon
  const co2eDelta = carbonDelta * CO2E_FACTOR
  const totalTrees = stats.baselineAlive + deadCount
  const alivePct = totalTrees > 0 ? Math.round((stats.scenarioAlive / totalTrees) * 100) : 100

  return (
    <div className="absolute left-0 top-0 m-3 w-72 max-w-[calc(100%-24px)] rounded-xl border border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm shadow-lg z-20 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">Scenario</h3>
      <div className="flex rounded-lg bg-[var(--bg-alt)] p-0.5 border border-[var(--border)]">
        <button
          type="button"
          onClick={() => onScenarioIdChange('baseline')}
          className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
            scenarioId === 'baseline'
              ? 'bg-[var(--primary)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          Baseline
        </button>
        <button
          type="button"
          onClick={() => onScenarioIdChange('invasive_outbreak')}
          className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
            scenarioId === 'invasive_outbreak'
              ? 'bg-[var(--primary)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          Invasive Outbreak
        </button>
      </div>

      {scenarioId === 'invasive_outbreak' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-muted)]">Start year</label>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="range"
                min={0}
                max={25}
                value={invasiveConfig.startYear}
                onChange={(e) =>
                  onInvasiveConfigChange({ ...invasiveConfig, startYear: Number(e.target.value) })
                }
                className="flex-1"
                style={{ accentColor: 'var(--primary)' }}
              />
              <span className="text-sm font-medium w-8">{invasiveConfig.startYear}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Severity</label>
            <div className="flex gap-1 mt-1">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onInvasiveConfigChange({ ...invasiveConfig, severity: opt.value })}
                  className={`flex-1 py-1.5 px-2 text-xs rounded border transition-colors ${
                    invasiveConfig.severity === opt.value
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-alt)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewOutbreakLocation}
              className="flex-1 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--text)] hover:bg-[var(--border)] transition-colors"
            >
              New outbreak location
            </button>
            <button
              type="button"
              onClick={onResetScenario}
              className="py-2 px-3 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Reset scenario
            </button>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-[var(--border)]">
        <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2">Impact at year {year}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-[var(--bg-alt)] p-2">
            <span className="text-[var(--text-muted)] block text-xs">Trees dead</span>
            <span className="text-[var(--text)] font-semibold">{deadCount}</span>
          </div>
          <div className="rounded-lg bg-[var(--bg-alt)] p-2">
            <span className="text-[var(--text-muted)] block text-xs">Carbon change</span>
            <span className="text-[var(--text)] font-semibold">
              {carbonDelta >= 0 ? '+' : ''}{Math.round(carbonDelta)} kg C
            </span>
          </div>
          <div className="rounded-lg bg-[var(--bg-alt)] p-2 col-span-2">
            <span className="text-[var(--text-muted)] block text-xs">CO₂e change</span>
            <span className="text-[var(--text)] font-semibold">
              {co2eDelta >= 0 ? '+' : ''}{Math.round(co2eDelta)} kg CO₂e
            </span>
          </div>
          <div className="rounded-lg bg-[var(--bg-alt)] p-2 col-span-2">
            <span className="text-[var(--text-muted)] block text-xs">Alive (scenario)</span>
            <span className="text-[var(--text)] font-semibold">
              {stats.scenarioAlive} / {totalTrees} ({alivePct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
