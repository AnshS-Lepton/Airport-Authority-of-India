# Environment Configuration Guide

This Angular application uses environment files to manage configuration for different environments (development and production).

## Environment Files

### Development (`src/environments/environment.ts`)
Used when running `ng serve` or `ng build` without production flag.

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleMapsLibraries: 'drawing,geometry'
};
```

### Production (`src/environments/environment.prod.ts`)
Used when running `ng build --configuration production`.

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-production-api.com/api', // Update this!
  googleMapsLibraries: 'drawing,geometry'
};
```

## Configuration Variables

### `apiUrl`
- **Description**: Base URL for the backend API
- **Development**: `http://localhost:3000/api`
- **Production**: Update to your production API URL

### `googleMapsLibraries`
- **Description**: Comma-separated list of Google Maps libraries to load
- **Default**: `drawing,geometry`
- **Available**: `drawing`, `geometry`, `places`, `visualization`

## How to Update Configuration

1. **For Development**: Edit `src/environments/environment.ts`
2. **For Production**: Edit `src/environments/environment.prod.ts`

After making changes, restart the development server:
```bash
ng serve
```

## Important Notes

- Environment files are TypeScript files, not `.env` files
- The production environment file is automatically used when building for production
- Never commit sensitive keys directly in environment files
- For production, consider using build-time environment variables or a configuration service


