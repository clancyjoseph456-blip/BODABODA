const db = require('../config/db');
const { summarise, breakEvenDistanceKm, SEASONS } = require('../services/fareEngine');

/**
 * Fleet-wide analytics.
 *
 * Admins see every rider; owners and riders are scoped to their own. All money
 * is aggregated in SQL with COALESCE so an idle rider contributes zero rather
 * than dropping out of the totals.
 */

function fleetScope(user) {
  if (user.role === 'admin') return { where: '', params: [] };
  return { where: ' WHERE r.user_id = ?', params: [user.id] };
}

function dateWindow(query) {
  const conditions = [];
  const params = [];

  if (query.from) {
    conditions.push('t.created_at >= ?');
    params.push(query.from);
  }
  if (query.to) {
    conditions.push('t.created_at <= DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(query.to);
  }

  return {
    clause: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
    params
  };
}

/** GET /api/analytics/overview — headline fleet numbers. */
async function overview(req, res) {
  const { where, params } = fleetScope(req.user);
  const window = dateWindow(req.query);

  const [totals] = await db.query(
    `SELECT
        COUNT(DISTINCT r.id)                                    AS rider_count,
        COUNT(DISTINCT t.id)                                    AS trip_count,
        COALESCE(SUM(t.distance_km), 0)                         AS total_distance_km,
        COALESCE(SUM(t.fare), 0)                                AS total_revenue,
        COALESCE(SUM(t.fuel_cost), 0)                           AS total_fuel_cost
     FROM riders r
     LEFT JOIN trips t ON t.rider_id = r.id ${window.clause}
     ${where}`,
    [...window.params, ...params]
  );

  const [manual] = await db.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS other_expenses
     FROM expenses e
     JOIN riders r ON r.id = e.rider_id
     ${where}`,
    params
  );

  const totalFuel = Number(totals.total_fuel_cost);
  const otherExpenses = Number(manual.other_expenses);
  const revenue = Number(totals.total_revenue);

  // Reuse the shared summariser so fleet totals and per-rider totals can never
  // drift apart in how expenses or profit are defined.
  const fleet = summarise({
    trips: [{ fare: revenue, fuel_cost: totalFuel, distance_km: Number(totals.total_distance_km) }],
    expenses: [{ amount: otherExpenses }]
  });

  return res.json({
    rider_count: totals.rider_count,
    trip_count: totals.trip_count,
    total_distance_km: Number(Number(totals.total_distance_km).toFixed(2)),
    total_revenue: fleet.total_revenue,
    total_fuel_cost: Number(totalFuel.toFixed(2)),
    other_expenses: fleet.other_expenses,
    total_expenses: fleet.total_expenses,
    net_profit: fleet.net_profit,
    avg_fare_per_trip: totals.trip_count ? Number((revenue / totals.trip_count).toFixed(2)) : 0,
    fuel_cost_per_km: totals.total_distance_km
      ? Number((totalFuel / totals.total_distance_km).toFixed(2))
      : 0
  });
}

/** GET /api/analytics/riders — per-rider profit ranking. */
async function perRider(req, res) {
  const { where, params } = fleetScope(req.user);
  const window = dateWindow(req.query);

  const riders = await db.query(
    `SELECT
        r.id, r.bike_model, r.registration_number, u.full_name AS rider_name,
        COALESCE(t.trips, 0)        AS trip_count,
        COALESCE(t.distance, 0)     AS distance_km,
        COALESCE(t.revenue, 0)      AS revenue,
        COALESCE(t.fuel, 0)         AS fuel_cost,
        COALESCE(e.other, 0)        AS other_expenses
     FROM riders r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN (
       SELECT rider_id,
              COUNT(*)                  AS trips,
              SUM(distance_km)          AS distance,
              SUM(fare)                 AS revenue,
              SUM(fuel_cost)            AS fuel
       FROM trips t WHERE 1=1 ${window.clause}
       GROUP BY rider_id
     ) t ON t.rider_id = r.id
     LEFT JOIN (
       SELECT rider_id, SUM(amount) AS other FROM expenses GROUP BY rider_id
     ) e ON e.rider_id = r.id
     WHERE r.status = 'active' ${where}
     ORDER BY (COALESCE(t.revenue, 0) - COALESCE(t.fuel, 0) - COALESCE(e.other, 0)) DESC`,
    [...window.params, ...params]
  );

  return res.json(
    riders.map((row) => {
      const revenue = Number(row.revenue);
      const fuel = Number(row.fuel_cost);
      const other = Number(row.other_expenses);
      const distance = Number(row.distance_km);
      return {
        id: row.id,
        bike_model: row.bike_model,
        registration_number: row.registration_number,
        rider_name: row.rider_name,
        trip_count: row.trip_count,
        distance_km: Number(distance.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        fuel_cost: Number(fuel.toFixed(2)),
        other_expenses: Number(other.toFixed(2)),
        net_profit: Number((revenue - fuel - other).toFixed(2)),
        margin_pct: revenue > 0 ? Number((((revenue - fuel - other) / revenue) * 100).toFixed(1)) : 0
      };
    })
  );
}

/** GET /api/analytics/seasons — how dry/rainy/holiday trading actually performs. */
async function bySeason(req, res) {
  const { where, params } = fleetScope(req.user);
  const window = dateWindow(req.query);

  const rows = await db.query(
    `SELECT t.season_key,
            COUNT(*)           AS trip_count,
            SUM(t.distance_km) AS distance_km,
            SUM(t.fare)        AS revenue,
            SUM(t.fuel_cost)   AS fuel_cost
     FROM trips t
     JOIN riders r ON r.id = t.rider_id
     WHERE 1=1 ${window.clause} ${where}
     GROUP BY t.season_key`,
    [...window.params, ...params]
  );

  // Always return every season so the UI has a stable shape to render.
  return res.json(
    Object.values(SEASONS).map((season) => {
      const row = rows.find((r) => r.season_key === season.key);
      const revenue = Number(row?.revenue || 0);
      const fuel = Number(row?.fuel_cost || 0);
      return {
        season: season.key,
        label: season.label,
        fare_multiplier: season.fare_multiplier,
        fuel_multiplier: season.fuel_multiplier,
        trip_count: row?.trip_count || 0,
        distance_km: Number(Number(row?.distance_km || 0).toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        fuel_cost: Number(fuel.toFixed(2)),
        net_profit: Number((revenue - fuel).toFixed(2))
      };
    })
  );
}

/** GET /api/analytics/break-even — the distance each rider needs to cover. */
async function breakEven(req, res) {
  const { where, params } = fleetScope(req.user);

  const riders = await db.query(
    `SELECT r.id, r.bike_model, r.base_fare, r.rate_per_km,
            r.fuel_price_per_litre, r.fuel_consumption_per_km
     FROM riders r WHERE r.status = 'active' ${where}`,
    params
  );

  return res.json(
    riders.map((rider) => ({
      id: rider.id,
      bike_model: rider.bike_model,
      break_even_km: breakEvenDistanceKm(rider)
    }))
  );
}

module.exports = { overview, perRider, bySeason, breakEven };
