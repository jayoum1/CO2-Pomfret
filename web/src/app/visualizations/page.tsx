'use client'

import Image from 'next/image'

export default function Visualizations() {
  const timeSeriesImages = [
    { src: '/figures/carbon_by_plot_over_time.png', title: 'Carbon by Plot Over Time', description: 'Time series showing carbon sequestration across different plots' },
    { src: '/figures/dbh_distribution_by_year.png', title: 'DBH Distribution by Year', description: 'Distribution of tree diameters across different years' },
    { src: '/figures/mean_dbh_vs_years.png', title: 'Mean DBH vs Years', description: 'Average diameter at breast height over time' },
    { src: '/figures/species_carbon_over_time.png', title: 'Species Carbon Over Time', description: 'Carbon storage by species across time periods' },
    { src: '/figures/total_carbon_vs_years.png', title: 'Total Carbon vs Years', description: 'Overall forest carbon sequestration trend' },
  ]

  const edaImages = [
    { src: '/Graphs/EDA_Figures/dbh_histogram_by_plot.png', title: 'DBH Histogram by Plot', description: 'Distribution of tree diameters across plots' },
    { src: '/Graphs/EDA_Figures/dbh_timeseries_by_plot.png', title: 'DBH Time Series by Plot', description: 'Diameter trends over time for each plot' },
    { src: '/Graphs/EDA_Figures/carbon_timeseries_by_plot.png', title: 'Carbon Time Series by Plot', description: 'Carbon storage trends by plot location' },
    { src: '/Graphs/EDA_Figures/growth_boxplot_by_species.png', title: 'Growth Boxplot by Species', description: 'Growth rate distribution across species' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">R Visualizations</h1>
      <p className="text-[var(--text-muted)]">Comprehensive analysis charts and trends</p>

      <div>
        <h2 className="text-xl font-semibold mb-4">Time Series Analysis</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Longitudinal analysis of forest metrics over time</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {timeSeriesImages.map((img, index) => (
            <div key={index} className="card">
              <h3 className="font-semibold mb-3">{img.title}</h3>
              <div className="relative w-full h-64 bg-[var(--bg-alt)] rounded overflow-hidden mb-3">
                <Image
                  src={img.src}
                  alt={img.title}
                  fill
                  className="object-contain"
                />
              </div>
              <p className="text-sm text-[var(--text-muted)]">{img.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Exploratory Data Analysis</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Statistical distributions and patterns in the data</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {edaImages.map((img, index) => (
            <div key={index} className="card">
              <h3 className="font-semibold mb-3">{img.title}</h3>
              <div className="relative w-full h-64 bg-[var(--bg-alt)] rounded overflow-hidden mb-3">
                <Image
                  src={img.src}
                  alt={img.title}
                  fill
                  className="object-contain"
                />
              </div>
              <p className="text-sm text-[var(--text-muted)]">{img.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
