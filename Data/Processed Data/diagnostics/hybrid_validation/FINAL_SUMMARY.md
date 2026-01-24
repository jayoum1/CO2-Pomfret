# Hybrid Model Validation Summary

Generated: 2026-01-23 21:34:46

---

## Stage 1: Baseline Curve Plausibility

- **Total groups evaluated:** 25
- **Groups with negative values:** 0 (0.0%)
- **Groups with >5% increases:** 19 (76.0%)
- **Groups with high-DBH increases:** 16 (64.0%)

⚠ **Warnings:** Some baseline curves show suspicious behavior.

## Stage 2: Residual ML Model Performance

- **RMSE:** 3.5568 cm/year
- **MAE:** 1.4879 cm/year
- **R²:** 0.0027
- **Bias:** 0.0025 cm/year
- **Mean Residual (Baseline Curve):** 0.0213 cm/year
- **Std Residual (Baseline-only RMSE):** 3.5615 cm/year
- **Baseline-only RMSE (predicting 0 residual):** 3.5616 cm/year
- **Test set size:** 524

⚠ **Warning:** Low R² suggests limited residual predictability.

### One-Step Model Comparison

Comparison of baseline-only, hybrid, and NN models on test set:

| Model | RMSE (Delta) | MAE (Delta) | RMSE (DBH) | MAE (DBH) |
|-------|--------------|-------------|------------|-----------|
| baseline_only | 3.5593 | 1.3998 | 3.5593 | 1.3998 |
| hybrid | 3.5534 | 1.5659 | 3.5856 | 1.5274 |
| nn | nan | nan | nan | nan |

- **Average clip rate:** 3.42%
- **Highest clip rate:** burning bush (30.8%)

## Stage 3: Multi-Step Backtesting

### Model Performance by Horizon

**1-Year Horizon:**
- Baseline-only RMSE: 4.7306 cm
- Baseline-only MAE: 1.5094 cm
- Hybrid RMSE: 4.6634 cm
- Hybrid MAE: 1.6035 cm
- Hybrid Bias: 0.2527 cm
- % with shrinkage before clamp: 23.4%

**2-Year Horizon:**
- Baseline-only RMSE: 5.0545 cm
- Baseline-only MAE: 1.7905 cm
- Hybrid RMSE: 5.0557 cm
- Hybrid MAE: 2.0169 cm
- Hybrid Bias: 0.3775 cm
- % with shrinkage before clamp: 25.3%

**3-Year Horizon:**
- Baseline-only RMSE: 5.1393 cm
- Baseline-only MAE: 1.8687 cm
- Hybrid RMSE: 5.2262 cm
- Hybrid MAE: 2.2477 cm
- Hybrid Bias: 0.5940 cm
- % with shrinkage before clamp: 26.1%

### Model Comparison

**1-Year Horizon:**
- Hybrid RMSE improvement vs baseline-only: 0.0673 cm (1.42%)

**2-Year Horizon:**
- Hybrid RMSE improvement vs baseline-only: -0.0012 cm (-0.02%)

**3-Year Horizon:**
- Hybrid RMSE improvement vs baseline-only: -0.0868 cm (-1.69%)

## Stage 4: Stability and Realism

⚠ No stability results available.

## Overall Assessment

⚠ **Issues Identified:**
- Baseline curves show suspicious increases at high DBH

## Conclusion: Baseline-Only vs Hybrid Model

**Average RMSE improvement (hybrid vs baseline-only) at horizons 2-3:** -0.86%

**Recommendation:** Default simulation to baseline-only model.
- Hybrid model provides <2% improvement over baseline-only at horizons 2-3.
- Keep residual ML model optional for users who want marginal improvements.
- Baseline-only model is simpler, faster, and more interpretable.

---

## Output Files

All detailed outputs are available in:
- CSV files: `Data/Processed Data/diagnostics/hybrid_validation/`
- Plots: `src/diagnostics/hybrid_validation/plots/`

