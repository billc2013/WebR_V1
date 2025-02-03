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

## Current Status and Known Issues

### Working Features
- User authentication
- Basic R code execution
- File upload and management
- Command history
- Session state persistence

### Under Development
- ggplot2 integration and plot generation
- Enhanced error handling
- Additional R package support
- Improved data visualization capabilities

### Known Issues
- ggplot2 plot generation is not currently functional
- Limited package availability through WebR
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

## Contributing
This project is currently in MVP phase for testing with college biology students. Feedback and contributions will be incorporated based on testing results.

## License
[License information to be added]

## Contact
[Contact information to be added]

---
Note: This README represents the current state of the MVP. The application is actively under development, and features may change based on user feedback and testing results.