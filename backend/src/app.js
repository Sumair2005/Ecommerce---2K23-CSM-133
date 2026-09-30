const express = require('express');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const categoriesRouter = require('./routes/admin/categories');
const productsRouter = require('./routes/admin/products');
const skusRouter = require('./routes/admin/skus');

// db: any object exposing an async .query(sql, params) method
// (a real `pg` Pool in production, a pg-mem-backed adapter in tests).
function createApp(db) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1/auth', authRouter(db));

  // CAT06: every admin route requires a valid token AND the admin role.
  app.use('/api/v1/admin/categories', requireAuth, requireAdmin, categoriesRouter(db));
  app.use('/api/v1/admin/products', requireAuth, requireAdmin, productsRouter(db));
  app.use('/api/v1/admin/skus', requireAuth, requireAdmin, skusRouter(db));

  // Fallback error handler for anything that slips through (e.g. malformed JSON).
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request' } });
  });

  return app;
}

module.exports = createApp;
