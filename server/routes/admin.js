const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes here require admin or manager. User create/edit/deactivate and
// role changes are restricted further to admin only.
router.use(requireAuth, requireRole('admin', 'manager'));

router.get('/users', (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, pto_balance_hours, active, created_at FROM users ORDER BY name')
    .all();
  res.json({ users });
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { name, email, password, role, pto_balance_hours } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const r = ['associate', 'manager', 'admin'].includes(role) ? role : 'associate';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, pto_balance_hours) VALUES (?, ?, ?, ?, ?)')
    .run(name, String(email).toLowerCase(), hash, r, Number(pto_balance_hours) || 0);
  res.json({ id: info.lastInsertRowid });
});

// Bulk import: body = { users: [{ name, email, password, role, pto_balance_hours }, ...] }
// Frontend parses a pasted CSV into this shape. Rows with an email that
// already exists are skipped and reported back.
router.post('/users/bulk', requireRole('admin'), (req, res) => {
  const { users } = req.body || {};
  if (!Array.isArray(users) || users.length === 0) return res.status(400).json({ error: 'users array is required' });

  const insert = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, pto_balance_hours) VALUES (?, ?, ?, ?, ?)'
  );
  const existsStmt = db.prepare('SELECT id FROM users WHERE email = ?');

  const created = [];
  const skipped = [];
  const tx = db.transaction(() => {
    for (const raw of users) {
      const name = (raw.name || '').trim();
      const email = (raw.email || '').trim().toLowerCase();
      const password = (raw.password || '').trim();
      const role = ['associate', 'manager', 'admin'].includes(raw.role) ? raw.role : 'associate';
      const pto = Number(raw.pto_balance_hours) || 0;

      if (!name || !email || password.length < 8) {
        skipped.push({ email: raw.email, reason: 'missing name/email or password too short' });
        continue;
      }
      if (existsStmt.get(email)) {
        skipped.push({ email, reason: 'email already exists' });
        continue;
      }
      const hash = bcrypt.hashSync(password, 10);
      insert.run(name, email, hash, role, pto);
      created.push(email);
    }
  });
  tx();
  res.json({ created, skipped });
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const { name, role, pto_balance_hours, active, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (role !== undefined && ['associate', 'manager', 'admin'].includes(role)) { fields.push('role = ?'); values.push(role); }
  if (pto_balance_hours !== undefined) { fields.push('pto_balance_hours = ?'); values.push(Number(pto_balance_hours)); }
  if (active !== undefined) { fields.push('active = ?'); values.push(active ? 1 : 0); }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    fields.push('password_hash = ?');
    values.push(bcrypt.hashSync(password, 10));
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No changes provided' });

  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

module.exports = router;
