export default function About() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">About / Assumptions</h1>
      <p className="text-[var(--text-muted)]">Project details and simulation assumptions</p>

      <div className="card">
        <h2 className="font-semibold mb-4">Project Overview</h2>
        <p className="text-[var(--text)] leading-relaxed mb-4">
          The Carbon DBH project uses measured DBH (diameter at breast height), species, and plot data to train 
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
              <strong>Hybrid Model:</strong>
              <span className="ml-2">
                Long-term simulations use a hybrid model combining baseline growth curves (smooth, nonnegative, decelerating) 
                with ML residual predictions. This produces stable multi-year projections without fixed-point freezing.
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
              Multi-year forest snapshots generated using hybrid modeling approach, combining baseline 
              growth curves with ML predictions for stable long-term projections.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-[var(--text-muted)] py-6">
        <p><strong>Pomfret School</strong> • Forest Carbon Project • {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
