const jwt = require('jsonwebtoken');

// In production this must be a long random value kept only in .env — see
// .env.example. Falling back to a fixed string here so the project runs
// out of the box for evaluation; the README calls this out explicitly.
const JWT_SECRET = process.env.JWT_SECRET || 'elimupay-dev-secret-change-me';

// Protects admin-only routes. Expects `Authorization: Bearer <token>`.
// On success, attaches { userId, schoolId, role } to req.auth and confirms
// the token's schoolId matches the :schoolId in the URL — one school's
// admin cannot use their token against another school's data.
// A superadmin token is exempt from that match (platform oversight can open
// any school's dashboard), but still must be a valid, unexpired token.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const urlSchoolId = req.params.schoolId ? Number(req.params.schoolId) : null;
    if (urlSchoolId && payload.schoolId !== urlSchoolId && payload.role !== 'superadmin') {
      return res.status(403).json({ error: 'This account cannot access that school.' });
    }
    req.auth = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

// Protects platform-admin-only routes (/api/superadmin/*).
function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'superadmin') {
      return res.status(403).json({ error: 'This account does not have platform administrator access.' });
    }
    req.auth = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { JWT_SECRET, requireAuth, requireSuperAdmin };
