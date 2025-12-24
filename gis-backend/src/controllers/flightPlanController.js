const { query } = require('../config/database');
const { validateGeometry, validateFlightPlanAgainstZones } = require('../services/validationService');

exports.validateFlightPlan = async (req, res) => {
    try {
        const { geometry, start_time, end_time, min_altitude, max_altitude } = req.body;
        
        if (!geometry || !start_time || !end_time || min_altitude === undefined || max_altitude === undefined) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Validate geometry
        if (!validateGeometry(geometry)) {
            return res.status(400).json({ message: 'Invalid geometry format' });
        }
        
        // Validate altitude
        if (min_altitude < 0 || max_altitude < 0 || min_altitude > max_altitude) {
            return res.status(400).json({ message: 'Invalid altitude range' });
        }
        
        // Validate time
        const startTime = new Date(start_time);
        const endTime = new Date(end_time);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }
        
        if (startTime >= endTime) {
            return res.status(400).json({ message: 'Start time must be before end time' });
        }
        
        // Check against zones
        const validationResult = await validateFlightPlanAgainstZones(
            geometry,
            min_altitude,
            max_altitude,
            startTime,
            endTime
        );
        
        res.json(validationResult);
    } catch (error) {
        console.error('[Flight Plan Controller] Validate error:', error);
        res.status(500).json({ message: 'Validation failed', error: error.message });
    }
};

exports.createFlightPlan = async (req, res) => {
    try {
        const { geometry, start_time, end_time, min_altitude, max_altitude, drone_type, operation_type, status } = req.body;
        const userId = req.user ? req.user.id : null; // Handle case where auth might be optional
        
        if (!geometry || !start_time || !end_time || min_altitude === undefined || 
            max_altitude === undefined || !drone_type || !operation_type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Validate geometry
        if (!validateGeometry(geometry)) {
            return res.status(400).json({ message: 'Invalid geometry format' });
        }
        
        // Validate altitude
        if (min_altitude < 0 || max_altitude < 0 || min_altitude > max_altitude) {
            return res.status(400).json({ message: 'Invalid altitude range' });
        }
        
        // Validate time
        const startTime = new Date(start_time);
        const endTime = new Date(end_time);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }
        
        if (startTime >= endTime) {
            return res.status(400).json({ message: 'Start time must be before end time' });
        }
        
        // Check against zones
        const validationResult = await validateFlightPlanAgainstZones(
            geometry,
            min_altitude,
            max_altitude,
            startTime,
            endTime
        );
        
        // Generate reference ID
        const referenceId = `FP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Determine status: use provided status, or default to SUBMITTED
        const flightPlanStatus = status || 'SUBMITTED';
        
        // Validate status
        const validStatuses = ['SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
        if (!validStatuses.includes(flightPlanStatus)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        // Insert flight plan
        const result = await query(
            `INSERT INTO flight_plans 
             (reference_id, user_id, geometry, start_time, end_time, min_altitude, max_altitude, 
              drone_type, operation_type, status, created_at, updated_at)
             VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING id, reference_id, user_id, ST_AsGeoJSON(geometry) as geometry, 
                      start_time, end_time, min_altitude, max_altitude, drone_type, 
                      operation_type, status, created_at`,
            [referenceId, userId, JSON.stringify(geometry), startTime, endTime, 
             min_altitude, max_altitude, drone_type, operation_type, flightPlanStatus]
        );
        
        const flightPlan = result.rows[0];
        flightPlan.geometry = JSON.parse(flightPlan.geometry);
        
        res.status(201).json({
            message: 'Flight plan created successfully',
            flightPlan,
            validation: validationResult
        });
    } catch (error) {
        console.error('[Flight Plan Controller] Create error:', error);
        res.status(500).json({ message: 'Failed to create flight plan', error: error.message });
    }
};

exports.getAllFlightPlans = async (req, res) => {
    try {
        const result = await query(
            `SELECT fp.id, fp.reference_id, fp.user_id, u.first_name || ' ' || u.last_name as pilot_name,
                    ST_AsGeoJSON(fp.geometry) as geometry, fp.start_time, fp.end_time,
                    fp.min_altitude, fp.max_altitude, fp.drone_type, fp.operation_type,
                    fp.status, fp.rejection_reason, fp.created_at, fp.updated_at
             FROM flight_plans fp
             JOIN users u ON fp.user_id = u.id
             ORDER BY fp.created_at DESC`
        );
        
        const flightPlans = result.rows.map(row => {
            const geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
            return {
                ...row,
                geometry: geometry
            };
        });
        
        res.json(flightPlans);
    } catch (error) {
        console.error('[Flight Plan Controller] Get all error:', error);
        res.status(500).json({ message: 'Failed to fetch flight plans', error: error.message });
    }
};

exports.getMyFlightPlans = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await query(
            `SELECT id, reference_id, ST_AsGeoJSON(geometry) as geometry, start_time, end_time,
                    min_altitude, max_altitude, drone_type, operation_type, status, 
                    rejection_reason, created_at, updated_at
             FROM flight_plans
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );
        
        const flightPlans = result.rows.map(row => {
            const geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
            return {
                ...row,
                geometry: geometry
            };
        });
        
        res.json(flightPlans);
    } catch (error) {
        console.error('[Flight Plan Controller] Get my flight plans error:', error);
        res.status(500).json({ message: 'Failed to fetch flight plans', error: error.message });
    }
};

