const express = require('express');
const bcrypt = require('bcryptjs');
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

// Generate temporary password
function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// List users (admin only)
router.get('/', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      whereClause += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT id, email, name, role, phone, is_active, created_at, last_login
       FROM users ${whereClause}
       ORDER BY name ASC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      users: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// Get single user (admin only)
router.get('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, name, role, phone, is_active, created_at, last_login
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
router.post('/',
  authenticate,
  isAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().notEmpty(),
    body('role').isIn(['admin', 'scheduler', 'crew']),
    body('phone').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, name, role, phone } = req.body;

      // Check if email exists
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Generate temporary password
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, name, role, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role, phone, is_active, created_at`,
        [email, passwordHash, name, role, phone || null]
      );

      res.status(201).json({
        user: result.rows[0],
        tempPassword,
        message: 'User created. Provide the temporary password to the user.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update user (admin only)
router.put('/:id',
  authenticate,
  isAdmin,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().notEmpty(),
    body('role').optional().isIn(['admin', 'scheduler', 'crew']),
    body('phone').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, name, role, phone, is_active } = req.body;
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (email) {
        // Check if email is taken by another user
        const existing = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, req.params.id]
        );
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }

      if (name) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }

      if (role) {
        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }

      if (phone !== undefined) {
        updates.push(`phone = $${paramCount++}`);
        values.push(phone || null);
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
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING id, email, name, role, phone, is_active`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Reset user password (admin only)
router.post('/:id/reset-password', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Check user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-reset through this endpoint
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Use change-password to update your own password' });
    }

    // Generate new password
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await query(
      'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
      [passwordHash, req.params.id]
    );

    res.json({
      tempPassword,
      message: 'Password reset. Provide the new temporary password to the user.'
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
