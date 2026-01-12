'use client'

import { useState, useEffect } from 'react'
import { getAvailableYears, getSummary } from '@/lib/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([])

  // Load available years and initial summary
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const years = await getAvailableYears()
        setAvailableYears(years)
        
        if (years.length > 0) {
          setSelectedYear(years[0])
          const initialSummary = await getSummary(years[0])
          setSummary(initialSummary)
          
          // Load time series data for all years
          const timeSeries = []
          for (const year of years) {
            const yearSummary = await getSummary(year)
            timeSeries.push({
              years_ahead: year,
              total_carbon: yearSummary.total_carbon_kgC,
            })
          }
          setTimeSeriesData(timeSeries)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Update summary when year changes
  useEffect(() => {
    if (selectedYear !== null && availableYears.includes(selectedYear)) {
      setLoading(true)
      getSummary(selectedYear)
        .then(setSummary)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedYear, availableYears])

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading forest data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    )
  }

  if (!summary) {
    return <div className="text-gray-500">No data available</div>
  }

  // Prepare chart data
  const plotData = Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any]) => ({
    plot,
    carbon: data.carbon_at_time,
    count: data.count,
  }))

  const speciesData = Object.entries(summary.species_breakdown || {})
    .map(([species, carbon]: [string, any]) => ({
      species: species.length > 15 ? species.substring(0, 15) + '...' : species,
      carbon,
    }))
    .sort((a, b) => b.carbon - a.carbon)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Forest snapshots and carbon metrics over time</p>
      </div>

      {/* Year Selector - Slider */}
      <div className="bg-white p-6 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Years Ahead: <span className="text-forest-green font-bold">{selectedYear}</span>
        </label>
        {availableYears.length > 0 && (
          <div className="space-y-2">
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
            {/* Quick jump buttons for key years */}
            <div className="flex gap-2 flex-wrap mt-3">
              {[0, 5, 10, 15, 20].filter(y => availableYears.includes(y)).map((year) => (
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
        )}
      </div>

      {/* Metrics Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Carbon</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {summary.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Mean DBH</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {summary.mean_dbh_cm.toFixed(1)} cm
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Number of Trees</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {summary.num_trees.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Carbon Over Time */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Total Carbon vs Years</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="years_ahead" label={{ value: 'Years Ahead', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_carbon" stroke="#2d5016" strokeWidth={2} name="Total Carbon (kg C)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Carbon by Plot */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Carbon by Plot</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={plotData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="plot" />
              <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="carbon" fill="#4a7c2a" name="Carbon (kg C)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Species */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top 10 Species by Carbon</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={speciesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: 'Carbon (kg C)', position: 'insideBottom', offset: -5 }} />
              <YAxis dataKey="species" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="carbon" fill="#2d5016" name="Carbon (kg C)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
