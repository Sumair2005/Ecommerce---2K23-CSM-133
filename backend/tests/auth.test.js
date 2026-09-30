const request = require('supertest');
const { buildTestContext, seedAdminAndToken, seedCustomerAndToken } = require('./setup');

describe('Authorization on admin routes (CAT06)', () => {
  let app, pool;

  beforeEach(() => {
    const ctx = buildTestContext();
    app = ctx.app;
    pool = ctx.pool;
  });

  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/v1/admin/categories');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('rejects a request with an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('rejects a non-admin (customer) token from admin routes', async () => {
    const token = await seedCustomerAndToken(pool);
    const res = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('allows an admin token through', async () => {
    const token = await seedAdminAndToken(pool);
    const res = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('login issues a working token', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@test.local', password: 'Passw0rd!', fullName: 'New User' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'new@test.local', password: 'Passw0rd!' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
  });

  test('login rejects wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new2@test.local', password: 'Passw0rd!', fullName: 'New User' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'new2@test.local', password: 'WrongPass!' });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
