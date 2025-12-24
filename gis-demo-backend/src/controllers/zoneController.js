const { query } = require('../config/database');
const { validateGeometry, checkZoneIntersections } = require('../services/validationService');

// In-memory cache for zones (sub-millisecond responses)
const zoneCache = {
    stateBoundaries: { data: null, timestamp: 0, ttl: 24 * 60 * 60 * 1000 }, // 24 hours
    allZones: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 }, // 1 hour
    airportRed: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 },
    airportYellow: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 }
};

const getCached = (key) => {
    const cached = zoneCache[key];
    if (!cached || !cached.data) return null;
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
        zoneCache[key] = { data: null, timestamp: 0, ttl: cached.ttl };
        return null;
    }
    return cached.data;
};

const setCached = (key, data, ttl) => {
    zoneCache[key] = { data, timestamp: Date.now(), ttl: ttl || 60 * 60 * 1000 };
};

exports.getAllZones = async (req, res) => {
    try {
        const { type, category, distance } = req.query;
        
        // Query all zone tables and combine results
        const allZones = [];
        
        // 1. Query main zones table - Always query zones table with base criteria
        // Query: Get zones with end_date >= now() and status_code = 2
        // All zones are treated as RED ZONE
        // Check cache first
        const cached = getCached('allZones');
        if (cached && !type && !category && !distance) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }
        
        // Use ST_Simplify with higher tolerance for maximum performance
        // Tolerance of 0.001 degrees (~111 meters) for faster queries
        let zonesQuery = `SELECT 
                            zone_id as id, 
                            geozone_name as name, 
                            'RED' as type,
                            'RED ZONE' as category,
                            NULL as distance,
                            ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geometry,
                            lwr_alt as min_altitude,
                            upr_alt as max_altitude,
                            CASE WHEN is_active = true THEN 'ACTIVE' ELSE 'INACTIVE' END as status,
                            start_date,
                            end_date,
                            created_on as created_at,
                            approved_on as updated_at
                         FROM zones
                         WHERE end_date >= NOW() 
                         AND status_code = 2
                         AND geom IS NOT NULL`;
        
        const zonesParams = [];
        let paramCount = 1;
        
        // No type or category filtering in SQL - return all zones matching base criteria
        // Base criteria: end_date >= NOW() AND status_code = 2
        // Frontend will filter by type/category based on Visualization menu
        
        try {
            const zonesResult = await query(zonesQuery, zonesParams);
            zonesResult.rows.forEach(row => {
                let geometry = row.geometry;
                if (typeof geometry === 'string') {
                    try {
                        geometry = JSON.parse(geometry);
                    } catch (e) {
                        console.error('Error parsing geometry:', e);
                        geometry = null;
                    }
                }
                if (geometry) {
                    allZones.push({
                        ...row,
                        geometry: geometry,
                        source: 'zones'
                    });
                }
            });
        } catch (err) {
            console.error('[Zone Controller] Error querying zones table:', err);
        }
        
        // 2. Query airport_region_radius_0_to_5_km (Airport Red)
        try {
            const airport5kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-5km') as name,
                                        'RED' as type,
                                        'AIRPORT' as category,
                                        '5' as distance,
                                        ST_AsGeoJSON(geom) as geometry,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        'ACTIVE' as status,
                                        NULL as start_date,
                                        NULL as end_date,
                                        NULL as created_at,
                                        NULL as updated_at
                                     FROM airport_region_radius_0_to_5_km
                                     WHERE geom IS NOT NULL`;
            
            const airport5kmResult = await query(airport5kmQuery);
            airport5kmResult.rows.forEach(row => {
                let geometry = row.geometry;
                if (typeof geometry === 'string') {
                    try {
                        geometry = JSON.parse(geometry);
                    } catch (e) {
                        console.error('Error parsing geometry:', e);
                        geometry = null;
                    }
                }
                if (geometry) {
                    allZones.push({
                        ...row,
                        geometry: geometry,
                        source: 'airport_0_5km'
                    });
                }
            });
        } catch (err) {
            console.error('[Zone Controller] Error querying airport_region_radius_0_to_5_km:', err);
        }
        
        // 3. Query airport_region_radius_0_to_8_km (Airport Yellow 5-8km)
        try {
            const airport8kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-8km') as name,
                                        'YELLOW' as type,
                                        'AIRPORT' as category,
                                        '8' as distance,
                                        ST_AsGeoJSON(geom) as geometry,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        'ACTIVE' as status,
                                        NULL as start_date,
                                        NULL as end_date,
                                        NULL as created_at,
                                        NULL as updated_at
                                     FROM airport_region_radius_0_to_8_km
                                     WHERE geom IS NOT NULL`;
            
            const airport8kmResult = await query(airport8kmQuery);
            airport8kmResult.rows.forEach(row => {
                let geometry = row.geometry;
                if (typeof geometry === 'string') {
                    try {
                        geometry = JSON.parse(geometry);
                    } catch (e) {
                        console.error('Error parsing geometry:', e);
                        geometry = null;
                    }
                }
                if (geometry) {
                    allZones.push({
                        ...row,
                        geometry: geometry,
                        source: 'airport_0_8km'
                    });
                }
            });
        } catch (err) {
            console.error('[Zone Controller] Error querying airport_region_radius_0_to_8_km:', err);
        }
        
        // 4. Query airport_region_radius_0_to_12_km_yellow (Airport Yellow 8-12km)
        try {
            const airport12kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-12km') as name,
                                        'YELLOW' as type,
                                        'AIRPORT' as category,
                                        '12' as distance,
                                        ST_AsGeoJSON(geom) as geometry,
                                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                        'ACTIVE' as status,
                                        NULL as start_date,
                                        NULL as end_date,
                                        NULL as created_at,
                                        NULL as updated_at
                                     FROM airport_region_radius_0_to_12_km_yellow
                                     WHERE geom IS NOT NULL`;
            
            const airport12kmResult = await query(airport12kmQuery);
            airport12kmResult.rows.forEach(row => {
                let geometry = row.geometry;
                if (typeof geometry === 'string') {
                    try {
                        geometry = JSON.parse(geometry);
                    } catch (e) {
                        console.error('Error parsing geometry:', e);
                        geometry = null;
                    }
                }
                if (geometry) {
                    allZones.push({
                        ...row,
                        geometry: geometry,
                        source: 'airport_0_12km',
                        distance: '12'  // Ensure distance is explicitly set
                    });
                }
            });
        } catch (err) {
            console.error('[Zone Controller] Error querying airport_region_radius_0_to_12_km_yellow:', err);
        }
        
        // 5. Query coastal_area_india_region_25km (International Boundary 25km)
        try {
            const coastalQuery = `SELECT 
                                    gid as id,
                                    COALESCE(geozone_name, name, 'Coastal/International Boundary 25km') as name,
                                    'RED' as type,
                                    'BOUNDARY' as category,
                                    '25' as distance,
                                    ST_AsGeoJSON(geom) as geometry,
                                    CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                                    CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                                    'ACTIVE' as status,
                                    NULL as start_date,
                                    NULL as end_date,
                                    NULL as created_at,
                                    NULL as updated_at
                                 FROM coastal_area_india_region_25km
                                 WHERE geom IS NOT NULL`;
            
            const coastalResult = await query(coastalQuery);
            coastalResult.rows.forEach(row => {
            let geometry = row.geometry;
            if (typeof geometry === 'string') {
                try {
                    geometry = JSON.parse(geometry);
                } catch (e) {
                        console.error('Error parsing geometry:', e);
                    geometry = null;
                }
            }
                if (geometry) {
                    allZones.push({
                ...row,
                        geometry: geometry,
                        source: 'coastal_25km'
                    });
                }
            });
        } catch (err) {
            console.error('[Zone Controller] Error querying coastal_area_india_region_25km:', err);
        }
        
        // Apply filters if provided
        let filteredZones = allZones;
        
        if (type) {
            filteredZones = filteredZones.filter(z => z.type === type.toUpperCase());
        }
        
        if (category) {
            filteredZones = filteredZones.filter(z => z.category === category.toUpperCase());
        }
        
        if (distance) {
            filteredZones = filteredZones.filter(z => z.distance === distance);
        }
        
        // Cache full result if no filters
        if (!type && !category && !distance) {
            setCached('allZones', filteredZones, 60 * 60 * 1000); // 1 hour
        }
        
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
        res.json(filteredZones);
    } catch (error) {
        console.error('[Zone Controller] Get all zones error:', error);
        res.status(500).json({ message: 'Failed to fetch zones', error: error.message });
    }
};

exports.getZoneById = async (req, res) => {
    try {
        const { id } = req.params;
        const { source } = req.query; // Get source from query parameter
        
        let zone = null;
        let queryResult;
        
        // Determine which table to query based on source
        // If no source provided, try zones table first (default)
        if (!source || source === 'zones') {
            // Query zones table with production column names
            try {
                queryResult = await query(
                    `SELECT 
                        zone_id as id,
                        zone_id as dsr_number,
                        geozone_name as name,
                        CASE 
                            WHEN UPPER(geozone_type) LIKE '%RED%' OR UPPER(geozone_type) LIKE '%RESTRICTION%' OR UPPER(geozone_type) LIKE '%PROHIBIT%' THEN 'RED'
                            WHEN UPPER(geozone_type) LIKE '%YELLOW%' OR UPPER(geozone_type) LIKE '%RESTRICT%' THEN 'YELLOW'
                            WHEN UPPER(geozone_type) LIKE '%GREEN%' OR UPPER(geozone_type) LIKE '%PERMIT%' THEN 'GREEN'
                            ELSE UPPER(geozone_type)
                        END as type,
                        CASE 
                            WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN 'TEMPORARY'
                            ELSE 'ZONE'
                        END as category,
                        start_date,
                        end_date,
                        lwr_alt as min_altitude,
                        upr_alt as max_altitude,
                        CASE WHEN is_active = true THEN 'ACTIVE' ELSE 'INACTIVE' END as status,
                        created_on as created_at,
                        COALESCE(created_by::text, 'N/A') as created_by,
                        ST_AsGeoJSON(geom) as geometry
                     FROM zones
                     WHERE zone_id = $1 AND is_active = true AND (is_visible = 1 OR is_visible IS NULL)`,
                    [id]
                );
                
                if (queryResult.rows.length > 0) {
                    zone = queryResult.rows[0];
                    zone.source = 'zones';
                }
            } catch (dbError) {
                // If created_by column doesn't exist, try query without it
                console.error('[Zone Controller] Primary query failed, trying fallback:', dbError.message);
                try {
                    queryResult = await query(
                        `SELECT 
                            zone_id as id,
                            zone_id as dsr_number,
                            geozone_name as name,
                            CASE 
                                WHEN UPPER(geozone_type) LIKE '%RED%' OR UPPER(geozone_type) LIKE '%RESTRICTION%' OR UPPER(geozone_type) LIKE '%PROHIBIT%' THEN 'RED'
                                WHEN UPPER(geozone_type) LIKE '%YELLOW%' OR UPPER(geozone_type) LIKE '%RESTRICT%' THEN 'YELLOW'
                                WHEN UPPER(geozone_type) LIKE '%GREEN%' OR UPPER(geozone_type) LIKE '%PERMIT%' THEN 'GREEN'
                                ELSE UPPER(geozone_type)
                            END as type,
                            CASE 
                                WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN 'TEMPORARY'
                                ELSE 'ZONE'
                            END as category,
                            start_date,
                            end_date,
                            lwr_alt as min_altitude,
                            upr_alt as max_altitude,
                            CASE WHEN is_active = true THEN 'ACTIVE' ELSE 'INACTIVE' END as status,
                            created_on as created_at,
                            'N/A' as created_by,
                            ST_AsGeoJSON(geom) as geometry
                         FROM zones
                         WHERE zone_id = $1 AND is_active = true AND (is_visible = 1 OR is_visible IS NULL)`,
                        [id]
                    );
                    
                    if (queryResult.rows.length > 0) {
                        zone = queryResult.rows[0];
                        zone.source = 'zones';
                    }
                } catch (fallbackError) {
                    console.error('[Zone Controller] Fallback query also failed:', fallbackError.message);
                }
            }
        } else if (source === 'airport_0_5km') {
            // Query airport_region_radius_0_to_5_km table
            try {
                queryResult = await query(
                    `SELECT 
                        gid as id,
                        gid as dsr_number,
                        COALESCE(geozone_name, name, 'Airport Zone 0-5km') as name,
                        'RED' as type,
                        'AIRPORT' as category,
                        NULL as start_date,
                        NULL as end_date,
                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                        'ACTIVE' as status,
                        NULL as created_at,
                        'N/A' as created_by,
                        ST_AsGeoJSON(geom) as geometry
                     FROM airport_region_radius_0_to_5_km
                     WHERE gid = $1 AND geom IS NOT NULL`,
                    [id]
                );
                
                if (queryResult.rows.length > 0) {
                    zone = queryResult.rows[0];
                    zone.source = 'airport_0_5km';
                    zone.distance = '5';
                }
            } catch (dbError) {
                console.error('[Zone Controller] Error querying airport_0_5km:', dbError.message);
            }
        } else if (source === 'airport_0_8km') {
            // Query airport_region_radius_0_to_8_km table
            try {
                queryResult = await query(
                    `SELECT 
                        gid as id,
                        gid as dsr_number,
                        COALESCE(geozone_name, name, 'Airport Zone 0-8km') as name,
                        'YELLOW' as type,
                        'AIRPORT' as category,
                        NULL as start_date,
                        NULL as end_date,
                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                        'ACTIVE' as status,
                        NULL as created_at,
                        'N/A' as created_by,
                        ST_AsGeoJSON(geom) as geometry
                     FROM airport_region_radius_0_to_8_km
                     WHERE gid = $1 AND geom IS NOT NULL`,
                    [id]
                );
                
                if (queryResult.rows.length > 0) {
                    zone = queryResult.rows[0];
                    zone.source = 'airport_0_8km';
                    zone.distance = '8';
                }
            } catch (dbError) {
                console.error('[Zone Controller] Error querying airport_0_8km:', dbError.message);
            }
        } else if (source === 'airport_0_12km') {
            // Query airport_region_radius_0_to_12_km_yellow table
            try {
                queryResult = await query(
                    `SELECT 
                        gid as id,
                        gid as dsr_number,
                        COALESCE(geozone_name, name, 'Airport Zone 0-12km') as name,
                        'YELLOW' as type,
                        'AIRPORT' as category,
                        NULL as start_date,
                        NULL as end_date,
                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                        'ACTIVE' as status,
                        NULL as created_at,
                        'N/A' as created_by,
                        ST_AsGeoJSON(geom) as geometry
                     FROM airport_region_radius_0_to_12_km_yellow
                     WHERE gid = $1 AND geom IS NOT NULL`,
                    [id]
                );
                
                if (queryResult.rows.length > 0) {
                    zone = queryResult.rows[0];
                    zone.source = 'airport_0_12km';
                    zone.distance = '12';
                }
            } catch (dbError) {
                console.error('[Zone Controller] Error querying airport_0_12km:', dbError.message);
            }
        } else if (source === 'coastal_25km') {
            // Query coastal_area_india_region_25km table
            try {
                queryResult = await query(
                    `SELECT 
                        gid as id,
                        gid as dsr_number,
                        COALESCE(geozone_name, name, 'Coastal/International Boundary 25km') as name,
                        'RED' as type,
                        'BOUNDARY' as category,
                        NULL as start_date,
                        NULL as end_date,
                        CASE WHEN lwr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(lwr_alt AS numeric) ELSE 0 END as min_altitude,
                        CASE WHEN upr_alt ~ '^[0-9]+\.?[0-9]*$' THEN CAST(upr_alt AS numeric) ELSE 1000 END as max_altitude,
                        'ACTIVE' as status,
                        NULL as created_at,
                        'N/A' as created_by,
                        ST_AsGeoJSON(geom) as geometry
                     FROM coastal_area_india_region_25km
                     WHERE gid = $1 AND geom IS NOT NULL`,
                    [id]
                );
                
                if (queryResult.rows.length > 0) {
                    zone = queryResult.rows[0];
                    zone.source = 'coastal_25km';
                    zone.distance = '25';
                }
            } catch (dbError) {
                console.error('[Zone Controller] Error querying coastal_25km:', dbError.message);
            }
        }
        
        if (!zone) {
            return res.status(404).json({ message: 'Zone not found' });
        }
        
        // Parse GeoJSON string to object
        if (zone.geometry && typeof zone.geometry === 'string') {
            try {
                zone.geometry = JSON.parse(zone.geometry);
            } catch (e) {
                console.error('Error parsing geometry for zone:', zone.name, e);
                zone.geometry = null;
            }
        }
        
        // Format dates - only format if they exist (TEMPORARY zones)
        if (zone.start_date) {
            zone.start_date = new Date(zone.start_date).toISOString().split('T')[0];
        }
        if (zone.end_date) {
            zone.end_date = new Date(zone.end_date).toISOString().split('T')[0];
        }
        if (zone.created_at) {
            zone.created_at = new Date(zone.created_at).toISOString().split('T')[0];
        }
        
        // Format category display name
        if (zone.category === 'TEMPORARY' && zone.type === 'RED') {
            zone.category_display = 'Temporary Red Zone';
            zone.type_display = 'Temporary Red Zone';
        } else if (zone.category === 'AIRPORT' && zone.type === 'RED') {
            zone.category_display = 'Airport Red Zone';
            zone.type_display = 'Airport Red Zone';
        } else if (zone.category === 'AIRPORT' && zone.type === 'YELLOW') {
            zone.category_display = 'Airport Yellow Zone';
            zone.type_display = 'Airport Yellow Zone';
        } else if (zone.type === 'RED' && zone.category !== 'TEMPORARY') {
            zone.category_display = 'Red Zone';
            zone.type_display = 'Red Zone';
        } else if (zone.type === 'YELLOW') {
            zone.category_display = 'Yellow Zone';
            zone.type_display = 'Yellow Zone';
        } else if (zone.category === 'BOUNDARY') {
            zone.category_display = 'International Boundary';
            zone.type_display = 'International Boundary';
        } else {
            zone.category_display = zone.category || 'Zone';
            zone.type_display = zone.type || 'Zone';
        }
        
        res.json(zone);
    } catch (error) {
        console.error('[Zone Controller] Get zone by ID error:', error);
        res.status(500).json({ message: 'Failed to fetch zone', error: error.message });
    }
};

exports.createZone = async (req, res) => {
    try {
        const { name, type, category, distance, geometry, min_altitude, max_altitude, start_date, end_date } = req.body;
        
        if (!name || !type || !geometry || min_altitude === undefined || max_altitude === undefined) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Validate geometry
        if (!validateGeometry(geometry)) {
            return res.status(400).json({ message: 'Invalid geometry format' });
        }
        
        // Validate zone type
        const validTypes = ['RED', 'YELLOW', 'GREEN'];
        if (!validTypes.includes(type.toUpperCase())) {
            return res.status(400).json({ message: 'Invalid zone type' });
        }
        
        // Check for duplicate name
        const existingZone = await query(
            'SELECT id FROM zones WHERE name = $1',
            [name]
        );
        
        if (existingZone.rows.length > 0) {
            return res.status(400).json({ message: 'Zone name already exists' });
        }
        
        // Insert zone
        const result = await query(
            `INSERT INTO zones (name, type, category, distance, geometry, min_altitude, max_altitude, 
                              start_date, end_date, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, $7, $8, $9, 'DRAFT', NOW(), NOW())
             RETURNING id, name, type, category, distance, ST_AsGeoJSON(geometry) as geometry, 
                      min_altitude, max_altitude, status, start_date, end_date, created_at`,
            [name, type.toUpperCase(), category || null, distance || null, JSON.stringify(geometry), 
             min_altitude, max_altitude, start_date || null, end_date || null]
        );
        
        const zone = result.rows[0];
        zone.geometry = JSON.parse(zone.geometry);
        
        res.status(201).json({
            message: 'Zone created successfully',
            zone
        });
    } catch (error) {
        console.error('[Zone Controller] Create zone error:', error);
        res.status(500).json({ message: 'Failed to create zone', error: error.message });
    }
};

exports.updateZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, geometry, min_altitude, max_altitude, start_date, end_date } = req.body;
        
        // Check if zone exists
        const existingZone = await query(
            'SELECT id, status FROM zones WHERE id = $1',
            [id]
        );
        
        if (existingZone.rows.length === 0) {
            return res.status(404).json({ message: 'Zone not found' });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (name) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        
        if (type) {
            const validTypes = ['RED', 'YELLOW', 'GREEN'];
            if (!validTypes.includes(type.toUpperCase())) {
                return res.status(400).json({ message: 'Invalid zone type' });
            }
            updates.push(`type = $${paramCount++}`);
            values.push(type.toUpperCase());
        }
        
        if (geometry) {
            if (!validateGeometry(geometry)) {
                return res.status(400).json({ message: 'Invalid geometry format' });
            }
            updates.push(`geometry = ST_GeomFromGeoJSON($${paramCount++})`);
            values.push(JSON.stringify(geometry));
        }
        
        if (min_altitude !== undefined) {
            updates.push(`min_altitude = $${paramCount++}`);
            values.push(min_altitude);
        }
        
        if (max_altitude !== undefined) {
            updates.push(`max_altitude = $${paramCount++}`);
            values.push(max_altitude);
        }
        
        if (start_date !== undefined) {
            updates.push(`start_date = $${paramCount++}`);
            values.push(start_date || null);
        }
        
        if (end_date !== undefined) {
            updates.push(`end_date = $${paramCount++}`);
            values.push(end_date || null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(id);
        
        const updateQuery = `
            UPDATE zones 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, name, type, ST_AsGeoJSON(geometry) as geometry, 
                     min_altitude, max_altitude, status, start_date, end_date, updated_at
        `;
        
        const result = await query(updateQuery, values);
        const zone = result.rows[0];
        zone.geometry = JSON.parse(zone.geometry);
        
        res.json({
            message: 'Zone updated successfully',
            zone
        });
    } catch (error) {
        console.error('[Zone Controller] Update zone error:', error);
        res.status(500).json({ message: 'Failed to update zone', error: error.message });
    }
};

exports.deleteZone = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            'DELETE FROM zones WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Zone not found' });
        }
        
        res.json({ message: 'Zone deleted successfully' });
    } catch (error) {
        console.error('[Zone Controller] Delete zone error:', error);
        res.status(500).json({ message: 'Failed to delete zone', error: error.message });
    }
};

exports.submitZoneForApproval = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `UPDATE zones 
             SET status = 'ACTIVE', updated_at = NOW()
             WHERE id = $1 AND status = 'DRAFT'
             RETURNING id, name, type, status`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Zone not found or already active' });
        }
        
        res.json({
            message: 'Zone submitted for approval',
            zone: result.rows[0]
        });
    } catch (error) {
        console.error('[Zone Controller] Submit zone error:', error);
        res.status(500).json({ message: 'Failed to submit zone', error: error.message });
    }
};

exports.deleteExpiredTemporaryZones = async (req, res) => {
    try {
        // Delete expired temporary zones (where end_date < NOW())
        const result = await query(
            `DELETE FROM zones 
             WHERE start_date IS NOT NULL 
             AND end_date IS NOT NULL 
             AND end_date < NOW()
             RETURNING zone_id as id, geozone_name as name, end_date`
        );
        
        const deletedCount = result.rows.length;
        
        console.log(`[Zone Controller] Deleted ${deletedCount} expired temporary zones`);
        
        res.json({
            message: `Successfully deleted ${deletedCount} expired temporary zone(s)`,
            deletedCount: deletedCount,
            deletedZones: result.rows
        });
    } catch (error) {
        console.error('[Zone Controller] Delete expired temporary zones error:', error);
        res.status(500).json({ message: 'Failed to delete expired temporary zones', error: error.message });
    }
};

// Get all state boundaries from state_boundary_gis table
exports.getStateBoundaries = async (req, res) => {
    try {
        // Check in-memory cache first (sub-millisecond response)
        const cached = getCached('stateBoundaries');
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }
        
        // Use ST_Simplify with higher tolerance for faster queries
        // Tolerance of 0.001 degrees (~111 meters) for maximum performance
        const stateQuery = `SELECT 
                            id,
                            state_name as name,
                            state_code as code,
                            ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geometry
                         FROM state_boundary_gis
                         WHERE geom IS NOT NULL`;
        
        const result = await query(stateQuery);
        
        const states = result.rows.map(row => {
            let geometry = row.geometry;
            if (typeof geometry === 'string') {
                try {
                    geometry = JSON.parse(geometry);
                } catch (e) {
                    console.error('Error parsing state geometry:', e);
                    geometry = null;
                }
            }
            
            return {
                id: row.id,
                name: row.name,
                code: row.code,
                geometry: geometry,
                category: 'STATE_BOUNDARY',
                type: 'GREEN'
            };
        }).filter(state => state.geometry !== null);
        
        // Cache the result for 24 hours
        setCached('stateBoundaries', states, 24 * 60 * 60 * 1000);
        
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
        console.log(`[Zone Controller] Retrieved ${states.length} state boundaries (cached)`);
        res.json(states);
    } catch (error) {
        console.error('[Zone Controller] Get state boundaries error:', error);
        res.status(500).json({ message: 'Failed to get state boundaries', error: error.message });
    }
};

