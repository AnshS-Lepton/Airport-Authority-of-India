const express = require('express');
const router = express.Router();
const flightPlanController = require('../controllers/flightPlanController');
const { authenticate, authorize } = require('../middleware/auth');

// All flight plan routes require authentication
router.use(authenticate);

// Validate flight plan (Pilot only)
router.post('/validate', authorize('PILOT'), flightPlanController.validateFlightPlan);

// Create flight plan (Pilot only)
router.post('/', authorize('PILOT'), flightPlanController.createFlightPlan);

// Get all flight plans (for map view)
router.get('/', flightPlanController.getAllFlightPlans);

// Get my flight plans (Pilot only)
router.get('/my', authorize('PILOT'), flightPlanController.getMyFlightPlans);

// Get pending flight plans (Approver only)
router.get('/pending', authorize('APPROVER'), flightPlanController.getPendingFlightPlans);

// Get flight plan by ID
router.get('/:id', flightPlanController.getFlightPlanById);

// Approve flight plan (Approver only)
router.put('/:id/approve', authorize('APPROVER'), flightPlanController.approveFlightPlan);

// Reject flight plan (Approver only)
router.put('/:id/reject', authorize('APPROVER'), flightPlanController.rejectFlightPlan);

module.exports = router;

