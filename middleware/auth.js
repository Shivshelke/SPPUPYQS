/**
 * middleware/auth.js
 * Protects admin routes — rejects unauthenticated requests.
 */

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  // API request or form-data fetch → JSON error
  if (req.path.startsWith('/api') || 
      req.headers['content-type']?.includes('application/json') || 
      req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized. Please login as admin.' });
  }
  // Browser GET request → redirect to login
  return res.redirect('/login.html');
}

async function requireAuth(req, res, next) {
  if (req.session && req.session.isStudent && req.session.studentUser) {
    // We need the user _id for payments, so fetch the student object
    const Student = require('../models/Student');
    try {
      const student = await Student.findOne({ username: req.session.studentUser });
      if (student) {
        req.user = student;
        return next();
      }
    } catch (e) {
      console.error('requireAuth error:', e);
    }
  }
  
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in as a student.' });
  }
  return res.redirect('/student-login.html');
}

module.exports = { requireAdmin, requireAuth };
