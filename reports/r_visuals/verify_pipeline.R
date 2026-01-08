#!/usr/bin/env Rscript
# Quick verification script to check pipeline outputs

project_root <- getwd()
combined_file <- file.path(project_root, "reports", "r_visuals", "combined_snapshots.csv")
figures_dir <- file.path(project_root, "reports", "r_visuals", "figures")

expected_plots <- c(
  "total_carbon_vs_years.png",
  "mean_dbh_vs_years.png",
  "dbh_distribution_by_year.png",
  "species_carbon_over_time.png",
  "carbon_by_plot_over_time.png"
)

cat("=== R Visualization Pipeline Verification ===\n\n")

# Check combined dataset
if (file.exists(combined_file)) {
  cat("✓ Combined dataset exists:", combined_file, "\n")
  data <- readr::read_csv(combined_file, show_col_types = FALSE)
  cat("  Rows:", nrow(data), "\n")
  cat("  Years ahead:", paste(sort(unique(data$years_ahead)), collapse = ", "), "\n")
} else {
  cat("✗ Combined dataset missing:", combined_file, "\n")
}

cat("\n")

# Check plots
cat("Plot files:\n")
all_exist <- TRUE
for (plot_file in expected_plots) {
  plot_path <- file.path(figures_dir, plot_file)
  if (file.exists(plot_path)) {
    file_size <- file.info(plot_path)$size / 1024  # KB
    cat("  ✓", plot_file, sprintf("(%.1f KB)\n", file_size))
  } else {
    cat("  ✗", plot_file, "MISSING\n")
    all_exist <- FALSE
  }
}

cat("\n")
if (all_exist && file.exists(combined_file)) {
  cat("✓ All pipeline outputs verified successfully!\n")
} else {
  cat("✗ Some files are missing. Please run:\n")
  cat("  Rscript reports/r_visuals/load_snapshots.R\n")
  cat("  Rscript reports/r_visuals/make_plots.R\n")
}

