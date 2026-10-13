const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const { generateToken } = require('../../src/utils/token.util');

describe('Auth API Integration Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should reject registration when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject registration when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          password: 'password123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration when password is shorter than 6 chars', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: '123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 conflict if user email already exists', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: '64e8b9281a8b123456789abc',
        email: 'existing@example.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'John Doe',
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('should successfully register a new user and return token', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue({
        _id: '64e8b9281a8b123456789abc',
        name: 'New User',
        email: 'newuser@example.com',
        role: 'user',
        plan: 'free',
        toJSON: () => ({
          _id: '64e8b9281a8b123456789abc',
          name: 'New User',
          email: 'newuser@example.com',
          role: 'user',
          plan: 'free',
        }),
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', 'newuser@example.com');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login when fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when user is not found', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should return 401 when password does not match', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: '64e8b9281a8b123456789abc',
          email: 'user@example.com',
          comparePassword: jest.fn().mockResolvedValue(false),
        }),
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should return 200 with token upon successful login', async () => {
      const mockUser = {
        _id: '64e8b9281a8b123456789abc',
        name: 'User One',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          _id: '64e8b9281a8b123456789abc',
          name: 'User One',
          email: 'user@example.com',
          role: 'user',
        }),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'correctpassword',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', 'user@example.com');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('No token provided');
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.statusCode).toBe(401);
    });

    it('should return authenticated user profile with valid token', async () => {
      const mockUserId = '64e8b9281a8b123456789abc';
      const token = generateToken({ id: mockUserId, email: 'me@example.com', role: 'user' });

      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        name: 'Logged In User',
        email: 'me@example.com',
        role: 'user',
        status: 'active',
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('email', 'me@example.com');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should reject request when email is missing or invalid', async () => {
      const resMissing = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});
      expect(resMissing.statusCode).toBe(400);

      const resInvalid = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });
      expect(resInvalid.statusCode).toBe(400);
    });

    it('should return 404 when email does not match any registered account', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('No account found');
    });

    it('should generate and return password reset token for valid registered email', async () => {
      const mockUser = {
        _id: '64e8b9281a8b123456789abc',
        email: 'user@example.com',
        createPasswordResetToken: jest.fn().mockReturnValue('mock-reset-token-hex-string'),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('resetToken', 'mock-reset-token-hex-string');
      expect(mockUser.createPasswordResetToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reject request when token or newPassword is missing or invalid', async () => {
      const resMissingToken = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ newPassword: 'newValidPassword123' });
      expect(resMissingToken.statusCode).toBe(400);

      const resShortPass = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-token', newPassword: '123' });
      expect(resShortPass.statusCode).toBe(400);
    });

    it('should return 400 when reset token is invalid or expired', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'expired-or-invalid-token', newPassword: 'newPassword123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('invalid or has expired');
    });

    it('should successfully reset password when token is valid', async () => {
      const mockUser = {
        _id: '64e8b9281a8b123456789abc',
        email: 'user@example.com',
        password: 'oldPassword',
        passwordResetToken: 'hashed',
        passwordResetExpires: new Date(Date.now() + 10000),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-reset-token', newPassword: 'newPassword123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.password).toBe('newPassword123');
      expect(mockUser.passwordResetToken).toBeNull();
      expect(mockUser.passwordResetExpires).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('PUT and PATCH /api/v1/auth/change-password', () => {
    it('should require authentication for changing password via auth route', async () => {
      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'newPassword123' });

      expect(res.statusCode).toBe(401);
    });

    it('should successfully change password when authenticated with valid credentials', async () => {
      const mockUserId = '64e8b9281a8b123456789abc';
      const token = generateToken({ id: mockUserId, email: 'user@example.com', role: 'user' });

      const mockUser = {
        _id: mockUserId,
        name: 'User',
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
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newPassword456',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUser.password).toBe('newPassword456');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should return 200 on logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });
});
