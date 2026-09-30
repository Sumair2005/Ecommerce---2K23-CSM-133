// Builds a fresh, isolated in-memory Postgres-compatible database (pg-mem)
// with all Sprint 2 migrations applied, plus an Express app wired to it.
// This lets the test suite exercise real SQL (constraints, uniqueness,
// foreign keys) without requiring a live Postgres server.
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
const bcrypt = require('bcryptjs');
const createApp = require('../src/app');
const { sign } = require('../src/middleware/auth');

function buildTestContext() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'now',
    returns: 'timestamp',
    implementation: () => new Date(),
  });
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  const migrationsDir = path.join(__dirname, '../src/db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.public.none(sql);
  }

  const app = createApp(pool);
  return { app, pool };
}

async function seedAdminAndToken(pool) {
  const hash = await bcrypt.hash('AdminPass123!', 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin') RETURNING *`,
    ['admin@test.local', hash, 'Test Admin']
  );
  return sign(rows[0]);
}

async function seedCustomerAndToken(pool) {
  const hash = await bcrypt.hash('CustomerPass123!', 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'customer') RETURNING *`,
    ['reader@test.local', hash, 'Test Reader']
  );
  return sign(rows[0]);
}

module.exports = { buildTestContext, seedAdminAndToken, seedCustomerAndToken };
