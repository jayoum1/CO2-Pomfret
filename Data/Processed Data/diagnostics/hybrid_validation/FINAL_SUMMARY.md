# Hybrid Model Validation Summary

Generated: 2026-01-14 10:10:14

---

## Stage 1: Baseline Curve Plausibility

- **Total groups evaluated:** 25
- **Groups with negative values:** 0 (0.0%)
- **Groups with >5% increases:** 19 (76.0%)
- **Groups with high-DBH increases:** 17 (68.0%)

⚠ **Warnings:** Some baseline curves show suspicious behavior.

## Stage 2: Residual ML Model Performance

- **RMSE:** 3.5647 cm/year
- **MAE:** 1.4834 cm/year
- **R²:** -0.0018
- **Bias:** -0.0004 cm/year
- **Test set size:** 524

⚠ **Warning:** Negative R² indicates poor residual prediction.

- **Average clip rate:** 4.08%
- **Highest clip rate:** burning bush (30.8%)

## Stage 3: Multi-Step Backtesting

### Hybrid Model Performance

**1-Year Horizon:**
- RMSE: 4.6625 cm
- MAE: 1.5989 cm
- Bias: 0.2457 cm
- % with shrinkage before clamp: 21.3%

**2-Year Horizon:**
- RMSE: 5.0612 cm
- MAE: 2.0024 cm
- Bias: 0.3536 cm
- % with shrinkage before clamp: 22.8%

**3-Year Horizon:**
- RMSE: 5.2149 cm
- MAE: 2.2158 cm
- Bias: 0.5660 cm
- % with shrinkage before clamp: 24.5%

### Hybrid vs NN Comparison

**1-Year Horizon:**
- Hybrid RMSE: 4.6625 cm
- NN RMSE: 5.1710 cm
- RMSE improvement: 0.5085 cm

**2-Year Horizon:**
- Hybrid RMSE: 5.0612 cm
- NN RMSE: 6.2991 cm
- RMSE improvement: 1.2379 cm

**3-Year Horizon:**
- Hybrid RMSE: 5.2149 cm
- NN RMSE: 7.1532 cm
- RMSE improvement: 1.9383 cm

## Stage 4: Stability and Realism

- **Initial mean DBH:** 21.37 cm
- **Final mean DBH (20 years):** 25.28 cm
- **Mean DBH change:** 3.92 cm
- **Average clamp rate:** 37.8%
- **% plateaued by year 20:** 44.6%

⚠ **Warning:** High plateau rate may indicate fixed-point behavior.

## Overall Assessment

⚠ **Issues Identified:**
- Baseline curves show suspicious increases at high DBH
- Residual model has negative R²
- High plateau rate in long-term simulation

---

## Output Files

All detailed outputs are available in:
- CSV files: `Data/Processed Data/diagnostics/hybrid_validation/`
- Plots: `src/diagnostics/hybrid_validation/plots/`

