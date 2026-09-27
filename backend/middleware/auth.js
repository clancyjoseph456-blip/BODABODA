const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Rejects any request without a valid, unexpired Bearer token.
 * On success it attaches the decoded payload to `req.user`.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    const expired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      message: expired ? 'Session expired. Please log in again.' : 'Invalid token.'
    });
  }
}

/**
 * Restricts a route to specific roles. Must run after `authenticate`.
 *
 *   router.post('/', authenticate, authorizeRoles('admin', 'owner'), handler)
 */
function authorizeRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource.' });
    }
    return next();
  };
}

/**
 * Blocks users whose account has been deactivated by an admin. Runs after
 * `authenticate` on protected routes so a suspended session cannot keep working.
 */
async function requireActive(req, res, next) {
  try {
    const users = await db.query('SELECT status FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0 || users[0].status !== 'active') {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Could not verify account status.' });
  }
}

module.exports = { authenticate, authorizeRoles, requireActive };
