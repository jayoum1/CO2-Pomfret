#!/usr/bin/env Rscript
# Visualize species statistics for Forest Modification UI refinement
# Generates comprehensive graphs showing species distribution, data quality, and recommendations

library(ggplot2)
library(dplyr)
library(readr)
library(tidyr)
library(scales)

# Set working directory
project_root <- getwd()
data_dir <- file.path(project_root, "Data", "Processed Data", "diagnostics")
output_dir <- file.path(project_root, "Graphs", "Species_Analysis")
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

# Load data
species_summary <- read_csv(file.path(data_dir, "species_summary_for_ui.csv"), show_col_types = FALSE)
plot_dist <- read_csv(file.path(data_dir, "species_plot_distribution.csv"), show_col_types = FALSE)

cat("Loaded", nrow(species_summary), "species\n")

# Color palette
colors_teal <- c("#14b8a6", "#0d9488", "#ccfbf1")
colors_green <- c("#10b8a6", "#059669", "#d1fae5")
colors_accent <- c("#3b82f6", "#2563eb", "#dbeafe")

# 1. Species by number of trees (bar chart)
p1 <- species_summary %>%
  arrange(desc(n_trees)) %>%
  mutate(Species = factor(Species, levels = Species)) %>%
  ggplot(aes(x = Species, y = n_trees, fill = recommended_for_ui)) +
  geom_bar(stat = "identity") +
  scale_fill_manual(values = c("FALSE" = "#94a3b8", "TRUE" = "#14b8a6"),
                    labels = c("FALSE" = "Not Recommended", "TRUE" = "Recommended"),
                    name = "UI Status") +
  labs(title = "Number of Trees by Species",
       subtitle = "Recommended species have ≥5 trees and baseline growth curves",
       x = "Species",
       y = "Number of Trees",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    axis.text.x = element_text(angle = 45, hjust = 1, size = 9),
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "bottom"
  ) +
  geom_hline(yintercept = 5, linetype = "dashed", color = "#ef4444", alpha = 0.5) +
  annotate("text", x = length(unique(species_summary$Species)) * 0.9, y = 5.5, 
           label = "Minimum threshold (5 trees)", size = 3, color = "#ef4444")

ggsave(file.path(output_dir, "1_species_by_tree_count.png"), p1, 
       width = 14, height = 8, dpi = 300, bg = "white")
cat("Saved: 1_species_by_tree_count.png\n")

# 2. Species by number of records (bar chart)
p2 <- species_summary %>%
  arrange(desc(n_records)) %>%
  mutate(Species = factor(Species, levels = Species)) %>%
  ggplot(aes(x = Species, y = n_records, fill = has_baseline_curve)) +
  geom_bar(stat = "identity") +
  scale_fill_manual(values = c("FALSE" = "#fbbf24", "TRUE" = "#10b981"),
                    labels = c("FALSE" = "No Curve", "TRUE" = "Has Curve"),
                    name = "Baseline Curve") +
  labs(title = "Number of Measurement Records by Species",
       subtitle = "More records = better temporal coverage for growth modeling",
       x = "Species",
       y = "Number of Records",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    axis.text.x = element_text(angle = 45, hjust = 1, size = 9),
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "bottom"
  )

ggsave(file.path(output_dir, "2_species_by_record_count.png"), p2, 
       width = 14, height = 8, dpi = 300, bg = "white")
cat("Saved: 2_species_by_record_count.png\n")

# 3. DBH range by species (boxplot-style visualization)
p3 <- species_summary %>%
  arrange(desc(n_trees)) %>%
  mutate(Species = factor(Species, levels = Species)) %>%
  ggplot() +
  geom_segment(aes(x = Species, xend = Species, y = dbh_min, yend = dbh_max, 
                   color = recommended_for_ui), size = 2, alpha = 0.7) +
  geom_point(aes(x = Species, y = dbh_mean, fill = recommended_for_ui), 
             shape = 21, size = 3, color = "white", stroke = 1) +
  scale_color_manual(values = c("FALSE" = "#94a3b8", "TRUE" = "#14b8a6"),
                     name = "Recommended") +
  scale_fill_manual(values = c("FALSE" = "#94a3b8", "TRUE" = "#14b8a6"),
                    name = "Recommended") +
  labs(title = "DBH Range by Species",
       subtitle = "Line shows min-max range, point shows mean DBH",
       x = "Species",
       y = "DBH (cm)",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    axis.text.x = element_text(angle = 45, hjust = 1, size = 9),
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "bottom"
  )

ggsave(file.path(output_dir, "3_dbh_range_by_species.png"), p3, 
       width = 14, height = 8, dpi = 300, bg = "white")
cat("Saved: 3_dbh_range_by_species.png\n")

