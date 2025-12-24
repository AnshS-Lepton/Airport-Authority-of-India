const { query } = require('../config/database');

/**
 * Validate GeoJSON geometry format
 */
exports.validateGeometry = (geometry) => {
    try {
        if (!geometry || typeof geometry !== 'object') {
            return false;
        }
        
        if (geometry.type === 'Point') {
            return Array.isArray(geometry.coordinates) && 
                   geometry.coordinates.length >= 2 &&
                   typeof geometry.coordinates[0] === 'number' &&
                   typeof geometry.coordinates[1] === 'number';
        }
        
        if (geometry.type === 'LineString') {
            return Array.isArray(geometry.coordinates) &&
                   geometry.coordinates.length >= 2 &&
                   geometry.coordinates.every(coord => 
                       Array.isArray(coord) && coord.length >= 2 &&
                       typeof coord[0] === 'number' && typeof coord[1] === 'number'
                   );
        }
        
        if (geometry.type === 'Polygon') {
            return Array.isArray(geometry.coordinates) &&
                   geometry.coordinates.length > 0 &&
                   geometry.coordinates.every(ring =>
                       Array.isArray(ring) && ring.length >= 4 &&
                       ring.every(coord =>
                           Array.isArray(coord) && coord.length >= 2 &&
                           typeof coord[0] === 'number' && typeof coord[1] === 'number'
                       )
                   );
        }
        
        if (geometry.type === 'MultiPolygon') {
            return Array.isArray(geometry.coordinates) &&
                   geometry.coordinates.every(polygon =>
                       Array.isArray(polygon) && polygon.length > 0
                   );
        }
        
        return false;
    } catch (error) {
        return false;
    }
};

/**
 * Check if flight plan intersects with any zones
 * Checks all production zone tables
 */
