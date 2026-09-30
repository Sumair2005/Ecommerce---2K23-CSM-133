const request = require('supertest');
const { buildTestContext, seedAdminAndToken } = require('./setup');

async function makeCategory(app, token) {
  const res = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fiction', slug: 'fiction' });
  return res.body.data;
}

describe('Admin products', () => {
  let app, pool, token, category;

  beforeEach(async () => {
    const ctx = buildTestContext();
    app = ctx.app;
    pool = ctx.pool;
    token = await seedAdminAndToken(pool);
    category = await makeCategory(app, token);
  });

  test('creates a draft product with required fields', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id, author: 'Frank Herbert' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  test('rejects a product with a duplicate slug', async () => {
    await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id });
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune Reprint', slug: 'dune', categoryId: category.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_SLUG');
  });

  test('rejects a product referencing a non-existent category', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: 99999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  test('rejects invalid specifications (non-string value)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id, specifications: { pages: 412 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SPECIFICATIONS');
  });

  test('a draft product can have no SKU', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id });
    const skus = await request(app)
      .get(`/api/v1/admin/products/${res.body.data.id}/skus`)
      .set('Authorization', `Bearer ${token}`);
    expect(skus.body.data).toHaveLength(0);
  });

  test('rejects publishing a product with no active SKU', async () => {
    const product = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_SELLABLE_SKU');
  });

  test('allows publishing once an active SKU exists', async () => {
    const product = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dune', slug: 'dune', categoryId: category.id });
    await request(app)
      .post(`/api/v1/admin/products/${product.body.data.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'DUNE-PB', priceCents: 1499, stockQuantity: 10 });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${product.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });
});
