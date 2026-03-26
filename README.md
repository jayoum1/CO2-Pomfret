# CO2 Pomfret Project

Integrated forest carbon and school emissions project for Pomfret School.

## Overview

This project combines two connected tracks:

- **Forest track**: estimate tree growth and carbon absorption over time from DBH-based baseline growth logic.
- **School operations track**: estimate annual school CO2 emissions from energy and fuel usage data.

The goal is to compare **estimated school emissions** against **estimated forest carbon absorption capacity** in one workflow.

## Current Model Approach

The current forest model is a **baseline growth-curve simulation**, not a neural network system.

- Tree state is updated from DBH-oriented growth assumptions.
- Carbon estimates are derived from forestry/allometric logic.
- Disturbance scenarios (for visualization and experimentation) can be layered onto baseline states.
- The interactive web app focuses on clear, inspectable behavior rather than opaque model complexity.

## Spring Term Implementation Plan (School Side)

For the spring term, this repository will integrate a school emissions pipeline using already collected school-side data:

- Fossil methane
- Propane
- Fuel oil
- Diesel
- Gasoline
- On-site PV solar electricity generation
- General electricity use
- Renewable Energy Certificate (REC) purchases

Planned outputs:

- Standardized emissions estimates by source and time period
- Aggregated school-side emissions totals
- Comparative view of school emissions versus forest absorption capacity

## Key Features in the Current Project

- Vector Forest interactive page with year slider and tree inspection
- Baseline tree growth and carbon state progression
- Disturbance scenario framework for comparative visualization
- Modular data/analysis structure in Python for reproducible processing
- Next.js web interface for exploration and communication

## Repository Structure (High Level)

```
CO2-Pomfret/
├── Data/            # Raw and processed datasets
├── src/             # Python processing and analysis code
├── web/             # Next.js frontend (Vector Forest and pages)
├── docs/            # Project documentation
├── Models/          # Saved model artifacts (as needed)
└── README.md
```

## Getting Started

### 1) Clone

```bash
git clone https://github.com/jayoum1/CO2-Pomfret.git
cd CO2-Pomfret
```

### 2) Python environment (data pipeline work)

```bash
pip install -r requirements.txt
```

### 3) Web app

```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Data Scope

- Forest inventory and growth-related data (DBH-centered)
- School operational energy/fuel data for emissions accounting
- Scenario metadata and visualization assets

## Near-Term Roadmap

- [ ] Implement school emissions ingestion and normalization pipeline
- [ ] Add source-specific CO2 conversion and aggregation modules
- [ ] Build school emissions vs forest absorption comparison outputs
- [ ] Surface comparison metrics in the web interface
- [ ] Improve documentation for assumptions and boundaries

## Author

Jay Youm