exports.getPendingFlightPlans = async (req, res) => {
    try {
        const result = await query(
            `SELECT fp.id, fp.reference_id, fp.user_id, u.first_name || ' ' || u.last_name as pilot_name,
                    ST_AsGeoJSON(fp.geometry) as geometry, fp.start_time, fp.end_time,
                    fp.min_altitude, fp.max_altitude, fp.drone_type, fp.operation_type,
                    fp.status, fp.created_at
             FROM flight_plans fp
             JOIN users u ON fp.user_id = u.id
             WHERE fp.status = 'SUBMITTED'
             ORDER BY fp.created_at ASC`
        );
        
        // Get intersecting zones for each flight plan
        const flightPlans = await Promise.all(result.rows.map(async (row) => {
            const geometry = JSON.parse(row.geometry);
            const validationResult = await validateFlightPlanAgainstZones(
                geometry,
                row.min_altitude,
                row.max_altitude,
                new Date(row.start_time),
                new Date(row.end_time)
            );
            
            return {
                ...row,
                geometry,
                intersecting_zones: validationResult.intersections || []
            };
        }));
        
        res.json(flightPlans);
    } catch (error) {
        console.error('[Flight Plan Controller] Get pending error:', error);
        res.status(500).json({ message: 'Failed to fetch pending flight plans', error: error.message });
    }
};

exports.getFlightPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `SELECT fp.id, fp.reference_id, fp.user_id, u.first_name || ' ' || u.last_name as pilot_name,
                    ST_AsGeoJSON(fp.geometry) as geometry, fp.start_time, fp.end_time,
                    fp.min_altitude, fp.max_altitude, fp.drone_type, fp.operation_type,
                    fp.status, fp.rejection_reason, fp.created_at, fp.updated_at
             FROM flight_plans fp
             JOIN users u ON fp.user_id = u.id
             WHERE fp.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Flight plan not found' });
        }
        
        const flightPlan = result.rows[0];
        flightPlan.geometry = JSON.parse(flightPlan.geometry);
        
        res.json(flightPlan);
    } catch (error) {
        console.error('[Flight Plan Controller] Get by ID error:', error);
        res.status(500).json({ message: 'Failed to fetch flight plan', error: error.message });
    }
};

exports.approveFlightPlan = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if flight plan exists and is pending
        const existing = await query(
            'SELECT id, status FROM flight_plans WHERE id = $1',
            [id]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Flight plan not found' });
        }
        
        if (existing.rows[0].status !== 'SUBMITTED') {
            return res.status(400).json({ message: 'Flight plan is not in submitted status' });
        }
        
        // Update status
        const result = await query(
            `UPDATE flight_plans 
             SET status = 'APPROVED', updated_at = NOW()
             WHERE id = $1
             RETURNING id, reference_id, status`,
            [id]
        );
        
        res.json({
            message: 'Flight plan approved successfully',
            flightPlan: result.rows[0]
        });
    } catch (error) {
        console.error('[Flight Plan Controller] Approve error:', error);
        res.status(500).json({ message: 'Failed to approve flight plan', error: error.message });
    }
};

exports.rejectFlightPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }
        
        // Check if flight plan exists and is pending
        const existing = await query(
            'SELECT id, status FROM flight_plans WHERE id = $1',
            [id]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Flight plan not found' });
        }
        
        if (existing.rows[0].status !== 'SUBMITTED') {
            return res.status(400).json({ message: 'Flight plan is not in submitted status' });
        }
        
        // Update status
        const result = await query(
            `UPDATE flight_plans 
             SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, reference_id, status, rejection_reason`,
            [reason.trim(), id]
        );
        
        res.json({
            message: 'Flight plan rejected',
            flightPlan: result.rows[0]
        });
    } catch (error) {
        console.error('[Flight Plan Controller] Reject error:', error);
        res.status(500).json({ message: 'Failed to reject flight plan', error: error.message });
    }
};

