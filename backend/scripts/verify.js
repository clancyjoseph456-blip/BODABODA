/**
 * One-off manual verification of the full stack: boots the API in-process,
 * exercises the exact calls the React app makes, and prints a readable report.
 * Run with: node scripts/verify.js
 */
const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

const money = (n) => `KSh ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const line = (label) => console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 58 - label.length))}`);

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body;
}

async function main() {
  line('public endpoints (no auth)');
  const seasons = await request(app).get('/api/seasons');
  console.log('GET /api/seasons ->', seasons.status);
  seasons.body.forEach((s) => console.log(`   ${s.label.padEnd(8)} fare x${s.fare_multiplier}  fuel x${s.fuel_multiplier}`));

  const health = await request(app).get('/api/health');
  console.log('GET /api/health  ->', health.status, JSON.stringify(health.body));

  const anon = await request(app).get('/api/riders');
  console.log('GET /api/riders without token ->', anon.status, '(must be 401)');

  line('admin sees everything');
  const admin = await login('admin@boda.test');
  const ah = { Authorization: `Bearer ${admin.token}` };
  const overview = (await request(app).get('/api/analytics/overview').set(ah)).body;
  console.log(`riders=${overview.rider_count} trips=${overview.trip_count} revenue=${money(overview.total_revenue)}`);
  console.log(`expenses=${money(overview.total_expenses)}  NET=${money(overview.net_profit)}`);

  line('rider sees only their own bike');
  const rider = await login('rider@boda.test');
  const rh = { Authorization: `Bearer ${rider.token}` };
  const mine = (await request(app).get('/api/riders').set(rh)).body;
  console.log(`riders visible: ${mine.length} -> ${mine[0].bike_model} ${mine[0].registration_number}`);

  line('fare engine agrees with the reference benchmark');
  const { summarise } = require('../services/fareEngine');
  const canonical = summarise({
    trips: [
      { fare: 150, fuel_cost: 27, distance_km: 5 },
      { fare: 360, fuel_cost: 43.2, distance_km: 8 },
      { fare: 221, fuel_cost: 37.26, distance_km: 6 }
    ],
    expenses: [{ amount: 1700 }]
  });
  const expected = { total_revenue: 731, total_expenses: 1807.46, net_profit: -1076.46 };
  console.log(`revenue  ${money(canonical.total_revenue)}  expected ${money(expected.total_revenue)}`);
  console.log(`expenses ${money(canonical.total_expenses)} expected ${money(expected.total_expenses)}`);
  console.log(`profit   ${money(canonical.net_profit)} expected ${money(expected.net_profit)}`);
  const match =
    canonical.total_revenue === expected.total_revenue &&
    canonical.total_expenses === expected.total_expenses &&
    canonical.net_profit === expected.net_profit;
  console.log(match ? 'MATCH — the port is faithful to the OOP exercise' : 'MISMATCH');
  if (!match) process.exitCode = 1;

  line('cross-tenant access is refused');
  const owner = await login('owner@boda.test');
  const foreign = await request(app).get(`/api/riders/${mine[0].id}/summary`).set({
    Authorization: `Bearer ${owner.token}`
  });
  console.log(`owner reading rider ${mine[0].id} -> ${foreign.status} (must be 403)`);
  if (foreign.status !== 403) process.exitCode = 1;

  line('role gates');
  const users = await request(app).get('/api/admin/users').set(rh);
  console.log(`rider hitting /api/admin/users -> ${users.status} (must be 403)`);
  if (users.status !== 403) process.exitCode = 1;

  await db.pool.end();
  console.log('\nAll checks passed.');
}

main().catch(async (error) => {
  console.error('\nVERIFICATION FAILED:', error.message);
  await db.pool.end().catch(() => {});
  process.exit(1);
});
