const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, isScheduler, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// List events
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      start_date,
      end_date,
      status,
      cost_center,
      search,
      page = 1,
      limit = 50
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (start_date) {
      whereClause += ` AND event_date >= $${paramCount++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND event_date <= $${paramCount++}`;
      params.push(end_date);
    }

    if (status) {
      whereClause += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (cost_center) {
      whereClause += ` AND cost_center = $${paramCount++}`;
      params.push(cost_center);
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramCount} OR location ILIKE $${paramCount} OR venue ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM events ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM crew_assignments WHERE event_id = e.id) as crew_count,
        (SELECT COUNT(*) FROM equipment_assignments WHERE event_id = e.id) as equipment_count
       FROM events e
       ${whereClause}
       ORDER BY event_date ASC, start_time ASC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      events: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// Get distinct cost centers for filtering
router.get('/cost-centers', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT cost_center FROM events
       WHERE cost_center IS NOT NULL AND cost_center != ''
       ORDER BY cost_center`
    );
    res.json({ costCenters: result.rows.map(r => r.cost_center) });
  } catch (error) {
    next(error);
  }
});

// Get single event with assignments
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const eventResult = await query(
      `SELECT e.*, u.name as created_by_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Get crew assignments
    const crewResult = await query(
      `SELECT ca.*, cm.name as crew_name, cm.email as crew_email, cm.phone as crew_phone,
              p.name as position_name, COALESCE(ca.rate_override, cm.hourly_rate) as rate
       FROM crew_assignments ca
       JOIN crew_members cm ON ca.crew_member_id = cm.id
       LEFT JOIN positions p ON ca.position_id = p.id
       WHERE ca.event_id = $1
       ORDER BY p.sort_order, cm.name`,
      [req.params.id]
    );

    // Get equipment assignments
    const equipmentResult = await query(
      `SELECT ea.*, eq.name as equipment_name, eq.serial_number,
              ec.name as category_name, COALESCE(ea.rate_override, eq.daily_rate) as rate
       FROM equipment_assignments ea
       JOIN equipment eq ON ea.equipment_id = eq.id
       LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
       WHERE ea.event_id = $1
       ORDER BY ec.sort_order, eq.name`,
      [req.params.id]
    );

    res.json({
      event,
      crewAssignments: crewResult.rows,
      equipmentAssignments: equipmentResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create event
router.post('/',
  authenticate,
  isScheduler,
  [
    body('name').trim().notEmpty(),
    body('event_date').isDate(),
    body('location').optional().trim(),
    body('venue').optional().trim(),
    body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('load_in_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('load_out_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('cost_center').optional().trim(),
    body('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']),
    body('description').optional().trim(),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        name, event_date, location, venue, start_time, end_time,
        load_in_time, load_out_time, cost_center, status, description, notes
      } = req.body;

      const result = await query(
        `INSERT INTO events (name, event_date, location, venue, start_time, end_time,
         load_in_time, load_out_time, cost_center, status, description, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [name, event_date, location || null, venue || null, start_time || null, end_time || null,
         load_in_time || null, load_out_time || null, cost_center || null, status || 'scheduled',
         description || null, notes || null, req.user.id]
      );

      res.status(201).json({ event: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update event
router.put('/:id',
  authenticate,
  isScheduler,
  [
    body('name').optional().trim().notEmpty(),
    body('event_date').optional().isDate(),
    body('location').optional().trim(),
    body('venue').optional().trim(),
    body('start_time').optional(),
    body('end_time').optional(),
    body('load_in_time').optional(),
    body('load_out_time').optional(),
    body('cost_center').optional().trim(),
    body('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']),
    body('description').optional().trim(),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = [
        'name', 'event_date', 'location', 'venue', 'start_time', 'end_time',
        'load_in_time', 'load_out_time', 'cost_center', 'status', 'description', 'notes'
      ];

      const updates = [];
      const values = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          values.push(req.body[field] || null);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ event: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete event (admin only)
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Duplicate event
router.post('/:id/duplicate', authenticate, isScheduler, async (req, res, next) => {
  try {
    const { new_date } = req.body;

    // Get original event
    const original = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = original.rows[0];

    // Create duplicate
    const result = await query(
      `INSERT INTO events (name, event_date, location, venue, start_time, end_time,
       load_in_time, load_out_time, cost_center, status, description, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', $10, $11, $12)
       RETURNING *`,
      [event.name, new_date || event.event_date, event.location, event.venue, event.start_time,
       event.end_time, event.load_in_time, event.load_out_time, event.cost_center,
       event.description, event.notes, req.user.id]
    );

    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
