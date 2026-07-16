const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toCsv } = require('../utils');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Currently open (clocked-in, not clocked-out) entry for a user, if any.
router.get('/status', requireAuth, (req, res) => {
  const open = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1')
    .get(req.user.id);
  res.json({ open: open || null });
});

router.post('/clock-in', requireAuth, (req, res) => {
  const open = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL')
    .get(req.user.id);
  if (open) return res.status(400).json({ error: 'Already clocked in' });

  const now = new Date();
  const info = db
    .prepare('INSERT INTO time_entries (user_id, work_date, clock_in, source) VALUES (?, ?, ?, ?)')
    .run(req.user.id, todayStr(), now.toISOString(), 'clock');
  res.json({ id: info.lastInsertRowid, clock_in: now.toISOString() });
});

router.post('/clock-out', requireAuth, (req, res) => {
  const open = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1')
    .get(req.user.id);
  if (!open) return res.status(400).json({ error: 'Not currently clocked in' });

  const now = new Date();
  const hours = Math.round(((now - new Date(open.clock_in)) / 3600000) * 100) / 100;
  db.prepare('UPDATE time_entries SET clock_out = ?, hours = ? WHERE id = ?').run(now.toISOString(), hours, open.id);
  res.json({ id: open.id, clock_out: now.toISOString(), hours });
});

// Associate submits a manual entry (e.g. forgot to clock in/out).
router.post('/manual', requireAuth, (req, res) => {
  const { work_date, hours, notes } = req.body || {};
  const targetUserId = req.body.user_id && ['admin', 'manager'].includes(req.user.role) ? req.body.user_id : req.user.id;
  if (!work_date || !hours || Number(hours) <= 0) {
    return res.status(400).json({ error: 'work_date and a positive hours value are required' });
  }
  const info = db
    .prepare('INSERT INTO time_entries (user_id, work_date, hours, source, notes) VALUES (?, ?, ?, ?, ?)')
    .run(targetUserId, work_date, Number(hours), 'manual', notes || null);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireAuth, (req, res) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const isOwner = entry.user_id === req.user.id;
  const isManager = ['admin', 'manager'].includes(req.user.role);
  if (!isOwner && !isManager) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Own timesheet, optional ?start=&end=
router.get('/me', requireAuth, (req, res) => {
  const { start, end } = req.query;
  let rows;
  if (start && end) {
    rows = db
      .prepare('SELECT * FROM time_entries WHERE user_id = ? AND work_date BETWEEN ? AND ? ORDER BY work_date DESC, id DESC')
      .all(req.user.id, start, end);
  } else {
    rows = db
      .prepare('SELECT * FROM time_entries WHERE user_id = ? ORDER BY work_date DESC, id DESC LIMIT 100')
      .all(req.user.id);
  }
  const totalHours = rows.reduce((sum, r) => sum + (r.hours || 0), 0);
  res.json({ entries: rows, totalHours: Math.round(totalHours * 100) / 100 });
});

// Admin/manager: everyone's entries for a date range, plus per-user totals.
router.get('/all', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { start, end } = req.query;
  const s = start || '1970-01-01';
  const e = end || '2999-12-31';
  const rows = db
    .prepare(
      `SELECT te.*, u.name AS user_name, u.email AS user_email
       FROM time_entries te JOIN users u ON u.id = te.user_id
       WHERE te.work_date BETWEEN ? AND ?
       ORDER BY u.name, te.work_date DESC`
    )
    .all(s, e);
  res.json({ entries: rows });
});

router.get('/report.csv', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { start, end } = req.query;
  const s = start || '1970-01-01';
  const e = end || '2999-12-31';
  const rows = db
    .prepare(
      `SELECT te.work_date, u.name AS user_name, u.email AS user_email, te.hours, te.source, te.notes
       FROM time_entries te JOIN users u ON u.id = te.user_id
       WHERE te.work_date BETWEEN ? AND ?
       ORDER BY u.name, te.work_date`
    )
    .all(s, e);
  const csv = toCsv(rows, [
    { key: 'user_name', label: 'Name' },
    { key: 'user_email', label: 'Email' },
    { key: 'work_date', label: 'Date' },
    { key: 'hours', label: 'Hours' },
    { key: 'source', label: 'Source' },
    { key: 'notes', label: 'Notes' },
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="timesheet_${s}_to_${e}.csv"`);
  res.send(csv);
});

module.exports = router;
