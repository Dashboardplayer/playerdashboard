# Player Management Dashboard

Een webapplicatie voor het beheren van digitale spelers (displays) voor verschillende bedrijven.

## Projectoverzicht

Dit project is een React-applicatie met een Express backend die het mogelijk maakt om digitale spelers (displays) te beheren voor verschillende bedrijven. Het systeem ondersteunt verschillende gebruikersrollen (superadmin, bedrijfsadmin, gebruiker) en biedt functionaliteit voor het aanmaken en beheren van bedrijven, spelers en gebruikers.

## Projectstructuur

### Belangrijke bestanden en mappen

```
├── server.js                 # Express backend server
├── .env                      # Omgevingsvariabelen
├── src/                      # Frontend broncode
│   ├── App.js                # Hoofdcomponent met routing
│   ├── index.js              # Entry point voor React
│   ├── db.js                 # Database connectie
│   ├── components/           # React componenten
│   │   ├── Auth/             # Authenticatie componenten
│   │   ├── Dashboards/       # Dashboard componenten
│   │   ├── Forms/            # Formulier componenten
│   │   └── Layouts/          # Layout componenten
│   ├── contexts/             # React contexts
│   ├── hooks/                # Custom hooks
│   ├── models/               # MongoDB modellen
│   ├── services/             # Service functies
│   ├── utils/                # Hulpfuncties
│   └── shims/                # Polyfills en compatibiliteit
└── public/                   # Statische bestanden
```

## Bestandsanalyse

### Root bestanden

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `server.js` | Express backend server die API endpoints biedt voor authenticatie, bedrijven en spelers | Ja | MongoDB met in-memory fallback |
| `.env` | Omgevingsvariabelen voor server configuratie (PORT, MONGO_URI, JWT_SECRET) | Ja | N/A |
| `config-overrides.js` | Webpack configuratie aanpassingen voor React | Ja | N/A |
| `package.json` | Project metadata en dependencies | Ja | N/A |
| `create-admin.js` | Script om een admin gebruiker aan te maken | Ja | MongoDB |
| `.gitignore` | Git configuratie voor te negeren bestanden | Ja | N/A |
| `README.md` | Project documentatie | Ja | N/A |

### Frontend (src/)

| Bestand/Map | Doel | In gebruik | Data opslag |
|-------------|------|------------|-------------|
| `src/App.js` | Hoofdcomponent met routing en authenticatie logica | Ja | Context API |
| `src/index.js` | Entry point voor React applicatie | Ja | N/A |
| `src/db.js` | Database connectie logica | Ja | MongoDB |
| `src/initMongoDB.js` | Script om MongoDB te initialiseren | Ja | MongoDB |

#### Components

| Map | Doel | In gebruik | Data opslag |
|-----|------|------------|-------------|
| `src/components/Auth/` | Authenticatie componenten (login, registratie) | Ja | JWT in localStorage |
| `src/components/Dashboards/` | Dashboard componenten voor verschillende gebruikersrollen | Ja | Data via API |
| `src/components/Forms/` | Formulier componenten voor het aanmaken van bedrijven, spelers en gebruikers | Ja | Data via API |
| `src/components/Layouts/` | Layout componenten zoals Navbar en ConnectionStatus | Ja | N/A |

#### Contexts

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/contexts/UserContext.js` | Context voor gebruikersgegevens en authenticatie | Ja | Context API + localStorage |

#### Hooks

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/hooks/apiClient.js` | API client voor communicatie met backend | Ja | localStorage voor caching |
| `src/hooks/mongoClient.js` | MongoDB client voor directe database interactie | Ja | MongoDB + localStorage fallback |
| `src/hooks/supabaseClient.js` | Supabase client (lijkt vervangen te zijn door mongoClient) | Nee | N/A |

#### Models

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/models/Command.js` | Model voor commando's | Ja | MongoDB |
| `src/models/Company.js` | Model voor bedrijven | Ja | MongoDB |
| `src/models/Log.js` | Model voor logs | Ja | MongoDB |
| `src/models/Player.js` | Model voor spelers | Ja | MongoDB |
| `src/models/Schedule.js` | Model voor schema's | Ja | MongoDB |
| `src/models/Update.js` | Model voor updates | Ja | MongoDB |
| `src/models/User.js` | Model voor gebruikers | Ja | MongoDB |

#### Services

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/services/authService.js` | Authenticatie services | Ja | JWT + MongoDB |
| `src/services/dbService.js` | Database services | Ja | MongoDB |