exports.checkZoneIntersections = async (geometry, minAltitude, maxAltitude, startTime, endTime) => {
    try {
        const geometryJson = JSON.stringify(geometry);
        const allIntersections = [];
        
        // 1. Check main zones table
        try {
            const zonesQuery = `SELECT 
                                    zone_id as id, 
                                    geozone_name as name, 
                                    geozone_type as type,
                                    lwr_alt as min_altitude,
                                    upr_alt as max_altitude,
                                    ST_AsGeoJSON(geom) as geometry
                                FROM zones
                                WHERE is_active = true 
                                  AND (is_visible = 1 OR is_visible IS NULL)
                                  AND ST_Intersects(geom, ST_GeomFromGeoJSON($1))
                                  AND (
                                      (lwr_alt <= $2 AND upr_alt >= $2) OR
                                      (lwr_alt <= $3 AND upr_alt >= $3) OR
                                      (lwr_alt >= $2 AND upr_alt <= $3)
               )
               AND (
                                      start_date IS NULL OR end_date IS NULL OR
                                      (start_date <= $5 AND end_date >= $4)
                                  )`;
            
            const zonesResult = await query(zonesQuery, [geometryJson, minAltitude, maxAltitude, startTime, endTime]);
            zonesResult.rows.forEach(row => {
                allIntersections.push({
                    id: row.id,
                    zoneName: row.name,
                    zoneType: row.type,
                    minAltitude: parseFloat(row.min_altitude) || 0,
                    maxAltitude: parseFloat(row.max_altitude) || 1000,
                    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                    source: 'zones'
                });
            });
        } catch (err) {
            console.error('[Validation Service] Error checking zones table:', err);
        }
        
        // 2. Check airport_region_radius_0_to_5_km
        try {
            const airport5kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-5km') as name,
                                        COALESCE(geozone_type, 'RED') as type,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        ST_AsGeoJSON(geom) as geometry
                                     FROM airport_region_radius_0_to_5_km
                                     WHERE geom IS NOT NULL
                                       AND ST_Intersects(geom, ST_GeomFromGeoJSON($1))
                                       AND (
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $2) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $3 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $3) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END >= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END <= $3)
                                       )`;
            
            const airport5kmResult = await query(airport5kmQuery, [geometryJson, minAltitude, maxAltitude]);
            airport5kmResult.rows.forEach(row => {
                allIntersections.push({
                    id: row.id,
                    zoneName: row.name,
                    zoneType: row.type,
                    minAltitude: parseFloat(row.min_altitude) || 0,
                    maxAltitude: parseFloat(row.max_altitude) || 1000,
                    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                    source: 'airport_0_5km'
                });
            });
        } catch (err) {
            console.error('[Validation Service] Error checking airport_region_radius_0_to_5_km:', err);
        }
        
        // 3. Check airport_region_radius_0_to_8_km
        try {
            const airport8kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-8km') as name,
                                        COALESCE(geozone_type, 'YELLOW') as type,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        ST_AsGeoJSON(geom) as geometry
                                     FROM airport_region_radius_0_to_8_km
                                     WHERE geom IS NOT NULL
                                       AND ST_Intersects(geom, ST_GeomFromGeoJSON($1))
                                       AND (
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $2) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $3 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $3) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END >= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END <= $3)
                                       )`;
            
            const airport8kmResult = await query(airport8kmQuery, [geometryJson, minAltitude, maxAltitude]);
            airport8kmResult.rows.forEach(row => {
                allIntersections.push({
                    id: row.id,
                    zoneName: row.name,
                    zoneType: row.type,
                    minAltitude: parseFloat(row.min_altitude) || 0,
                    maxAltitude: parseFloat(row.max_altitude) || 1000,
                    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                    source: 'airport_0_8km'
                });
            });
        } catch (err) {
            console.error('[Validation Service] Error checking airport_region_radius_0_to_8_km:', err);
        }
        
        // 4. Check airport_region_radius_0_to_12_km_yellow
        try {
            const airport12kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-12km') as name,
                                        COALESCE(geozone_type, 'YELLOW') as type,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        ST_AsGeoJSON(geom) as geometry
                                     FROM airport_region_radius_0_to_12_km_yellow
                                     WHERE geom IS NOT NULL
                                       AND ST_Intersects(geom, ST_GeomFromGeoJSON($1))
                                       AND (
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $2) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $3 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $3) OR
                                           (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END >= $2 
                                            AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END <= $3)
                                       )`;
            
            const airport12kmResult = await query(airport12kmQuery, [geometryJson, minAltitude, maxAltitude]);
            airport12kmResult.rows.forEach(row => {
                allIntersections.push({
                    id: row.id,
                    zoneName: row.name,
                    zoneType: row.type,
                    minAltitude: parseFloat(row.min_altitude) || 0,
                    maxAltitude: parseFloat(row.max_altitude) || 1000,
                    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                    source: 'airport_0_12km'
                });
            });
        } catch (err) {
            console.error('[Validation Service] Error checking airport_region_radius_0_to_12_km_yellow:', err);
        }
        
        // 5. Check coastal_area_india_region_25km
        try {
            const coastalQuery = `SELECT 
                                    gid as id,
                                    COALESCE(geozone_name, name, 'Coastal/International Boundary 25km') as name,
                                    COALESCE(geozone_type, 'RED') as type,
                                    CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                    CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                    ST_AsGeoJSON(geom) as geometry
                                 FROM coastal_area_india_region_25km
                                 WHERE geom IS NOT NULL
                                   AND ST_Intersects(geom, ST_GeomFromGeoJSON($1))
                                   AND (
                                       (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $2 
                                        AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $2) OR
                                       (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END <= $3 
                                        AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END >= $3) OR
                                       (CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END >= $2 
                                        AND CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END <= $3)
                                   )`;
            
            const coastalResult = await query(coastalQuery, [geometryJson, minAltitude, maxAltitude]);
            coastalResult.rows.forEach(row => {
                allIntersections.push({
            id: row.id,
            zoneName: row.name,
            zoneType: row.type,
                    minAltitude: parseFloat(row.min_altitude) || 0,
                    maxAltitude: parseFloat(row.max_altitude) || 1000,
                    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                    source: 'coastal_25km'
                });
            });
        } catch (err) {
            console.error('[Validation Service] Error checking coastal_area_india_region_25km:', err);
        }
        
        return allIntersections;
    } catch (error) {
        console.error('[Validation Service] Check intersections error:', error);
        throw error;
    }
};

/**
 * Validate flight plan against zones
 */
exports.validateFlightPlanAgainstZones = async (geometry, minAltitude, maxAltitude, startTime, endTime) => {
    try {
        const intersections = await exports.checkZoneIntersections(
            geometry,
            minAltitude,
            maxAltitude,
            startTime,
            endTime
        );
        
        // Check for RED zones (prohibited)
        const redZones = intersections.filter(z => z.zoneType === 'RED');
        if (redZones.length > 0) {
            return {
                valid: false,
                message: 'Flight plan intersects with prohibited (RED) zones',
                intersections: intersections,
                blockingZones: redZones
            };
        }
        
        // Check for YELLOW zones (restricted - may need special permission)
        const yellowZones = intersections.filter(z => z.zoneType === 'YELLOW');
        if (yellowZones.length > 0) {
            return {
                valid: true,
                message: 'Flight plan intersects with restricted (YELLOW) zones - may require special permission',
                intersections: intersections,
                warnings: yellowZones
            };
        }
        
        // GREEN zones are permitted, so no issue
        
        if (intersections.length === 0) {
            return {
                valid: true,
                message: 'Flight plan is valid - no zone conflicts',
                intersections: []
            };
        }
        
        return {
            valid: true,
            message: 'Flight plan is valid',
            intersections: intersections
        };
    } catch (error) {
        console.error('[Validation Service] Validate flight plan error:', error);
        throw error;
    }
};

