const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { JWT_SECRET } = require('../auth');

const router = express.Router();

// POST /api/auth/login
// Issues a token for an already-onboarded school's administrator, or for
// the platform's superadmin account (which has no schoolId).
// There is no self-signup here on purpose — school accounts are created
// during onboarding (see README "Onboarding a new school"); there is
// exactly one superadmin account, seeded directly.
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  if (user.role === 'superadmin') {
    const token = jwt.sign({ userId: user.id, schoolId: null, role: 'superadmin' }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      school: null,
    });
  }

  const platform = db.getPlatformInfo();
  if (platform.maintenanceMode) {
    return res.status(503).json({ error: 'ElimuPay is undergoing scheduled maintenance. Please try again shortly.' });
  }

  const school = db.getSchool(user.schoolId);
  if (!school) {
    return res.status(401).json({ error: 'This account is not linked to an active school.' });
  }
  if (school.status === 'suspended') {
    return res.status(403).json({ error: "This school's ElimuPay access has been paused. Contact ElimuPay support for details." });
  }

  const token = jwt.sign(
    { userId: user.id, schoolId: user.schoolId, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    school: { id: school.id, name: school.name },
  });
});

// POST /api/leads
// A school that wants ElimuPay submits its details here. This is a request
// to start onboarding, not an account — nothing is activated automatically.
router.post('/leads', (req, res) => {
  const { name, schoolName, phone, email, studentCount, message } = req.body || {};
  if (!name || !schoolName || !phone) {
    return res.status(400).json({ error: 'name, schoolName and phone are required.' });
  }
  const lead = db.addLead({ name, schoolName, phone, email, studentCount, message });
  res.status(201).json({ message: 'Thank you — we will be in touch to arrange onboarding.', lead });
});

module.exports = router;
