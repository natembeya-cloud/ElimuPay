const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/schools/:schoolId/students  — admin only
router.get('/schools/:schoolId/students', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  res.json(db.listStudents(schoolId));
});

// POST /api/schools/:schoolId/students  — admin only
router.post('/schools/:schoolId/students', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const { name, className, admissionNo, parentPhone, expected } = req.body || {};

  if (!name || !className || !admissionNo) {
    return res.status(400).json({ error: 'name, className and admissionNo are required.' });
  }
  if (db.findStudentByAdmission(schoolId, admissionNo)) {
    return res.status(409).json({ error: `Admission number ${admissionNo} is already in use.` });
  }

  const student = db.addStudent(schoolId, { name, className, admissionNo, parentPhone, expected });
  res.status(201).json(student);
});

function requireActiveSchool(req, res) {
  const school = db.getSchool(req.params.schoolId);
  if (!school) {
    res.status(404).json({ error: 'School not found.' });
    return null;
  }
  if (school.status === 'suspended') {
    res.status(403).json({ error: 'This school is not currently active on ElimuPay.' });
    return null;
  }
  return school;
}

// GET /api/schools/:schoolId/students/search?name=&className=&admissionNo=
// Public — the parent portal's "find my child" search. admissionNo, if
// given, is authoritative and exact; otherwise name/className are matched
// as substrings. At least one of name or admissionNo must be given.
router.get('/schools/:schoolId/students/search', (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!requireActiveSchool(req, res)) return;

  const { name, className, admissionNo } = req.query;
  if (!(name && name.trim()) && !(admissionNo && admissionNo.trim())) {
    return res.status(400).json({ error: 'Enter at least the child\'s name or their admission number.' });
  }

  const results = db.searchStudents(schoolId, { name, className, admissionNo });
  res.json(results.map((s) => ({ name: s.name, className: s.className, admissionNo: s.admissionNo })));
});

// GET /api/schools/:schoolId/students/:admissionNo  (parent portal lookup — no login required)
router.get('/schools/:schoolId/students/:admissionNo', (req, res) => {
  const schoolId = Number(req.params.schoolId);
  if (!requireActiveSchool(req, res)) return;

  const statement = db.studentStatement(schoolId, req.params.admissionNo);
  if (!statement) {
    return res.status(404).json({ error: `No student found for admission number ${req.params.admissionNo}.` });
  }
  res.json(statement);
});

module.exports = router;