# 4. Species distribution across plots (heatmap)
p4 <- plot_dist %>%
  filter(n_trees > 0) %>%
  mutate(Species = factor(Species)) %>%
  ggplot(aes(x = Plot, y = Species, fill = n_trees)) +
  geom_tile(color = "white", size = 0.5) +
  scale_fill_gradient(low = "#e0f2fe", high = "#0d9488", 
                      name = "Number\nof Trees",
                      trans = "sqrt") +
  labs(title = "Species Distribution Across Plots",
       subtitle = "Heatmap showing number of trees per species in each plot",
       x = "Plot",
       y = "Species",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    axis.text.y = element_text(size = 8),
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "right"
  )

ggsave(file.path(output_dir, "4_species_plot_heatmap.png"), p4, 
       width = 10, height = 12, dpi = 300, bg = "white")
cat("Saved: 4_species_plot_heatmap.png\n")

# 5. Data quality scatter: Trees vs Records, colored by recommendation
p5 <- species_summary %>%
  ggplot(aes(x = n_trees, y = n_records, 
             color = recommended_for_ui, 
             size = has_baseline_curve,
             label = Species)) +
  geom_point(alpha = 0.7) +
  geom_text(aes(label = ifelse(n_trees >= 20 | n_records >= 100, Species, "")), 
            hjust = -0.1, vjust = 0.5, size = 3, show.legend = FALSE) +
  scale_color_manual(values = c("FALSE" = "#fbbf24", "TRUE" = "#10b981"),
                     labels = c("FALSE" = "Not Recommended", "TRUE" = "Recommended"),
                     name = "UI Status") +
  scale_size_manual(values = c("FALSE" = 3, "TRUE" = 5),
                    labels = c("FALSE" = "No Curve", "TRUE" = "Has Curve"),
                    name = "Baseline Curve") +
  labs(title = "Species Data Quality Assessment",
       subtitle = "Recommended species: ≥5 trees AND baseline growth curves",
       x = "Number of Trees",
       y = "Number of Records",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "right"
  ) +
  geom_vline(xintercept = 5, linetype = "dashed", color = "#ef4444", alpha = 0.3) +
  scale_x_log10() +
  scale_y_log10()

ggsave(file.path(output_dir, "5_data_quality_scatter.png"), p5, 
       width = 12, height = 8, dpi = 300, bg = "white")
cat("Saved: 5_data_quality_scatter.png\n")

# 6. Recommended vs Not Recommended comparison
recommended_summary <- species_summary %>%
  group_by(recommended_for_ui) %>%
  summarise(
    n_species = n(),
    total_trees = sum(n_trees),
    total_records = sum(n_records),
    avg_trees_per_species = mean(n_trees),
    avg_records_per_species = mean(n_records),
    .groups = "drop"
  )

p6 <- recommended_summary %>%
  pivot_longer(cols = c(total_trees, total_records), 
               names_to = "metric", values_to = "value") %>%
  mutate(metric = ifelse(metric == "total_trees", "Total Trees", "Total Records"),
         recommended_for_ui = ifelse(recommended_for_ui, "Recommended", "Not Recommended")) %>%
  ggplot(aes(x = recommended_for_ui, y = value, fill = metric)) +
  geom_bar(stat = "identity", position = "dodge") +
  scale_fill_manual(values = c("Total Trees" = "#14b8a6", "Total Records" = "#3b82f6"),
                    name = "Metric") +
  labs(title = "Recommended vs Not Recommended Species Comparison",
       subtitle = "Aggregate statistics for UI recommendation groups",
       x = "Recommendation Status",
       y = "Count",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8"),
    legend.position = "bottom"
  ) +
  scale_y_continuous(labels = comma)

ggsave(file.path(output_dir, "6_recommendation_comparison.png"), p6, 
       width = 10, height = 8, dpi = 300, bg = "white")
cat("Saved: 6_recommendation_comparison.png\n")

# 7. Top recommended species (focused view)
top_recommended <- species_summary %>%
  filter(recommended_for_ui) %>%
  arrange(desc(n_trees)) %>%
  head(15) %>%
  mutate(Species = factor(Species, levels = rev(Species)))

p7 <- top_recommended %>%
  ggplot(aes(x = Species, y = n_trees)) +
  geom_bar(stat = "identity", fill = "#14b8a6", alpha = 0.8) +
  geom_text(aes(label = n_trees), hjust = -0.2, size = 3.5, color = "#0d9488") +
  coord_flip() +
  labs(title = "Top Recommended Species for Forest Modification UI",
       subtitle = "Species with ≥5 trees and baseline growth curves (top 15)",
       x = "Species",
       y = "Number of Trees",
       caption = "Data: CO2 Pomfret Dataset") +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 14, face = "bold", color = "#1e293b"),
    plot.subtitle = element_text(size = 11, color = "#64748b"),
    plot.caption = element_text(size = 9, color = "#94a3b8")
  )

ggsave(file.path(output_dir, "7_top_recommended_species.png"), p7, 
       width = 10, height = 8, dpi = 300, bg = "white")
cat("Saved: 7_top_recommended_species.png\n")

cat("\n✓ All visualizations saved to:", output_dir, "\n")
