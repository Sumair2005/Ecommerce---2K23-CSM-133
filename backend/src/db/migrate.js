// Simple, dependency-free migration runner.
// Applies each .sql file in src/db/migrations, in filename order, and
// records applied filenames in a `schema_migrations` table so re-runs are safe.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
    );

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
