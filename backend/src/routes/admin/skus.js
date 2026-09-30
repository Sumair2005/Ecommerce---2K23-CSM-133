const express = require('express');
const skuModel = require('../../models/skuModel');

function handleError(res, err) {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
}

module.exports = function skusRouter(db) {
  const router = express.Router();

  // PATCH /api/v1/admin/skus/:id - update price, stock, or active status.
  router.patch('/:id', async (req, res) => {
    try {
      const sku = await skuModel.update(db, Number(req.params.id), req.body);
      res.status(200).json({ data: sku });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
};
