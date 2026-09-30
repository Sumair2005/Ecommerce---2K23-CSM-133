const express = require('express');
const productModel = require('../../models/productModel');
const variantModel = require('../../models/variantModel');
const skuModel = require('../../models/skuModel');

function handleError(res, err) {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
}

module.exports = function productsRouter(db) {
  const router = express.Router();

  // POST /api/v1/admin/products - creates a draft product.
  router.post('/', async (req, res) => {
    try {
      const product = await productModel.create(db, req.body);
      res.status(201).json({ data: product });
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/v1/admin/products
  router.get('/', async (req, res) => {
    try {
      const products = await productModel.list(db);
      res.status(200).json({ data: products });
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/v1/admin/products/:id
  router.get('/:id', async (req, res) => {
    try {
      const product = await productModel.get(db, Number(req.params.id));
      res.status(200).json({ data: product });
    } catch (err) {
      handleError(res, err);
    }
  });

  // PATCH /api/v1/admin/products/:id
  router.patch('/:id', async (req, res) => {
    try {
      const product = await productModel.update(db, Number(req.params.id), req.body);
      res.status(200).json({ data: product });
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/v1/admin/products/:id/variants
  router.post('/:id/variants', async (req, res) => {
    try {
      const variant = await variantModel.create(db, {
        productId: Number(req.params.id),
        optionValues: req.body.optionValues,
      });
      res.status(201).json({ data: variant });
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/v1/admin/products/:id/skus - add a validated SKU.
  router.post('/:id/skus', async (req, res) => {
    try {
      const sku = await skuModel.create(db, { ...req.body, productId: Number(req.params.id) });
      res.status(201).json({ data: sku });
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/v1/admin/products/:id/skus
  router.get('/:id/skus', async (req, res) => {
    try {
      const skus = await skuModel.listByProduct(db, Number(req.params.id));
      res.status(200).json({ data: skus });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
};
