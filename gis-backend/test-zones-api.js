require('dotenv').config();
const { query } = require('./src/config/database');

async function testZones() {
    try {
        console.log('Testing zones query...');
        const result = await query(
            `SELECT id, name, type, ST_AsGeoJSON(geometry) as geometry, min_altitude, max_altitude, 
                    status, start_date, end_date, created_at, updated_at
             FROM zones
             WHERE status IN ('ACTIVE', 'DRAFT')
             ORDER BY created_at DESC`
        );
        
        console.log('Total zones:', result.rows.length);
        
        result.rows.forEach((row, index) => {
            console.log(`\nZone ${index + 1}:`);
            console.log('  Name:', row.name);
            console.log('  Type:', row.type);
            console.log('  Geometry type:', typeof row.geometry);
            console.log('  Geometry:', row.geometry ? (typeof row.geometry === 'string' ? row.geometry.substring(0, 100) + '...' : JSON.stringify(row.geometry).substring(0, 100)) : 'null');
            
            if (typeof row.geometry === 'string') {
                try {
                    const parsed = JSON.parse(row.geometry);
                    console.log('  Parsed GeoJSON type:', parsed.type);
                    console.log('  Coordinates count:', parsed.coordinates ? parsed.coordinates.length : 0);
                } catch (e) {
                    console.log('  ERROR parsing GeoJSON:', e.message);
                }
            }
        });
        
        // Test parsing
        const zones = result.rows.map(row => {
            const geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
            return {
                ...row,
                geometry: geometry
            };
        });
        
        console.log('\n✅ All zones parsed successfully!');
        console.log('Sample zone geometry:', JSON.stringify(zones[0]?.geometry, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

testZones();





