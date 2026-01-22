'use client'

import { useState, useEffect } from 'react'
import { getSummary, getAvailableYears } from '@/lib/api'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/KpiCard'
import { Leaf, Trees, TrendingUp } from 'lucide-react'
import { SkeletonBlock } from '@/components/ui/SkeletonBlock'

export default function Visualize() {
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<any>(null)
  const [is3D, setIs3D] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([0, 5, 10, 20])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAvailableYears().then(setAvailableYears).catch(console.error)
  }, [])

  useEffect(() => {
    if (availableYears.includes(selectedYear)) {
      setLoading(true)
      getSummary(selectedYear)
        .then(setSummary)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [selectedYear, availableYears])

  // Generate random positions for trees (placeholder)
  const generateTreePositions = (count: number, plot: string) => {
    const positions = []
    for (let i = 0; i < count; i++) {
      positions.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        plot,
      })
    }
    return positions
  }

  const treePositions = summary
    ? Object.entries(summary.plot_breakdown || {}).flatMap(([plot, data]: [string, any]) =>
        generateTreePositions(data.count, plot)
      )
    : []

  const colors: Record<string, string> = {
    Upper: '#3b82f6',
    Middle: '#22c55e',
    Lower: '#86efac',
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Visualize Forest"
        subtitle="2D and 3D visualization of forest structure"
      />

      <GlassCard>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-label">
              Years Ahead: <span className="text-[var(--text)] font-semibold">{selectedYear}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={is3D}
                onChange={(e) => setIs3D(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--primary)]"
                aria-label="Enable 3D view"
              />
              <span className="text-sm text-[var(--muted)]">3D View (coming soon)</span>
            </label>
          </div>
          
          <div className="space-y-2">
            {availableYears.length > 0 && (
              <>
                <input
                  type="range"
                  min={Math.min(...availableYears)}
                  max={Math.max(...availableYears)}
                  value={selectedYear}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    const closest = availableYears.reduce((prev, curr) =>
                      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                    )
                    setSelectedYear(closest)
                  }}
                  step={availableYears.length > 10 ? 1 : undefined}
                  className="w-full h-2 bg-[var(--panel2)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                  style={{
                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, var(--panel2) ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, var(--panel2) 100%)`
                  }}
                />
                <div className="flex justify-between text-label text-[var(--muted)]">
                  <span>{Math.min(...availableYears)}</span>
                  <span>{Math.max(...availableYears)}</span>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  {[0, 5, 10, 15, 20].filter(y => availableYears.includes(y)).map((year) => (
                    <Button
                      key={year}
                      variant={selectedYear === year ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedYear(year)}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {is3D ? (
          <div className="mt-6 glass-panel rounded-lg p-16 text-center border-2 border-dashed border-[var(--border)]">
            <div className="text-[var(--text)] text-lg mb-2 font-semibold">3D Visualization</div>
            <div className="text-[var(--muted)] text-sm">Coming soon - React Three Fiber integration</div>
            <div className="mt-4 text-xs text-[var(--muted)]">
              This will show an interactive 3D view of the forest with tree positions and sizes
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <h2 className="text-heading-3 text-[var(--text)] mb-4">2D Plot View (placeholder)</h2>
            <div className="relative w-full h-96 bg-[var(--panel2)] rounded-lg border border-[var(--border)]">
              {summary && (
                <>
                  {Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any], idx) => {
                    const plotPositions = treePositions.filter((p: any) => p.plot === plot)
                    return (
                      <div key={plot} className="absolute inset-0">
                        <div className="absolute top-2 left-2 text-xs font-semibold" style={{ color: colors[plot] }}>
                          {plot} ({data.count} trees)
                        </div>
                        {plotPositions.map((pos: any, i: number) => (
                          <div
                            key={`${plot}-${i}`}
                            className="absolute w-2 h-2 rounded-full"
                            style={{
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              backgroundColor: colors[plot],
                            }}
                            title={`${plot} tree ${i + 1}`}
                          />
                        ))}
                      </div>
                    )
                  })}
                  <div className="absolute bottom-4 left-4 text-xs text-[var(--muted)]">
                    {summary.num_trees} total trees • Random positions (placeholder)
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 text-sm text-[var(--muted)]">
              <p>
                <strong className="text-[var(--text)]">Note:</strong> Tree positions are randomly generated for visualization purposes.
                Actual tree coordinates will be integrated when spatial data is available.
              </p>
            </div>
          </div>
        )}
      </GlassCard>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} hover={false}>
              <SkeletonBlock lines={3} />
            </GlassCard>
          ))}
        </div>
      ) : summary && (
        <GlassCard>
          <h2 className="text-heading-3 text-[var(--text)] mb-4">Summary ({selectedYear} years ahead)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Total Carbon"
              value={`${summary.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
              icon={Leaf}
            />
            <KpiCard
              title="Mean DBH"
              value={`${summary.mean_dbh_cm.toFixed(1)} cm`}
              icon={Trees}
            />
            <KpiCard
              title="Number of Trees"
              value={summary.num_trees.toLocaleString()}
              icon={TrendingUp}
            />
          </div>
        </GlassCard>
      )}
    </div>
  )
}
