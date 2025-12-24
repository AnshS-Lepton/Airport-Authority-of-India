require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...');
console.log('Host:', process.env.DB_HOST);
console.log('Port:', process.env.DB_PORT);
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);
console.log('Password:', process.env.DB_PASSWORD ? '***' : 'NOT SET');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gis_demo',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
});

pool.query('SELECT NOW()')
    .then(result => {
        console.log('✅ Database connection successful!');
        console.log('Current time:', result.rows[0].now);
        pool.end();
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Database connection failed!');
        console.error('Error:', error.message);
        pool.end();
        process.exit(1);
    });





