const { ValidationError } = require('./categoryModel');

// Validation rule (Sprint 1 decision: JSONB specifications, not EAV):
// specifications must be a flat object whose keys and values are both strings.
// Example: {"language": "English", "pages": "320", "publisher": "Penguin"}
function validateSpecifications(spec) {
  if (spec === undefined) return {};
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    throw ValidationError('INVALID_SPECIFICATIONS', 'specifications must be a flat JSON object');
  }
  for (const [key, value] of Object.entries(spec)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw ValidationError(
        'INVALID_SPECIFICATIONS',
        `specifications.${key} must be a string value`
      );
    }
  }
  return spec;
}

async function create(db, { name, slug, categoryId, author, isbn, description, status, specifications }) {
  if (!name || !slug || !categoryId) {
    throw ValidationError('REQUIRED_FIELD', 'name, slug, and categoryId are required');
  }

  const category = await db.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
  if (category.rows.length === 0) {
    throw ValidationError('INVALID_CATEGORY', `category ${categoryId} does not exist`);
  }

  const dup = await db.query('SELECT id FROM products WHERE slug = $1', [slug]);
  if (dup.rows.length > 0) throw ValidationError('DUPLICATE_SLUG', `slug "${slug}" is already in use`);

  const specs = validateSpecifications(specifications);
  const finalStatus = status === 'published' ? 'published' : 'draft';

  const { rows } = await db.query(
    `INSERT INTO products (category_id, name, slug, author, isbn, description, status, specifications)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [categoryId, name, slug, author ?? null, isbn ?? null, description ?? null, finalStatus, specs]
  );
  return rows[0];
}

async function update(db, id, fields) {
  const existing = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw ValidationError('NOT_FOUND', `product ${id} not found`);
  const current = existing.rows[0];

  if (fields.slug !== undefined) {
    const dup = await db.query('SELECT id FROM products WHERE slug = $1 AND id <> $2', [fields.slug, id]);
    if (dup.rows.length > 0) throw ValidationError('DUPLICATE_SLUG', `slug "${fields.slug}" is already in use`);
  }

  if (fields.categoryId !== undefined) {
    const category = await db.query('SELECT id FROM categories WHERE id = $1', [fields.categoryId]);
    if (category.rows.length === 0) {
      throw ValidationError('INVALID_CATEGORY', `category ${fields.categoryId} does not exist`);
    }
  }

  // CAT: a product cannot move to 'published' without at least one active SKU.
  if (fields.status === 'published') {
    const skus = await db.query(
      'SELECT id FROM skus WHERE product_id = $1 AND active = TRUE',
      [id]
    );
    if (skus.rows.length === 0) {
      throw ValidationError(
        'NO_SELLABLE_SKU',
        'a product cannot be published without at least one active SKU'
      );
    }
  }

  const specs = fields.specifications !== undefined
    ? validateSpecifications(fields.specifications)
    : current.specifications;

  const { rows } = await db.query(
    `UPDATE products SET
       category_id = $1, name = $2, slug = $3, author = $4, isbn = $5,
       description = $6, status = $7, specifications = $8, updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [
      fields.categoryId ?? current.category_id,
      fields.name ?? current.name,
      fields.slug ?? current.slug,
      fields.author === undefined ? current.author : fields.author,
      fields.isbn === undefined ? current.isbn : fields.isbn,
      fields.description === undefined ? current.description : fields.description,
      fields.status ?? current.status,
      specs,
      id,
    ]
  );
  return rows[0];
}

async function list(db) {
  const { rows } = await db.query('SELECT * FROM products ORDER BY created_at DESC');
  return rows;
}

async function get(db, id) {
  const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  if (rows.length === 0) throw ValidationError('NOT_FOUND', `product ${id} not found`);
  return rows[0];
}

module.exports = { create, update, list, get, validateSpecifications };
