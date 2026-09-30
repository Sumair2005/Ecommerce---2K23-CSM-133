const { ValidationError } = require('./categoryModel');

async function create(db, { productId, variantId = null, skuCode, priceCents, stockQuantity = 0, active = true }) {
  if (!productId || !skuCode || priceCents === undefined) {
    throw ValidationError('REQUIRED_FIELD', 'productId, skuCode, and priceCents are required');
  }
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw ValidationError('INVALID_PRICE', 'priceCents must be a non-negative integer');
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw ValidationError('INVALID_STOCK', 'stockQuantity must be a non-negative integer');
  }

  const product = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) throw ValidationError('INVALID_PRODUCT', `product ${productId} does not exist`);

  if (variantId != null) {
    const variant = await db.query(
      'SELECT id FROM variants WHERE id = $1 AND product_id = $2',
      [variantId, productId]
    );
    if (variant.rows.length === 0) {
      throw ValidationError('INVALID_VARIANT', `variant ${variantId} does not belong to product ${productId}`);
    }
  }

  const dup = await db.query('SELECT id FROM skus WHERE sku_code = $1', [skuCode]);
  if (dup.rows.length > 0) throw ValidationError('DUPLICATE_SKU_CODE', `sku_code "${skuCode}" is already in use`);

  const { rows } = await db.query(
    `INSERT INTO skus (product_id, variant_id, sku_code, price_cents, stock_quantity, active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [productId, variantId, skuCode, priceCents, stockQuantity, active]
  );
  return rows[0];
}

async function update(db, id, { priceCents, stockQuantity, active, skuCode }) {
  const existing = await db.query('SELECT * FROM skus WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw ValidationError('NOT_FOUND', `sku ${id} not found`);
  const current = existing.rows[0];

  if (priceCents !== undefined && (!Number.isInteger(priceCents) || priceCents < 0)) {
    throw ValidationError('INVALID_PRICE', 'priceCents must be a non-negative integer');
  }
  if (stockQuantity !== undefined && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) {
    throw ValidationError('INVALID_STOCK', 'stockQuantity must be a non-negative integer (no negative stock)');
  }
  if (skuCode !== undefined && skuCode !== current.sku_code) {
    const dup = await db.query('SELECT id FROM skus WHERE sku_code = $1 AND id <> $2', [skuCode, id]);
    if (dup.rows.length > 0) throw ValidationError('DUPLICATE_SKU_CODE', `sku_code "${skuCode}" is already in use`);
  }

  const { rows } = await db.query(
    `UPDATE skus SET
       price_cents = $1, stock_quantity = $2, active = $3, sku_code = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [
      priceCents ?? current.price_cents,
      stockQuantity ?? current.stock_quantity,
      active === undefined ? current.active : active,
      skuCode ?? current.sku_code,
      id,
    ]
  );
  return rows[0];
}

async function listByProduct(db, productId) {
  const { rows } = await db.query('SELECT * FROM skus WHERE product_id = $1 ORDER BY id', [productId]);
  // Availability is a computed, response-only flag: out-of-stock SKUs are
  // never deleted, just represented with available = false (business rule Q4).
  return rows.map(r => ({ ...r, available: r.active && r.stock_quantity > 0 }));
}

module.exports = { create, update, listByProduct };
