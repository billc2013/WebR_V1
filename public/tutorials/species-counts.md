# Counting Species

## Description
Now let's count how many trees we have of each species in the dataset and sort them in descending order of abundance. This helps us identify which species are dominant in the forest.

## Code
```r
# Load the dplyr package for easier data manipulation
library(dplyr)

# Count the number of trees per species
species_counts <- df %>%
  count(Species)

# Display the results
species_counts

# Sort the counts in descending order
species_counts_sorted <- species_counts %>%
  arrange(desc(n))

# Display the sorted results
species_counts_sorted

# Optional: Calculate relative abundance (percentage)
species_counts_sorted <- species_counts_sorted %>%
  mutate(
    percentage = (n / sum(n)) * 100,
    percentage = round(percentage, 2)
  )

# Show the top 10 most abundant species
head(species_counts_sorted, 10)
```

## Explanation
- `library(dplyr)` loads the dplyr package which provides the pipe operator `%>%` and other functions
- `count(Species)` counts how many rows exist for each unique value in the Species column
- The `%>%` (pipe) operator takes the output from the left and passes it as input to the right
- `arrange(desc(n))` sorts the data frame by the count column in descending order
- `mutate()` adds new columns to the data frame
- `percentage = (n / sum(n)) * 100` calculates the percentage of each species
- `head(species_counts_sorted, 10)` shows only the first 10 rows of the sorted data