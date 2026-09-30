function ValidationError(code, message) {
  const e = new Error(message);
  e.code = code;
  e.status = 400;
  return e;
}

// Walks up the parent chain to ensure `newParentId` is not `categoryId`
// itself or a descendant of it (cycle prevention, required by CAT01).
async function assertNoCycle(db, categoryId, newParentId) {
  if (newParentId == null) return;
  if (newParentId === categoryId) {
    throw ValidationError('CYCLE', 'A category cannot be its own parent');
  }
  let current = newParentId;
  const seen = new Set();
  while (current != null) {
    if (current === categoryId) {
      throw ValidationError('CYCLE', 'A category cannot become its own ancestor');
    }
    if (seen.has(current)) break; // defensive: pre-existing cycle, stop
    seen.add(current);
    const { rows } = await db.query('SELECT parent_id FROM categories WHERE id = $1', [current]);
    if (rows.length === 0) break;
    current = rows[0].parent_id;
  }
}

async function create(db, { name, slug, parentId = null, description = null }) {
  if (!name || !slug) throw ValidationError('REQUIRED_FIELD', 'name and slug are required');

  const dup = await db.query('SELECT id FROM categories WHERE slug = $1', [slug]);
  if (dup.rows.length > 0) {
    throw ValidationError('DUPLICATE_SLUG', `slug "${slug}" is already in use`);
  }

  if (parentId != null) {
    const parent = await db.query('SELECT id FROM categories WHERE id = $1', [parentId]);
    if (parent.rows.length === 0) {
      throw ValidationError('INVALID_PARENT', `parent category ${parentId} does not exist`);
    }
  }

  const { rows } = await db.query(
    `INSERT INTO categories (name, slug, parent_id, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, parentId, description]
  );
  return rows[0];
}

async function update(db, id, { name, slug, parentId, description, active }) {
  const existing = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
  if (existing.rows.length === 0) throw ValidationError('NOT_FOUND', `category ${id} not found`);

  if (slug !== undefined) {
    const dup = await db.query('SELECT id FROM categories WHERE slug = $1 AND id <> $2', [slug, id]);
    if (dup.rows.length > 0) throw ValidationError('DUPLICATE_SLUG', `slug "${slug}" is already in use`);
  }

  if (parentId !== undefined && parentId !== null) {
    await assertNoCycle(db, id, parentId);
  }

  const current = existing.rows[0];
  const { rows } = await db.query(
    `UPDATE categories SET
       name = $1, slug = $2, parent_id = $3, description = $4, active = $5, updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [
      name ?? current.name,
      slug ?? current.slug,
      parentId === undefined ? current.parent_id : parentId,
      description === undefined ? current.description : description,
      active === undefined ? current.active : active,
      id,
    ]
  );
  return rows[0];
}

async function deactivate(db, id) {
  const { rows } = await db.query(
    `UPDATE categories SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (rows.length === 0) throw ValidationError('NOT_FOUND', `category ${id} not found`);
  return rows[0];
}

async function list(db) {
  const { rows } = await db.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name');
  return rows;
}

module.exports = { create, update, deactivate, list, assertNoCycle, ValidationError };
