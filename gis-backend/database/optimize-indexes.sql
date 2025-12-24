-- Performance Optimization Indexes
-- Run this script to create indexes for sub-millisecond queries

-- Index on state_boundary_gis for faster state boundary queries
CREATE INDEX IF NOT EXISTS idx_state_boundary_gis_geom 
ON state_boundary_gis USING GIST (geom);

-- Index on zones table for faster filtering
CREATE INDEX IF NOT EXISTS idx_zones_end_date_status 
ON zones (end_date, status_code) 
WHERE end_date >= NOW() AND status_code = 2;

-- Index on zones geometry (if not exists)
CREATE INDEX IF NOT EXISTS idx_zones_geom 
ON zones USING GIST (geom) 
WHERE geom IS NOT NULL;

-- Index on airport tables for faster queries
CREATE INDEX IF NOT EXISTS idx_airport_5km_geom 
ON airport_region_radius_0_to_5_km USING GIST (geom) 
WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_8km_geom 
ON airport_region_radius_0_to_8_km USING GIST (geom) 
WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_12km_geom 
ON airport_region_radius_0_to_12_km_yellow USING GIST (geom) 
WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coastal_25km_geom 
ON coastal_area_india_region_25km USING GIST (geom) 
WHERE geom IS NOT NULL;

-- Analyze tables to update statistics for query planner
ANALYZE state_boundary_gis;
ANALYZE zones;
ANALYZE airport_region_radius_0_to_5_km;
ANALYZE airport_region_radius_0_to_8_km;
ANALYZE airport_region_radius_0_to_12_km_yellow;
ANALYZE coastal_area_india_region_25km;

