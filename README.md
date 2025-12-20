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
   - HTTP-only cookies for secure token storage (SameSite=Strict)
   - Server-side route protection with Next.js middleware (proxy.js)
   - Client-side navigation guards with custom hooks
   - Token verification in middleware (jose) and API routes
   - Multi-device token management (max 2 devices configured)
  
- **User Management**
  - User profiles with customizable settings
  - Theme preferences (font color, background mode, font size)
  - Persistent theme storage (localStorage for guests, MongoDB for users)
  - Account ban capability
  - Email validation with validator.js
  - Terms of Service acceptance tracking

- **State Management**
  - React Context API for global state (UserContext, ThemeContext)
  - Custom hooks for reusable logic
  - Session persistence across page reloads
  - Automatic theme synchronization with user settings

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
  - Protected routes with automatic redirection (clientside hooks and serverside middleware)

- **API & Backend**
  - Next.js API routes with App Router
  - JWT token validation in middleware(proxy.js) and secured routes
  - User session management
  - RESTful API design
  - Error handling and validation
  - Settings update endpoints (background mode, etc.)

- **Database**
  - MongoDB with Mongoose ODM
  - User schema with authentication and theme preferences
  - Token management with device tracking
  - Timestamp tracking

- **Performance & Security**
  - Edge Runtime compatible middleware for fast authentication checks
  - Secure HTTP-only cookies (SameSite=Strict)
  - Password hashing and validation (8 salt rounds)
  - Server-side JWT verification
  - Environment-based configuration
  - Token expiration (7 days)
  - CSRF protection with SameSite cookies

- **Developer Experience**
  - Next.js 16 with Turbopack (dev) / SWC (production)
  - ESLint for code quality
  - Responsive design patterns
  - Module path aliases (@/app/*)
  - Hot Module Replacement (HMR) for faster development
  - Clean component structure with containers and components
  - Modular and reusable code organization

## Installation
1. Clone the repository:
   ```bash
      git clone https://github.com/anatoli308/edifacts
      cd edifacts
      npm install
   ```

4. Set up environment variables:
   Create a `.env` file in the root directory (look at `.env.example` for reference)

5. Run the development server:
   ```bash
     npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3010` to access the application.

## Usage
WIP

## Known Issues
- Start vscode with admin rights to avoid issues with turbopack on Windows.

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

### License
MIT

