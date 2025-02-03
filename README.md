# WebR Conservation Ecology Lab

## Overview
This project provides a web-based R programming environment specifically designed for teaching conservation biology to college students. It leverages WebR to run R code directly in the browser, making it accessible without requiring local R installation or complex setup procedures.

## Purpose
The primary goal is to create an accessible platform for biology students to learn R programming in the context of conservation ecology. This MVP (Minimum Viable Product) is designed to:

1. Remove technical barriers to learning R by eliminating local installation requirements
2. Provide a consistent environment for all students
3. Enable instructors to share datasets and examples easily
4. Allow students to save and track their work progress
5. Facilitate the teaching of data analysis in conservation biology

## Features

### Core Functionality
- Browser-based R environment using WebR
- Interactive REPL (Read-Eval-Print Loop) interface
- Support for basic R operations and data analysis
- File upload and management system
- User authentication and session management
- Plot generation capabilities (currently under development)
- Command history preservation

### User Management
- Secure authentication system using Supabase
- Individual user workspaces
- Persistent storage of user files and command history
- Session state management

### Data Management
- CSV file upload functionality
- File storage using Supabase
- Ability to load data directly into R environment
- Shared access to course datasets

## Technical Architecture

### Frontend
- Pure JavaScript/HTML/CSS implementation
- Custom Web Components for modularity
- Responsive design for various screen sizes

### Backend Services (Supabase)
- Authentication
- File storage
- Database for user data and session management
- Real-time updates capability

### Key Components

#### WebR Integration
- Custom WebR service wrapper (`webr-service.js`)
- Handles R environment initialization
- Manages package loading and updates
- Provides plot generation capabilities

#### User Interface
- Custom REPL component
- File management interface
- Authentication forms
- Plot display area

#### Data Persistence
- Command history tracking
- Session state management
- File storage and retrieval
- User preferences storage

## Current Status

### Core Features
- User authentication and session management
- Full R code execution environment
- File upload and management
- Command history with navigation
- Session state persistence
- Advanced plotting capabilities
- Statistical analysis tools
- Plot sharing functionality

### Verified Workflows
1. Data Import and Analysis
   - CSV file upload
   - Automatic data frame creation
   - Basic statistical analysis
   - Data visualization

2. Visualization
   - Base R plotting
   - ggplot2 graphics
   - Statistical annotations with ggpubr
   - Plot sharing and export

3. Session Management
   - Command history
   - Environment persistence
   - File management
   - User authentication

### Functional Features
- Full ggplot2 integration with plot generation
- Statistical analysis support through ggpubr
- CSV file upload and automatic loading into R environment
- Plot sharing capabilities
- Enhanced error handling
- Data visualization with both base R and ggplot2

### Verified Working Packages
- ggplot2: Full support for complex visualizations
- ggpubr: Statistical annotations and publication-ready plots
- Base R graphics: All standard plotting functions
- Some R functions may not work as expected in the WebR environment

## Development Setup

1. Clone the repository
2. Configure Supabase credentials in `supabaseClient.js`
3. Ensure CORS headers are properly set in `netlify.toml`
4. Run a local server to test the application

## Environment Requirements
- Modern web browser with WebAssembly support
- Internet connection for WebR and Supabase services
- Supabase project with proper configuration

## Future Development Plans
1. Implement functional ggplot2 support
2. Add more conservation biology-specific packages
3. Improve error handling and user feedback
4. Develop guided tutorials and exercises
5. Add collaborative features for group work
6. Implement export functionality for work and results

## Security Considerations
- User authentication is handled through Supabase
- File access is restricted to authenticated users
- Cross-Origin policies are enforced
- Data is stored securely in Supabase

## Example Usage

### Data Visualization
The platform supports both base R plotting and advanced ggplot2 visualizations:

```R
# Base R plotting
plot(cars)

# Simple ggplot2 visualization
library(ggplot2)
ggplot(cars, aes(x=speed, y=dist)) + 
    geom_point() +
    theme_minimal()

# Advanced statistical visualization with ggpubr
library(ggplot2)
library(ggpubr)

ggplot(cars, aes(x=speed, y=dist)) + 
    geom_point() +
    geom_smooth(method='lm', formula = y ~ x) +
    theme_minimal() +
    labs(title='Speed vs. Distance',
         x='Speed (mph)',
         y='Stopping Distance (ft)') +
    stat_regline_equation(label.y = 100)
```

### Data Import
CSV files can be uploaded through the UI and automatically loaded into R:
1. Use the file upload button to select a CSV file
2. The file will be automatically uploaded and stored
3. Click "Load in R" to create a data frame named after your file
4. Access your data using standard R commands

### Plot Sharing
All generated plots can be:
1. Displayed directly in the web interface
2. Shared via unique URLs
3. Downloaded for use in other contexts

## Contributing
This project is currently in MVP phase for testing with college biology students. Feedback and contributions will be incorporated based on testing results.

## License
[License information to be added]

## Contact
[Contact information to be added]

---
Note: This README represents the current state of the MVP. The application is actively under development, and features may change based on user feedback and testing results.