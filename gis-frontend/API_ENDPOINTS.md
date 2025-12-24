# API Endpoints Documentation

This document describes the backend API endpoints used by the Angular frontend to display zones and flight plans on the map.

## Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: Configured in `src/environments/environment.prod.ts`

## Zone Endpoints

### 1. Get All Zones (with optional filters)
**Endpoint**: `GET /api/zones`

**Query Parameters**:
- `type` (optional): Filter by zone type (`RED`, `YELLOW`, `GREEN`)
- `category` (optional): Filter by category (`AIRPORT`, `TEMPORARY`, `BOUNDARY`, `STATE`, `ZONE`)
- `distance` (optional): Filter by distance (e.g., `25`, `5`, `8`, `12`)

**Authentication**: Not required (public endpoint)

**Response**: Array of zone objects with geometry in GeoJSON format

**Example Requests**:
```
GET /api/zones                                    # Get all zones
GET /api/zones?type=RED                           # Get all red zones
GET /api/zones?type=RED&category=AIRPORT          # Get red airport zones
GET /api/zones?category=BOUNDARY&distance=25       # Get boundary zones (25km)
GET /api/zones?type=YELLOW&category=AIRPORT      # Get yellow airport zones
```

**Data Sources**:
The endpoint queries multiple database tables:
- `zones` - Main zones table (when type/category filters are provided)
- `airport_region_radius_0_to_5_km` - Airport red zones (0-5km)
- `airport_region_radius_0_to_8_km` - Airport yellow zones (0-8km)
- `airport_region_radius_0_to_12_km_yellow` - Airport yellow zones (0-12km)
- `coastal_area_india_region_25km` - International boundary zones (25km)

**Zone Object Structure**:
```json
{
  "id": 1,
  "name": "Zone Name",
  "type": "RED",
  "category": "AIRPORT",
  "distance": "5",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "min_altitude": 0,
  "max_altitude": 1000,
  "status": "ACTIVE",
  "source": "airport_0_5km"
}
```

### 2. Get Zone by ID
**Endpoint**: `GET /api/zones/:id`

**Query Parameters**:
- `source` (optional): Specify source table (`zones`, `airport_0_5km`, `airport_0_8km`, `airport_0_12km`, `coastal_25km`)

**Authentication**: Not required (public endpoint)

**Example**:
```
GET /api/zones/123?source=airport_0_8km
```

## Flight Plan Endpoints

### 1. Get All Flight Plans (for map view)
**Endpoint**: `GET /api/flight-plans`

**Authentication**: Required (but may return empty array if not authenticated)

**Response**: Array of flight plan objects with geometry in GeoJSON format

**Flight Plan Object Structure**:
```json
{
  "id": 1,
  "reference_id": "FP-1234567890-ABC123",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng, lat], ...]
  },
  "start_time": "2024-01-01T10:00:00Z",
  "end_time": "2024-01-01T12:00:00Z",
  "min_altitude": 100,
  "max_altitude": 500,
  "drone_type": "UAV",
  "operation_type": "Flight Operation",
  "status": "APPROVED"
}
```

### 2. Validate Flight Plan
**Endpoint**: `POST /api/flight-plans/validate`

**Authentication**: Required (PILOT role)

**Request Body**:
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "start_time": "2024-01-01T10:00:00Z",
  "end_time": "2024-01-01T12:00:00Z",
  "min_altitude": 100,
  "max_altitude": 500
}
```

**Response**:
```json
{
  "valid": true,
  "blockingZones": [],
  "warnings": []
}
```

### 3. Create Flight Plan
**Endpoint**: `POST /api/flight-plans`

**Authentication**: Required (PILOT role)

**Request Body**: Same as validate, plus:
```json
{
  "drone_type": "UAV",
  "operation_type": "Flight Operation",
  "status": "SUBMITTED"
}
```

## Configuration Endpoints

### Get Google Maps API Key
**Endpoint**: `GET /api/config/maps-key`

**Authentication**: Not required

**Response**:
```json
{
  "apiKey": "YOUR_GOOGLE_MAPS_API_KEY",
  "libraries": "drawing,geometry"
}
```

## Frontend Usage

### Zone Service Methods:
- `getZones()` → `GET /api/zones`
- `getZonesByTypeAndCategory(type, category)` → `GET /api/zones?type={type}&category={category}`
- `getZonesByCategory(category, distance)` → `GET /api/zones?category={category}&distance={distance}`
- `getGeneralRedZones()` → `GET /api/zones?type=RED` (filters out AIRPORT and TEMPORARY)
- `getZoneById(id, source)` → `GET /api/zones/{id}?source={source}`

### Flight Plan Service Methods:
- `getFlightPlans()` → `GET /api/flight-plans`
- `validateFlightPlan(data)` → `POST /api/flight-plans/validate`
- `createFlightPlan(data)` → `POST /api/flight-plans`

### Config Service Methods:
- `getGoogleMapsApiKey()` → `GET /api/config/maps-key`

## Notes

1. **Zone Filtering**: The `getAllZones` endpoint only queries the main `zones` table when `type` or `category` filters are provided. Without filters, it only returns zones from airport and boundary tables.

2. **Source Field**: Each zone includes a `source` field indicating which table it came from:
   - `zones` - Main zones table
   - `airport_0_5km` - Airport red zones (0-5km)
   - `airport_0_8km` - Airport yellow zones (0-8km)
   - `airport_0_12km` - Airport yellow zones (0-12km)
   - `coastal_25km` - International boundary (25km)

3. **Authentication**: Most endpoints require authentication, but the zone GET endpoints are public for map display purposes.


