// API Configuration Constants
// Note: In Angular, environment variables are set in src/environments/environment.ts
// For dynamic configuration, use the environment files instead of this constants file
import { environment } from '../../environments/environment';

export const Constants = {
  // API base URL - uses environment configuration
  url: environment.apiUrl,
  
  // Map tile URL (for future use with Leaflet/WMS if needed)
  // Currently using Google Maps, but keeping for compatibility
  mapUrl: environment.apiUrl
};

// Data layer configuration - similar to Airspace Map
export const DATA_LAYERS = [
  {
    name: "State",
    id: "stateBoundaries",
    isActive: false,
    checked: true,
    category: 1,
  },
  {
    name: "Airport Red",
    id: "airportRed",
    isActive: false,
    checked: false,
    category: 1,
  },
  {
    name: "Airport Yellow [5-8]km",
    id: "airportYellow5_8",
    isActive: false,
    checked: false,
    category: 1,
  },
  {
    name: "Airport Yellow [8-12]km",
    id: "airportYellow8_12",
    isActive: false,
    checked: false,
    category: 1,
  },
  {
    name: "International Boundary - 25km",
    id: "internationalBoundary",
    isActive: false,
    checked: false,
    category: 1,
  },
  {
    name: "Red Zone",
    id: "redZone",
    isActive: false,
    checked: false,
    category: 1,
  },
];

