const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/database');

const router = express.Router();

// Generate a webhook token for Power Automate
// Store this in admin settings or .env
const WEBHOOK_TOKEN = process.env.POWERAUTOMATE_WEBHOOK_TOKEN || '';

// Verify webhook token (optional security)
function verifyToken(req, res, next) {
  const token = req.headers['x-webhook-token'] || req.query.token;

  // If no token configured, allow all requests (for initial setup)
  if (!WEBHOOK_TOKEN) {
    return next();
  }

  if (token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }
  next();
}

// Receive single event from Power Automate
router.post('/event', verifyToken, async (req, res) => {
  try {
    const {
      name,
      event_date,
      location,
      start_time,
      end_time,
      description,
      cost_center,
      sharepoint_id,  // Optional: to link back to SharePoint item
      external_id     // Optional: alternative ID for updates
    } = req.body;

    if (!name || !event_date) {
      return res.status(400).json({ error: 'name and event_date are required' });
    }

    // Check if event already exists (by sharepoint_id or external_id)
    let existingEvent = null;
    if (sharepoint_id) {
      const existing = await query(
        'SELECT id FROM events WHERE sharepoint_id = $1',
        [sharepoint_id]
      );
      existingEvent = existing.rows[0];
    } else if (external_id) {
      const existing = await query(
        'SELECT id FROM events WHERE external_id = $1',
        [external_id]
      );
      existingEvent = existing.rows[0];
    }

    let result;
    if (existingEvent) {
      // Update existing event
      result = await query(
        `UPDATE events SET
          name = $1,
          event_date = $2,
          location = $3,
          start_time = $4,
          end_time = $5,
          description = $6,
          cost_center = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *`,
        [name, event_date, location || null, start_time || null, end_time || null,
         description || null, cost_center || null, existingEvent.id]
      );

      console.log(`Power Automate: Updated event ${result.rows[0].id} - ${name}`);
      res.json({ message: 'Event updated', event: result.rows[0], action: 'updated' });
    } else {
      // Create new event
      result = await query(
        `INSERT INTO events (name, event_date, location, start_time, end_time, description, cost_center, sharepoint_id, external_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'powerautomate')
         RETURNING *`,
        [name, event_date, location || null, start_time || null, end_time || null,
         description || null, cost_center || null, sharepoint_id || null, external_id || null]
      );

      console.log(`Power Automate: Created event ${result.rows[0].id} - ${name}`);
      res.json({ message: 'Event created', event: result.rows[0], action: 'created' });
    }
  } catch (error) {
    console.error('Power Automate webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Receive batch of events from Power Automate
router.post('/events', verifyToken, async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const event of events) {
      try {
        const {
          name,
          event_date,
          location,
          start_time,
          end_time,
          description,
          cost_center,
          sharepoint_id,
          external_id
        } = event;

        if (!name || !event_date) {
          results.errors.push({ event, error: 'name and event_date are required' });
          continue;
        }

        // Check if event exists
        let existingEvent = null;
        if (sharepoint_id) {
          const existing = await query(
            'SELECT id FROM events WHERE sharepoint_id = $1',
            [sharepoint_id]
          );
          existingEvent = existing.rows[0];
        } else if (external_id) {
          const existing = await query(
            'SELECT id FROM events WHERE external_id = $1',
            [external_id]
          );
          existingEvent = existing.rows[0];
        }

        if (existingEvent) {
          await query(
            `UPDATE events SET
              name = $1, event_date = $2, location = $3, start_time = $4,
              end_time = $5, description = $6, cost_center = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8`,
            [name, event_date, location || null, start_time || null, end_time || null,
             description || null, cost_center || null, existingEvent.id]
          );
          results.updated++;
        } else {
          await query(
            `INSERT INTO events (name, event_date, location, start_time, end_time, description, cost_center, sharepoint_id, external_id, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'powerautomate')`,
            [name, event_date, location || null, start_time || null, end_time || null,
             description || null, cost_center || null, sharepoint_id || null, external_id || null]
          );
          results.created++;
        }
      } catch (err) {
        results.errors.push({ event: event.name, error: err.message });
      }
    }

    console.log(`Power Automate batch: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
    res.json(results);
  } catch (error) {
    console.error('Power Automate batch webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for Power Automate to verify endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TGL Schedule Power Automate Webhook',
    timestamp: new Date().toISOString()
  });
});

// Generate a new webhook token (admin only - call manually or via settings)
router.post('/generate-token', async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.json({
    token,
    instructions: 'Add this to your .env as POWERAUTOMATE_WEBHOOK_TOKEN and use it in Power Automate HTTP headers as x-webhook-token'
  });
});

module.exports = router;
