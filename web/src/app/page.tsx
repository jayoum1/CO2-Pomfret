'use client'

import { useState, useEffect } from 'react'
import { getAvailableYears, getSummary, Summary } from '@/lib/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Trees, Leaf, Info } from 'lucide-react'
import { KpiCard } from '@/components/ui/KpiCard'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SkeletonBlock } from '@/components/ui/SkeletonBlock'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summary20, setSummary20] = useState<Summary | null>(null)
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
          
          // Load time series data for all years (using hybrid mode)
          const timeSeries = []
          for (const year of years) {
            const yearSummary = await getSummary(year, 'hybrid')
            timeSeries.push({
              years_ahead: year,
              total_carbon: yearSummary.total_carbon_kgC,
            })
            // Store year 20 summary separately
            if (year === 20) {
              setSummary20(yearSummary)
            }
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

  // Prepare chart data
  const plotData = summary ? Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any]) => ({
    plot,
    carbon: data.carbon_at_time,
    count: data.count,
  })) : []

  const speciesData = summary ? Object.entries(summary.species_breakdown || {})
    .map(([species, carbon]: [string, any]) => ({
      species: species.length > 15 ? species.substring(0, 15) + '...' : species,
      carbon,
    }))
    .sort((a, b) => b.carbon - a.carbon)
    .slice(0, 10) : []

  const year0 = timeSeriesData.find(d => d.years_ahead === 0)
  const year20Data = timeSeriesData.find(d => d.years_ahead === 20)

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-label">
                Years Ahead: <span className="text-[var(--text)] font-semibold">{selectedYear}</span>
              </label>
            </div>
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
                <div className="flex gap-2 flex-wrap">
                  {[0, 5, 10, 15, 20].filter(y => availableYears.includes(y)).map((year) => (
                    <Button
                      key={year}
                      variant={selectedYear === year ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedYear(year)}
                      className="h-7 text-xs"
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </GlassCard>

        {/* KPI Cards */}
        {loading && !summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <GlassCard key={i} hover={false}>
                <SkeletonBlock lines={3} />
              </GlassCard>
            ))}
          </div>
        ) : error ? (
          <GlassCard>
            <div className="text-[var(--error)]">Error: {error}</div>
          </GlassCard>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Carbon"
              value={`${summary.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
              icon={Leaf}
              description={`Year ${selectedYear}`}
            />
            <KpiCard
              title="Mean DBH"
              value={`${summary.mean_dbh_cm.toFixed(1)} cm`}
              icon={Trees}
              description="Average diameter"
            />
            <KpiCard
              title="Total Trees"
              value={summary.num_trees.toLocaleString()}
              icon={Trees}
              description="Tree count"
            />
            <KpiCard
              title="CO2 Equivalent"
              value={`${(summary.total_carbon_kgC * 3.667).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`}
              icon={TrendingUp}
              description="CO2e stored"
            />
          </div>
        ) : null}

        {/* Charts Section */}
        <SectionHeader
          title="Carbon Analysis"
          subtitle="Time series and breakdown visualizations"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Carbon Over Time */}
          <GlassCard>
            <h3 className="text-heading-3 text-[var(--text)] mb-4">Total Carbon vs Years</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis 
                  dataKey="years_ahead" 
                  label={{ value: 'Years Ahead', position: 'insideBottom', offset: -5 }} 
                  stroke="var(--muted)" 
                  tick={{ fill: 'var(--muted)' }} 
                />
                <YAxis 
                  label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} 
                  stroke="var(--muted)" 
                  tick={{ fill: 'var(--muted)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--panel)', 
                    border: '1px solid var(--border)', 
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)'
                  }} 
                />
                <Legend wrapperStyle={{ color: 'var(--text)' }} />
                <Line 
                  type="monotone" 
                  dataKey="total_carbon" 
                  stroke="var(--primary)" 
                  strokeWidth={3} 
                  name="Total Carbon (kg C)" 
                  dot={{ fill: 'var(--primary)', r: 5 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Carbon by Plot */}
          <GlassCard>
            <h3 className="text-heading-3 text-[var(--text)] mb-4">Carbon by Plot</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={plotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="plot" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
                <YAxis 
                  label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} 
                  stroke="var(--muted)" 
                  tick={{ fill: 'var(--muted)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--panel)', 
                    border: '1px solid var(--border)', 
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)'
                  }} 
                />
                <Legend wrapperStyle={{ color: 'var(--text)' }} />
                <Bar dataKey="carbon" fill="var(--primary)" name="Carbon (kg C)" />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Top Species */}
          <GlassCard className="lg:col-span-2">
            <h3 className="text-heading-3 text-[var(--text)] mb-4">Top 10 Species by Carbon</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={speciesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis 
                  type="number" 
                  label={{ value: 'Carbon (kg C)', position: 'insideBottom', offset: -5 }} 
                  stroke="var(--muted)" 
                  tick={{ fill: 'var(--muted)' }} 
                />
                <YAxis 
                  dataKey="species" 
                  type="category" 
                  width={150} 
                  stroke="var(--muted)" 
                  tick={{ fill: 'var(--muted)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--panel)', 
                    border: '1px solid var(--border)', 
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)'
                  }} 
                />
                <Legend wrapperStyle={{ color: 'var(--text)' }} />
                <Bar dataKey="carbon" fill="var(--primary)" name="Carbon (kg C)" />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
    </div>
  )
}
