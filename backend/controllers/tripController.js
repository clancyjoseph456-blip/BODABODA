const db = require('../config/db');
const { quoteTrip, SEASONS } = require('../services/fareEngine');
const { assertCanAccess, findRider, logAction } = require('./riderController');

/**
 * Trip creation is atomic: the fare is computed by the engine, then the trip
 * row is written with its fare and fuel cost already resolved. Nothing about
 * pricing is ever accepted from the client.
 */
async function createTrip(req, res) {
  const rider = await assertCanAccess(req, req.params.riderId);
  const { distance_km, weight_kg, season_key, passenger, notes } = req.body;

  const quote = quoteTrip({
    distance_km,
    weight_kg,
    season: season_key,
    base_fare: rider.base_fare,
    rate_per_km: rider.rate_per_km,
    fuel_price_per_litre: rider.fuel_price_per_litre,
    fuel_consumption_per_km: rider.fuel_consumption_per_km
  });

  const result = await db.execute(
    `INSERT INTO trips (rider_id, distance_km, weight_kg, season_key, fare, fuel_cost, passenger, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rider.id, quote.distance_km, quote.weight_kg, quote.season, quote.fare, quote.fuel_cost, passenger || null, notes || null]
  );

  await logAction(req.user.id, 'trip.created', 'trip', result.insertId, {
    rider_id: rider.id, fare: quote.fare
  });

  return res.status(201).json({
    message: 'Trip recorded.',
    trip: { id: result.insertId, ...quote }
  });
}

/** GET /api/riders/:riderId/trips — optionally filtered by season or date range. */
async function listTrips(req, res) {
  const rider = await assertCanAccess(req, req.params.riderId);
  const { season, from, to } = req.query;

  const conditions = ['rider_id = ?'];
  const params = [rider.id];

  if (season && SEASONS[season]) {
    conditions.push('season_key = ?');
    params.push(season);
  }
  if (from) {
    conditions.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('created_at <= DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(to);
  }

  const trips = await db.query(
    `SELECT * FROM trips WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC, id DESC`,
    params
  );

  return res.json(trips);
}

/** GET /api/riders/:riderId/trips/:id */
async function getTrip(req, res) {
  await assertCanAccess(req, req.params.riderId);
  const trips = await db.query('SELECT * FROM trips WHERE id = ? AND rider_id = ?', [
    req.params.id,
    req.params.riderId
  ]);

  if (trips.length === 0) {
    return res.status(404).json({ message: 'Trip not found.' });
  }
  return res.json(trips[0]);
}

/** DELETE /api/riders/:riderId/trips/:id */
async function deleteTrip(req, res) {
  await assertCanAccess(req, req.params.riderId);
  const result = await db.execute('DELETE FROM trips WHERE id = ? AND rider_id = ?', [
    req.params.id,
    req.params.riderId
  ]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Trip not found.' });
  }

  await logAction(req.user.id, 'trip.deleted', 'trip', req.params.id, null);
  return res.json({ message: 'Trip deleted.' });
}

/**
 * POST /api/quote — price a hypothetical trip without saving it.
 * Lets the UI show the rider exactly what they will earn and pay before
 * they commit the record.
 */
async function quote(req, res) {
  const rider = await findRider(req.body.rider_id);
  if (!rider) {
    return res.status(404).json({ message: 'Rider not found.' });
  }
  await assertCanAccess(req, rider.id);

  return res.json(
    quoteTrip({
      distance_km: req.body.distance_km,
      weight_kg: req.body.weight_kg,
      season: req.body.season_key,
      base_fare: rider.base_fare,
      rate_per_km: rider.rate_per_km,
      fuel_price_per_litre: rider.fuel_price_per_litre,
      fuel_consumption_per_km: rider.fuel_consumption_per_km
    })
  );
}

module.exports = { createTrip, listTrips, getTrip, deleteTrip, quote };
