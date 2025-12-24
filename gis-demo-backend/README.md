# GIS Demo Backend

Node.js/Express backend for GIS Drone Management System

## Features

- RESTful API with Express.js
- PostgreSQL with PostGIS for spatial data
- JWT Authentication
- Role-based access control (Pilot, Approver, Admin)
- Flight plan validation against zones
- Zone management
- Approval workflow

## Getting Started

### Prerequisites

- Node.js (v22.17 or higher)
- PostgreSQL (v12 or higher) with PostGIS extension
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials

4. Create database and run schema:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE gis_demo;

# Enable PostGIS
\c gis_demo
CREATE EXTENSION postgis;

# Run schema
\i src/database/schema.sql
```

5. Seed database with sample data:
```bash
node src/database/seed.js
```

### Start Development Server

```bash
npm run dev
```

Server will run on http://localhost:3000

### Start Production Server

```bash
npm start
```

### Migrating to Node.js 22.17

If you're upgrading from an older Node.js version:

1. **Install Node.js 22.17.0 or higher:**
   - Download from [nodejs.org](https://nodejs.org/)
   - Or use a version manager:
     ```bash
     # Using nvm (Node Version Manager)
     nvm install 22.17.0
     nvm use 22.17.0
     
     # Or if you have .nvmrc file (already created in this project)
     nvm use
     ```

2. **Verify Node.js version:**
   ```bash
   node --version  # Should show v22.17.0 or higher
   npm --version   # Should show 10.0.0 or higher
   ```

3. **Clean and reinstall dependencies (important for native modules like bcrypt):**
   ```bash
   # Remove old node_modules and lock file
   rm -rf node_modules package-lock.json
   
   # On Windows PowerShell:
   # Remove-Item -Recurse -Force node_modules, package-lock.json
   
   # Reinstall dependencies (this will rebuild native modules for Node 22)
   npm install
   ```

4. **Test the application:**
   ```bash
   npm run dev
   ```

> **Note:** Native modules like `bcrypt` need to be rebuilt when switching Node versions. The `npm install` command will automatically rebuild them for Node.js 22.17.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user (protected)

### Zones
- `GET /api/zones` - Get all zones (protected)
- `GET /api/zones/:id` - Get zone by ID (protected)
- `POST /api/zones` - Create zone (Admin only)
- `PUT /api/zones/:id` - Update zone (Admin only)
- `DELETE /api/zones/:id` - Delete zone (Admin only)
- `PUT /api/zones/:id/submit` - Submit zone for approval (Admin only)

### Flight Plans
- `POST /api/flight-plans/validate` - Validate flight plan (Pilot only)
- `POST /api/flight-plans` - Create flight plan (Pilot only)
- `GET /api/flight-plans` - Get all flight plans (protected)
- `GET /api/flight-plans/my` - Get my flight plans (Pilot only)
- `GET /api/flight-plans/pending` - Get pending flight plans (Approver only)
- `GET /api/flight-plans/:id` - Get flight plan by ID (protected)
- `PUT /api/flight-plans/:id/approve` - Approve flight plan (Approver only)
- `PUT /api/flight-plans/:id/reject` - Reject flight plan (Approver only)

## Default Users

After seeding, you can login with:
- **Pilot 1**: pilot1@demo.com / password123
- **Pilot 2**: pilot2@demo.com / password123
- **Approver**: approver@demo.com / password123
- **Admin**: admin@demo.com / password123

## Project Structure

```
gis-demo-backend/
├── src/
│   ├── app.js                    # Main application entry
│   ├── config/
│   │   └── database.js           # Database connection
│   ├── controllers/
│   │   ├── authController.js     # Authentication controller
│   │   ├── zoneController.js     # Zone management controller
│   │   └── flightPlanController.js # Flight plan controller
│   ├── middleware/
│   │   └── auth.js               # Authentication middleware
│   ├── routes/
│   │   ├── authRoutes.js         # Auth routes
│   │   ├── zoneRoutes.js         # Zone routes
│   │   └── flightPlanRoutes.js   # Flight plan routes
│   ├── services/
│   │   └── validationService.js  # Validation logic
│   └── database/
│       ├── schema.sql            # Database schema
│       ├── seed.sql              # SQL seed data
│       └── seed.js               # Node.js seed script
├── .env.example                  # Environment variables example
├── package.json                  # Dependencies
└── README.md                     # This file
```

## Database Schema

- **users**: User accounts with roles
- **zones**: Geographic zones (RED/YELLOW/GREEN)
- **flight_plans**: Flight plan requests

All tables use PostGIS geometry types for spatial data.

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Error Handling

The API returns standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