#### Utils

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/utils/browserUtils.js` | Browser-specifieke hulpfuncties | Ja | N/A |
| `src/utils/createSuperAdmin.js` | Hulpfunctie voor het aanmaken van een superadmin | Ja | MongoDB |
| `src/utils/setupInitialAdmin.js` | Script voor het instellen van de initiële admin | Ja | MongoDB |

#### Shims

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `src/shims/inherits.js` | Polyfill voor inherits functionaliteit | Ja | N/A |
| `src/shims/jsonwebtoken.js` | Polyfill voor JWT functionaliteit in browser | Ja | N/A |
| `src/shims/jws.js` | Polyfill voor JWS functionaliteit | Ja | N/A |
| `src/shims/stream.js` | Polyfill voor stream functionaliteit | Ja | N/A |

### Public

| Bestand | Doel | In gebruik | Data opslag |
|---------|------|------------|-------------|
| `public/index.html` | HTML template voor React app | Ja | N/A |
| `public/manifest.json` | Web app manifest voor PWA functionaliteit | Ja | N/A |
| `public/favicon.ico` | Website favicon | Ja | N/A |
| `public/robots.txt` | Instructies voor web crawlers | Ja | N/A |

## Architectuur

### Backend

De backend is gebouwd met Node.js en Express en biedt een RESTful API voor de frontend. Het gebruikt MongoDB voor data opslag met een in-memory fallback voor ontwikkeling.

#### API Endpoints

| Endpoint | Methode | Doel | Authenticatie |
|----------|---------|------|---------------|
| `/api/companies` | GET | Alle bedrijven ophalen | Optioneel (filtert op basis van rol) |
| `/api/companies` | POST | Nieuw bedrijf aanmaken | Vereist (alleen superadmin) |
| `/api/players` | GET | Alle spelers ophalen | Optioneel (filtert op basis van rol) |
| `/api/players` | POST | Nieuwe speler aanmaken | Niet vereist |
| `/api/auth/login` | POST | Gebruiker inloggen | Niet vereist |
| `/api/auth/verify` | GET | Token verifiëren | Vereist |
| `/api/auth/register` | POST | Nieuwe gebruiker registreren | Vereist (alleen admins) |

#### Authenticatie

De backend gebruikt JWT (JSON Web Tokens) voor authenticatie:
- Tokens worden gegenereerd bij login en bevatten gebruikersgegevens (id, email, rol, bedrijf)
- Tokens worden opgeslagen in localStorage in de browser
- API requests bevatten de token in de Authorization header
- De server verifieert de token en voegt gebruikersgegevens toe aan het request object

#### Data Opslag

- **MongoDB**: Primaire data opslag voor productie
- **In-memory**: Fallback voor ontwikkeling als MongoDB niet beschikbaar is
- **Models**: Mongoose schemas voor bedrijven, spelers, gebruikers, etc.

### Frontend

De frontend is gebouwd met React en gebruikt React Router voor navigatie. Het communiceert met de backend via de API client.

#### Componenten

- **Auth**: Componenten voor authenticatie (login, registratie)
- **Dashboards**: Dashboards voor verschillende gebruikersrollen
- **Forms**: Formulieren voor het aanmaken van bedrijven, spelers en gebruikers
- **Layouts**: Layout componenten zoals Navbar en ConnectionStatus

#### State Management

- **Context API**: UserContext voor gebruikersgegevens en authenticatie
- **localStorage**: Caching van data en opslag van JWT token
- **API Client**: Communicatie met backend met offline fallback

#### Routing

- **React Router**: Client-side routing
- **Protected Routes**: Routes die authenticatie vereisen
- **Role-based Access**: Toegang tot routes op basis van gebruikersrol

## Installatie en Opstarten

### Vereisten

- Node.js (v14 of hoger)
- MongoDB (lokaal of remote)

### Installatie

1. Clone de repository
2. Installeer dependencies:
   ```
   npm install
   ```

3. Maak een `.env` bestand aan in de root met de volgende variabelen:
   ```
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/player-dashboard
   JWT_SECRET=your_secret_key_here
   ```

### Database Setup

1. Zorg ervoor dat MongoDB draait
2. Initialiseer de database:
   ```
   npm run init-db
   ```

3. Maak een admin gebruiker aan:
   ```
   npm run create-admin
   ```

### Opstarten

1. Start de ontwikkelserver:
   ```
   npm run dev
   ```

2. Of start frontend en backend apart:
   ```
   npm run start        # Frontend
   npm run start:server # Backend
   ```

3. Open de applicatie in de browser:
   ```
   http://localhost:3000
   ```

## Ontwikkelingsnotities

- De applicatie heeft een offline modus met localStorage caching
- MongoDB verbindingsfouten worden opgevangen met een in-memory fallback
- De frontend controleert regelmatig de verbinding met de backend
- Gebruikersrollen bepalen welke functionaliteit beschikbaar is
- JWT tokens worden gebruikt voor authenticatie en autorisatie

## Gebruikersrollen

1. **Superadmin**:
   - Kan alle bedrijven zien en beheren
   - Kan nieuwe bedrijven aanmaken
   - Kan nieuwe gebruikers aanmaken (alle rollen)
   - Kan nieuwe spelers aanmaken voor elk bedrijf

2. **Bedrijfsadmin**:
   - Kan alleen eigen bedrijf zien en beheren
   - Kan nieuwe gebruikers aanmaken (alleen bedrijfsadmin en user)
   - Kan nieuwe spelers aanmaken voor eigen bedrijf

3. **User**:
   - Kan alleen eigen bedrijf zien
   - Beperkte functionaliteit
