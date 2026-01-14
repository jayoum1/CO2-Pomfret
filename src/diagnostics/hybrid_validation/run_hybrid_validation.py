"""
Hybrid Model Validation Suite - Main Entry Point

Runs all validation stages and generates final summary report.
"""

import sys
from pathlib import Path
import pandas as pd
from datetime import datetime

# Add src directory to path (same pattern as train_hybrid_model.py)
# File is at: src/diagnostics/hybrid_validation/run_hybrid_validation.py
# Need to add: project_root/src to path
# Path(__file__).parent.parent.parent.parent = project_root
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root / "src"))

from config import PROCESSED_DATA_DIR, ensure_dir

# Import validation modules
from diagnostics.hybrid_validation import baseline_checks
from diagnostics.hybrid_validation import residual_checks
from diagnostics.hybrid_validation import backtesting
from diagnostics.hybrid_validation import stability_checks


def generate_final_summary(
    baseline_quality_df,
    residual_metrics,
    residual_clip_df,
    backtest_metrics_df,
    backtest_comparison_df,
    stability_results,
    outdir: Path
):
    """
    Generate final summary markdown report.
    
    Parameters
    ----------
    baseline_quality_df : pd.DataFrame
        Baseline quality metrics
    residual_metrics : dict
        Residual model metrics
    residual_clip_df : pd.DataFrame
        Residual clip rates
    backtest_metrics_df : pd.DataFrame
        Backtest metrics
    backtest_comparison_df : pd.DataFrame
        Backtest comparison (hybrid vs NN)
    stability_results : dict
        Stability analysis results
    outdir : Path
        Output directory
    """
    summary_path = outdir / "FINAL_SUMMARY.md"
    
    with open(summary_path, 'w') as f:
        f.write("# Hybrid Model Validation Summary\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
        
        # Stage 1: Baseline Plausibility
        f.write("## Stage 1: Baseline Curve Plausibility\n\n")
        
        if baseline_quality_df is not None and len(baseline_quality_df) > 0:
            n_groups = len(baseline_quality_df)
            n_negative = (baseline_quality_df['pct_negative'] > 0).sum()
            n_increases = (baseline_quality_df['pct_increases'] > 5).sum()
            n_high_increases = (baseline_quality_df['n_high_dbh_increases'] > 5).sum()
            
            f.write(f"- **Total groups evaluated:** {n_groups}\n")
            f.write(f"- **Groups with negative values:** {n_negative} ({n_negative/n_groups*100:.1f}%)\n")
            f.write(f"- **Groups with >5% increases:** {n_increases} ({n_increases/n_groups*100:.1f}%)\n")
            f.write(f"- **Groups with high-DBH increases:** {n_high_increases} ({n_high_increases/n_groups*100:.1f}%)\n\n")
            
            if n_negative > 0 or n_high_increases > 5:
                f.write("⚠ **Warnings:** Some baseline curves show suspicious behavior.\n\n")
            else:
                f.write("✓ **Status:** Baseline curves appear plausible.\n\n")
        else:
            f.write("⚠ No baseline quality data available.\n\n")
        
        # Stage 2: Residual Performance
        f.write("## Stage 2: Residual ML Model Performance\n\n")
        
        if residual_metrics:
            f.write(f"- **RMSE:** {residual_metrics['rmse']:.4f} cm/year\n")
            f.write(f"- **MAE:** {residual_metrics['mae']:.4f} cm/year\n")
            f.write(f"- **R²:** {residual_metrics['r2']:.4f}\n")
            f.write(f"- **Bias:** {residual_metrics['bias']:.4f} cm/year\n")
            f.write(f"- **Test set size:** {residual_metrics['n_test']}\n\n")
            
            if residual_metrics['r2'] < 0:
                f.write("⚠ **Warning:** Negative R² indicates poor residual prediction.\n\n")
            elif residual_metrics['r2'] < 0.1:
                f.write("⚠ **Warning:** Low R² suggests limited residual predictability.\n\n")
            else:
                f.write("✓ **Status:** Residual model performance acceptable.\n\n")
        else:
            f.write("⚠ No residual metrics available.\n\n")
        
        if residual_clip_df is not None and len(residual_clip_df) > 0:
            avg_clip_rate = residual_clip_df['pct_clipped'].mean()
            f.write(f"- **Average clip rate:** {avg_clip_rate:.2f}%\n")
            max_clip_species = residual_clip_df.loc[residual_clip_df['pct_clipped'].idxmax()]
            f.write(f"- **Highest clip rate:** {max_clip_species['Species']} ({max_clip_species['pct_clipped']:.1f}%)\n\n")
        
        # Stage 3: Backtesting
        f.write("## Stage 3: Multi-Step Backtesting\n\n")
        
        if backtest_metrics_df is not None and len(backtest_metrics_df) > 0:
            f.write("### Hybrid Model Performance\n\n")
            for _, row in backtest_metrics_df.iterrows():
                horizon = int(row['horizon'])
                f.write(f"**{horizon}-Year Horizon:**\n")
                f.write(f"- RMSE: {row['hybrid_rmse']:.4f} cm\n")
                f.write(f"- MAE: {row['hybrid_mae']:.4f} cm\n")
                f.write(f"- Bias: {row['hybrid_bias']:.4f} cm\n")
                f.write(f"- % with shrinkage before clamp: {row['hybrid_pct_shrink']:.1f}%\n\n")
            
            if backtest_comparison_df is not None and len(backtest_comparison_df) > 0:
                f.write("### Hybrid vs NN Comparison\n\n")
                for _, row in backtest_comparison_df.iterrows():
                    horizon = int(row['horizon'])
                    f.write(f"**{horizon}-Year Horizon:**\n")
                    f.write(f"- Hybrid RMSE: {row['hybrid_rmse']:.4f} cm\n")
                    f.write(f"- NN RMSE: {row['nn_rmse']:.4f} cm\n")
                    f.write(f"- RMSE improvement: {row['rmse_improvement']:.4f} cm\n\n")
        else:
            f.write("⚠ No backtest data available.\n\n")
        
        # Stage 4: Stability
        f.write("## Stage 4: Stability and Realism\n\n")
        
        if stability_results:
            f.write(f"- **Initial mean DBH:** {stability_results['initial_mean_dbh']:.2f} cm\n")
            f.write(f"- **Final mean DBH (20 years):** {stability_results['final_mean_dbh']:.2f} cm\n")
            f.write(f"- **Mean DBH change:** {stability_results['mean_dbh_change']:.2f} cm\n")
            f.write(f"- **Average clamp rate:** {stability_results['avg_clamp_rate']:.1f}%\n")
            f.write(f"- **% plateaued by year 20:** {stability_results['pct_plateaued']:.1f}%\n\n")
            
            if stability_results['pct_plateaued'] > 25:
                f.write("⚠ **Warning:** High plateau rate may indicate fixed-point behavior.\n\n")
            elif stability_results['pct_plateaued'] > 10:
                f.write("⚠ **Caution:** Moderate plateau rate observed.\n\n")
            else:
                f.write("✓ **Status:** Low plateau rate indicates good stability.\n\n")
        else:
            f.write("⚠ No stability results available.\n\n")
        
        # Overall Assessment
        f.write("## Overall Assessment\n\n")
        
        # Count issues
        issues = []
        if baseline_quality_df is not None:
            if (baseline_quality_df['pct_negative'] > 0).sum() > 0:
                issues.append("Baseline curves have negative values")
            if (baseline_quality_df['n_high_dbh_increases'] > 5).sum() > 5:
                issues.append("Baseline curves show suspicious increases at high DBH")
        
        if residual_metrics and residual_metrics['r2'] < 0:
            issues.append("Residual model has negative R²")
        
        if stability_results and stability_results['pct_plateaued'] > 25:
            issues.append("High plateau rate in long-term simulation")
        
        if issues:
            f.write("⚠ **Issues Identified:**\n")
            for issue in issues:
                f.write(f"- {issue}\n")
            f.write("\n")
        else:
            f.write("✓ **Status:** No major issues identified. Model appears ready for use.\n\n")
        
        f.write("---\n\n")
        f.write("## Output Files\n\n")
        f.write("All detailed outputs are available in:\n")
        f.write("- CSV files: `Data/Processed Data/diagnostics/hybrid_validation/`\n")
        f.write("- Plots: `src/diagnostics/hybrid_validation/plots/`\n\n")
    
    print(f"\n✓ Saved final summary: {summary_path}")


def main():
    """
    Main execution function.
    """
    print("="*70)
    print("HYBRID MODEL VALIDATION SUITE")
    print("="*70)
    
    # Set up output directory
    outdir = PROCESSED_DATA_DIR / "diagnostics" / "hybrid_validation"
    ensure_dir(outdir)
    ensure_dir(outdir / "plots")
    
    print(f"\nOutput directory: {outdir}")
    
    results = {}
    
    try:
        # Stage 1: Baseline checks
        print("\n" + "="*70)
        baseline_quality_df = baseline_checks.run_baseline_checks(outdir)
        results['baseline'] = baseline_quality_df
    except Exception as e:
        print(f"\n⚠ Error in baseline checks: {e}")
        import traceback
        traceback.print_exc()
        results['baseline'] = None
    
    try:
        # Stage 2: Residual checks
        print("\n" + "="*70)
        residual_metrics, residual_clip_df = residual_checks.run_residual_checks(outdir, retrain=False)
        results['residual_metrics'] = residual_metrics
        results['residual_clip'] = residual_clip_df
    except Exception as e:
        print(f"\n⚠ Error in residual checks: {e}")
        import traceback
        traceback.print_exc()
        results['residual_metrics'] = None
        results['residual_clip'] = None
    
    try:
        # Stage 3: Backtesting
        print("\n" + "="*70)
        backtest_metrics_df, backtest_comparison_df = backtesting.run_backtesting(outdir)
        results['backtest_metrics'] = backtest_metrics_df
        results['backtest_comparison'] = backtest_comparison_df
    except Exception as e:
        print(f"\n⚠ Error in backtesting: {e}")
        import traceback
        traceback.print_exc()
        results['backtest_metrics'] = None
        results['backtest_comparison'] = None
    
    try:
        # Stage 4: Stability checks
        print("\n" + "="*70)
        stability_results = stability_checks.run_stability_analysis(outdir)
        results['stability'] = stability_results
    except Exception as e:
        print(f"\n⚠ Error in stability checks: {e}")
        import traceback
        traceback.print_exc()
        results['stability'] = None
    
    # Generate final summary
    print("\n" + "="*70)
    print("GENERATING FINAL SUMMARY")
    print("="*70)
    
    generate_final_summary(
        results.get('baseline'),
        results.get('residual_metrics'),
        results.get('residual_clip'),
        results.get('backtest_metrics'),
        results.get('backtest_comparison'),
        results.get('stability'),
        outdir
    )
    
    print("\n" + "="*70)
    print("VALIDATION COMPLETE")
    print("="*70)
    print(f"\nAll outputs saved to: {outdir}")
    print(f"Final summary: {outdir / 'FINAL_SUMMARY.md'}")


if __name__ == "__main__":
    main()
