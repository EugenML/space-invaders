const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const { getPool, sql } = require('../shared/db');

// Secured with a separate admin key from env
module.exports = async function (context, req) {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_IMPORT_KEY) {
    context.res = { status: 403, body: { error: 'Forbidden.' } };
    return;
  }

  if (!req.body) {
    context.res = { status: 400, body: { error: 'No file data received. Send base64-encoded xlsx as { "file": "<base64>" }.' } };
    return;
  }

  try {
    const base64 = req.body.file;
    const buffer = Buffer.from(base64, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    // Expected columns: Username, Password
    if (!rows.length || !rows[0].Username || !rows[0].Password) {
      context.res = { status: 400, body: { error: 'Excel must have columns: Username, Password' } };
      return;
    }

    const pool = await getPool();
    let imported = 0, skipped = 0;

    for (const row of rows) {
      const username = String(row.Username).trim();
      const password = String(row.Password).trim();
      if (!username || !password) { skipped++; continue; }

      const existing = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT Id FROM Users WHERE Username = @username');

      if (existing.recordset.length > 0) { skipped++; continue; }

      const hash = await bcrypt.hash(password, 12);
      await pool.request()
        .input('username', sql.NVarChar, username)
        .input('hash', sql.NVarChar, hash)
        .query('INSERT INTO Users (Username, PasswordHash, ImportedFromExcel) VALUES (@username, @hash, 1)');
      imported++;
    }

    context.res = { status: 200, body: { imported, skipped } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: 'Server error.' } };
  }
};
