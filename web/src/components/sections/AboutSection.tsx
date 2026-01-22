export default function AboutSection() {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="text-center space-y-2 pb-6 border-b border-[#1e293b]/50 animate-fade-in">
        <h1 className="text-5xl font-black gradient-text neon-glow tracking-tight animate-fade-in stagger-1">About / Assumptions</h1>
        <p className="text-lg text-[#4ade80]/70 mt-1 animate-fade-in stagger-2">Project details and simulation assumptions</p>
      </div>

      <div className="glass dark-card p-6 rounded-lg space-y-6 animate-fade-in stagger-2">
        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">Project Overview</h2>
          <p className="text-[#4ade80]/70 leading-relaxed">
            The Pomfret Forest Growth & Carbon Simulation project uses measured DBH (diameter at breast height),
            species, and plot data to train a Neural Network that predicts next-year DBH. We generate multi-year
            forest snapshots (0/5/10/20 years) to visualize forest carbon sequestration over time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">Simulation Assumptions</h2>
          <ul className="space-y-2 text-[#4ade80]/70">
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span><strong className="text-[#4ade80]">DBH Units:</strong> All measurements are in centimeters (cm)</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span><strong className="text-[#4ade80]">Growth-Only Baseline:</strong> No mortality or disturbance modeled (growth-only baseline)</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>
                <strong className="text-[#4ade80]">Hybrid Model:</strong> Long-term simulations use a hybrid model combining baseline growth curves
                (smooth, nonnegative, decelerating) with ML residual predictions. This produces stable multi-year projections
                without fixed-point freezing.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>
                <strong className="text-[#4ade80]">No Mortality Modeled:</strong> Growth-only scenario projections. Mortality, disturbance, and climate
                change impacts are not included.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>
                <strong className="text-[#4ade80]">Results are Projections:</strong> These are scenario projections based on historical growth patterns,
                not exact forecasts. Actual outcomes may vary.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">Data Source</h2>
          <p className="text-[#4ade80]/70 leading-relaxed">
            Data comes from Pomfret School forest measurements across three plots (Upper, Middle, Lower).
            Measurements include:
          </p>
          <ul className="list-disc list-inside text-[#4ade80]/70 mt-2 space-y-1 ml-4">
            <li>TreeID: Unique tree identifier</li>
            <li>Plot: Forest plot location (Upper/Middle/Lower)</li>
            <li>Species: Tree species name</li>
            <li>DBH_cm: Diameter at breast height in centimeters</li>
            <li>Carbon: Derived carbon storage (kg C) using allometric equations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">Carbon Calculation</h2>
          <p className="text-[#4ade80]/70 leading-relaxed">
            Carbon storage is calculated from DBH using species-specific allometric equations.
            The equations classify trees into hardwood/softwood groups and apply appropriate biomass
            coefficients. Carbon is then derived as a fraction of aboveground biomass.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">CO2 Equivalent</h2>
          <p className="text-[#4ade80]/70 leading-relaxed">
            CO2 equivalent (CO2e) is calculated using the conversion factor: <strong className="text-[#4ade80]">1 kg C = 3.667 kg CO2e</strong>.
            This represents the amount of CO2 that would be equivalent to the carbon stored in the forest.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold gradient-text-subtle mb-3">Limitations</h2>
          <ul className="space-y-2 text-[#4ade80]/70">
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>No mortality or disturbance events are modeled</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>Simulation assumes consistent growth conditions</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>Climate change impacts are not included</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#4ade80] mr-2 neon-glow-subtle">•</span>
              <span>Results are projections based on historical growth patterns</span>
            </li>
          </ul>
        </section>

        <section className="pt-4 border-t border-[#1e293b]/50">
          <p className="text-sm text-[#4ade80]/50">
            <strong className="text-[#4ade80]">Pomfret School</strong> • Forest Carbon Project • {new Date().getFullYear()}
          </p>
        </section>
      </div>
    </div>
  )
}
