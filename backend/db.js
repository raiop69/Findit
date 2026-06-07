const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_HOST,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    integratedSecurity: process.env.DB_USER ? false : true  // Use Windows auth only if no user specified
  }
};

let pool = null;

async function initConnection() {
  try {
    if (!pool) {
      console.log('Connecting to:', config.server, 'Database:', config.database);
      pool = new sql.ConnectionPool(config);
      await pool.connect();
      console.log('✓ Connected to SQL Server database');
    }
    return pool;
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    throw err;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initConnection first.');
  }
  return pool;
}

module.exports = { initConnection, getPool, sql };