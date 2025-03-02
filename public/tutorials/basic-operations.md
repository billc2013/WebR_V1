# Exploring the Dataset

## Description
Let's start by exploring the Hubbard Brook vegetation inventory dataset to understand its structure and contents. These basic operations help you get familiar with your data before analysis.

## Code
```r
# First, let's look at the structure of the dataset
str(df)

# View the first few rows
head(df)

# Get a statistical summary
summary(df)

# Check the dimensions (rows and columns)
dim(df)

# Get unique species
unique(df$Species)

# Count how many rows per plot
table(df$Plot)

# Basic filter example - look at just one species
oak_trees <- df[df$Species == "ACRU", ]
head(oak_trees)
```

## Explanation
- `str(df)` shows the structure of your dataframe, including variable types and first few values
- `head(df)` displays the first 6 rows of your data to get a quick preview
- `summary(df)` gives statistical summaries for each column (min, max, mean, etc.)
- `dim(df)` returns the dimensions as [rows, columns]
- `unique(df$Species)` shows all the different species codes in the dataset
- `table(df$Plot)` counts the number of observations in each plot
- The filter example shows trees of a specific species (ACRU, which is Red Maple)