/**
 * API Client for Pomfret Forest Simulation
 * 
 * Typed fetch helpers for communicating with the FastAPI backend
 */

/** Live FastAPI base (local dev). Midterm GitHub Pages build sets NEXT_PUBLIC_MIDTERM_STATIC_FIRST and does not rely on this. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

// ============================================================================
// Type Definitions
// ============================================================================

export interface Summary {
  success: boolean
  years_ahead: number
  num_trees: number
  mean_dbh_cm: number
  total_carbon_kgC: number
  plot_breakdown: Record<string, { carbon_at_time: number; count: number }>
  species_breakdown: Record<string, number>
}

export interface PlantingGroup {
  plot: 'Upper' | 'Middle' | 'Lower'
  species: string
  dbh_cm: number
  count: number
}

export interface ScenarioRequest {
  mode?: string
  years_list: number[]
  plantings: PlantingGroup[]
}

export interface YearSummary {
  num_trees: number
  mean_dbh_cm: number
  total_carbon_kgC: number
}

export interface ScenarioResult {
  success: boolean
  baseline_by_year: Record<string, YearSummary>
  cohort_by_year: Record<string, YearSummary>
  scenario_by_year: Record<string, YearSummary>
  delta_by_year: Record<string, YearSummary>
}

export interface PredictTreeRequest {
  prev_dbh_cm: number
  species?: string | null
  plot: 'Upper' | 'Middle' | 'Lower'
  group_softw?: boolean | null
}

export interface PredictTreeResult {
  success: boolean
  prediction: {
    dbh_now_cm: number
    dbh_next_year_cm: number
    carbon_now_kg: number
    carbon_future_kg: number
    carbon_growth_kg: number
    carbon_growth_rate: number
    dbh_growth_cm: number
    dbh_growth_rate: number
  }
  inputs: {
    prev_dbh_cm: number
    species: string | null
    plot: string
    group_softw: boolean | null
  }
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch {
    throw new Error(
      `Cannot reach the backend server at ${API_BASE_URL}. ` +
      'Make sure the FastAPI backend is running (e.g. uvicorn src.api.app:app).'
    )
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `API error: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get list of available snapshot years
 */
export async function getAvailableYears(): Promise<number[]> {
  const data = await fetchAPI<{ success: boolean; years: number[] }>('/snapshots/years')
  return data.years
}

/**
 * Get summary metrics for a specific year
 */
export async function getSummary(yearsAhead: number, mode: string = 'baseline'): Promise<Summary> {
  return fetchAPI<Summary>(`/summary?years_ahead=${yearsAhead}&mode=${mode}`)
}

/**
 * Simulate a planting scenario
 */
