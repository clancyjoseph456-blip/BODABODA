/**
 * smoke.test.js — End-to-end API tests using supertest.
 *
 * These exercise the real routing, middleware chain and MySQL queries against
 * a live database, complementing the pure-unit fareEngine tests.
 *
 * Requires: `npm run migrate` to have been run first.
 */

const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

const PASSWORD = 'Password123!';
let adminToken;
let riderToken;
let ownerToken;
let riderId;
let riderUserId;

beforeAll(async () => {
  const admin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@boda.test', password: PASSWORD });
  adminToken = admin.body.token;

  const owner = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner@boda.test', password: PASSWORD });
  ownerToken = owner.body.token;

  const rider = await request(app)
    .post('/api/auth/login')
    .send({ email: 'rider@boda.test', password: PASSWORD });
  riderToken = rider.body.token;
  riderUserId = rider.body.user.id;

  // Resolve the rider this account owns up front. Several suites depend on it,
  // and relying on a test that happens to run earlier is fragile ordering.
  const mine = await request(app)
    .get('/api/riders')
    .set('Authorization', `Bearer ${riderToken}`);
  riderId = mine.body[0].id;
});

describe('health & metadata', () => {
  it('reports the API is up', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/running/i);
  });

  it('confirms the database is reachable', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('exposes the pricing seasons publicly', async () => {
    const res = await request(app).get('/api/seasons');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.find((s) => s.key === 'rainy').fare_multiplier).toBe(1.3);
  });
});

describe('authentication', () => {
  it('logs in and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@boda.test', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('admin');
  });

  it('never leaks the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@boda.test', password: PASSWORD });

    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@boda.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('gives the same message for unknown email and bad password', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@boda.test', password: PASSWORD });
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@boda.test', password: 'nope' });

    expect(unknown.status).toBe(wrongPass.status);
    expect(unknown.body.message).toBe(wrongPass.body.message);
  });

  it('blocks unauthenticated access to riders', async () => {
    const res = await request(app).get('/api/riders');
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('rider@boda.test');
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/riders')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });
});

describe('rider scoping', () => {
  it('shows an admin every rider', async () => {
    const res = await request(app)
      .get('/api/riders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('shows a rider only their own bike', async () => {
    const res = await request(app)
      .get('/api/riders')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("stops a rider reading someone else's rider", async () => {
    const res = await request(app)
      .get('/api/riders/9999')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(404);
  });

  it("stops an owner touching a rider outside their fleet", async () => {
    const res = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('trip recording', () => {
  it('prices a trip server-side and stores the result', async () => {
    const before = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 5, weight_kg: 10, season_key: 'dry' });

    expect(res.status).toBe(201);
    // 50 base + 5*20 + 0 surcharge, dry season
    expect(res.body.trip.fare).toBe(150);
    expect(res.body.trip.fuel_cost).toBe(27);

    const after = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.body.trip_count).toBe(before.body.trip_count + 1);
  });

  it('applies the rainy season markup', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 6, weight_kg: 15, season_key: 'rainy' });

    // (50 + 6*20 + 0) * 1.3 = 221
    expect(res.body.trip.fare).toBe(221);
  });

  it('charges a weight surcharge above 20kg', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 8, weight_kg: 35, season_key: 'dry' });

    // (50 + 8*20 + 15*10) * 1.0 = 360
    expect(res.body.trip.fare).toBe(360);
  });

  it('rejects a load beyond bike capacity', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 5, weight_kg: 150, season_key: 'dry' });

    expect(res.status).toBe(400);
  });

  it('rejects a zero distance', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 0, season_key: 'dry' });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown season', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distance_km: 5, season_key: 'monsoon' });

    expect(res.status).toBe(400);
  });

  it('lists trips newest first', async () => {
    const res = await request(app)
      .get(`/api/riders/${riderId}/trips`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].id).toBeGreaterThan(res.body[res.body.length - 1].id);
  });

  it('filters trips by season', async () => {
    const res = await request(app)
      .get(`/api/riders/${riderId}/trips?season=rainy`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.forEach((trip) => expect(trip.season_key).toBe('rainy'));
  });
});

describe('quote preview', () => {
  it('prices without persisting anything', async () => {
    const before = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post('/api/riders/quote')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rider_id: riderId, distance_km: 10, weight_kg: 25, season_key: 'dry' });

    expect(res.status).toBe(200);
    // 50 + 10*20 + 5*10 = 300
    expect(res.body.fare).toBe(300);

    const after = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.body.trip_count).toBe(before.body.trip_count);
  });
});

describe('expenses', () => {
  it('records a manual expense and moves net profit', async () => {
    const before = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/riders/${riderId}/expenses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'brake pads', amount: 450, category: 'maintenance' });

    expect(res.status).toBe(201);

    const after = await request(app)
      .get(`/api/riders/${riderId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.body.other_expenses).toBe(before.body.other_expenses + 450);
    expect(after.body.net_profit).toBe(
      Number((before.body.net_profit - 450).toFixed(2))
    );
  });

  it('rejects a zero-value expense', async () => {
    const res = await request(app)
      .post(`/api/riders/${riderId}/expenses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'nothing', amount: 0 });

    expect(res.status).toBe(400);
  });
});

describe('analytics', () => {
  it('returns fleet totals', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rider_count).toBeGreaterThan(0);
    expect(res.body.total_revenue).toBeGreaterThan(0);
  });

  it('ranks riders by net profit', async () => {
    const res = await request(app)
      .get('/api/analytics/riders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].net_profit).toBeGreaterThanOrEqual(res.body[res.body.length - 1].net_profit);
  });

  it('always returns all three seasons', async () => {
    const res = await request(app)
      .get('/api/analytics/seasons')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.season)).toEqual(['dry', 'rainy', 'holiday']);
  });

  it('computes break-even distance per rider', async () => {
    const res = await request(app)
      .get('/api/analytics/break-even')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.forEach((r) => expect(typeof r.break_even_km).toBe('number'));
  });
});

describe('admin', () => {
  it('lists users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('forbids non-admins', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(403);
  });

  it('stops an admin from suspending themselves', async () => {
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .put(`/api/admin/users/${me.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(400);
  });
});

describe('error handling', () => {
  it('404s an unknown API route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// Without this the mysql2 pool keeps the event loop alive and Jest hangs after
// reporting results. Closing it is cleaner than forcing the process to exit,
// which would hide any genuinely open handle.
afterAll(async () => {
  await db.pool.end();
});
