# EDIFACTS

EDIFACTS is a web application designed to help users read and manage their EDIFACT data easily online.

## Technology Stack
- Next / React
- Material-UI (MUI)
- mongoDB / mongoose

## Features 
- Next.js App Router for server-side rendering and routing
- MUI for UI components and theming
- MongoDB / mongoose for data storage
- jsonwebtoken / jose for authentication
- bcrypt for password hashing
- Google Analytics for tracking
- React Context for state management
- Custom hooks for reusable logic
- Next.js API routes for backend functionality with App Router routes
- Environment variables for configuration
- Splash screen for improved user experience during loading
- Responsive design for various devices
- Light, dim and dark theming support
- Override MUI theme components with user preferences
- User authentication and registration
- Next.js middleware for route protection with proxy.js
- Module path aliases for cleaner imports configured in jsconfig.json

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/anatoli308/edifacts
   ```

2. Navigate to the project directory:
   ```bash 
    cd edifacts
    ```

3. Install the dependencies:
   ```bash
    npm install
    ```

4. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables looking like this:
    ```
    GOOGLE_TAG_MANAGER_ID=your_google_analytics_id
    GOOGLE_SITE_VERIFICATION=your_google_site_verification
    ```

5. Run the development server:
    ```bash
     npm run dev
     ```

6. Open your browser and navigate to `http://localhost:3010` to access the application.

## Usage
Once the application is running, you can upload your EDIFACT files and start reading and managing your data through the intuitive interface.


## Known Issues
- Start vscode with admin rights to avoid issues with turbopack on Windows.