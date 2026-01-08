#!/usr/bin/env Rscript
# Generate visualization plots from combined snapshots
# Creates 5 high-quality plots for project report

library(readr)
library(dplyr)
library(tidyr)
library(ggplot2)

# Set working directory to project root
project_root <- getwd()
data_file <- file.path(project_root, "reports", "r_visuals", "combined_snapshots.csv")
output_dir <- file.path(project_root, "reports", "r_visuals", "figures")

# Create output directory if it doesn't exist
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

# Load combined data
cat("Loading combined snapshots...\n")
data <- read_csv(data_file, show_col_types = FALSE)

# Set consistent theme with white backgrounds
theme_set(theme_minimal(base_size = 12) +
  theme(
    plot.title = element_text(size = 14, face = "bold", hjust = 0.5),
    plot.subtitle = element_text(size = 11, hjust = 0.5),
    axis.title = element_text(size = 11),
    legend.position = "bottom",
    panel.grid.minor = element_blank(),
    panel.background = element_rect(fill = "white", color = NA),
    plot.background = element_rect(fill = "white", color = NA)
  ))

# --- Plot A: Total Carbon vs Years ---
cat("Creating Plot A: Total Carbon vs Years...\n")
plot_a_data <- data %>%
  group_by(years_ahead) %>%
  summarise(total_carbon = sum(carbon_at_time, na.rm = TRUE), .groups = "drop")

plot_a <- ggplot(plot_a_data, aes(x = years_ahead, y = total_carbon)) +
  geom_line(linewidth = 1.2, color = "#2E86AB") +
  geom_point(size = 3, color = "#2E86AB") +
  labs(
    title = "Total Forest Carbon Over Time",
    x = "Years Ahead",
    y = "Total Carbon (kg C)",
    subtitle = "Epsilon simulation mode"
  ) +
  scale_y_continuous(labels = scales::comma)

ggsave(
  filename = file.path(output_dir, "total_carbon_vs_years.png"),
  plot = plot_a,
  width = 8,
  height = 6,
  dpi = 300,
  bg = "white"
)

# --- Plot B: Mean DBH vs Years ---
cat("Creating Plot B: Mean DBH vs Years...\n")
plot_b_data <- data %>%
  group_by(years_ahead) %>%
  summarise(mean_dbh = mean(DBH_cm, na.rm = TRUE), .groups = "drop")

plot_b <- ggplot(plot_b_data, aes(x = years_ahead, y = mean_dbh)) +
  geom_line(linewidth = 1.2, color = "#A23B72") +
  geom_point(size = 3, color = "#A23B72") +
  labs(
    title = "Mean DBH Over Time",
    x = "Years Ahead",
    y = "Mean DBH (cm)",
    subtitle = "Epsilon simulation mode"
  )

ggsave(
  filename = file.path(output_dir, "mean_dbh_vs_years.png"),
  plot = plot_b,
  width = 8,
  height = 6,
  dpi = 300,
  bg = "white"
)

# --- Plot C: DBH Distribution Over Time ---
cat("Creating Plot C: DBH Distribution Over Time...\n")
plot_c_data <- data %>%
  filter(years_ahead %in% c(0, 5, 10, 20)) %>%
  mutate(years_label = paste0(years_ahead, " years"))

plot_c <- ggplot(plot_c_data, aes(x = DBH_cm)) +
  geom_density(fill = "#F18F01", alpha = 0.6, color = "#C73E1D", linewidth = 0.8) +
  facet_wrap(~years_label, ncol = 2) +
  labs(
    title = "DBH Distribution Over Time",
    x = "DBH (cm)",
    y = "Density",
    subtitle = "Epsilon simulation mode"
  )

ggsave(
  filename = file.path(output_dir, "dbh_distribution_by_year.png"),
  plot = plot_c,
  width = 10,
  height = 8,
  dpi = 300,
  bg = "white"
)

# --- Plot D: Species Contribution to Carbon (Stacked) ---
cat("Creating Plot D: Species Contribution to Carbon...\n")

# Get top 8 species by carbon at year 0
top_species <- data %>%
  filter(years_ahead == 0) %>%
  group_by(Species) %>%
  summarise(total_carbon = sum(carbon_at_time, na.rm = TRUE), .groups = "drop") %>%
  arrange(desc(total_carbon)) %>%
  slice_head(n = 8) %>%
  pull(Species)

plot_d_data <- data %>%
  filter(Species %in% top_species) %>%
  group_by(years_ahead, Species) %>%
  summarise(total_carbon = sum(carbon_at_time, na.rm = TRUE), .groups = "drop") %>%
  mutate(Species = factor(Species, levels = top_species))

plot_d <- ggplot(plot_d_data, aes(x = years_ahead, y = total_carbon, fill = Species)) +
  geom_area(position = "stack", alpha = 0.8) +
  labs(
    title = "Species Contribution to Total Carbon Over Time",
    x = "Years Ahead",
    y = "Total Carbon (kg C)",
    fill = "Species",
    subtitle = "Top 8 species by carbon at baseline (epsilon simulation mode)"
  ) +
  scale_y_continuous(labels = scales::comma) +
  scale_fill_viridis_d(option = "plasma")

ggsave(
  filename = file.path(output_dir, "species_carbon_over_time.png"),
  plot = plot_d,
  width = 10,
  height = 6,
  dpi = 300,
  bg = "white"
)

# --- Plot E: Plot-level Comparison ---
cat("Creating Plot E: Plot-level Comparison...\n")
plot_e_data <- data %>%
  group_by(years_ahead, Plot) %>%
  summarise(total_carbon = sum(carbon_at_time, na.rm = TRUE), .groups = "drop")

plot_e <- ggplot(plot_e_data, aes(x = years_ahead, y = total_carbon, color = Plot)) +
  geom_line(linewidth = 1.2) +
  geom_point(size = 3) +
  labs(
    title = "Total Carbon by Plot Over Time",
    x = "Years Ahead",
    y = "Total Carbon (kg C)",
    color = "Plot",
    subtitle = "Epsilon simulation mode"
  ) +
  scale_y_continuous(labels = scales::comma) +
  scale_color_manual(values = c("Upper" = "#2E86AB", "Middle" = "#A23B72", "Lower" = "#F18F01"))

ggsave(
  filename = file.path(output_dir, "carbon_by_plot_over_time.png"),
  plot = plot_e,
  width = 8,
  height = 6,
  dpi = 300,
  bg = "white"
)

cat("\nAll plots saved to:", output_dir, "\n")
cat("Generated plots:\n")
cat("  - total_carbon_vs_years.png\n")
cat("  - mean_dbh_vs_years.png\n")
cat("  - dbh_distribution_by_year.png\n")
cat("  - species_carbon_over_time.png\n")
cat("  - carbon_by_plot_over_time.png\n")

