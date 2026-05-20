const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../shared/db');
const { signToken } = require('../shared/auth');

module.exports = async function (context, req) {
  const { username, password } = req.body || {};

  if (!username || !password || username.length < 3 || password.length < 6) {
    context.res = { status: 400, body: { error: 'Username min 3 chars, password min 6 chars.' } };
    return;
  }

  try {
    const pool = await getPool();
    const existing = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT Id FROM Users WHERE Username = @username');

    if (existing.recordset.length > 0) {
      context.res = { status: 409, body: { error: 'Username already taken.' } };
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('hash', sql.NVarChar, hash)
      .query('INSERT INTO Users (Username, PasswordHash) OUTPUT INSERTED.Id VALUES (@username, @hash)');

    const userId = result.recordset[0].Id;
    const token = signToken(userId, username);

    context.res = { status: 201, body: { token, username } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: 'Server error.' } };
  }
};
