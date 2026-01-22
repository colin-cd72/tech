const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const XLSX = require('xlsx');
const { query } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');

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

// List equipment
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, category_id, is_active = 'true', page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (is_active !== 'all') {
      whereClause += ` AND eq.is_active = $${paramCount++}`;
      params.push(is_active === 'true');
    }

    if (search) {
      whereClause += ` AND (eq.name ILIKE $${paramCount} OR eq.serial_number ILIKE $${paramCount} OR eq.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (category_id) {
      whereClause += ` AND eq.category_id = $${paramCount++}`;
      params.push(category_id);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM equipment eq ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT eq.*, ec.name as category_name
       FROM equipment eq
       LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
       ${whereClause}
       ORDER BY ec.sort_order, eq.name ASC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      equipment: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// List equipment categories
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ec.*, COUNT(eq.id) as equipment_count
       FROM equipment_categories ec
       LEFT JOIN equipment eq ON ec.id = eq.category_id AND eq.is_active = true
       GROUP BY ec.id
       ORDER BY ec.sort_order, ec.name`
    );
    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create category
router.post('/categories',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty(),
    body('description').optional().trim(),
    body('sort_order').optional().isInt()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, sort_order } = req.body;

      const result = await query(
        `INSERT INTO equipment_categories (name, description, sort_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description || null, sort_order || 0]
      );

      res.status(201).json({ category: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update category
router.put('/categories/:id',
  authenticate,
  isAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('sort_order').optional().isInt()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, sort_order } = req.body;
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
      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramCount++}`);
        values.push(sort_order);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE equipment_categories SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ category: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete category
router.delete('/categories/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Check if category has equipment
    const equipmentCount = await query(
      'SELECT COUNT(*) FROM equipment WHERE category_id = $1',
      [req.params.id]
    );

    if (parseInt(equipmentCount.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete category with equipment. Reassign equipment first.' });
    }

    const result = await query(
      'DELETE FROM equipment_categories WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get single equipment item
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const equipmentResult = await query(
      `SELECT eq.*, ec.name as category_name
       FROM equipment eq
       LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
       WHERE eq.id = $1`,
      [req.params.id]
    );

    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Get upcoming assignments
    const assignmentsResult = await query(
      `SELECT ea.*, e.name as event_name, e.event_date, e.location
       FROM equipment_assignments ea
       JOIN events e ON ea.event_id = e.id
       WHERE ea.equipment_id = $1 AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      equipment: equipmentResult.rows[0],
      upcomingAssignments: assignmentsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create equipment
router.post('/',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty(),
    body('category_id').optional().isUUID(),
    body('description').optional().trim(),
    body('serial_number').optional().trim(),
    body('daily_rate').optional().isFloat({ min: 0 }),
    body('replacement_cost').optional().isFloat({ min: 0 }),
    body('quantity_available').optional().isInt({ min: 0 }),
    body('location').optional().trim(),
    body('notes').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        name, category_id, description, serial_number, daily_rate,
        replacement_cost, quantity_available, location, notes
      } = req.body;

      const result = await query(
        `INSERT INTO equipment (name, category_id, description, serial_number, daily_rate,
         replacement_cost, quantity_available, location, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [name, category_id || null, description || null, serial_number || null,
         daily_rate || 0, replacement_cost || null, quantity_available || 1,
         location || null, notes || null]
      );

      res.status(201).json({ equipment: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update equipment
router.put('/:id',
  authenticate,
  isAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('category_id').optional(),
    body('description').optional().trim(),
    body('serial_number').optional().trim(),
    body('daily_rate').optional().isFloat({ min: 0 }),
    body('replacement_cost').optional().isFloat({ min: 0 }),
    body('quantity_available').optional().isInt({ min: 0 }),
    body('location').optional().trim(),
    body('notes').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowedFields = [
        'name', 'category_id', 'description', 'serial_number', 'daily_rate',
        'replacement_cost', 'quantity_available', 'location', 'notes', 'is_active'
      ];
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
        `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      res.json({ equipment: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete equipment (soft delete)
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE equipment SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    res.json({ message: 'Equipment deactivated successfully' });
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

    // Pre-fetch categories for mapping
    const categoriesResult = await query('SELECT id, name FROM equipment_categories');
    const categoryMap = {};
    categoriesResult.rows.forEach(c => {
      categoryMap[c.name.toLowerCase()] = c.id;
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const name = row.Name || row.name || row['Equipment Name'];
        const category = row.Category || row.category;
        const description = row.Description || row.description;
        const serialNumber = row['Serial Number'] || row.serial_number || row.Serial;
        const dailyRate = row['Daily Rate'] || row.daily_rate || row.Rate;
        const replacementCost = row['Replacement Cost'] || row.replacement_cost || row.Cost;
        const quantity = row.Quantity || row.quantity || row['Qty'];
        const location = row.Location || row.location;

        if (!name) {
          results.errors.push({ row: i + 2, error: 'Name is required' });
          continue;
        }

        // Find or create category
        let categoryId = null;
        if (category) {
          categoryId = categoryMap[category.toLowerCase()];
          if (!categoryId) {
            // Create new category
            const newCat = await query(
              'INSERT INTO equipment_categories (name) VALUES ($1) RETURNING id',
              [category]
            );
            categoryId = newCat.rows[0].id;
            categoryMap[category.toLowerCase()] = categoryId;
          }
        }

        // Check if equipment exists by serial number or name
        let existing = null;
        if (serialNumber) {
          const serialCheck = await query(
            'SELECT id FROM equipment WHERE serial_number = $1',
            [serialNumber]
          );
          if (serialCheck.rows.length > 0) {
            existing = serialCheck.rows[0];
          }
        }

        if (existing) {
          // Update existing
          await query(
            `UPDATE equipment SET name = $1, category_id = $2, description = $3,
             daily_rate = $4, replacement_cost = $5, quantity_available = $6, location = $7
             WHERE id = $8`,
            [name, categoryId, description || null, dailyRate || 0, replacementCost || null,
             quantity || 1, location || null, existing.id]
          );
          results.updated++;
        } else {
          // Create new
          await query(
            `INSERT INTO equipment (name, category_id, description, serial_number, daily_rate,
             replacement_cost, quantity_available, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [name, categoryId, description || null, serialNumber || null, dailyRate || 0,
             replacementCost || null, quantity || 1, location || null]
          );
          results.created++;
        }

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
