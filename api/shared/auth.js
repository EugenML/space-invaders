const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function signToken(userId, username) {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: '24h' });
}

function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
