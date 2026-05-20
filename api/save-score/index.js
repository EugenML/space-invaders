const { getPool, sql } = require('../shared/db');
const { verifyToken } = require('../shared/auth');

module.exports = async function (context, req) {
  const user = verifyToken(req);
  if (!user) {
    context.res = { status: 401, body: { error: 'Not authenticated.' } };
    return;
  }

  const { score, level } = req.body || {};
  if (typeof score !== 'number' || score < 0) {
    context.res = { status: 400, body: { error: 'Invalid score.' } };
    return;
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, user.userId)
      .input('score', sql.Int, score)
      .input('level', sql.Int, level || 1)
      .query('INSERT INTO Scores (UserId, Score, Level) VALUES (@userId, @score, @level)');

    context.res = { status: 200, body: { saved: true } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: 'Server error.' } };
  }
};
