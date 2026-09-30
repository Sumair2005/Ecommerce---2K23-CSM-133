const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, SECRET, {
    expiresIn: '2h',
  });
}

// Rejects unauthenticated requests (no/invalid token).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing bearer token' } });
  }
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' } });
  }
}

// Rejects unauthorized requests (authenticated but not an admin).
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'UNAUTHORIZED', message: 'Admin role required' } });
  }
  next();
}

module.exports = { sign, requireAuth, requireAdmin, SECRET };
