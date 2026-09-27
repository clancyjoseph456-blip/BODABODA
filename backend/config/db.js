const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * A connection pool keeps a small set of database connections warm for reuse.
 * Controllers call `db.query(...)` instead of opening a connection per request.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'boda_boda_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } })
});

/** Run a SELECT and get back plain rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run an INSERT/UPDATE/DELETE and get back the result header. */
async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/** Verify connectivity at boot so misconfiguration fails loudly, not silently. */
async function assertConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
}

module.exports = { pool, query, execute, assertConnection };
