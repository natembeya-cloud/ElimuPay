const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/schools/search?q=...
// Public — lets a parent find their school by name before searching for
// their child. Only returns schools currently active on ElimuPay.
router.get('/schools/search', (req, res) => {
  const results = db.searchSchools(req.query.q || '');
  res.json(results);
});

// GET /api/version
// Public — current platform version and maintenance status, for a small
// footer/about display and for the platform-admin dashboard to read its
// own toggle's current state.
router.get('/version', (req, res) => {
  const info = db.getPlatformInfo();
  res.json({ current: info.current, history: info.history, maintenanceMode: info.maintenanceMode });
});

module.exports = router;
