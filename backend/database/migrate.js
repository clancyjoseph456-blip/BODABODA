/**
 * migrate.js — Creates the database, applies the schema, and seeds demo data.
 *
 * Run with: `npm run migrate`
 *
 * Seeding is done in JavaScript rather than a static seed.sql for two reasons:
 *   1. Password hashes are generated with bcrypt at run time, so nothing
 *      sensitive is ever committed to the repository.
 *   2. Demo trips are priced by calling the real `fareEngine`, which means the
 *      seeded numbers can never drift out of sync with the business rules.
 *
 * The script is idempotent: it drops and recreates the schema on every run.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const { quoteTrip } = require('../services/fareEngine');

const DB_NAME = process.env.DB_NAME || 'boda_boda_db';
const DEMO_PASSWORD = 'Password123!';

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: true
  });

  console.log('→ Dropping and recreating database...');
  await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await connection.query(
    `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${DB_NAME}\``);

  console.log('→ Applying schema...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await connection.query(schema);

  console.log('→ Seeding seasons...');
  await connection.query(`
    INSERT INTO seasons (season_key, label, fare_multiplier, fuel_multiplier) VALUES
      ('dry',     'Dry season',  1.00, 1.00),
      ('rainy',   'Rainy season', 1.30, 1.15),
      ('holiday', 'Holiday',      1.50, 1.00)
  `);

  console.log('→ Seeding users...');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [admin] = await connection.query(
    `INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, 'admin')`,
    ['Fleet Admin', 'admin@boda.test', '+254700000001', hash]
  );

  const [owner] = await connection.query(
    `INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, 'owner')`,
    ['Grace Wanjiru', 'owner@boda.test', '+254700000002', hash]
  );

  const [riderUser] = await connection.query(
    `INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, 'rider')`,
    ['Otieno Kamau', 'rider@boda.test', '+254700000003', hash]
  );

  console.log('→ Seeding riders...');
  const [rider1] = await connection.query(
    `INSERT INTO riders (user_id, bike_model, registration_number, base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km)
     VALUES (?, 'Bajaj Boxer', 'KDA 412B', 50, 20, 180, 0.030)`,
    [riderUser.insertId]
  );

  const [rider2] = await connection.query(
    `INSERT INTO riders (user_id, bike_model, registration_number, base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km)
     VALUES (?, 'Yamaha FZ', 'KCZ 088X', 60, 25, 195, 0.028)`,
    [owner.insertId]
  );

  // The first three trips for rider 1 are the exact fixtures from the reference
  // OOP exercise (731.00 revenue / -1076.46 profit). The fourth is extra demo
  // data so the dashboard has something to chart, which means the seeded
  // dashboard totals are intentionally HIGHER than that benchmark. The canonical
  // figures are pinned by the unit tests in __tests__/fareEngine.test.js.
  console.log('→ Seeding trips (priced by fareEngine)...');
  const demoTrips = [
    { riderId: rider1.insertId, distance_km: 5, weight_kg: 10, season_key: 'dry', passenger: 'Amina' },
    { riderId: rider1.insertId, distance_km: 8, weight_kg: 35, season_key: 'dry', passenger: 'Market run' },
    { riderId: rider1.insertId, distance_km: 6, weight_kg: 15, season_key: 'rainy', passenger: 'James' },
    { riderId: rider1.insertId, distance_km: 12, weight_kg: 5, season_key: 'dry', passenger: 'School run' },
    { riderId: rider2.insertId, distance_km: 9, weight_kg: 25, season_key: 'dry', passenger: 'Deliveries' },
    { riderId: rider2.insertId, distance_km: 4, weight_kg: 0, season_key: 'holiday', passenger: 'Weekend outing' }
  ];

  for (const trip of demoTrips) {
    const settings = await riderSettings(connection, trip.riderId);
    const quote = quoteTrip({
      distance_km: trip.distance_km,
      weight_kg: trip.weight_kg,
      season: trip.season_key,
      ...settings
    });

    await connection.query(
      `INSERT INTO trips (rider_id, distance_km, weight_kg, season_key, fare, fuel_cost, passenger)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [trip.riderId, quote.distance_km, quote.weight_kg, quote.season, quote.fare, quote.fuel_cost, trip.passenger]
    );
  }

  console.log('→ Seeding expenses...');
  const demoExpenses = [
    { riderId: rider1.insertId, label: 'maintenance (oil change)', amount: 500, category: 'maintenance' },
    { riderId: rider1.insertId, label: 'insurance (monthly)', amount: 1200, category: 'insurance' },
    { riderId: rider1.insertId, label: 'helmet replacement', amount: 1800, category: 'equipment' },
    { riderId: rider2.insertId, label: 'tyre replacement', amount: 6500, category: 'maintenance' }
  ];

  for (const expense of demoExpenses) {
    await connection.query(
      'INSERT INTO expenses (rider_id, label, amount, category) VALUES (?, ?, ?, ?)',
      [expense.riderId, expense.label, expense.amount, expense.category]
    );
  }

  await connection.end();

  console.log('\n✓ Migration complete.\n');
  console.log('  Database: ' + DB_NAME);
  console.log('  Demo accounts (password: ' + DEMO_PASSWORD + ')');
  console.log('    admin@boda.test   — Fleet Admin');
  console.log('    owner@boda.test   — Grace Wanjiru (owns a fleet)');
  console.log('    rider@boda.test   — Otieno Kamau (single bike)\n');
}

async function riderSettings(connection, riderId) {
  const [rows] = await connection.query(
    `SELECT base_fare, rate_per_km, fuel_price_per_litre, fuel_consumption_per_km
     FROM riders WHERE id = ?`,
    [riderId]
  );
  return rows[0];
}

run().catch((error) => {
  console.error('✗ Migration failed:', error.message);
  process.exit(1);
});
