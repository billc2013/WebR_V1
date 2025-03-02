# Simple Plot

## Description
Let's create a basic bar plot to visualize the species distribution. This simple plot shows which species are most abundant in the forest. We'll only look at the top 15 species to keep the plot readable.

## Code
```r
# Load required libraries if not already loaded
library(dplyr)
library(ggplot2)

# Count species and sort (if not already done)
species_counts_sorted <- df %>%
  count(Species) %>%
  arrange(desc(n))

# Get the top 15 most common species
top_species <- head(species_counts_sorted, 15)

# Create a basic bar plot
p1 <- ggplot(top_species, aes(x = reorder(Species, -n), y = n)) +
  geom_bar(stat = "identity")

# Display the plot
print(p1)

# Alternative using base R (no ggplot)
# barplot(top_species$n, names.arg = top_species$Species)
```

## Explanation
- `library(ggplot2)` loads the ggplot2 package for creating visualizations
- `head(species_counts_sorted, 15)` selects only the 15 most abundant species
- `ggplot()` initializes a plot with data and aesthetic mappings
- `aes(x = reorder(Species, -n), y = n)` maps species to x-axis and counts to y-axis
- `reorder(Species, -n)` arranges species by count in descending order
- `geom_bar(stat = "identity")` creates bars with heights determined by the data values
- `stat = "identity"` tells ggplot we're providing the actual heights (not counting them)