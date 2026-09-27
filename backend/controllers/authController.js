const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/** Strip the password hash before returning a user to any client. */
function publicUser(row) {
  const { password, ...safe } = row;
  return safe;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** POST /api/auth/register */
async function register(req, res) {
  const { full_name, email, phone, password, role } = req.body;

  const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  // Admin accounts are never self-registered — they are created by an admin.
  const result = await db.execute(
    'INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
    [full_name, email, phone || null, await bcrypt.hash(password, 10), role]
  );

  const created = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  const user = publicUser(created[0]);

  return res.status(201).json({ token: signToken(user), user });
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body;

  const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (users.length === 0) {
    // Same message and code for unknown email and wrong password, so the
    // endpoint cannot be used to enumerate registered accounts.
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  const user = users[0];
  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }

  const safe = publicUser(user);
  return res.json({ token: signToken(safe), user: safe });
}

/** GET /api/auth/me — re-reads the user so role/status changes apply immediately. */
async function me(req, res) {
  const users = await db.query(
    'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    return res.status(404).json({ message: 'Account no longer exists.' });
  }

  return res.json(users[0]);
}

module.exports = { register, login, me, publicUser, signToken };
