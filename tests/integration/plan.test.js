const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Plan = require('../../src/models/plan.model');
const { generateToken } = require('../../src/utils/token.util');
const { PLAN_STATUS } = require('../../src/constants');

describe('Plans API Integration Tests', () => {
  const userId = '64e8b9281a8b123456789001';
  let authToken;

  const mockUser = {
    _id: userId,
    name: 'Test User',
    email: 'user@example.com',
    role: 'user',
    status: 'active',
    plan: 'free',
    storage: {
      usedBytes: 1048576, // 1 MB
      allocatedBytes: 52428800, // 50 MB
    },
  };

  beforeAll(() => {
    authToken = generateToken({ id: userId, email: 'user@example.com', role: 'user' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockResolvedValue(mockUser);
  });

  describe('GET /api/v1/plans (Database-Driven Catalog)', () => {
    it('should return 401 when accessed unauthenticated', async () => {
      const res = await request(app).get('/api/v1/plans');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('should return active plans from MongoDB in sortOrder with exact storageBytes', async () => {
      const dbPlans = [
        {
          _id: '64e8b9281a8b123456789001',
          name: 'Free Plan',
          code: 'free',
          storageBytes: 52428800, // 50 MB
          price: null,
          currency: null,
          durationDays: null,
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 0,
        },
        {
          _id: '64e8b9281a8b123456789002',
          name: 'Basic Plan',
          code: 'basic',
          storageBytes: 314572800, // 300 MB
          price: null,
          currency: null,
          durationDays: null,
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 1,
        },
        {
          _id: '64e8b9281a8b123456789003',
          name: 'Premium Plan',
          code: 'premium',
          storageBytes: 524288000, // 500 MB
          price: null,
          currency: null,
          durationDays: null,
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 2,
        },
        {
          _id: '64e8b9281a8b123456789004',
          name: 'Pro Plan',
          code: 'pro',
          storageBytes: 943718400, // 900 MB
          price: null,
          currency: null,
          durationDays: null,
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 3,
        },
      ];

      const selectMock = jest.fn().mockReturnThis();
      const sortMock = jest.fn().mockResolvedValue(dbPlans);

      jest.spyOn(Plan, 'find').mockReturnValue({
        select: selectMock,
        sort: sortMock,
      });

      const res = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Plans fetched successfully');
      expect(res.body.data.plans).toHaveLength(4);

      // Verify exact storage allocation in bytes
      expect(res.body.data.plans[0].storageBytes).toBe(52428800);
      expect(res.body.data.plans[1].storageBytes).toBe(314572800);
      expect(res.body.data.plans[2].storageBytes).toBe(524288000);
      expect(res.body.data.plans[3].storageBytes).toBe(943718400);

      // Verify no fake price or duration populated
      expect(res.body.data.plans[1].price).toBeNull();
      expect(res.body.data.plans[1].durationDays).toBeNull();

      // Verify direct MongoDB query
      expect(Plan.find).toHaveBeenCalledWith({ status: PLAN_STATUS.ACTIVE });
      expect(selectMock).toHaveBeenCalledWith('-metadata');
      expect(sortMock).toHaveBeenCalledWith({ sortOrder: 1, createdAt: 1 });
    });

    it('REGRESSION: should immediately return updated DB values when storageBytes changes in MongoDB', async () => {
      // Step 1: Initial MongoDB state: basic = 300 MB (314,572,800 bytes)
      const initialPlans = [
        {
          _id: '64e8b9281a8b123456789002',
          code: 'basic',
          name: 'Basic Plan',
          storageBytes: 314572800,
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 1,
        },
      ];

      const findMock = jest.spyOn(Plan, 'find');

      findMock.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(initialPlans),
        }),
      });

      const res1 = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.statusCode).toBe(200);
      expect(res1.body.data.plans[0].storageBytes).toBe(314572800);

      // Step 2: Database updated directly (e.g. by future admin or DB update: basic = 350 MB = 367,001,600 bytes)
      const updatedPlans = [
        {
          _id: '64e8b9281a8b123456789002',
          code: 'basic',
          name: 'Basic Plan',
          storageBytes: 367001600, // 350 MB
          status: PLAN_STATUS.ACTIVE,
          sortOrder: 1,
        },
      ];

      findMock.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(updatedPlans),
        }),
      });

      // Step 3: Next API call immediately reflects the new DB value without code or .env changes
      const res2 = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.plans[0].storageBytes).toBe(367001600);
    });

    it('should exclude inactive plans from public listing', async () => {
      jest.spyOn(Plan, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: 'plan1', name: 'Basic', code: 'basic', storageBytes: 314572800, status: PLAN_STATUS.ACTIVE },
        ]),
      });

      const res = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.plans).toHaveLength(1);
      expect(Plan.find).toHaveBeenCalledWith({ status: PLAN_STATUS.ACTIVE });
    });

    it('should produce NO storage or user entitlement side effects', async () => {
      const userUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate');
      const userFindAndUpdateSpy = jest.spyOn(User, 'findOneAndUpdate');

      jest.spyOn(Plan, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(userUpdateSpy).not.toHaveBeenCalled();
      expect(userFindAndUpdateSpy).not.toHaveBeenCalled();
      expect(mockUser.storage.allocatedBytes).toBe(52428800);
    });
  });

  describe('GET /api/v1/plans/:planId', () => {
    const validPlanId = '64e8b9281a8b123456789abc';

    it('should return 401 when accessed unauthenticated', async () => {
      const res = await request(app).get(`/api/v1/plans/${validPlanId}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when planId is not a valid MongoDB ObjectId', async () => {
      const res = await request(app)
        .get('/api/v1/plans/not-a-valid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('Invalid plan ID format');
    });

    it('should return 404 when plan does not exist in MongoDB', async () => {
      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Plan not found or currently unavailable');
    });

    it('should return 404 when plan is inactive in MongoDB', async () => {
      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(Plan.findOne).toHaveBeenCalledWith({
        _id: validPlanId,
        status: PLAN_STATUS.ACTIVE,
      });
    });

    it('should return plan details with current MongoDB storageBytes', async () => {
      const mockPlan = {
        _id: validPlanId,
        name: 'Basic Plan',
        code: 'basic',
        description: 'Basic tier with 300 MB storage',
        storageBytes: 314572800,
        price: null,
        currency: null,
        durationDays: null,
        status: PLAN_STATUS.ACTIVE,
        sortOrder: 1,
      };

      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockPlan),
      });

      const res = await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'Basic Plan');
      expect(res.body.data).toHaveProperty('storageBytes', 314572800);
      expect(res.body.data.price).toBeNull();
      expect(res.body.data.durationDays).toBeNull();
      expect(res.body.message).toBe('Plan details retrieved successfully');
    });

    it('REGRESSION: should immediately return updated DB value when plan document changes in MongoDB', async () => {
      const findOneMock = jest.spyOn(Plan, 'findOne');

      // Call 1: initial 300 MB
      findOneMock.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          _id: validPlanId,
          code: 'basic',
          name: 'Basic Plan',
          storageBytes: 314572800,
          status: PLAN_STATUS.ACTIVE,
        }),
      });

      const res1 = await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.body.data.storageBytes).toBe(314572800);

      // Call 2: modified in DB to 350 MB
      findOneMock.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          _id: validPlanId,
          code: 'basic',
          name: 'Basic Plan',
          storageBytes: 367001600,
          status: PLAN_STATUS.ACTIVE,
        }),
      });

      const res2 = await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res2.body.data.storageBytes).toBe(367001600);
    });

    it('should produce NO storage or user entitlement side effects on retrieval', async () => {
      const userUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate');
      const userFindAndUpdateSpy = jest.spyOn(User, 'findOneAndUpdate');

      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: validPlanId,
          name: 'Pro Plan',
          storageBytes: 943718400,
          status: PLAN_STATUS.ACTIVE,
        }),
      });

      await request(app)
        .get(`/api/v1/plans/${validPlanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(userUpdateSpy).not.toHaveBeenCalled();
      expect(userFindAndUpdateSpy).not.toHaveBeenCalled();
      expect(mockUser.storage.allocatedBytes).toBe(52428800);
    });
  });
});
