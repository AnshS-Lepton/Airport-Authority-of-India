const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'gis-demo-secret-key-change-in-production';

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Verify user still exists
            const userResult = await query(
                'SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1',
                [decoded.userId]
            );
            
            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            const user = userResult.rows[0];
            
            if (user.status !== 'ACTIVE') {
                return res.status(401).json({ message: 'User account is not active' });
            }
            
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Invalid token' });
        }
    } catch (error) {
        console.error('[Auth Middleware] Error:', error);
        return res.status(500).json({ message: 'Authentication error' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        
        next();
    };
};

module.exports = {
    authenticate,
    authorize
};

