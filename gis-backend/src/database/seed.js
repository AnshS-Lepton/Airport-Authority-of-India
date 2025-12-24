// Seed script to populate database with sample data
// Run with: node src/database/seed.js

const bcrypt = require('bcrypt');
const { query } = require('../config/database');

async function seedDatabase() {
    try {
        console.log('[Seed] Starting database seeding...');
        
        // Hash password for all users
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert users
        console.log('[Seed] Inserting users...');
        const users = [
            { email: 'pilot1@demo.com', first_name: 'John', last_name: 'Pilot', role: 'PILOT' },
            { email: 'pilot2@demo.com', first_name: 'Jane', last_name: 'Aviator', role: 'PILOT' },
            { email: 'approver@demo.com', first_name: 'Robert', last_name: 'Approver', role: 'APPROVER' },
            { email: 'admin@demo.com', first_name: 'Admin', last_name: 'User', role: 'ADMIN' }
        ];
        
        for (const user of users) {
            await query(
                `INSERT INTO users (email, password, first_name, last_name, role, status)
                 VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
                 ON CONFLICT (email) DO NOTHING`,
                [user.email, hashedPassword, user.first_name, user.last_name, user.role]
            );
        }
        console.log('[Seed] Users inserted');
        
        // Insert zones
        console.log('[Seed] Inserting zones...');
        const zones = [
            {
                name: 'Delhi Airport - Prohibited Zone',
                type: 'RED',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[77.08, 28.55], [77.12, 28.55], [77.12, 28.58], [77.08, 28.58], [77.08, 28.55]]]
                },
                min_altitude: 0,
                max_altitude: 1000,
                status: 'ACTIVE'
            },
            {
                name: 'Central Delhi - Restricted Zone',
                type: 'YELLOW',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[77.20, 28.60], [77.25, 28.60], [77.25, 28.65], [77.20, 28.65], [77.20, 28.60]]]
                },
                min_altitude: 0,
                max_altitude: 500,
                status: 'ACTIVE'
            },
            {
                name: 'Noida - Permitted Zone',
                type: 'GREEN',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[77.30, 28.50], [77.35, 28.50], [77.35, 28.55], [77.30, 28.55], [77.30, 28.50]]]
                },
                min_altitude: 0,
                max_altitude: 200,
                status: 'ACTIVE'
            }
        ];
        
        for (const zone of zones) {
            await query(
                `INSERT INTO zones (name, type, geometry, min_altitude, max_altitude, status)
                 VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6)
                 ON CONFLICT (name) DO NOTHING`,
                [zone.name, zone.type, JSON.stringify(zone.geometry), zone.min_altitude, zone.max_altitude, zone.status]
            );
        }
        console.log('[Seed] Zones inserted');
        
        console.log('[Seed] Database seeding completed successfully!');
        console.log('[Seed] Default password for all users: password123');
        
    } catch (error) {
        console.error('[Seed] Error seeding database:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { seedDatabase };

