require('dotenv').config();
const { query, pool } = require('./src/config/database');

async function testProductionTables() {
    try {
        console.log('\n=== Testing Production Database Tables ===\n');
        
        // Test connection
        console.log('1. Testing database connection...');
        const connectionTest = await query('SELECT NOW() as current_time');
        console.log('✅ Database connected. Current time:', connectionTest.rows[0].current_time);
        
        // Check if tables exist
        console.log('\n2. Checking if tables exist...');
        const tablesToCheck = [
            'zones',
            'airport_region_radius_0_to_5_km',
            'airport_region_radius_0_to_8_km',
            'airport_region_radius_0_to_12_km_yellow',
            'coastal_area_india_region_25km'
        ];
        
        for (const tableName of tablesToCheck) {
            try {
                const result = await query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    ) as exists
                `, [tableName]);
                
                const exists = result.rows[0].exists;
                console.log(`   ${exists ? '✅' : '❌'} Table "${tableName}": ${exists ? 'EXISTS' : 'NOT FOUND'}`);
                
                if (exists) {
                    // Count rows
                    try {
                        const countResult = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
                        const count = countResult.rows[0].count;
                        console.log(`      └─ Rows: ${count}`);
                    } catch (err) {
                        console.log(`      └─ Error counting rows: ${err.message}`);
                    }
                }
            } catch (err) {
                console.log(`   ❌ Error checking table "${tableName}": ${err.message}`);
            }
        }
        
        // Test querying airport_region_radius_0_to_5_km
        console.log('\n3. Testing query on airport_region_radius_0_to_5_km...');
        try {
            const testQuery = `SELECT 
                                gid as id,
                                COALESCE(geozone_name, name, 'Airport Zone 0-5km') as name,
                                COALESCE(geozone_type, 'RED') as type,
                                'AIRPORT' as category,
                                '5' as distance,
                                ST_AsGeoJSON(geom) as geometry
                             FROM airport_region_radius_0_to_5_km
                             WHERE geom IS NOT NULL
                             LIMIT 5`;
            
            const result = await query(testQuery);
            console.log(`   ✅ Query successful. Found ${result.rows.length} rows`);
            
            if (result.rows.length > 0) {
                console.log('   Sample row:');
                const sample = result.rows[0];
                console.log(`      ID: ${sample.id}`);
                console.log(`      Name: ${sample.name}`);
                console.log(`      Type: ${sample.type}`);
                console.log(`      Has Geometry: ${sample.geometry ? 'Yes' : 'No'}`);
                if (sample.geometry) {
                    try {
                        const geom = typeof sample.geometry === 'string' ? JSON.parse(sample.geometry) : sample.geometry;
                        console.log(`      Geometry Type: ${geom.type}`);
                    } catch (e) {
                        console.log(`      Geometry Parse Error: ${e.message}`);
                    }
                }
            }
        } catch (err) {
            console.log(`   ❌ Query failed: ${err.message}`);
            console.log(`   Error code: ${err.code}`);
            console.log(`   Error detail: ${err.detail || 'N/A'}`);
        }
        
        // Test querying with filters
        console.log('\n4. Testing query with filters (type=RED, category=AIRPORT)...');
        try {
            // This simulates what the controller does
            const allZones = [];
            
            // Query airport_region_radius_0_to_5_km
            const airport5kmQuery = `SELECT 
                                        gid as id,
                                        COALESCE(geozone_name, name, 'Airport Zone 0-5km') as name,
                                        COALESCE(geozone_type, 'RED') as type,
                                        'AIRPORT' as category,
                                        '5' as distance,
                                        ST_AsGeoJSON(geom) as geometry
                                     FROM airport_region_radius_0_to_5_km
                                     WHERE geom IS NOT NULL`;
            
            const airport5kmResult = await query(airport5kmQuery);
            console.log(`   ✅ airport_region_radius_0_to_5_km: ${airport5kmResult.rows.length} rows`);
            
            // Apply filters
            const filtered = airport5kmResult.rows.filter(row => {
                return row.type === 'RED' && row.category === 'AIRPORT';
            });
            
            console.log(`   ✅ After filtering (type=RED, category=AIRPORT): ${filtered.length} rows`);
            
            if (filtered.length > 0) {
                console.log('   Sample filtered row:');
                const sample = filtered[0];
                console.log(`      Name: ${sample.name}`);
                console.log(`      Type: ${sample.type}`);
                console.log(`      Category: ${sample.category}`);
            }
            
        } catch (err) {
            console.log(`   ❌ Filter test failed: ${err.message}`);
        }
        
        // Check database schema
        console.log('\n5. Checking database schema...');
        try {
            const schemaResult = await query(`
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                AND table_name LIKE '%zone%' OR table_name LIKE '%airport%' OR table_name LIKE '%coastal%'
                ORDER BY table_name
            `);
            console.log(`   Found ${schemaResult.rows.length} related tables:`);
            schemaResult.rows.forEach(row => {
                console.log(`      - ${row.table_schema}.${row.table_name}`);
            });
        } catch (err) {
            console.log(`   ❌ Schema check failed: ${err.message}`);
        }
        
        console.log('\n=== Test Complete ===\n');
        
    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

testProductionTables();







