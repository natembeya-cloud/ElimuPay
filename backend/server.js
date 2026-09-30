require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const studentsRoutes = require('./routes/students');
const paymentsRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const superadminRoutes = require('./routes/superadmin');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 4000;

// Restrict this to your actual frontend origin(s) in production —
// see README "Configuration" for CORS_ORIGIN.
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  })
);
app.use(express.json());

// Simple request log — replace with a real logger (pino/winston) in production.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', studentsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', authRoutes);
app.use('/api', superadminRoutes);
app.use('/api', publicRoutes);

// Demo convenience only — wipes data back to the seed dataset.
// Remove this route (or protect it) before any real deployment.
app.post('/api/dev/reset', (req, res) => {
  const fresh = db.reset();
  res.json({ message: 'Data reset to seed values.', schools: fresh.schools });
});

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`ElimuPay API listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
