const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Get allowed CORS origins from environment variables
const getAllowedOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  // Default origins for development
  return ['http://localhost:4200', 'http://localhost:3000'];
};

const allowedOrigins = getAllowedOrigins();

// Middleware
// CORS configuration - use environment variables for allowed origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    
    // In development, be more permissive
    if (NODE_ENV === 'development') {
      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        // Allow any localhost origin in development
        callback(null, true);
      } else {
        callback(null, true); // Allow all in development for easier testing
      }
    } else {
      // In production, only allow origins from CORS_ORIGINS env var
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Compression middleware for faster responses
app.use(compression({
  level: 6, // Balance between compression and speed
  filter: (req, res) => {
    // Compress all responses
    return compression.filter(req, res);
  }
}));

// Log CORS configuration on startup
console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
console.log(`[CORS] Environment: ${NODE_ENV}`);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const flightPlanRoutes = require('./routes/flightPlanRoutes');
const configRoutes = require('./routes/configRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/flight-plans', flightPlanRoutes);
app.use('/api/config', configRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'GIS Demo Backend is running' });
});

// Test CORS endpoint
app.get('/api/test-cors', (req, res) => {
    res.json({ 
        status: 'CORS working',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GIS Demo Backend] Server running on port ${PORT}`);
    console.log(`[Server] Environment: ${NODE_ENV}`);
    console.log(`[Server] CORS origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;

