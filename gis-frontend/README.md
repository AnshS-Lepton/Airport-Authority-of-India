# GIS Frontend Angular

Angular 19 application for GIS Demo - Drone Flight Management System.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI 19

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
   - The application uses environment files located in `src/environments/`
   - For development: `src/environments/environment.ts` (already configured for localhost)
   - For production: `src/environments/environment.prod.ts` (update with your production API URL)

3. Make sure the backend is running on `http://localhost:3000`

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:4200`

## Environment Configuration

### Development Environment
Edit `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleMapsLibraries: 'drawing,geometry'
};
```

### Production Environment
Edit `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-production-api.com/api',
  googleMapsLibraries: 'drawing,geometry'
};
```

## Features

- Interactive Google Maps integration
- Zone visualization (State, Airport Red/Yellow, International Boundary, Red Zones, Temporary Red Zones)
- Flight plan creation with drawing tools
- Flight plan validation against zones
- Zone details modal

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── map/
│   │   │   └── map.component.ts
│   │   └── create-flight-plan/
│   │       └── create-flight-plan.component.ts
│   ├── services/
│   │   ├── config.service.ts
│   │   ├── zone.service.ts
│   │   └── flight-plan.service.ts
│   ├── app.component.ts
│   └── app.routes.ts
├── environments/
│   ├── environment.ts (development)
│   └── environment.prod.ts (production)
└── styles.css
```

## API Endpoints

The application connects to the backend API configured in environment files:

- `/config/maps-key` - Get Google Maps API key
- `/zones` - Get zones with filters
- `/flight-plans` - Flight plan operations
- `/flight-plans/validate` - Validate flight plan

## Development

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

For production build:
```bash
ng build --configuration production
```

## Environment Variables

All API URLs and configuration are stored in environment files:
- `src/environments/environment.ts` - Development settings
- `src/environments/environment.prod.ts` - Production settings

Update these files to change API endpoints or other configuration values.