export async function simulateScenario(request: ScenarioRequest): Promise<ScenarioResult> {
  return fetchAPI<ScenarioResult>('/scenario/simulate', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * @deprecated Use simulateScenario instead
 */
export async function postScenario(request: any): Promise<any> {
  return simulateScenario(request)
}

/**
 * Predict next-year DBH and carbon for a single tree
 */
export async function postPredictTree(request: PredictTreeRequest): Promise<PredictTreeResult> {
  return fetchAPI<PredictTreeResult>('/predict/tree', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Get model uncertainty summary
 */
export interface UncertaintySummary {
  success: boolean
  per_tree_stats: {
    median_co2e_sigma_kg_per_year: number
    p75_co2e_sigma_kg_per_year: number
    mean_co2e_sigma_kg_per_year: number
    median_equivalent_miles_per_year: number
    p75_equivalent_miles_per_year: number
  }
  forest_wide: {
    total_co2e_sigma_sum_kg_per_year: number
    total_co2e_sigma_rss_kg_per_year: number
    total_equivalent_miles_sum_per_year: number
    total_equivalent_miles_rss_per_year: number
  }
  n_trees: number
  methodology: {
    dbh_sigma_source: string
    carbon_conversion: string
    co2e_factor: number
    co2_per_mile_kg: number
  }
}

export async function getUncertaintySummary(): Promise<UncertaintySummary> {
  return fetchAPI<UncertaintySummary>('/uncertainty/summary')
}

/**
 * Area Scaling API
 */
export interface PlotAreas {
  success: boolean
  plot_areas: {
    Upper: { area_m2: number | null }
    Middle: { area_m2: number | null }
    Lower: { area_m2: number | null }
  }
}

export interface AreaDensities {
  success: boolean
  mode: string
  densities_by_horizon: Record<number, Record<string, any>>
  sequestration_rates: Record<string, Record<string, number | null>>
  aggregated: Record<string, { min: number; max: number; average: number }>
  plots_with_areas: string[]
}

export interface ScaleAreaRequest {
  mode: string
  target_area_m2: number
  reference: 'Upper' | 'Middle' | 'Lower' | 'Average' | 'Range'
}

export interface ScaleAreaResult {
  success: boolean
  mode: string
  target_area_m2: number
  reference: string
  results_by_horizon: Record<number, {
    total_carbon_kgC: number
    total_co2e_kg: number
    low?: { total_carbon_kgC: number; total_co2e_kg: number }
    high?: { total_carbon_kgC: number; total_co2e_kg: number }
  }>
  annual_sequestration: {
    kgC_per_year: number
    kgCO2e_per_year: number
    low?: { kgC_per_year: number; kgCO2e_per_year: number }
    high?: { kgC_per_year: number; kgCO2e_per_year: number }
  } | null
  metadata: any
}

export async function getPlotAreas(): Promise<PlotAreas> {
  return fetchAPI<PlotAreas>('/area/plot-areas')
}

export async function getAreaDensities(mode: string = 'baseline'): Promise<AreaDensities> {
  return fetchAPI<AreaDensities>(`/area/densities?mode=${mode}`)
}

export async function scaleArea(request: ScaleAreaRequest): Promise<ScaleAreaResult> {
  return fetchAPI<ScaleAreaResult>('/area/scale', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// ============================================================================
// Removal Options
// ============================================================================

export interface DbhBin {
  label: string
  min_dbh: number
  max_dbh: number | null
}

export interface RemovalBinOption {
  count: number
  min_dbh: number
  max_dbh: number
  mean_dbh: number
  mean_carbon: number
}

export interface RemovalOptions {
  success: boolean
  plot: string
  species: string
  bins: string[]
  options: Record<string, RemovalBinOption>
}

export async function getDbhBins(): Promise<DbhBin[]> {
  const response = await fetchAPI<{ success: boolean; bins: DbhBin[] }>('/removal/dbh-bins')
  return response.bins
}

export async function getRemovalOptions(plot: string, species: string): Promise<RemovalOptions> {
  return fetchAPI<RemovalOptions>(`/removal/options?plot=${encodeURIComponent(plot)}&species=${encodeURIComponent(species)}`)
}

// ============================================================================
// Planting DBH Bins
// ============================================================================

export interface PlantingDbhBin {
  label: string
  min_dbh: number
  max_dbh: number | null
  description: string
  midpoint: number
}

export interface PlantingDbhBinsResponse {
  success: boolean
  bins: PlantingDbhBin[]
}

export async function getPlantingDbhBins(): Promise<PlantingDbhBin[]> {
  const response = await fetchAPI<PlantingDbhBinsResponse>('/planting/dbh-bins')
  return response.bins
}

// ============================================================================
// Vector Forest — real snapshot data
// ============================================================================

export interface VectorForestTree {
  tree_id: number
  plot: string
  species: string
  dbh_cm: number
  carbon_kgC: number
}

export interface VectorForestSnapshot {
  success: boolean
  years_ahead: number
  plot_filter: string
  count: number
  plots: string[]
  trees: VectorForestTree[]
}

export async function getVectorForestSnapshot(
  yearsAhead: number,
  plot: string = 'all',
): Promise<VectorForestSnapshot> {
  return fetchAPI<VectorForestSnapshot>(
    `/vector-forest/snapshot?years_ahead=${yearsAhead}&plot=${encodeURIComponent(plot)}`,
  )
}
