const express = require('express');
const router = express.Router();

/**
 * GET /api/config/maps-key
 * Returns the Google Maps API key securely from environment variables
 * Note: In production, you may want to add authentication/authorization
 */
router.get('/maps-key', (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
        console.error('[Config Route] Google Maps API key not configured in environment variables');
        return res.status(500).json({ 
            error: 'Google Maps API key not configured',
            message: 'Please configure GOOGLE_MAPS_API_KEY in your .env file'
        });
    }
    
    // Return the API key
    // Note: The key will still be visible in network requests, but not in source code
    res.json({ 
        apiKey: apiKey,
        libraries: 'drawing,geometry' // Default libraries needed
    });
});

module.exports = router;


