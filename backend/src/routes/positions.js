const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// List positions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { is_active = 'true' } = req.query;

    let whereClause = '';
    const params = [];

    if (is_active !== 'all') {
      whereClause = 'WHERE is_active = $1';
      params.push(is_active === 'true');
    }

    const result = await query(
      `SELECT * FROM positions ${whereClause} ORDER BY sort_order, name`,
      params
    );

    res.json({ positions: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single position
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM positions WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ position: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Create position
router.post('/',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty(),
    body('description').optional().trim(),
    body('default_rate').optional().isFloat({ min: 0 }),
    body('sort_order').optional().isInt()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, default_rate, sort_order } = req.body;

      const result = await query(
        `INSERT INTO positions (name, description, default_rate, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, default_rate || null, sort_order || 0]
      );

      res.status(201).json({ position: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update position
router.put('/:id',
  authenticate,
  isAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('default_rate').optional().isFloat({ min: 0 }),
    body('sort_order').optional().isInt(),
    body('is_active').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, default_rate, sort_order, is_active } = req.body;
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (name) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description || null);
      }
      if (default_rate !== undefined) {
        updates.push(`default_rate = $${paramCount++}`);
        values.push(default_rate || null);
      }
      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramCount++}`);
        values.push(sort_order);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE positions SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Position not found' });
      }

      res.json({ position: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete position
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Check if position is in use
    const usageCount = await query(
      `SELECT COUNT(*) FROM crew_assignments WHERE position_id = $1
       UNION ALL
       SELECT COUNT(*) FROM crew_members WHERE default_position_id = $1`,
      [req.params.id]
    );

    const totalUsage = usageCount.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    if (totalUsage > 0) {
      // Soft delete instead
      await query(
        'UPDATE positions SET is_active = false WHERE id = $1',
        [req.params.id]
      );
      return res.json({ message: 'Position deactivated (in use by crew members or assignments)' });
    }

    const result = await query(
      'DELETE FROM positions WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
