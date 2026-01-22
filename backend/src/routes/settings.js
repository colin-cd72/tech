const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
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

// ==================== EMAIL SETTINGS ====================

// Get email settings
router.get('/email', authenticate, isAdmin, async (req, res, next) => {
  try {
    let result = await query('SELECT * FROM email_settings LIMIT 1');

    if (result.rows.length === 0) {
      // Create default settings
      result = await query(
        `INSERT INTO email_settings (smtp_host, smtp_port, smtp_secure, enabled)
         VALUES ('', 587, false, false)
         RETURNING *`
      );
    }

    // Don't return password
    const settings = result.rows[0];
    delete settings.smtp_pass;
    settings.has_password = !!(await query('SELECT smtp_pass FROM email_settings WHERE id = $1 AND smtp_pass IS NOT NULL', [settings.id])).rows[0]?.smtp_pass;

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// Update email settings
router.put('/email',
  authenticate,
  isAdmin,
  [
    body('smtp_host').optional().trim(),
    body('smtp_port').optional().isInt({ min: 1, max: 65535 }),
    body('smtp_secure').optional().isBoolean(),
    body('smtp_user').optional().trim(),
    body('smtp_pass').optional(),
    body('from_email').optional().isEmail().normalizeEmail(),
    body('from_name').optional().trim(),
    body('enabled').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
        from_email, from_name, enabled
      } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (smtp_host !== undefined) {
        updates.push(`smtp_host = $${paramCount++}`);
        values.push(smtp_host || null);
      }
      if (smtp_port !== undefined) {
        updates.push(`smtp_port = $${paramCount++}`);
        values.push(smtp_port);
      }
      if (smtp_secure !== undefined) {
        updates.push(`smtp_secure = $${paramCount++}`);
        values.push(smtp_secure);
      }
      if (smtp_user !== undefined) {
        updates.push(`smtp_user = $${paramCount++}`);
        values.push(smtp_user || null);
      }
      if (smtp_pass !== undefined && smtp_pass !== '') {
        updates.push(`smtp_pass = $${paramCount++}`);
        values.push(smtp_pass);
      }
      if (from_email !== undefined) {
        updates.push(`from_email = $${paramCount++}`);
        values.push(from_email || null);
      }
      if (from_name !== undefined) {
        updates.push(`from_name = $${paramCount++}`);
        values.push(from_name || null);
      }
      if (enabled !== undefined) {
        updates.push(`enabled = $${paramCount++}`);
        values.push(enabled);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      // Get existing settings ID
      const existing = await query('SELECT id FROM email_settings LIMIT 1');
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Settings not found. Get settings first.' });
      }

      values.push(existing.rows[0].id);

      const result = await query(
        `UPDATE email_settings SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING id, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, enabled`,
        values
      );

      res.json({ settings: result.rows[0], message: 'Email settings updated' });
    } catch (error) {
      next(error);
    }
  }
);

// Test email settings
router.post('/email/test', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { test_email } = req.body;

    if (!test_email) {
      return res.status(400).json({ error: 'test_email is required' });
    }

    // Get settings
    const settings = await query('SELECT * FROM email_settings LIMIT 1');
    if (settings.rows.length === 0 || !settings.rows[0].smtp_host) {
      return res.status(400).json({ error: 'Email not configured' });
    }

    const config = settings.rows[0];

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure || false,
      auth: config.smtp_user ? {
        user: config.smtp_user,
        pass: config.smtp_pass
      } : undefined
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `"${config.from_name || 'TGL Schedule'}" <${config.from_email || config.smtp_user}>`,
      to: test_email,
      subject: 'TGL Schedule - Test Email',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from the TGL Schedule system.</p>
        <p>If you received this, your email settings are configured correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    });

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    res.status(400).json({ error: `Email test failed: ${error.message}` });
  }
});

// ==================== SHAREPOINT SETTINGS ====================

