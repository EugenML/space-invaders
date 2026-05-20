const { getPool } = require('../shared/db');

// One-time setup endpoint — protected by admin key
module.exports = async function (context, req) {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_IMPORT_KEY) {
    context.res = { status: 403, body: { error: 'Forbidden.' } };
    return;
  }

  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
      CREATE TABLE Users (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        Username      NVARCHAR(50)  UNIQUE NOT NULL,
        PasswordHash  NVARCHAR(255) NOT NULL,
        ImportedFromExcel BIT DEFAULT 0,
        CreatedAt     DATETIME DEFAULT GETDATE()
      );
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Scores' AND xtype='U')
      CREATE TABLE Scores (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        UserId    INT NOT NULL REFERENCES Users(Id),
        Score     INT NOT NULL,
        Level     INT NOT NULL DEFAULT 1,
        PlayedAt  DATETIME DEFAULT GETDATE()
      );
    `);
    context.res = { status: 200, body: { message: 'Tables created (or already exist).' } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: err.message } };
  }
};
