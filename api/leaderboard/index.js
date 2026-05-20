const { getPool } = require('../shared/db');

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 10
        u.Username,
        MAX(s.Score) AS HighScore,
        MAX(s.PlayedAt) AS LastPlayed
      FROM Scores s
      JOIN Users u ON s.UserId = u.Id
      GROUP BY u.Username
      ORDER BY HighScore DESC
    `);

    context.res = { status: 200, body: result.recordset };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: 'Server error.' } };
  }
};
