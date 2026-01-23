'use client'

import { useState, useEffect } from 'react'
import { getSummary, getAvailableYears } from '@/lib/api'

export default function Visualize() {
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<any>(null)
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Forest Visualization</h1>
      <p className="text-[var(--text-muted)]">2D plot view of forest structure</p>

      <div className="card">
        <label className="block text-sm font-medium mb-3">
          Time Horizon: <span className="font-semibold text-[var(--primary)]">{selectedYear} years ahead</span>
        </label>
        <div className="flex gap-2">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`btn ${selectedYear === year ? 'btn-primary' : 'btn-secondary'}`}
            >
              {year} years
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Forest Plot View</h2>
        {loading ? (
          <div className="h-96 flex items-center justify-center text-[var(--text-muted)]">
            Loading...
          </div>
        ) : summary ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any], index) => {
                const plotColors = [
                  { border: 'var(--accent)', text: 'var(--accent)' },
                  { border: 'var(--secondary)', text: 'var(--secondary)' },
                  { border: 'var(--teal-500)', text: 'var(--teal-600)' },
                ]
                const colors = plotColors[index % 3]
                return (
                  <div key={plot} className="p-4 bg-[var(--bg-alt)] rounded border-t-4" style={{ borderTopColor: colors.border }}>
                    <h3 className="font-semibold mb-2">{plot} Plot</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Trees:</span>
                        <span className="font-medium">{data.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Carbon:</span>
                        <span className="font-medium" style={{ color: colors.text }}>
                          {data.carbon_at_time.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="h-96 bg-[var(--bg-alt)] rounded flex items-center justify-center border-2 border-dashed border-[var(--border)]">
              <div className="text-center text-[var(--text-muted)]">
                <p className="mb-2">2D Visualization Placeholder</p>
                <p className="text-sm">3D visualization coming soon</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-96 flex items-center justify-center text-[var(--text-muted)]">
            No data available
          </div>
        )}
      </div>
    </div>
  )
}
