'use client'

import { useState, useEffect } from 'react'
import { getUncertaintySummary, UncertaintySummary } from '@/lib/api'

export default function About() {
  const [uncertainty, setUncertainty] = useState<UncertaintySummary | null>(null)
  const [loadingUncertainty, setLoadingUncertainty] = useState(true)

  useEffect(() => {
    getUncertaintySummary()
      .then((data) => {
        console.log('Uncertainty data loaded:', data)
        setUncertainty(data)
      })
      .catch((error) => {
        console.error('Error loading uncertainty metrics:', error)
        setUncertainty(null)
      })
      .finally(() => setLoadingUncertainty(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">About / Assumptions</h1>
      <p className="text-[var(--text-muted)]">Project details and simulation assumptions</p>

      <div className="card">
        <h2 className="font-semibold mb-4">Project Overview</h2>
        <p className="text-[var(--text)] leading-relaxed mb-4">
          The CO2 Pomfret project uses measured DBH (diameter at breast height), species, and plot data to train 
          a Neural Network that predicts next-year DBH. We generate multi-year forest snapshots (0/5/10/20 years) 
          to visualize forest carbon sequestration over time.
        </p>
        <p className="text-[var(--text)] leading-relaxed">
          This project analyzes approximately 450 trees across 3 forest plots (Upper, Middle, Lower) at Pomfret School, 
          providing insights into forest growth patterns and carbon storage potential.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Simulation Assumptions</h2>
        <ul className="space-y-3">
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>DBH Units:</strong>
              <span className="ml-2">All measurements are in centimeters (cm)</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>Growth-Only Baseline:</strong>
              <span className="ml-2">No mortality or disturbance modeled (growth-only baseline)</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>Growth-Curve Simulator (Default):</strong>
              <span className="ml-2">
                Long-term simulations use baseline growth curves learned from historical DBH increments by species, plot, and size. 
                High-DBH tail is constrained with a guardrail to prevent unrealistic increasing growth at large diameters. 
                This produces stable, biologically plausible multi-year projections.
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>Visual Mode (Stochastic):</strong>
              <span className="ml-2">
                Optional stochastic mode adds small random variation calibrated from historical residual spread. 
                This improves visual realism but does not claim improved accuracy. Useful for exploring natural variation in growth patterns.
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>Residual ML Model:</strong>
              <span className="ml-2">
                A residual ML model exists in the codebase but is not used by default because validation showed it did not 
                improve backtest performance at 2-3 year horizons compared to baseline-only. It remains available for future research.
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>No Mortality Modeled:</strong>
              <span className="ml-2">
                Growth-only scenario projections. Mortality, disturbance, and climate change impacts are not included.
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-[var(--primary)] mr-3 mt-1">•</span>
            <div>
              <strong>Carbon Calculations:</strong>
              <span className="ml-2">
                Carbon storage is calculated using allometric equations based on DBH and species type. 
                CO₂ equivalent uses a factor of 3.667 (molecular weight ratio).
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Methodology</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Data Collection</h3>
            <p className="text-[var(--text)]">
              Tree measurements collected across three plots (Upper, Middle, Lower) from 2015-2025, 
              including DBH, species identification, and plot location.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Model Training</h3>
            <p className="text-[var(--text)]">
              Machine learning models (XGBoost, Neural Networks) trained on historical growth data 
              to predict year-to-year DBH changes based on species, plot location, and previous DBH.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Projection</h3>
            <p className="text-[var(--text)]">
              Multi-year forest snapshots generated using baseline growth curves with high-DBH guardrails. 
              Baseline curves are fitted from historical data using robust binning statistics (trimmed means) 
              at the species+plot level, with fallback to species-only or global curves. The guardrail ensures 
              non-increasing growth at high DBH to prevent unrealistic projections from sparse data.
            </p>
          </div>
        </div>
      </div>

      {/* Model Uncertainty Section */}
      <div className="card">
        <h2 className="font-semibold mb-4">Model Uncertainty</h2>
        <p className="text-[var(--text)] leading-relaxed mb-4">
          Our growth model predictions have inherent uncertainty due to natural variation in tree growth. 
          We quantify this uncertainty using residual standard deviations (sigma) from historical data, 
          converted to carbon and CO₂ equivalent units.
        </p>
        
        {loadingUncertainty ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            Loading uncertainty metrics...
          </div>
        ) : uncertainty ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-alt)] rounded-2xl border border-[var(--border)]">
                <div className="text-sm text-[var(--text-muted)] mb-1">Per-Tree Uncertainty</div>
                <div className="text-xl font-semibold mb-1" style={{ color: 'var(--teal-600)' }}>
                  {uncertainty.per_tree_stats.median_co2e_sigma_kg_per_year.toFixed(1)} kg CO₂e/year
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  ≈ {uncertainty.per_tree_stats.median_equivalent_miles_per_year.toFixed(1)} miles driven/year
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2">
                  (median typical deviation)
                </div>
              </div>
              
              <div className="p-4 bg-[var(--bg-alt)] rounded-2xl border border-[var(--border)]">
                <div className="text-sm text-[var(--text-muted)] mb-1">75th Percentile</div>
                <div className="text-xl font-semibold mb-1" style={{ color: 'var(--accent)' }}>
                  {uncertainty.per_tree_stats.p75_co2e_sigma_kg_per_year.toFixed(1)} kg CO₂e/year
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  ≈ {uncertainty.per_tree_stats.p75_equivalent_miles_per_year.toFixed(1)} miles driven/year
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20">
              <div className="text-sm text-[var(--text-muted)] mb-1">Forest-Wide Uncertainty Band</div>
              <div className="text-lg font-semibold mb-1" style={{ color: 'var(--teal-600)' }}>
                ±{uncertainty.forest_wide.total_co2e_sigma_rss_kg_per_year.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e/year
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                ≈ ±{uncertainty.forest_wide.total_equivalent_miles_rss_per_year.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles driven/year
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-2">
                (statistical combination across {uncertainty.n_trees} trees)
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> The stochastic simulation mode samples noise using these uncertainty estimates 
                to make visualizations more realistic. This represents typical natural variation, not model error.
              </p>
            </div>
            
            <div className="mt-4 text-xs text-[var(--text-muted)]">
              <p><strong>Methodology:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>DBH residual sigma estimated from historical growth data by species/plot</li>
                <li>Carbon uncertainty computed using finite difference approximation</li>
                <li>CO₂e conversion: {uncertainty.methodology.co2e_factor} kg CO₂e per kg C</li>
                <li>Driving analogy: {uncertainty.methodology.co2_per_mile_kg} kg CO₂ per mile (EPA estimate)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)]">
            Uncertainty metrics not available
          </div>
        )}
      </div>

      <div className="text-center text-sm text-[var(--text-muted)] py-6">
        <p><strong>Pomfret School</strong> • Forest Carbon Project • {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
