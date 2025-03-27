# Player Dashboard

## 1. Project Overview
The Player Dashboard is a web-based application built with React and Node.js that provides a comprehensive management system for players and companies. It features user authentication with 2FA support, QR code generation, and real-time updates through WebSocket connections. The application uses MongoDB for data storage and includes various security features such as XSS protection and helmet security.

## 2. Project Structure
```
├── public/                 # Static files
├── src/                    # Source code
│   ├── assets/            # Images, fonts, and other static resources
│   ├── components/        # React components
│   ├── config/           # Configuration files
│   ├── contexts/         # React context providers
│   ├── cron/            # Scheduled tasks
│   ├── hooks/           # Custom React hooks
│   ├── middleware/      # Express middleware
│   ├── models/          # MongoDB models
│   ├── services/        # Business logic and API services
│   ├── shims/          # Polyfills and compatibility files
│   ├── utils/          # Utility functions
│   ├── App.js          # Main React component
│   ├── db.js           # Database connection setup
│   ├── index.js        # Application entry point
│   ├── initMongoDB.js  # Database initialization script
│   └── setupTests.js   # Test configuration
├── .env                # Environment variables
├── .gitignore         # Git ignore rules
├── config-overrides.js # React configuration overrides
├── create-admin.js    # Admin user creation script
├── package.json       # Project dependencies and scripts
└── server.js          # Express server setup
```

## 3. File Descriptions

### Core Files
- `server.js`: Main Express server file that handles API routes and WebSocket connections
- `src/App.js`: Main React application component
- `src/db.js`: Database connection and configuration
- `src/initMongoDB.js`: Script for initializing the MongoDB database
- `create-admin.js`: Utility script for creating administrator accounts

### Configuration Files
- `.env`: Environment variables configuration
- `config-overrides.js`: Custom webpack configuration
- `package.json`: Project dependencies and npm scripts

### Detailed Directory Structure

#### src/components/
- **Auth/**
  - Bevat alle authenticatie-gerelateerde componenten
  - Login, registratie, en 2FA verificatie componenten
- **Dashboards/**
  - SuperAdminDashboard.js: Dashboard voor super administrators
  - CompanyDashboard.js: Dashboard voor bedrijfsbeheerders
- **Forms/**
  - Formuliercomponenten voor het aanmaken en bewerken van gebruikers, bedrijven en spelers
- **Layouts/**
  - Algemene layout componenten zoals navigatie en headers
- **Players/**
  - Componenten voor het beheren en weergeven van spelers
- **Settings/**
  - Componenten voor gebruikers- en systeeminstellingen
- **Users/**
  - Componenten voor gebruikersbeheer en profielen

#### src/contexts/
- **UserContext.js**
  - Centrale staat voor gebruikersauthenticatie
  - Beheert gebruikerssessie en autorisatie
  - Biedt globale toegang tot gebruikersgegevens

#### src/hooks/
- **apiClient.js**
  - Custom hook voor API communicatie
  - Bevat alle API endpoints en request logica
- **mongoClient.js**
  - Hook voor directe MongoDB interacties
  - Bevat database queries en mutaties
- **useAuth.js**
  - Hook voor authenticatie functionaliteit
  - Vereenvoudigt toegang tot auth-gerelateerde functies

#### src/services/
- **authService.js**
  - Authenticatie service met login/logout logica
  - JWT token beheer
  - Gebruikersautorisatie functies
- **dbService.js**
  - Database service voor algemene data operaties
  - Connectie en query management
- **emailService.js**
  - Email verzendservice
  - Templates en notificatie logica
- **twoFactorService.js**
  - 2FA implementatie en verificatie
  - QR code generatie voor 2FA setup

#### src/utils/
- **browserUtils.js**
  - Browser-specifieke hulpfuncties
  - Feature detection en compatibiliteit checks
- **passwordValidation.js**
  - Wachtwoord validatie en sterkte checking
  - Beveiligingsregels implementatie
- **setupInitialAdmin.js**
  - Script voor initiële admin setup
  - Database initialisatie helpers
- **createSuperAdmin.js**
  - Hulpscript voor het aanmaken van super administrators

#### src/shims/
- **inherits.js**
  - Polyfill voor object inheritance
- **jsonwebtoken.js**
  - Browser-compatibele JWT implementatie
- **jws.js**
  - JSON Web Signature compatibiliteit
- **stream.js**
  - Stream functionaliteit polyfill

## 4. Database Tables

### Models
1. **User Model** (`src/models/User.js`)
   - Handles user authentication and profile management
   - Stores user credentials, 2FA settings, and permissions

2. **Company Model** (`src/models/Company.js`)
   - Manages company information and settings
   - Links companies with users and players

3. **Player Model** (`src/models/Player.js`)
   - Stores player information and status
   - Tracks player activities and settings

4. **Command Model** (`src/models/Command.js`)
   - Manages system commands and operations
   - Tracks command execution and status

5. **Update Model** (`src/models/Update.js`)
   - Handles system updates and changelog
   - Tracks version information

6. **Log Model** (`src/models/Log.js`)
   - System logging and activity tracking
   - Stores important system events

7. **Schedule Model** (`src/models/Schedule.js`)
   - Manages scheduled tasks and automation
   - Stores timing and execution details

## 5. Scripts
- `npm start`: Starts the React development server
- `npm run start:server`: Starts the Express backend server
- `npm run dev`: Runs both frontend and backend in development mode
- `npm run build`: Creates a production build
- `npm run init-db`: Initializes the MongoDB database
- `npm run create-admin`: Creates an administrator account

## 6. Dependencies

### Main Dependencies
- React and React DOM for the frontend
- Express for the backend server
- MongoDB and Mongoose for database operations
- WebSocket (ws) for real-time communications
- Material-UI for the user interface
- JWT for authentication
- Node-cron for scheduled tasks
- QRCode for 2FA setup
- Various security packages (helmet, xss, etc.)

### Development Dependencies
- React Scripts and related build tools
- Webpack and Babel for bundling and transpilation
- Polyfills for browser compatibility

## 7. Security Features
- Two-factor authentication (2FA)
- JWT-based authentication
- XSS protection
- Helmet security headers
- CSRF protection
- Secure password hashing with bcrypt

## 8. Getting Started
1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables in `.env`
4. Initialize the database with `npm run init-db`
5. Create an admin account with `npm run create-admin`
6. Start the development servers with `npm run dev`

## 9. Unused Files
- `x laatste versie met alle fixes.zip`: Backup archive, niet in gebruik
- `x nieuste versie van de code.zip`: Backup archive, niet in gebruik
- `src/components/Dashboards/CompaniesDashboard.js`: Vervangen door nieuwe dashboard implementatie
- `src/hooks/supabaseClient.js`: Oude database client, vervangen door MongoDB
- `src/middleware/`: Lege directory, niet in gebruik
