const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ptoHoursForRange, toCsv } = require('../utils');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  const requests = db
    .prepare('SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  const user = db.prepare('SELECT pto_balance_hours FROM users WHERE id = ?').get(req.user.id);
  res.json({ requests, balanceHours: user.pto_balance_hours });
});

router.post('/request', requireAuth, (req, res) => {
  const { start_date, end_date, type, reason } = req.body || {};
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  if (end_date < start_date) return res.status(400).json({ error: 'end_date must be on or after start_date' });

  const hours = ptoHoursForRange(start_date, end_date);
  if (hours <= 0) return res.status(400).json({ error: 'Selected range has no business days' });

  const info = db
    .prepare(
      `INSERT INTO pto_requests (user_id, start_date, end_date, type, hours_requested, reason)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, start_date, end_date, type || 'vacation', hours, reason || null);
  res.json({ id: info.lastInsertRowid, hours_requested: hours });
});

router.post('/:id/cancel', requireAuth, (req, res) => {
  const request = db.prepare('SELECT * FROM pto_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be cancelled' });
  db.prepare("UPDATE pto_requests SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Admin/manager: list all requests, optional ?status=pending
router.get('/all', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db
      .prepare(
        `SELECT p.*, u.name AS user_name, u.email AS user_email
         FROM pto_requests p JOIN users u ON u.id = p.user_id
         WHERE p.status = ? ORDER BY p.created_at DESC`
      )
      .all(status);
  } else {
    rows = db
      .prepare(
        `SELECT p.*, u.name AS user_name, u.email AS user_email
         FROM pto_requests p JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC`
      )
      .all();
  }
  res.json({ requests: rows });
});

router.post('/:id/decide', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { decision } = req.body || {}; // 'approved' | 'denied'
  if (!['approved', 'denied'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or denied' });

  const request = db.prepare('SELECT * FROM pto_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already decided' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE pto_requests SET status = ?, decided_by = ?, decided_at = datetime(\'now\') WHERE id = ?').run(
      decision,
      req.user.id,
      req.params.id
    );
    if (decision === 'approved') {
      db.prepare('UPDATE users SET pto_balance_hours = pto_balance_hours - ? WHERE id = ?').run(
        request.hours_requested,
        request.user_id
      );
    }
  });
  tx();
  res.json({ ok: true });
});

router.get('/report.csv', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { start, end } = req.query;
  const s = start || '1970-01-01';
  const e = end || '2999-12-31';
  const rows = db
    .prepare(
      `SELECT u.name AS user_name, u.email AS user_email, p.start_date, p.end_date, p.type, p.hours_requested, p.status, p.reason
       FROM pto_requests p JOIN users u ON u.id = p.user_id
       WHERE p.start_date <= ? AND p.end_date >= ?
       ORDER BY u.name, p.start_date`
    )
    .all(e, s);
  const csv = toCsv(rows, [
    { key: 'user_name', label: 'Name' },
    { key: 'user_email', label: 'Email' },
    { key: 'start_date', label: 'Start' },
    { key: 'end_date', label: 'End' },
    { key: 'type', label: 'Type' },
    { key: 'hours_requested', label: 'Hours' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason' },
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="pto_${s}_to_${e}.csv"`);
  res.send(csv);
});

module.exports = router;
