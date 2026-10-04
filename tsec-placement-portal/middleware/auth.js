/**
 * Authentication & authorisation middleware.
 * After login we store { userId, role, studentId } in the session (a cookie
 * that the browser sends back automatically on every request).
 */
const db = require('../db');

/** Blocks the request unless someone is logged in. */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  // Make sure the account still exists (e.g. after `npm run reset`).
  const user = db.get('SELECT id, role FROM users WHERE id = ?', [req.session.userId]);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
  next();
}

/** Blocks the request unless the logged-in user has the given role. */
function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

/**
 * Protects the HTML pages themselves: /student/* pages only for students,
 * /tpo/* pages only for the TPO. Anyone else is sent back to the login page.
 */
function guardPages(req, res, next) {
  const area = req.path.startsWith('/student') ? 'STUDENT' : req.path.startsWith('/tpo') ? 'TPO' : null;
  if (!area) return next();
  if (!req.session || !req.session.userId) return res.redirect('/?next=' + encodeURIComponent(req.originalUrl));
  if (req.session.role !== area) return res.redirect(req.session.role === 'TPO' ? '/tpo/dashboard.html' : '/student/dashboard.html');
  next();
}

module.exports = { requireLogin, requireRole, guardPages };
