const { ValidationError } = require('./categoryModel');

async function create(db, { productId, optionValues }) {
  if (!productId) throw ValidationError('REQUIRED_FIELD', 'productId is required');

  const product = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) throw ValidationError('INVALID_PRODUCT', `product ${productId} does not exist`);

  const values = optionValues ?? {};
  if (typeof values !== 'object' || Array.isArray(values)) {
    throw ValidationError('INVALID_OPTION_VALUES', 'optionValues must be a flat JSON object');
  }

  // CAT04: reject a duplicate combination for the same product rather than
  // silently creating a second identical variant.
  const existing = await db.query('SELECT option_values FROM variants WHERE product_id = $1', [productId]);
  const serialized = JSON.stringify(values, Object.keys(values).sort());
  for (const row of existing.rows) {
    const rowSerialized = JSON.stringify(row.option_values, Object.keys(row.option_values).sort());
    if (rowSerialized === serialized) {
      throw ValidationError('DUPLICATE_VARIANT', 'this option combination already exists for the product');
    }
  }

  const { rows } = await db.query(
    `INSERT INTO variants (product_id, option_values) VALUES ($1, $2) RETURNING *`,
    [productId, values]
  );
  return rows[0];
}

async function listByProduct(db, productId) {
  const { rows } = await db.query('SELECT * FROM variants WHERE product_id = $1 ORDER BY id', [productId]);
  return rows;
}

module.exports = { create, listByProduct };
