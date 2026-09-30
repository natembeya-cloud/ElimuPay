const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/schools/:schoolId/dashboard — admin only
router.get('/schools/:schoolId/dashboard', requireAuth, (req, res) => {
  res.json(db.dashboardStats(Number(req.params.schoolId)));
});

// GET /api/schools/:schoolId/reports/:reportType — admin only
// reportType: daily-collection | outstanding-fees | unmatched-payments | term-collection
router.get('/schools/:schoolId/reports/:reportType', requireAuth, (req, res) => {
  const report = db.generateReport(Number(req.params.schoolId), req.params.reportType);
  res.json(report);
});

// GET /api/schools/:schoolId/reminders — admin only
router.get('/schools/:schoolId/reminders', requireAuth, (req, res) => {
  res.json(db.listReminders(Number(req.params.schoolId)));
});

// PATCH /api/schools/:schoolId/reminders/:reminderId — admin only
router.patch('/schools/:schoolId/reminders/:reminderId', requireAuth, (req, res) => {
  const { enabled } = req.body || {};
  const reminder = db.toggleReminder(Number(req.params.schoolId), req.params.reminderId, enabled);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found.' });
  res.json(reminder);
});

// GET /api/schools/:schoolId/audit-log — admin only
router.get('/schools/:schoolId/audit-log', requireAuth, (req, res) => {
  res.json(db.listAuditLogs(Number(req.params.schoolId)));
});

module.exports = router;
