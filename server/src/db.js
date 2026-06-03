"use strict";

const { Pool } = require("pg");
const config = require("./config");

let pool;

function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function query(text, params = []) {
  const currentPool = getPool();
  if (!currentPool) {
    const error = new Error("database_not_configured");
    error.code = "DATABASE_NOT_CONFIGURED";
    throw error;
  }
  return currentPool.query(text, params);
}

async function checkConnection() {
  try {
    const currentPool = getPool();
    if (!currentPool) return false;
    await currentPool.query("SELECT 1");
    return true;
  } catch (error) {
    return false;
  }
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  query,
  checkConnection,
  closePool
};
