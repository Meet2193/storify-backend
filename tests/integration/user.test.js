const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const { generateToken } = require('../../src/utils/token.util');

describe('User API Integration Tests', () => {
  const mockUserId = '64e8b9281a8b123456789abc';
  let token;

  beforeEach(() => {
    token = generateToken({ id: mockUserId, email: 'user@example.com', role: 'user' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return profile for authenticated user', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        name: 'John User',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        plan: 'free',
        storage: { usedBytes: 1024, allocatedBytes: 5368709120 },
      });

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'John User');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update user profile name', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Old Name',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Updated Name' });

      expect(res.statusCode).toBe(200);
      expect(mockUser.name).toBe('New Updated Name');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('PUT /api/v1/users/me/password', () => {
    it('should reject password change when current password is wrong', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'John User',
        status: 'active',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      // First findById for auth middleware, second with .select('+password') for service
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
        then: function (resolve) {
          return Promise.resolve(mockUser).then(resolve);
        },
      });

      const res = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newSecurePassword123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('should successfully update password when current password matches', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'John User',
        status: 'active',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
        then: function (resolve) {
          return Promise.resolve(mockUser).then(resolve);
        },
      });

      const res = await request(app)
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'currentValidPassword',
          newPassword: 'newValidPassword123',
        });

      expect(res.statusCode).toBe(200);
      expect(mockUser.password).toBe('newValidPassword123');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/users/me/storage', () => {
    it('should return storage calculation and formatted values', async () => {
      const mockUser = {
        _id: mockUserId,
        plan: 'free',
        status: 'active',
        storage: {
          usedBytes: 10485760, // 10 MB
          allocatedBytes: 52428800, // 50 MB
        },
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/users/me/storage')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('usedFormatted', '10 MB');
      expect(res.body.data).toHaveProperty('allocatedFormatted', '50 MB');
      expect(res.body.data).toHaveProperty('remainingFormatted', '40 MB');
      expect(res.body.data.usagePercentage).toBe(20);
    });
  });

  describe('PATCH /api/v1/users/me/password', () => {
    it('should allow password update via PATCH method as well', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'John User',
        status: 'active',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
        then: function (resolve) {
          return Promise.resolve(mockUser).then(resolve);
        },
      });

      const res = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'currentValidPassword',
          newPassword: 'newPatchPassword123',
        });

      expect(res.statusCode).toBe(200);
      expect(mockUser.password).toBe('newPatchPassword123');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
