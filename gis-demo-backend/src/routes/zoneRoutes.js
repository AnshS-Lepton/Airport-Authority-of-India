const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { authenticate, authorize } = require('../middleware/auth');

// Get all zones (with optional filters) - no auth required for now
router.get('/', zoneController.getAllZones);

// Get state boundaries - no auth required for now
router.get('/states', zoneController.getStateBoundaries);

// Get zone by ID - no auth required for now
router.get('/:id', zoneController.getZoneById);

// All other zone routes require authentication
router.use(authenticate);

// Create zone (Admin only)
router.post('/', authorize('ADMIN'), zoneController.createZone);

// Update zone (Admin only)
router.put('/:id', authorize('ADMIN'), zoneController.updateZone);

// Delete zone (Admin only)
router.delete('/:id', authorize('ADMIN'), zoneController.deleteZone);

// Submit zone for approval (Admin only)
router.put('/:id/submit', authorize('ADMIN'), zoneController.submitZoneForApproval);

// Delete expired temporary zones (Admin only)
router.delete('/expired/temporary', authorize('ADMIN'), zoneController.deleteExpiredTemporaryZones);

module.exports = router;

