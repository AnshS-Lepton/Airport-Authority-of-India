require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./src/config/database');

async function resetPasswords() {
    try {
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('Resetting passwords for all users...');
        
        const result = await query(
            'UPDATE users SET password = $1 WHERE email IN ($2, $3, $4, $5)',
            [hashedPassword, 'pilot1@demo.com', 'pilot2@demo.com', 'approver@demo.com', 'admin@demo.com']
        );
        
        // Better approach - update each user
        const users = ['pilot1@demo.com', 'pilot2@demo.com', 'approver@demo.com', 'admin@demo.com'];
        
        for (const email of users) {
            const updateResult = await query(
                'UPDATE users SET password = $1 WHERE email = $2',
                [hashedPassword, email]
            );
            if (updateResult.rowCount > 0) {
                console.log(`✅ Updated password for ${email}`);
            } else {
                console.log(`⚠️  User ${email} not found`);
            }
        }
        
        console.log('\n✅ All passwords reset to: password123');
        console.log('You can now login with any of these users:');
        users.forEach(email => console.log(`  - ${email}`));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit(0);
}

resetPasswords();





