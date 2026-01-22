const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const crewRoutes = require('./routes/crew');
const equipmentRoutes = require('./routes/equipment');
const positionRoutes = require('./routes/positions');
const assignmentRoutes = require('./routes/assignments');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhook');
const powerAutomateRoutes = require('./routes/powerautomate');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3200;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Webhook routes (before body parsing for raw body access)
app.use('/api/webhook', webhookRoutes);

// Power Automate webhook (needs JSON body parsing)
app.use('/api/powerautomate', express.json(), powerAutomateRoutes);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Schedule Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
