'use client'

import Image from 'next/image'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionHeader } from '@/components/ui/SectionHeader'

const rVisualizations = [
  {
    title: 'Total Carbon vs Years',
    description: 'Total carbon sequestration over time across all plots',
    image: '/figures/total_carbon_vs_years.png',
  },
  {
    title: 'Carbon by Plot Over Time',
    description: 'Carbon sequestration trends for Upper, Middle, and Lower plots',
    image: '/figures/carbon_by_plot_over_time.png',
  },
  {
    title: 'Mean DBH vs Years',
    description: 'Average diameter at breast height (DBH) growth over time',
    image: '/figures/mean_dbh_vs_years.png',
  },
  {
    title: 'DBH Distribution by Year',
    description: 'Distribution of tree diameters across different years',
    image: '/figures/dbh_distribution_by_year.png',
  },
  {
    title: 'Species Carbon Over Time',
    description: 'Carbon sequestration by different tree species over time',
    image: '/figures/species_carbon_over_time.png',
  },
]

const edaVisualizations = [
  {
    title: 'DBH vs Year by Plot',
    description: 'Diameter growth patterns across different forest plots',
    image: '/Graphs/EDA_Figures/01_DBH_vs_Year_by_Plot.png',
  },
  {
    title: 'Mean Carbon vs Year by Plot',
    description: 'Average carbon storage trends by plot location',
    image: '/Graphs/EDA_Figures/02_Mean_Carbon_vs_Year_by_Plot.png',
  },
  {
    title: 'Total CO2e per Plot per Year',
    description: 'Total CO2 equivalent sequestration by plot and year',
    image: '/Graphs/EDA_Figures/12_Total_CO2e_per_Plot_per_Year.png',
  },
  {
    title: 'Carbon Growth Rate Distribution',
    description: 'Distribution of carbon growth rates across all trees',
    image: '/Graphs/EDA_Figures/03_Distribution_CarbonGrowthRate_trimmed.png',
  },
  {
    title: 'Carbon Growth Rate by Plot',
    description: 'Carbon growth rate distributions for each plot',
    image: '/Graphs/EDA_Figures/04_Distribution_CarbonGrowthRate_by_Plot_trimmed.png',
  },
  {
    title: 'DBH vs Carbon Relationship',
    description: 'Relationship between tree diameter and carbon storage',
    image: '/Graphs/EDA_Figures/06_DBHcm_vs_Carbon_trimmed.png',
  },
  {
    title: 'Carbon by Species (Top Species)',
    description: 'Carbon storage distribution for top tree species',
    image: '/Graphs/EDA_Figures/07_Boxplot_Carbon_by_Species_topN_redoak_max_removed.png',
  },
  {
    title: 'Correlation Heatmap',
    description: 'Correlations between forest variables',
    image: '/Graphs/EDA_Figures/14_Correlation_Heatmap.png',
  },
]

export default function Visualizations() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="R Visualizations"
        subtitle="Comprehensive analysis and trends of CO2 Pomfret data"
      />

      {/* Time Series Visualizations */}
      <section>
        <h2 className="text-heading-2 text-[var(--text)] mb-4">Time Series Analysis</h2>
        <p className="text-body text-[var(--muted)] mb-6">
          These visualizations show how carbon sequestration, DBH, and species composition change over time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rVisualizations.map((viz, index) => (
            <GlassCard key={index}>
              <h3 className="text-heading-3 text-[var(--text)] mb-2">{viz.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{viz.description}</p>
              <div className="relative w-full h-64 bg-[var(--panel2)] rounded-lg overflow-hidden border border-[var(--border)]">
                <Image
                  src={viz.image}
                  alt={viz.title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* EDA Visualizations */}
      <section>
        <h2 className="text-heading-2 text-[var(--text)] mb-4">Exploratory Data Analysis</h2>
        <p className="text-body text-[var(--muted)] mb-6">
          Detailed analysis of forest structure, growth patterns, and relationships between variables.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {edaVisualizations.map((viz, index) => (
            <GlassCard key={index}>
              <h3 className="text-heading-3 text-[var(--text)] mb-2">{viz.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{viz.description}</p>
              <div className="relative w-full h-48 bg-[var(--panel2)] rounded-lg overflow-hidden border border-[var(--border)]">
                <Image
                  src={viz.image}
                  alt={viz.title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Insights Section */}
      <GlassCard>
        <h2 className="text-heading-2 text-[var(--text)] mb-4">Key Insights</h2>
        <div className="space-y-3 text-body text-[var(--muted)]">
          <div className="flex items-start gap-3">
            <span className="text-[var(--primary)] text-xl">🌳</span>
            <div>
              <strong className="text-[var(--text)]">Carbon Sequestration Trends:</strong> The forest shows consistent growth in carbon storage over time, with variations between plots based on tree density and species composition.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-[var(--primary)] text-xl">📊</span>
            <div>
              <strong className="text-[var(--text)]">DBH Growth Patterns:</strong> Tree diameter increases follow predictable patterns, with larger trees showing slower growth rates (typical of mature forests).
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-[var(--primary)] text-xl">🌲</span>
            <div>
              <strong className="text-[var(--text)]">Species Diversity:</strong> Different species contribute varying amounts to carbon sequestration, with some species showing higher growth rates than others.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-[var(--primary)] text-xl">📍</span>
            <div>
              <strong className="text-[var(--text)]">Plot Variations:</strong> Upper, Middle, and Lower plots show distinct characteristics, likely due to differences in soil conditions, elevation, and tree composition.
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
