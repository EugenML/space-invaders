const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../shared/db');
const { signToken } = require('../shared/auth');

module.exports = async function (context, req) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    context.res = { status: 400, body: { error: 'Username and password required.' } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT Id, PasswordHash FROM Users WHERE Username = @username');

    if (result.recordset.length === 0) {
      context.res = { status: 401, body: { error: 'Invalid username or password.' } };
      return;
    }

    const user = result.recordset[0];
    const valid = await bcrypt.compare(password, user.PasswordHash);

    if (!valid) {
      context.res = { status: 401, body: { error: 'Invalid username or password.' } };
      return;
    }

    const token = signToken(user.Id, username);
    context.res = { status: 200, body: { token, username } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: 'Server error.' } };
  }
};
