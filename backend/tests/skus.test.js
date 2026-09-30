const request = require('supertest');
const { buildTestContext, seedAdminAndToken } = require('./setup');

let productCounter = 0;

async function makeProduct(app, token) {
  const n = ++productCounter;
  const category = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fiction', slug: `fiction-${n}` });
  const product = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'The Hobbit', slug: `the-hobbit-${n}`, categoryId: category.body.data.id });
  return product.body.data;
}

describe('Admin variants and SKUs', () => {
  let app, pool, token, product;

  beforeEach(async () => {
    const ctx = buildTestContext();
    app = ctx.app;
    pool = ctx.pool;
    token = await seedAdminAndToken(pool);
    product = await makeProduct(app, token);
  });

  test('creates a SKU with required fields', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: 20 });
    expect(res.status).toBe(201);
    expect(res.body.data.sku_code).toBe('HOBBIT-PB');
  });

  test('rejects a duplicate SKU code', async () => {
    await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: 20 });
    const res = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 999, stockQuantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_SKU_CODE');
  });

  test('rejects a negative stock quantity on create', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STOCK');
  });

  test('rejects a negative stock quantity on update', async () => {
    const created = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: 5 });
    const res = await request(app)
      .patch(`/api/v1/admin/skus/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stockQuantity: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STOCK');
  });

  test('represents an out-of-stock SKU as available:false, not deleted', async () => {
    const created = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'HOBBIT-PB', priceCents: 1299, stockQuantity: 0 });
    expect(created.status).toBe(201);
    const list = await request(app)
      .get(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data[0].available).toBe(false);
    expect(list.body.data[0].stock_quantity).toBe(0);
  });

  test('creates two variants and rejects a duplicate option combination', async () => {
    const v1 = await request(app)
      .post(`/api/v1/admin/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optionValues: { format: 'Paperback' } });
    expect(v1.status).toBe(201);

    const dup = await request(app)
      .post(`/api/v1/admin/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optionValues: { format: 'Paperback' } });
    expect(dup.status).toBe(400);
    expect(dup.body.error.code).toBe('DUPLICATE_VARIANT');
  });

  test('rejects a SKU whose variant does not belong to the product', async () => {
    const otherProduct = await makeProduct(app, token);
    const variant = await request(app)
      .post(`/api/v1/admin/products/${otherProduct.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optionValues: { format: 'Paperback' } });

    const res = await request(app)
      .post(`/api/v1/admin/products/${product.id}/skus`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skuCode: 'X-1', priceCents: 100, stockQuantity: 1, variantId: variant.body.data.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VARIANT');
  });
});
