const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }
  if (err.code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({ error: 'A record with this value already exists' });
  }
  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  res.status(500).json({ error: 'Internal server error' });
};

module.exports = errorHandler;
