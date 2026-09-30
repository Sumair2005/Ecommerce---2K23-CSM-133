const express = require('express');
const categoryModel = require('../../models/categoryModel');

function handleError(res, err) {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
}

module.exports = function categoriesRouter(db) {
  const router = express.Router();

  // POST /api/v1/admin/categories
  router.post('/', async (req, res) => {
    try {
      const category = await categoryModel.create(db, req.body);
      res.status(201).json({ data: category });
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/v1/admin/categories
  router.get('/', async (req, res) => {
    try {
      const categories = await categoryModel.list(db);
      res.status(200).json({ data: categories });
    } catch (err) {
      handleError(res, err);
    }
  });

  // PATCH /api/v1/admin/categories/:id
  router.patch('/:id', async (req, res) => {
    try {
      const category = await categoryModel.update(db, Number(req.params.id), req.body);
      res.status(200).json({ data: category });
    } catch (err) {
      handleError(res, err);
    }
  });

  // PATCH /api/v1/admin/categories/:id/deactivate
  router.patch('/:id/deactivate', async (req, res) => {
    try {
      const category = await categoryModel.deactivate(db, Number(req.params.id));
      res.status(200).json({ data: category });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
};
