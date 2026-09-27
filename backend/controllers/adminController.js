const db = require('../config/db');

/** GET /api/admin/users — every account. */
async function listUsers(req, res) {
  const users = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at,
            (SELECT COUNT(*) FROM riders r WHERE r.user_id = u.id) AS rider_count
     FROM users u
     ORDER BY u.created_at DESC`
  );
  return res.json(users);
}

/** PUT /api/admin/users/:id/status — activate or suspend. */
async function updateUserStatus(req, res) {
  const { status } = req.body;

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Status must be active or inactive.' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own status.' });
  }

  const result = await db.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ message: `User ${status === 'active' ? 'activated' : 'suspended'}.` });
}

/** GET /api/admin/rider/:id/history — full audit trail for one rider. */
async function riderHistory(req, res) {
  const logs = await db.query(
    `SELECT a.*, u.full_name AS actor
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.entity = 'rider' AND a.entity_id = ?
        OR (JSON_EXTRACT(a.details, '$.rider_id') = ?)
     ORDER BY a.created_at DESC
     LIMIT 100`,
    [req.params.id, req.params.id]
  );
  return res.json(logs);
}

/** PUT /api/admin/riders/:id/assign — move a rider to a different owner. */
async function assignRider(req, res) {
  const { user_id } = req.body;

  const owners = await db.query("SELECT id FROM users WHERE id = ? AND role IN ('owner', 'admin')", [user_id]);
  if (owners.length === 0) {
    return res.status(400).json({ message: 'Riders can only be assigned to an owner or admin.' });
  }

  const result = await db.execute('UPDATE riders SET user_id = ? WHERE id = ?', [user_id, req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Rider not found.' });
  }

  return res.json({ message: 'Rider reassigned.' });
}

module.exports = { listUsers, updateUserStatus, riderHistory, assignRider };