// Get SharePoint settings
router.get('/sharepoint', authenticate, isAdmin, async (req, res, next) => {
  try {
    let result = await query('SELECT * FROM sharepoint_settings LIMIT 1');

    if (result.rows.length === 0) {
      // Create default settings
      result = await query(
        `INSERT INTO sharepoint_settings (sync_enabled)
         VALUES (false)
         RETURNING *`
      );
    }

    // Don't return client secret
    const settings = result.rows[0];
    delete settings.client_secret;
    settings.has_secret = !!(await query('SELECT client_secret FROM sharepoint_settings WHERE id = $1 AND client_secret IS NOT NULL', [settings.id])).rows[0]?.client_secret;

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// Update SharePoint settings
router.put('/sharepoint',
  authenticate,
  isAdmin,
  [
    body('tenant_id').optional().trim(),
    body('client_id').optional().trim(),
    body('client_secret').optional(),
    body('site_url').optional().trim(),
    body('list_name').optional().trim(),
    body('field_mapping').optional().isObject(),
    body('sync_enabled').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        tenant_id, client_id, client_secret, site_url, list_name,
        field_mapping, sync_enabled
      } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (tenant_id !== undefined) {
        updates.push(`tenant_id = $${paramCount++}`);
        values.push(tenant_id || null);
      }
      if (client_id !== undefined) {
        updates.push(`client_id = $${paramCount++}`);
        values.push(client_id || null);
      }
      if (client_secret !== undefined && client_secret !== '') {
        updates.push(`client_secret = $${paramCount++}`);
        values.push(client_secret);
      }
      if (site_url !== undefined) {
        updates.push(`site_url = $${paramCount++}`);
        values.push(site_url || null);
      }
      if (list_name !== undefined) {
        updates.push(`list_name = $${paramCount++}`);
        values.push(list_name || null);
      }
      if (field_mapping !== undefined) {
        updates.push(`field_mapping = $${paramCount++}`);
        values.push(JSON.stringify(field_mapping));
      }
      if (sync_enabled !== undefined) {
        updates.push(`sync_enabled = $${paramCount++}`);
        values.push(sync_enabled);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      const existing = await query('SELECT id FROM sharepoint_settings LIMIT 1');
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Settings not found' });
      }

      values.push(existing.rows[0].id);

      const result = await query(
        `UPDATE sharepoint_settings SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING id, tenant_id, client_id, site_url, list_name, field_mapping, sync_enabled, last_sync_at`,
        values
      );

      res.json({ settings: result.rows[0], message: 'SharePoint settings updated' });
    } catch (error) {
      next(error);
    }
  }
);

// Get SharePoint sync history
router.get('/sharepoint/history', authenticate, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sl.*, u.name as synced_by_name
       FROM sharepoint_sync_log sl
       LEFT JOIN users u ON sl.synced_by = u.id
       ORDER BY sl.synced_at DESC
       LIMIT 20`
    );

    res.json({ history: result.rows });
  } catch (error) {
    next(error);
  }
});

// Trigger SharePoint sync (placeholder - full implementation needs Microsoft Graph API)
router.post('/sharepoint/sync', authenticate, isAdmin, async (req, res, next) => {
  try {
    // Get settings
    const settings = await query('SELECT * FROM sharepoint_settings LIMIT 1');
    if (settings.rows.length === 0 || !settings.rows[0].tenant_id) {
      return res.status(400).json({ error: 'SharePoint not configured' });
    }

    const config = settings.rows[0];

    if (!config.tenant_id || !config.client_id || !config.client_secret || !config.site_url) {
      return res.status(400).json({ error: 'SharePoint configuration incomplete' });
    }

    // TODO: Implement actual Microsoft Graph API sync
    // For now, log a manual sync attempt
    await query(
      `INSERT INTO sharepoint_sync_log (events_added, events_updated, events_unchanged, errors, synced_by)
       VALUES (0, 0, 0, 'Manual sync triggered - Microsoft Graph integration pending', $1)`,
      [req.user.id]
    );

    // Update last sync time
    await query(
      'UPDATE sharepoint_settings SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
      [config.id]
    );

    res.json({
      message: 'Sync initiated. Full Microsoft Graph integration pending.',
      note: 'Configure Azure AD App Registration with appropriate permissions for full sync functionality.'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    // Get upcoming events count
    const upcomingEvents = await query(
      `SELECT COUNT(*) FROM events WHERE event_date >= CURRENT_DATE AND status != 'cancelled'`
    );

    // Get events this week
    const thisWeekEvents = await query(
      `SELECT COUNT(*) FROM events
       WHERE event_date >= CURRENT_DATE
       AND event_date <= CURRENT_DATE + INTERVAL '7 days'
       AND status != 'cancelled'`
    );

    // Get active crew count
    const activeCrew = await query(
      `SELECT COUNT(*) FROM crew_members WHERE is_active = true`
    );

    // Get active equipment count
    const activeEquipment = await query(
      `SELECT COUNT(*) FROM equipment WHERE is_active = true`
    );

    // Get recent events with assignments
    const recentEvents = await query(
      `SELECT e.id, e.name, e.event_date, e.location, e.status,
        (SELECT COUNT(*) FROM crew_assignments WHERE event_id = e.id) as crew_count,
        (SELECT COUNT(*) FROM equipment_assignments WHERE event_id = e.id) as equipment_count
       FROM events e
       WHERE e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 5`
    );

    res.json({
      stats: {
        upcomingEvents: parseInt(upcomingEvents.rows[0].count),
        thisWeekEvents: parseInt(thisWeekEvents.rows[0].count),
        activeCrew: parseInt(activeCrew.rows[0].count),
        activeEquipment: parseInt(activeEquipment.rows[0].count)
      },
      upcomingEvents: recentEvents.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
