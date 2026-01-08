#!/usr/bin/env Rscript
# Load and combine forest simulation snapshots
# Reads all forest_*_years.csv files and combines into one dataset

library(readr)
library(dplyr)

# Set working directory to project root (assuming script is run from project root)
project_root <- getwd()
snapshots_dir <- file.path(project_root, "Data", "Processed Data", "forest_snapshots_nn_epsilon")
output_dir <- file.path(project_root, "reports", "r_visuals")

# Find all snapshot files
snapshot_files <- list.files(
  path = snapshots_dir,
  pattern = "forest_nn_\\d+_years\\.csv",
  full.names = TRUE
)

if (length(snapshot_files) == 0) {
  stop("No snapshot files found in: ", snapshots_dir)
}

cat("Found", length(snapshot_files), "snapshot files\n")

# Read and combine all snapshots
combined_data <- lapply(snapshot_files, function(file) {
  cat("Loading:", basename(file), "\n")
  read_csv(file, show_col_types = FALSE)
}) %>%
  bind_rows()

# Ensure proper column types
combined_data <- combined_data %>%
  mutate(
    years_ahead = as.integer(years_ahead),
    DBH_cm = as.numeric(DBH_cm),
    carbon_at_time = as.numeric(carbon_at_time),
    Plot = as.character(Plot),
    Species = as.character(Species),
    TreeID = as.character(TreeID)
  )

# Sort by years_ahead and TreeID for consistency
combined_data <- combined_data %>%
  arrange(years_ahead, TreeID)

# Save combined dataset
output_file <- file.path(output_dir, "combined_snapshots.csv")
write_csv(combined_data, output_file)

cat("\nCombined dataset saved to:", output_file, "\n")
cat("Total rows:", nrow(combined_data), "\n")
cat("Years ahead:", paste(sort(unique(combined_data$years_ahead)), collapse = ", "), "\n")
cat("Unique trees:", length(unique(combined_data$TreeID)), "\n")
cat("Unique species:", length(unique(combined_data$Species)), "\n")
cat("Unique plots:", length(unique(combined_data$Plot)), "\n")

