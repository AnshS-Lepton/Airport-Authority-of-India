const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gis_demo',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    // Connection pool optimization for sub-ms responses
    max: 20, // Maximum number of clients in the pool
    min: 5, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
    // Statement timeout for safety
    statement_timeout: 5000, // 5 seconds max query time
});

// Test connection
pool.on('connect', () => {
    console.log('[Database] Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client', err);
    process.exit(-1);
});

// Query helper
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('[Database] Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('[Database] Query error', { text, error: error.message });
        throw error;
    }
};

module.exports = {
    pool,
    query
};

