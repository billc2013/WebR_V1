# Formatted Plot

## Description
Now let's improve our species distribution plot by adding proper formatting, labels, and colors to make it more readable and presentation-ready. Good visualization is key for effectively communicating ecological data.

## Code
```r
# Load required libraries
library(dplyr)
library(ggplot2)

# Count species and sort (if not already done)
species_counts_sorted <- df %>%
  count(Species) %>%
  arrange(desc(n))

# Get the top 15 most common species
top_species <- head(species_counts_sorted, 15)

# Create a formatted plot
final_plot <- ggplot(top_species, aes(x = reorder(Species, -n), y = n)) +
  # Add bars with a nice color
  geom_bar(stat = "identity", fill = "#8884d8") +
  
  # Add a minimal theme
  theme_minimal() +
  
  # Customize the theme elements
  theme(
    axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
    plot.title = element_text(hjust = 0.5, size = 14, face = "bold"),
    plot.subtitle = element_text(hjust = 0.5, size = 12),
    panel.grid.major.x = element_blank()
  ) +
  
  # Add labels
  labs(
    title = "Species Distribution in Hubbard Brook Forest",
    subtitle = "Top 15 most abundant species",
    x = "Species",
    y = "Number of Trees",
    caption = "Data source: Hubbard Brook vegetation inventory"
  )

# Display the plot
print(final_plot)

# Optional: Save the plot
# ggsave("species_distribution.png", final_plot, width = 10, height = 6)
```

## Explanation
- `fill = "#8884d8"` sets the color of the bars to a nice purple
- `theme_minimal()` provides a clean background with minimal clutter
- `axis.text.x = element_text(angle = 45, hjust = 1)` rotates species labels for better readability
- `hjust = 1` aligns the rotated text to prevent overlap
- `plot.title = element_text(hjust = 0.5)` centers the plot title
- `panel.grid.major.x = element_blank()` removes vertical grid lines
- `labs()` adds proper titles and labels to the plot
- `caption = "..."` adds a source note at the bottom of the plot
- `ggsave()` (commented out) would save the plot as a PNG file