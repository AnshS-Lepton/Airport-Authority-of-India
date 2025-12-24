require('dotenv').config();
const { query } = require('./src/config/database');

async function checkUsers() {
    try {
        const result = await query('SELECT id, email, first_name, last_name, role, status FROM users ORDER BY id');
        console.log('\n=== Users in Database ===');
        console.log('Total users:', result.rows.length);
        result.rows.forEach(user => {
            console.log(`- ${user.email} (${user.role}) - ${user.status}`);
        });
        
        // Check if pilot1 exists
        const pilot1 = result.rows.find(u => u.email === 'pilot1@demo.com');
        if (pilot1) {
            console.log('\n✅ pilot1@demo.com exists');
        } else {
            console.log('\n❌ pilot1@demo.com NOT FOUND');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit(0);
}

checkUsers();





