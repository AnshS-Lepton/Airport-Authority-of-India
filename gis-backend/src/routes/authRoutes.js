const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected routes
router.get('/me', authController.authenticate, authController.getCurrentUser);

module.exports = router;

