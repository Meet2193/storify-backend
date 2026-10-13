const request = require('supertest');
const app = require('../../src/app');

describe('Healthcheck API Integration Tests', () => {
  it('GET /health should return 200 or 503 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('success');
    expect(res.body.data).toHaveProperty('service', 'storify-backend');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('database');
  });

  it('GET /api/v1/health should return health payload', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body).toHaveProperty('success');
    expect(res.body.data).toHaveProperty('service', 'storify-backend');
    expect(res.body.data).toHaveProperty('environment');
  });

  it('GET /api/v1/non-existent-route should return 404 ApiError response', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });
});
