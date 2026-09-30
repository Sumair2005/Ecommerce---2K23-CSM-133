const request = require('supertest');
const { buildTestContext, seedAdminAndToken } = require('./setup');

describe('Admin categories', () => {
  let app, pool, token;

  beforeEach(async () => {
    const ctx = buildTestContext();
    app = ctx.app;
    pool = ctx.pool;
    token = await seedAdminAndToken(pool);
  });

  test('creates a category', async () => {
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('fiction');
    expect(res.body.data.active).toBe(true);
  });

  test('creates a nested category under a parent', async () => {
    const parent = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    const child = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sci-Fi', slug: 'scifi', parentId: parent.body.data.id });
    expect(child.status).toBe(201);
    expect(child.body.data.parent_id).toBe(parent.body.data.id);
  });

  test('rejects a duplicate slug', async () => {
    await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction Again', slug: 'fiction' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_SLUG');
  });

  test('rejects a category becoming its own parent', async () => {
    const created = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    const id = created.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/admin/categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parentId: id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CYCLE');
  });

  test('rejects a cycle where a category becomes its own descendant ancestor', async () => {
    const parent = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    const child = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sci-Fi', slug: 'scifi', parentId: parent.body.data.id });

    // Try to make the parent a child of its own child -> cycle.
    const res = await request(app)
      .patch(`/api/v1/admin/categories/${parent.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parentId: child.body.data.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CYCLE');
  });

  test('deactivates a category without deleting it', async () => {
    const created = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fiction', slug: 'fiction' });
    const res = await request(app)
      .patch(`/api/v1/admin/categories/${created.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);

    const list = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find(c => c.id === created.body.data.id)).toBeTruthy();
  });
});
