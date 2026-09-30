const express = require('express');
const db = require('../db');
const { requireSuperAdmin } = require('../auth');

const router = express.Router();

/* ------------------------------ Overview -------------------------------- */

// GET /api/superadmin/overview
router.get('/superadmin/overview', requireSuperAdmin, (req, res) => {
  res.json(db.platformOverview());
});

/* ------------------------------- Schools -------------------------------- */

// GET /api/superadmin/schools
router.get('/superadmin/schools', requireSuperAdmin, (req, res) => {
  res.json(db.listSchoolsWithStats());
});

// POST /api/superadmin/schools
// Onboards a new school and creates its first admin account in one step.
// This is the concrete action behind "grant a school access" — a lead
// (see /leads) is typically converted into a school this way.
router.post('/superadmin/schools', requireSuperAdmin, (req, res) => {
  const { name, county, paybillNumber, plan, adminName, adminEmail, adminPassword } = req.body || {};
  if (!name || !adminName || !adminEmail) {
    return res.status(400).json({ error: 'name, adminName and adminEmail are required.' });
  }
  if (db.findUserByEmail(adminEmail)) {
    return res.status(409).json({ error: `An account already exists for ${adminEmail}.` });
  }

  const result = db.createSchool({ name, county, paybillNumber, plan, adminName, adminEmail, adminPassword });
  res.status(201).json(result);
});

// PATCH /api/superadmin/schools/:schoolId
// Suspend/reactivate a school, or edit its details.
router.patch('/superadmin/schools/:schoolId', requireSuperAdmin, (req, res) => {
  const updated = db.updateSchool(req.params.schoolId, req.body || {});
  if (!updated) return res.status(404).json({ error: 'School not found.' });
  res.json(updated);
});

// DELETE /api/superadmin/schools/:schoolId
// Permanently removes a school that "doesn't meet expectations" — along
// with its students, payments, admin accounts and reminders. Suspension
// (PATCH status=suspended) is the reversible alternative to this.
router.delete('/superadmin/schools/:schoolId', requireSuperAdmin, (req, res) => {
  const deleted = db.deleteSchool(req.params.schoolId);
  if (!deleted) return res.status(404).json({ error: 'School not found.' });
  res.json({ message: `${deleted.name} and all of its data have been removed.` });
});

/* -------------------------------- Leads ---------------------------------- */

// GET /api/superadmin/leads
router.get('/superadmin/leads', requireSuperAdmin, (req, res) => {
  res.json(db.listLeads());
});

// PATCH /api/superadmin/leads/:leadId
router.patch('/superadmin/leads/:leadId', requireSuperAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'onboarded', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'status must be one of: new, contacted, onboarded, declined.' });
  }
  const lead = db.updateLeadStatus(req.params.leadId, status);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  res.json(lead);
});

/* ------------------------------ Audit log --------------------------------- */

// GET /api/superadmin/audit-log
router.get('/superadmin/audit-log', requireSuperAdmin, (req, res) => {
  res.json(db.listAllAuditLogs());
});

/* --------------------------- Version & maintenance ------------------------ */

// POST /api/superadmin/version
// Records a new release note and makes it the "current" version shown on
// the public site. This does not deploy code — see README "What 'updating
// the version' actually does here".
router.post('/superadmin/version', requireSuperAdmin, (req, res) => {
  const { version, notes } = req.body || {};
  if (!version) return res.status(400).json({ error: 'version is required.' });
  const entry = db.addPlatformVersion({ version, notes });
  res.status(201).json(entry);
});

// PATCH /api/superadmin/maintenance
// While enabled, school administrator logins are blocked with a friendly
// message. Parent-facing endpoints (lookup, search, payments) are
// deliberately left working, so fees can still be paid during a deploy.
router.patch('/superadmin/maintenance', requireSuperAdmin, (req, res) => {
  const { enabled } = req.body || {};
  const maintenanceMode = db.setMaintenanceMode(enabled);
  res.json({ maintenanceMode });
});

module.exports = router;
