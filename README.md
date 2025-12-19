# EDIFACTS

EDIFACTS is a web application designed to help users read and manage their EDIFACT data easily online.

## Requirements
- Node.js (version 18 or higher) ideally latest stable version
- npm (version 8 or higher) ideally latest stable version
- MongoDB instance (local or cloud-based) ideally latest stable version.

## Technology Stack
- Next / React 
- Material-UI (MUI) 
- MongoDB / Mongoose 

## Project Structure
```
app/                    # Next.js App Router structure
├── _components/        # Reusable UI components
├── _contexts/          # React Context providers
├── _hooks/             # Custom client hooks 
├── api/                # Next.js API routes
├── auth/               # Next.js App Router auth pages
├── layout.js           # Root layout with providers
└── page.js             # Root Home page

lib/                    # Library utilities
├── dbConnect.js        # MongoDB connection utility

models/                 # Mongoose ODM models 
├── User.js             # User schema and methods

theme/                  # MUI theme configurations
├── colors.js           # font color definitions
├── backgroundModes.js  # Theme background mode definitions
├── [index.js]          # Theme provider wrapper
├── typography.js       # Typography definitions
└── overrides/          # MUI component overrides

.env.example            # Example environment variables
jsconfig.json           # Module path aliases
proxy.js                # Route middleware
```

## Development Features
- **Authentication & Authorization**
  - User registration and login with JWT-based authentication
  - Secure password hashing with bcryptjs
  - HTTP-only cookies for secure token storage
  - Server-side route protection with Next.js middleware (proxy.js)
  - Client-side navigation guards with custom hooks (useProtectedRoute, useAlreadyAuthenticatedRoute)
  - Token verification in Middleware (jose) and API routes
  
- **User Management**
  - User profiles with customizable settings
  - Theme preferences (font color, background mode, font size)
  - Persistent theme storage per user (localStorage for guests, MongoDB for users)
  - Account ban capability

- **State Management**
  - React Context API for global state (UserContext, ThemeContext)
  - Custom hooks for reusable logic
  - Session persistence across page reloads

- **Theming & UI**
  - Light, Dim, and Dark theme support
  - Customizable font colors and font sizes
  - MUI component overrides with theme customization
  - Material-UI v7 with responsive design
  - Splash screen with minimum loading time for improved UX
  - Dynamic theme synchronization with user preferences

- **Routing & Navigation**
  - Next.js App Router for modern file-based routing
  - Client-side Link navigation with next/link for faster transitions
  - Module path aliases for cleaner imports (configured in jsconfig.json)
  - Protected routes with automatic redirection (hooks and middleware)

- **API & Backend**
  - Next.js API routes with App Router
  - JWT token validation in middleware(proxy.js) and routes
  - User session management
  - Settings update endpoints (background mode, etc.)

- **Database**
  - MongoDB with Mongoose ODM
  - User schema with authentication and theme preferences
  - Token management with device tracking
  - User edit timestamp tracking

- **Performance & Security**
  - Edge Runtime compatible middleware for fast authentication checks
  - Secure HTTP-only cookies (SameSite=Strict)
  - Password hashing and validation
  - Server-side JWT verification
  - Environment-based configuration

- **Developer Experience**
  - Next.js 16 with Turbopack (dev) / SWC (production)
  - ESLint for code quality
  - Responsive design patterns
  - Clean component structure with containers and components


## Installation
1. Clone the repository:
   ```bash
      git clone https://github.com/anatoli308/edifacts
      cd edifacts
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

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

### License
MIT

