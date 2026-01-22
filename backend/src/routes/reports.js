const express = require('express');
const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const { query } = require('../config/database');
const { authenticate, isScheduler } = require('../middleware/auth');

const router = express.Router();

// Helper: Calculate crew cost
function calculateCrewCost(assignment) {
  const rate = parseFloat(assignment.rate) || 0;
  // Default to 8 hours if no times specified
  let hours = 8;
  if (assignment.call_time && assignment.end_time) {
    const start = assignment.call_time.split(':').map(Number);
    const end = assignment.end_time.split(':').map(Number);
    hours = (end[0] + end[1]/60) - (start[0] + start[1]/60);
    if (hours < 0) hours += 24; // Handle overnight
  }
  return rate * hours;
}

// Helper: Calculate equipment cost
function calculateEquipmentCost(assignment) {
  const rate = parseFloat(assignment.rate) || 0;
  const quantity = parseInt(assignment.quantity) || 1;
  return rate * quantity;
}

// Helper: Format date
function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

// Helper: Format time
function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

// Get event report data
router.get('/event/:id', authenticate, async (req, res, next) => {
  try {
    // Get event
    const eventResult = await query(
      `SELECT e.*, u.name as created_by_name
       FROM events e LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Get crew assignments with costs
    const crewResult = await query(
      `SELECT ca.*, cm.name as crew_name, cm.email as crew_email, cm.phone as crew_phone,
              p.name as position_name, COALESCE(ca.rate_override, cm.hourly_rate, 0) as rate
       FROM crew_assignments ca
       JOIN crew_members cm ON ca.crew_member_id = cm.id
       LEFT JOIN positions p ON ca.position_id = p.id
       WHERE ca.event_id = $1
       ORDER BY p.sort_order, cm.name`,
      [req.params.id]
    );

    // Get equipment assignments with costs
    const equipmentResult = await query(
      `SELECT ea.*, eq.name as equipment_name, eq.serial_number,
              ec.name as category_name, COALESCE(ea.rate_override, eq.daily_rate, 0) as rate
       FROM equipment_assignments ea
       JOIN equipment eq ON ea.equipment_id = eq.id
       LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
       WHERE ea.event_id = $1
       ORDER BY ec.sort_order, eq.name`,
      [req.params.id]
    );

    // Calculate totals
    const crewAssignments = crewResult.rows.map(a => ({
      ...a,
      cost: calculateCrewCost(a)
    }));

    const equipmentAssignments = equipmentResult.rows.map(a => ({
      ...a,
      cost: calculateEquipmentCost(a)
    }));

    const crewTotal = crewAssignments.reduce((sum, a) => sum + a.cost, 0);
    const equipmentTotal = equipmentAssignments.reduce((sum, a) => sum + a.cost, 0);

    res.json({
      event,
      crewAssignments,
      equipmentAssignments,
      totals: {
        crew: crewTotal,
        equipment: equipmentTotal,
        total: crewTotal + equipmentTotal
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cost summary report by cost center
router.get('/costs', authenticate, isScheduler, async (req, res, next) => {
  try {
    const { start_date, end_date, cost_center } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (start_date) {
      whereClause += ` AND e.event_date >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ` AND e.event_date <= $${paramCount++}`;
      params.push(end_date);
    }
    if (cost_center) {
      whereClause += ` AND e.cost_center = $${paramCount++}`;
      params.push(cost_center);
    }

    const result = await query(
      `SELECT
         e.id, e.name, e.event_date, e.cost_center, e.status,
         COALESCE(SUM(COALESCE(ca.rate_override, cm.hourly_rate, 0) * 8), 0) as crew_cost,
         COALESCE(SUM(COALESCE(ea.rate_override, eq.daily_rate, 0) * ea.quantity), 0) as equipment_cost
       FROM events e
       LEFT JOIN crew_assignments ca ON e.id = ca.event_id
       LEFT JOIN crew_members cm ON ca.crew_member_id = cm.id
       LEFT JOIN equipment_assignments ea ON e.id = ea.event_id
       LEFT JOIN equipment eq ON ea.equipment_id = eq.id
       ${whereClause}
       GROUP BY e.id
       ORDER BY e.event_date`,
      params
    );

    // Group by cost center
    const byCostCenter = {};
    let grandTotal = { crew: 0, equipment: 0, total: 0 };

    result.rows.forEach(event => {
      const cc = event.cost_center || 'Unassigned';
      if (!byCostCenter[cc]) {
        byCostCenter[cc] = { events: [], totals: { crew: 0, equipment: 0, total: 0 } };
      }

      const crewCost = parseFloat(event.crew_cost) || 0;
      const equipmentCost = parseFloat(event.equipment_cost) || 0;
      const total = crewCost + equipmentCost;

      byCostCenter[cc].events.push({
        ...event,
        crew_cost: crewCost,
        equipment_cost: equipmentCost,
        total
      });

      byCostCenter[cc].totals.crew += crewCost;
      byCostCenter[cc].totals.equipment += equipmentCost;
      byCostCenter[cc].totals.total += total;

      grandTotal.crew += crewCost;
      grandTotal.equipment += equipmentCost;
      grandTotal.total += total;
    });

    res.json({
      byCostCenter,
      grandTotal,
      eventCount: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Crew schedule report
router.get('/crew-schedule', authenticate, async (req, res, next) => {
  try {
    const { start_date, end_date, crew_member_id } = req.query;

    let whereClause = 'WHERE e.event_date >= CURRENT_DATE';
    const params = [];
    let paramCount = 1;

    if (start_date) {
      whereClause = `WHERE e.event_date >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ` AND e.event_date <= $${paramCount++}`;
      params.push(end_date);
    }
    if (crew_member_id) {
      whereClause += ` AND ca.crew_member_id = $${paramCount++}`;
      params.push(crew_member_id);
    }

    const result = await query(
      `SELECT
         cm.id as crew_id, cm.name as crew_name, cm.email, cm.phone,
         e.id as event_id, e.name as event_name, e.event_date, e.location, e.venue,
         e.start_time, e.end_time,
         ca.call_time, ca.end_time as assignment_end_time, ca.status,
         p.name as position_name
       FROM crew_assignments ca
       JOIN crew_members cm ON ca.crew_member_id = cm.id
       JOIN events e ON ca.event_id = e.id
       LEFT JOIN positions p ON ca.position_id = p.id
       ${whereClause}
       ORDER BY cm.name, e.event_date, e.start_time`,
      params
    );

    // Group by crew member
    const byCrewMember = {};
    result.rows.forEach(row => {
      if (!byCrewMember[row.crew_id]) {
        byCrewMember[row.crew_id] = {
          id: row.crew_id,
          name: row.crew_name,
          email: row.email,
          phone: row.phone,
          assignments: []
        };
      }
      byCrewMember[row.crew_id].assignments.push({
        event_id: row.event_id,
        event_name: row.event_name,
        event_date: row.event_date,
        location: row.location,
        venue: row.venue,
        call_time: row.call_time,
        position: row.position_name,
        status: row.status
      });
    });

    res.json({
      schedule: Object.values(byCrewMember),
      totalAssignments: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Export event report as PDF
router.get('/export/pdf/event/:id', authenticate, async (req, res, next) => {
  try {
    // Get event data
    const eventResult = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventResult.rows[0];

    // Get assignments
    const crewResult = await query(
      `SELECT ca.*, cm.name as crew_name, cm.phone as crew_phone,
              p.name as position_name, COALESCE(ca.rate_override, cm.hourly_rate, 0) as rate
       FROM crew_assignments ca
       JOIN crew_members cm ON ca.crew_member_id = cm.id
       LEFT JOIN positions p ON ca.position_id = p.id
       WHERE ca.event_id = $1
       ORDER BY p.sort_order, cm.name`,
      [req.params.id]
    );

    const equipmentResult = await query(
      `SELECT ea.*, eq.name as equipment_name, eq.serial_number,
              ec.name as category_name, COALESCE(ea.rate_override, eq.daily_rate, 0) as rate
       FROM equipment_assignments ea
       JOIN equipment eq ON ea.equipment_id = eq.id
       LEFT JOIN equipment_categories ec ON eq.category_id = ec.id
       WHERE ea.event_id = $1
       ORDER BY ec.sort_order, eq.name`,
      [req.params.id]
    );

    // Calculate costs
    let crewTotal = 0;
    const crewRows = crewResult.rows.map(a => {
      const cost = calculateCrewCost(a);
      crewTotal += cost;
      return { ...a, cost };
    });

    let equipmentTotal = 0;
    const equipmentRows = equipmentResult.rows.map(a => {
      const cost = calculateEquipmentCost(a);
      equipmentTotal += cost;
      return { ...a, cost };
    });

    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0 0 10px 0; font-size: 24px; }
          .header .meta { color: #666; }
          .section { margin-bottom: 30px; }
          .section h2 { font-size: 16px; background: #f0f0f0; padding: 8px; margin: 0 0 10px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .totals { font-weight: bold; background: #e8f4f8; }
          .grand-total { font-size: 16px; text-align: right; margin-top: 20px; padding: 10px; background: #333; color: white; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${event.name}</h1>
          <p class="meta">
            ${formatDate(event.event_date)} | ${event.location || 'TBD'} ${event.venue ? `- ${event.venue}` : ''}<br>
            ${event.start_time ? `${formatTime(event.start_time)} - ${formatTime(event.end_time)}` : ''}<br>
            Cost Center: ${event.cost_center || 'Unassigned'}
          </p>
        </div>

        <div class="section">
          <h2>Crew (${crewRows.length})</h2>
          <table>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Call Time</th>
              <th>Phone</th>
              <th class="right">Rate</th>
              <th class="right">Est. Cost</th>
            </tr>
            ${crewRows.map(a => `
              <tr>
                <td>${a.crew_name}</td>
                <td>${a.position_name || '-'}</td>
                <td>${a.call_time ? formatTime(a.call_time) : '-'}</td>
                <td>${a.crew_phone || '-'}</td>
                <td class="right">$${(parseFloat(a.rate) || 0).toFixed(2)}/hr</td>
                <td class="right">$${a.cost.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="totals">
              <td colspan="5">Crew Subtotal</td>
              <td class="right">$${crewTotal.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>Equipment (${equipmentRows.length})</h2>
          <table>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Serial #</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Cost</th>
            </tr>
            ${equipmentRows.map(a => `
              <tr>
                <td>${a.equipment_name}</td>
                <td>${a.category_name || '-'}</td>
                <td>${a.serial_number || '-'}</td>
                <td class="right">${a.quantity}</td>
                <td class="right">$${(parseFloat(a.rate) || 0).toFixed(2)}</td>
                <td class="right">$${a.cost.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="totals">
              <td colspan="5">Equipment Subtotal</td>
              <td class="right">$${equipmentTotal.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="grand-total">
          Event Total: $${(crewTotal + equipmentTotal).toFixed(2)}
        </div>

        <p style="color: #999; font-size: 10px; margin-top: 40px;">
          Generated: ${new Date().toLocaleString()}
        </p>
      </body>
      </html>
    `;

    // Generate PDF
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="event-${event.event_date}-${event.name.replace(/[^a-z0-9]/gi, '-')}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Export cost report as Excel
router.get('/export/excel/costs', authenticate, isScheduler, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (start_date) {
      whereClause += ` AND e.event_date >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ` AND e.event_date <= $${paramCount++}`;
      params.push(end_date);
    }

    const result = await query(
      `SELECT
         e.name as "Event", e.event_date as "Date", e.location as "Location",
         e.cost_center as "Cost Center", e.status as "Status",
         COALESCE(SUM(COALESCE(ca.rate_override, cm.hourly_rate, 0) * 8), 0) as "Crew Cost",
         COALESCE(SUM(COALESCE(ea.rate_override, eq.daily_rate, 0) * ea.quantity), 0) as "Equipment Cost"
       FROM events e
       LEFT JOIN crew_assignments ca ON e.id = ca.event_id
       LEFT JOIN crew_members cm ON ca.crew_member_id = cm.id
       LEFT JOIN equipment_assignments ea ON e.id = ea.event_id
       LEFT JOIN equipment eq ON ea.equipment_id = eq.id
       ${whereClause}
       GROUP BY e.id
       ORDER BY e.event_date`,
      params
    );

    // Add total column
    const data = result.rows.map(row => ({
      ...row,
      'Total': (parseFloat(row['Crew Cost']) || 0) + (parseFloat(row['Equipment Cost']) || 0)
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Event
      { wch: 12 }, // Date
      { wch: 20 }, // Location
      { wch: 15 }, // Cost Center
      { wch: 12 }, // Status
      { wch: 12 }, // Crew Cost
      { wch: 15 }, // Equipment Cost
      { wch: 12 }  // Total
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cost-report-${start_date || 'all'}-${end_date || 'all'}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
