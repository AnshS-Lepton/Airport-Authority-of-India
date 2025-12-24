const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'gis-demo-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // Find user
        const userResult = await query(
            'SELECT id, email, password, first_name, last_name, role, status FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const user = userResult.rows[0];
        
        // Check if user is active
        if (user.status !== 'ACTIVE') {
            return res.status(401).json({ message: 'User account is not active' });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        // Return user data (without password)
        const userData = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
        };
        
        res.json({
            message: 'Login successful',
            token,
            user: userData
        });
    } catch (error) {
        console.error('[Auth Controller] Login error:', error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const { email, password, first_name, last_name, role } = req.body;
        
        if (!email || !password || !first_name || !last_name || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Validate role
        const validRoles = ['PILOT', 'APPROVER', 'ADMIN'];
        if (!validRoles.includes(role.toUpperCase())) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        
        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await query(
            `INSERT INTO users (email, password, first_name, last_name, role, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())
             RETURNING id, email, first_name, last_name, role`,
            [email.toLowerCase(), hashedPassword, first_name, last_name, role.toUpperCase()]
        );
        
        const user = result.rows[0];
        
        res.status(201).json({
            message: 'User created successfully',
            user
        });
    } catch (error) {
        console.error('[Auth Controller] Register error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const user = req.user;
        res.json({
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
        });
    } catch (error) {
        console.error('[Auth Controller] Get current user error:', error);
        res.status(500).json({ message: 'Failed to get user', error: error.message });
    }
};

// Add authenticate method for use in routes
exports.authenticate = authenticate;

