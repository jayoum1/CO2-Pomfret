'use client'

import { useState, useEffect } from 'react'
import { getSummary, getAvailableYears } from '@/lib/api'

export default function Visualize() {
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<any>(null)
  const [is3D, setIs3D] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([0, 5, 10, 20])

  useEffect(() => {
    getAvailableYears().then(setAvailableYears).catch(console.error)
  }, [])

  useEffect(() => {
    if (availableYears.includes(selectedYear)) {
      getSummary(selectedYear)
        .then(setSummary)
        .catch(console.error)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Visualize Forest</h1>
        <p className="text-gray-600 mt-1">2D and 3D visualization of forest structure</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4 mb-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700">
              Years Ahead: <span className="text-forest-green font-bold">{selectedYear}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={is3D}
                onChange={(e) => setIs3D(e.target.checked)}
                className="w-4 h-4 text-forest-green rounded focus:ring-forest-green"
              />
              <span className="text-sm text-gray-700">3D View (coming soon)</span>
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
                    // Find closest available year
                    const closest = availableYears.reduce((prev, curr) =>
                      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                    )
                    setSelectedYear(closest)
                  }}
                  step={availableYears.length > 10 ? 1 : undefined}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #2d5016 0%, #2d5016 ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, #e5e7eb ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{Math.min(...availableYears)}</span>
                  <span>{Math.max(...availableYears)}</span>
                </div>
              </>
            )}
            {/* Quick jump buttons */}
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 10, 15, 20].map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    selectedYear === year
                      ? 'bg-forest-green text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        {is3D ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-16 text-center">
            <div className="text-gray-500 text-lg mb-2">3D Visualization</div>
            <div className="text-gray-400 text-sm">Coming soon - React Three Fiber integration</div>
            <div className="mt-4 text-xs text-gray-400">
              This will show an interactive 3D view of the forest with tree positions and sizes
            </div>
          </div>
        ) : (
          <div className="border-2 border-gray-200 rounded-lg p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2D Plot View (placeholder)</h2>
            <div className="relative w-full h-96 bg-gray-50 rounded border border-gray-200">
              {summary && (
                <>
                  {/* Plot areas */}
                  {Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any], idx) => {
                    const plotPositions = treePositions.filter((p: any) => p.plot === plot)
                    const colors: Record<string, string> = {
                      Upper: '#3b82f6',
                      Middle: '#10b981',
                      Lower: '#f59e0b',
                    }
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
                  <div className="absolute bottom-4 left-4 text-xs text-gray-600">
                    {summary.num_trees} total trees • Random positions (placeholder)
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>
                <strong>Note:</strong> Tree positions are randomly generated for visualization purposes.
                Actual tree coordinates will be integrated when spatial data is available.
              </p>
            </div>
          </div>
        )}
      </div>

      {summary && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary ({selectedYear} years ahead)</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Carbon</div>
              <div className="text-xl font-bold text-gray-900">
                {summary.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Mean DBH</div>
              <div className="text-xl font-bold text-gray-900">{summary.mean_dbh_cm.toFixed(1)} cm</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Number of Trees</div>
              <div className="text-xl font-bold text-gray-900">{summary.num_trees.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
