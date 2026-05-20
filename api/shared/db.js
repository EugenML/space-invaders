const sql = require('mssql');

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
  return pool;
}

module.exports = { getPool, sql };
