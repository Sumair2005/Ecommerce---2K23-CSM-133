# PageHaven Backend — Sprint 2 (Catalog Data Foundation)

## Local setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and fill in real values (never commit `.env`):
   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose |
   |---|---|
   | `DATABASE_URL` | Postgres connection string, e.g. `postgres://user:pass@localhost:5432/pagehaven` |
   | `JWT_SECRET` | Random secret used to sign admin/customer auth tokens |
   | `PORT` | Port the API listens on (default `4000`) |

3. **Create the database** (once), then run migrations:
   ```bash
   createdb pagehaven
   npm run migrate
   ```

4. **Seed demo data** (categories, products, variants, SKUs, an admin and a customer user):
   ```bash
   npm run seed
   ```
   Prints demo login credentials on completion:
   - Admin: `admin@pagehaven.test` / `AdminPass123!`
   - Customer: `reader@pagehaven.test` / `CustomerPass123!`

5. **Start the API**
   ```bash
   npm start
   ```
   Health check: `GET http://localhost:4000/health`

## Running tests

```bash
npm test
```

Tests run against an in-memory Postgres-compatible database ([pg-mem](https://github.com/oguimbal/pg-mem)) with all migrations applied fresh for each test file, so `npm test` needs no running Postgres server or `.env` file. See `docs/SPRINT_2.md` for the full test strategy and the last recorded result.

## Project layout

```
backend/
  src/
    db/migrations/   -- SQL migrations, applied in filename order
    db/migrate.js     -- migration runner (real Postgres)
    middleware/auth.js -- JWT auth + admin-role guard
    models/            -- query + validation logic per entity
    routes/admin/       -- authenticated admin CRUD endpoints
    routes/auth.js       -- register/login
    seed/seed.js          -- reproducible demo data
    app.js                 -- Express app factory (injectable db client)
    server.js                -- production entrypoint
  tests/                       -- Jest + Supertest, using pg-mem
```
