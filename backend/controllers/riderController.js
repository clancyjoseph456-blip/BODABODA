const db = require('../config/db');

/**
 * Ownership rules.
 *
 *   admin  — sees and edits every rider
 *   owner  — sees and edits riders belonging to them
 *   rider  — sees and edits only their own bike
 */
function scopeFilter(user) {
  if (user.role === 'admin') return { sql: '', params: [] };
  if (user.role === 'owner') {
    return { sql: ' AND r.user_id = ?', params: [user.id] };
  }
  return { sql: ' AND r.user_id = ?', params: [user.id] };
}

async function findRider(id) {
  const riders = await db.query('SELECT * FROM riders WHERE id = ?', [id]);
  return riders[0] || null;
}

/** Throws 404/403 unless the caller is allowed to touch this rider. */
async function assertCanAccess(req, riderId) {
  const rider = await findRider(riderId);
  if (!rider) {
    const error = new Error('Rider not found.');
    error.status = 404;
    throw error;
  }
  if (req.user.role !== 'admin' && rider.user_id !== req.user.id) {
    const error = new Error('You can only access your own riders.');
    error.status = 403;
    throw error;
  }
  return rider;
}

async function logAction(userId, action, entity, entityId, details) {
  await db.execute(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
  );
}

/** GET /api/riders — list riders visible to the caller. */
async function listRiders(req, res) {
  const { sql, params } = scopeFilter(req.user);

  const riders = await db.query(
    `SELECT r.*, u.full_name AS rider_name, u.email, u.phone,
            (SELECT COUNT(*) FROM trips t WHERE t.rider_id = r.id) AS trip_count,
            (SELECT COALESCE(SUM(fare), 0) FROM trips t WHERE t.rider_id = r.id) AS total_revenue
     FROM riders r
     JOIN users u ON u.id = r.user_id
     WHERE 1=1 ${sql}
     ORDER BY r.created_at DESC`,
    params
  );

  return res.json(riders);
}

/** GET /api/riders/:id */
async function getRider(req, res) {
  const rider = await assertCanAccess(req, req.params.id);
  const owner = await db.query(
    'SELECT id, full_name, email, phone FROM users WHERE id = ?',
    [rider.user_id]
  );
  return res.json({ ...rider, owner: owner[0] });
}

/** POST /api/riders — register a new bike. */
async function createRider(req, res) {
  const { bike_model, registration_number, base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km } = req.body;

  // Owners create riders for themselves; admins may create for anyone.
  const userId = req.user.role === 'admin' && req.body.user_id ? req.body.user_id : req.user.id;

  const result = await db.execute(
    `INSERT INTO riders (user_id, bike_model, registration_number, base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, bike_model, registration_number || null, base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km]
  );

  await logAction(req.user.id, 'rider.created', 'rider', result.insertId, { bike_model });

  return res.status(201).json({ message: 'Rider registered.', rider_id: result.insertId });
}

/** PUT /api/riders/:id — update pricing or deactivate. */
async function updateRider(req, res) {
  const rider = await assertCanAccess(req, req.params.id);

  const fields = ['bike_model', 'registration_number', 'base_fare', 'rate_per_km', 'fuel_price_per_litre', 'fuel_consumption_per_km', 'status'];
  const updates = fields.filter((field) => req.body[field] !== undefined);

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update.' });
  }

  const assignments = updates.map((field) => `${field} = ?`).join(', ');
  const values = updates.map((field) => req.body[field]);

  await db.execute(`UPDATE riders SET ${assignments} WHERE id = ?`, [...values, rider.id]);
  await logAction(req.user.id, 'rider.updated', 'rider', rider.id, updates);

  return res.json({ message: 'Rider updated.' });
}

/** DELETE /api/riders/:id — deactivate. Trips are never destroyed. */
async function deleteRider(req, res) {
  const rider = await assertCanAccess(req, req.params.id);
  await db.execute("UPDATE riders SET status = 'inactive' WHERE id = ?", [rider.id]);
  await logAction(req.user.id, 'rider.deactivated', 'rider', rider.id, null);
  return res.json({ message: 'Rider deactivated.' });
}

/** GET /api/riders/:id/summary — the JSON equivalent of the reference `summary()`. */
async function getSummary(req, res) {
  const rider = await assertCanAccess(req, req.params.id);

  const trips = await db.query(
    'SELECT fare, fuel_cost, distance_km FROM trips WHERE rider_id = ?',
    [rider.id]
  );
  const expenses = await db.query(
    'SELECT label, amount FROM expenses WHERE rider_id = ?',
    [rider.id]
  );

  const { summarise } = require('../services/fareEngine');
  const summary = summarise({ trips, expenses, settings: rider });

  return res.json({
    rider: {
      id: rider.id,
      bike_model: rider.bike_model,
      registration_number: rider.registration_number,
      status: rider.status
    },
    ...summary
  });
}

module.exports = {
  listRiders,
  getRider,
  createRider,
  updateRider,
  deleteRider,
  getSummary,
  assertCanAccess,
  findRider,
  logAction
};
