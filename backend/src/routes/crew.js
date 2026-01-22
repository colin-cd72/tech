const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const XLSX = require('xlsx');
const { query } = require('../config/database');
const { authenticate, isAdmin, isScheduler } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// List crew members
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, department, is_active = 'true', page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (is_active !== 'all') {
      whereClause += ` AND cm.is_active = $${paramCount++}`;
      params.push(is_active === 'true');
    }

    if (search) {
      whereClause += ` AND (cm.name ILIKE $${paramCount} OR cm.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (department) {
      whereClause += ` AND cm.department = $${paramCount++}`;
      params.push(department);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM crew_members cm ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT cm.*, p.name as default_position_name
       FROM crew_members cm
       LEFT JOIN positions p ON cm.default_position_id = p.id
       ${whereClause}
       ORDER BY cm.name ASC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      crewMembers: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// Get distinct departments
router.get('/departments', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT department FROM crew_members
       WHERE department IS NOT NULL AND department != ''
       ORDER BY department`
    );
    res.json({ departments: result.rows.map(r => r.department) });
  } catch (error) {
    next(error);
  }
});

// Get single crew member with upcoming assignments
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const crewResult = await query(
      `SELECT cm.*, p.name as default_position_name
       FROM crew_members cm
       LEFT JOIN positions p ON cm.default_position_id = p.id
       WHERE cm.id = $1`,
      [req.params.id]
    );

    if (crewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found' });
    }

    // Get upcoming assignments
    const assignmentsResult = await query(
      `SELECT ca.*, e.name as event_name, e.event_date, e.location, e.venue,
              p.name as position_name
       FROM crew_assignments ca
       JOIN events e ON ca.event_id = e.id
       LEFT JOIN positions p ON ca.position_id = p.id
       WHERE ca.crew_member_id = $1 AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC, e.start_time ASC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      crewMember: crewResult.rows[0],
      upcomingAssignments: assignmentsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create crew member
router.post('/',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('department').optional().trim(),
    body('default_position_id').optional().isUUID(),
    body('hourly_rate').optional().isFloat({ min: 0 }),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, department, default_position_id, hourly_rate, notes } = req.body;

      const result = await query(
        `INSERT INTO crew_members (name, email, phone, department, default_position_id, hourly_rate, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, email || null, phone || null, department || null, default_position_id || null,
         hourly_rate || null, notes || null]
      );

      res.status(201).json({ crewMember: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update crew member
router.put('/:id',
  authenticate,
  isAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('department').optional().trim(),
    body('default_position_id').optional(),
    body('hourly_rate').optional().isFloat({ min: 0 }),
    body('notes').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = ['name', 'email', 'phone', 'department', 'default_position_id', 'hourly_rate', 'notes', 'is_active'];
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
        `UPDATE crew_members SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Crew member not found' });
      }

      res.json({ crewMember: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete crew member (soft delete)
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE crew_members SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found' });
    }

    res.json({ message: 'Crew member deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// CSV Import
router.post('/import', authenticate, isAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Map common column names
        const name = row.Name || row.name || row['Crew Name'];
        const email = row.Email || row.email;
        const phone = row.Phone || row.phone || row['Phone Number'];
        const department = row.Department || row.department;
        const hourlyRate = row['Hourly Rate'] || row.hourly_rate || row.Rate;

        if (!name) {
          results.errors.push({ row: i + 2, error: 'Name is required' });
          continue;
        }

        // Check if crew member exists by email
        if (email) {
          const existing = await query(
            'SELECT id FROM crew_members WHERE email = $1',
            [email.toLowerCase()]
          );

          if (existing.rows.length > 0) {
            // Update existing
            await query(
              `UPDATE crew_members SET name = $1, phone = $2, department = $3, hourly_rate = $4
               WHERE id = $5`,
              [name, phone || null, department || null, hourlyRate || null, existing.rows[0].id]
            );
            results.updated++;
            continue;
          }
        }

        // Create new
        await query(
          `INSERT INTO crew_members (name, email, phone, department, hourly_rate)
           VALUES ($1, $2, $3, $4, $5)`,
          [name, email ? email.toLowerCase() : null, phone || null, department || null, hourlyRate || null]
        );
        results.created++;

      } catch (error) {
        results.errors.push({ row: i + 2, error: error.message });
      }
    }

    res.json({
      message: `Import complete: ${results.created} created, ${results.updated} updated`,
      results
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
