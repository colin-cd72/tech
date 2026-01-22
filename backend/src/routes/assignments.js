const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, isScheduler } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ==================== CREW ASSIGNMENTS ====================

// Create crew assignment
router.post('/crew',
  authenticate,
  isScheduler,
  [
    body('event_id').isUUID(),
    body('crew_member_id').isUUID(),
    body('position_id').optional().isUUID(),
    body('call_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('rate_override').optional().isFloat({ min: 0 }),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { event_id, crew_member_id, position_id, call_time, end_time, rate_override, notes } = req.body;

      // Verify event exists
      const eventCheck = await query('SELECT id FROM events WHERE id = $1', [event_id]);
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Verify crew member exists and is active
      const crewCheck = await query('SELECT id FROM crew_members WHERE id = $1 AND is_active = true', [crew_member_id]);
      if (crewCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Crew member not found or inactive' });
      }

      const result = await query(
        `INSERT INTO crew_assignments (event_id, crew_member_id, position_id, call_time, end_time, rate_override, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [event_id, crew_member_id, position_id || null, call_time || null, end_time || null,
         rate_override || null, notes || null, req.user.id]
      );

      // Fetch full assignment with names
      const fullResult = await query(
        `SELECT ca.*, cm.name as crew_name, cm.email as crew_email, p.name as position_name
         FROM crew_assignments ca
         JOIN crew_members cm ON ca.crew_member_id = cm.id
         LEFT JOIN positions p ON ca.position_id = p.id
         WHERE ca.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json({ assignment: fullResult.rows[0] });
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Crew member already assigned to this event' });
      }
      next(error);
    }
  }
);

// Update crew assignment
router.put('/crew/:id',
  authenticate,
  isScheduler,
  [
    body('position_id').optional(),
    body('call_time').optional(),
    body('end_time').optional(),
    body('rate_override').optional(),
    body('status').optional().isIn(['pending', 'confirmed', 'declined', 'no_show', 'completed']),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = ['position_id', 'call_time', 'end_time', 'rate_override', 'status', 'notes'];
      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          values.push(req.body[field] === '' ? null : req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE crew_assignments SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      // Fetch full assignment with names
      const fullResult = await query(
        `SELECT ca.*, cm.name as crew_name, cm.email as crew_email, p.name as position_name
         FROM crew_assignments ca
         JOIN crew_members cm ON ca.crew_member_id = cm.id
         LEFT JOIN positions p ON ca.position_id = p.id
         WHERE ca.id = $1`,
        [result.rows[0].id]
      );

      res.json({ assignment: fullResult.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete crew assignment
router.delete('/crew/:id', authenticate, isScheduler, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM crew_assignments WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Bulk assign crew to event
router.post('/crew/bulk',
  authenticate,
  isScheduler,
  [
    body('event_id').isUUID(),
    body('crew_member_ids').isArray({ min: 1 }),
    body('position_id').optional().isUUID(),
    body('call_time').optional()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { event_id, crew_member_ids, position_id, call_time } = req.body;

      const results = { assigned: 0, skipped: 0, errors: [] };

      for (const crew_member_id of crew_member_ids) {
        try {
          await query(
            `INSERT INTO crew_assignments (event_id, crew_member_id, position_id, call_time, created_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (event_id, crew_member_id) DO NOTHING`,
            [event_id, crew_member_id, position_id || null, call_time || null, req.user.id]
          );
          results.assigned++;
        } catch (error) {
          results.errors.push({ crew_member_id, error: error.message });
        }
      }

      res.json({
        message: `Assigned ${results.assigned} crew members`,
        results
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== EQUIPMENT ASSIGNMENTS ====================

// Create equipment assignment
router.post('/equipment',
  authenticate,
  isScheduler,
  [
    body('event_id').isUUID(),
    body('equipment_id').isUUID(),
    body('quantity').optional().isInt({ min: 1 }),
    body('rate_override').optional().isFloat({ min: 0 }),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { event_id, equipment_id, quantity, rate_override, notes } = req.body;

      // Verify event exists
      const eventCheck = await query('SELECT id FROM events WHERE id = $1', [event_id]);
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Verify equipment exists and is active
      const equipmentCheck = await query('SELECT id FROM equipment WHERE id = $1 AND is_active = true', [equipment_id]);
      if (equipmentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Equipment not found or inactive' });
      }

      const result = await query(
        `INSERT INTO equipment_assignments (event_id, equipment_id, quantity, rate_override, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [event_id, equipment_id, quantity || 1, rate_override || null, notes || null, req.user.id]
      );

      // Fetch full assignment with names
      const fullResult = await query(
        `SELECT ea.*, eq.name as equipment_name, eq.serial_number, ec.name as category_name
         FROM equipment_assignments ea
         JOIN equipment eq ON ea.equipment_id = eq.id
         LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
         WHERE ea.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json({ assignment: fullResult.rows[0] });
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Equipment already assigned to this event' });
      }
      next(error);
    }
  }
);

// Update equipment assignment
router.put('/equipment/:id',
  authenticate,
  isScheduler,
  [
    body('quantity').optional().isInt({ min: 1 }),
    body('rate_override').optional(),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { quantity, rate_override, notes } = req.body;
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (quantity !== undefined) {
        updates.push(`quantity = $${paramCount++}`);
        values.push(quantity);
      }
      if (rate_override !== undefined) {
        updates.push(`rate_override = $${paramCount++}`);
        values.push(rate_override === '' ? null : rate_override);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramCount++}`);
        values.push(notes || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE equipment_assignments SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      // Fetch full assignment with names
      const fullResult = await query(
        `SELECT ea.*, eq.name as equipment_name, eq.serial_number, ec.name as category_name
         FROM equipment_assignments ea
         JOIN equipment eq ON ea.equipment_id = eq.id
         LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
         WHERE ea.id = $1`,
        [result.rows[0].id]
      );

      res.json({ assignment: fullResult.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete equipment assignment
router.delete('/equipment/:id', authenticate, isScheduler, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM equipment_assignments WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== AVAILABILITY CHECK ====================

// Check crew availability for a date range
router.get('/availability/crew', authenticate, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }

    const result = await query(
      `SELECT cm.id, cm.name, e.event_date, e.name as event_name
       FROM crew_members cm
       LEFT JOIN crew_assignments ca ON cm.id = ca.crew_member_id
       LEFT JOIN events e ON ca.event_id = e.id AND e.event_date BETWEEN $1 AND $2
       WHERE cm.is_active = true
       ORDER BY cm.name, e.event_date`,
      [start_date, end_date]
    );

    // Group by crew member
    const availability = {};
    result.rows.forEach(row => {
      if (!availability[row.id]) {
        availability[row.id] = { id: row.id, name: row.name, assignments: [] };
      }
      if (row.event_date) {
        availability[row.id].assignments.push({
          date: row.event_date,
          event: row.event_name
        });
      }
    });

    res.json({ availability: Object.values(availability) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
