const express = require('express');
const bcrypt = require('bcryptjs');
const { sign } = require('../middleware/auth');

module.exports = function authRouter(db) {
  const router = express.Router();

  // POST /api/v1/auth/register
  router.post('/register', async (req, res) => {
    try {
      const { email, password, fullName, role } = req.body;
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: { code: 'REQUIRED_FIELD', message: 'email, password, fullName are required' } });
      }
      const dup = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: { code: 'DUPLICATE_EMAIL', message: 'email already registered' } });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const safeRole = role === 'admin' ? 'admin' : 'customer';
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role`,
        [email, passwordHash, fullName, safeRole]
      );
      const user = rows[0];
      res.status(201).json({ data: { user, token: sign(user) } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
    }
  });

  // POST /api/v1/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (rows.length === 0) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'email or password incorrect' } });
      }
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'email or password incorrect' } });
      }
      res.status(200).json({
        data: { user: { id: user.id, email: user.email, role: user.role }, token: sign(user) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
    }
  });

  return router;
};
