# EDIFACTS

EDIFACTS is a web application designed to help users read and manage their EDIFACT data easily online.

## Technology Stack
- Next / React
- Material-UI (MUI)
- mongoDB / mongoose

## Features
- User-friendly interface for reading EDIFACT files
- Theme customization with light and dark modes
- Responsive design for various devices
- Google Analytics integration for usage tracking
- Splash screen for better user experience during loading

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