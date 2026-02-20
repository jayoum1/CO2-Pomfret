# ==============================================================================
# DBH Growth Curve Visualization (Vector Forest Simulation)
# ==============================================================================
# Plots the growth curve used to simulate future DBH in the Vector Forest app.
# Formula: DBH(year) = clamp(dbh0 + growthRate * year, 1, 200) [cm]
# Parameters match the app: dbh0 in [8, 35] cm, growthRate in [0.2, 0.8] cm/yr.
# ==============================================================================

# Load packages (optional: source("R/setup_packages.R") if you use it)
library(ggplot2)
library(dplyr)
library(tidyr)
library(purrr)

# ==============================================================================
# Growth model (matches web/src/lib/vectorForest/treeModel.ts)
# ==============================================================================

# DBH at a given year (linear growth, clamped to [1, 200] cm)
dbh_at_year <- function(dbh0, growth_rate, year) {
  dbh <- dbh0 + growth_rate * year
  pmax(1, pmin(200, dbh))
}

# ==============================================================================
# Example trees (range of dbh0 and growthRate as in Vector Forest)
# ==============================================================================

years <- 0:30

examples <- tibble(
  label = c(
    "Small, slow (dbh0=10, r=0.3)",
    "Small, fast (dbh0=10, r=0.7)",
    "Medium (dbh0=22, r=0.5)",
    "Large, slow (dbh0=32, r=0.3)",
    "Large, fast (dbh0=32, r=0.7)"
  ),
  dbh0 = c(10, 10, 22, 32, 32),
  growth_rate = c(0.3, 0.7, 0.5, 0.3, 0.7)
)

curve_data <- examples %>%
  purrr::pmap_dfr(function(label, dbh0, growth_rate) {
    tibble(
      label = label,
      year = years,
      dbh = dbh_at_year(dbh0, growth_rate, years)
    )
  })

# ==============================================================================
# Plot
# ==============================================================================

p <- ggplot(curve_data, aes(x = year, y = dbh, color = label, linetype = label)) +
  geom_line(linewidth = 1) +
  geom_hline(yintercept = 200, linetype = "dashed", color = "gray50", linewidth = 0.5) +
  annotate("text", x = max(years) * 0.7, y = 198, label = "cap at 200 cm", size = 3, color = "gray40") +
  scale_color_brewer(palette = "Set1") +
  scale_linetype_manual(values = c("solid", "solid", "solid", "dashed", "dashed")) +
  labs(
    title = "DBH Growth Curves Used in Vector Forest Simulation",
    subtitle = "Linear model: DBH(year) = dbh0 + growthRate * year, clamped to [1, 200] cm",
    x = "Year",
    y = "DBH (cm)",
    color = "Example tree",
    linetype = "Example tree"
  ) +
  theme(
    legend.position = "right",
    legend.key.width = unit(1.2, "cm"),
    plot.subtitle = element_text(size = 10, color = "gray40")
  ) +
  coord_cartesian(ylim = c(0, NA))

# Save
plots_dir <- "plots"
if (!dir.exists(plots_dir)) dir.create(plots_dir, recursive = TRUE)
out_path <- file.path(plots_dir, "vector_forest_growth_curve.png")
ggsave(out_path, p, width = 9, height = 5, dpi = 150, bg = "white")
message("Saved: ", out_path)
