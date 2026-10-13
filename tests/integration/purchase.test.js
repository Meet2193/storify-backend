const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Plan = require('../../src/models/plan.model');
const Purchase = require('../../src/models/purchase.model');
const { generateToken } = require('../../src/utils/token.util');
const { PURCHASE_STATUS, PLAN_STATUS, ACQUISITION_SOURCE } = require('../../src/constants');

describe('Purchase API Integration Tests', () => {
  const userOneId = '64e8b9281a8b123456789001';
  const userTwoId = '64e8b9281a8b123456789002';
  const validPlanId = '64e8b9281a8b123456789abc';

  let tokenUserOne;
  let tokenUserTwo;

  const mockUserOne = {
    _id: userOneId,
    name: 'User One',
    email: 'user1@example.com',
    role: 'user',
    status: 'active',
    plan: 'free',
    acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
    storage: {
      usedBytes: 1048576, // 1 MB
      allocatedBytes: 52428800, // 50 MB
    },
  };

  const mockUserTwo = {
    _id: userTwoId,
    name: 'User Two',
    email: 'user2@example.com',
    role: 'user',
    status: 'active',
    plan: 'free',
    acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    storage: {
      usedBytes: 0,
      allocatedBytes: 52428800,
    },
  };

  const mockActivePlan = {
    _id: validPlanId,
    code: 'basic',
    name: 'Basic Plan',
    storageBytes: 314572800, // 300 MB
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
    sortOrder: 1,
  };

  beforeAll(() => {
    tokenUserOne = generateToken({ id: userOneId, email: 'user1@example.com', role: 'user' });
    tokenUserTwo = generateToken({ id: userTwoId, email: 'user2@example.com', role: 'user' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation(async (id) => {
      if (id.toString() === userOneId) return { ...mockUserOne };
      if (id.toString() === userTwoId) return { ...mockUserTwo };
      return null;
    });
  });

  describe('POST /api/v1/purchases (Create Purchase)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/purchases')
        .send({ planId: validPlanId });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid MongoDB ObjectId for planId with 400', async () => {
      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: 'not-a-valid-object-id' });

      expect(res.statusCode).toBe(400);
      expect(res.body.errors[0].message).toContain('Invalid plan ID format');
    });

    it('should reject non-existent or inactive plan with 404', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: validPlanId });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Plan not found or currently unavailable');
    });

    it('should create a purchase with PENDING status, plan snapshot, and trusted user acquisitionSource', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockActivePlan);
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null); // No recent pending purchase

      const createdDoc = {
        _id: '64e8b9281a8b123456789def',
        userId: userOneId,
        planId: validPlanId,
        planSnapshot: {
          planId: validPlanId,
          planCode: 'basic',
          planName: 'Basic Plan',
          storageBytes: 314572800,
          price: null,
          currency: null,
          durationDays: null,
        },
        status: PURCHASE_STATUS.PENDING,
        acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
        paymentReference: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createSpy = jest.spyOn(Purchase, 'create').mockResolvedValue(createdDoc);

      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: validPlanId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(PURCHASE_STATUS.PENDING);
      expect(res.body.data.acquisitionSource).toBe(ACQUISITION_SOURCE.ADVERTISEMENT);
      expect(res.body.data.planSnapshot.storageBytes).toBe(314572800);
      expect(res.body.data.planSnapshot.price).toBeNull();
      expect(res.body.data.planSnapshot.durationDays).toBeNull();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userOneId,
          planId: validPlanId,
          status: PURCHASE_STATUS.PENDING,
          acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
        })
      );
    });

    it('should ignore client-provided overrides (price, storageBytes, acquisitionSource) and read from DB', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockActivePlan);
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);

      const createSpy = jest.spyOn(Purchase, 'create').mockImplementation(async (data) => ({
        _id: 'purchase_secure_1',
        ...data,
      }));

      const maliciousPayload = {
        planId: validPlanId,
        storageBytes: 999999999999, // Attempted hack
        price: 0,                   // Attempted price override
        planName: 'Free Pro',
        acquisitionSource: ACQUISITION_SOURCE.ORGANIC, // Attempted attribution change
      };

      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send(maliciousPayload);

      expect(res.statusCode).toBe(201);
      // DB value is used, client values ignored
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT, // Inherited from User One
          planSnapshot: expect.objectContaining({
            storageBytes: 314572800, // Taken from MongoDB Plan
            planName: 'Basic Plan',
            price: null,
          }),
        })
      );
    });

    it('should NOT modify user storage allocation or usedBytes upon purchase creation', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockActivePlan);
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);
      jest.spyOn(Purchase, 'create').mockResolvedValue({
        _id: 'purchase_no_side_effects',
        userId: userOneId,
        planId: validPlanId,
        status: PURCHASE_STATUS.PENDING,
      });

      const userUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate');
      const userFindAndUpdateSpy = jest.spyOn(User, 'findOneAndUpdate');

      await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: validPlanId });

      expect(userUpdateSpy).not.toHaveBeenCalled();
      expect(userFindAndUpdateSpy).not.toHaveBeenCalled();
      expect(mockUserOne.storage.allocatedBytes).toBe(52428800); // Still 50 MB
    });

    it('should reuse existing pending purchase order if tapped within cooldown window (idempotency)', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockActivePlan);

      const existingRecentPurchase = {
        _id: 'existing_pending_order_id',
        userId: userOneId,
        planId: validPlanId,
        status: PURCHASE_STATUS.PENDING,
        createdAt: new Date(),
      };

      jest.spyOn(Purchase, 'findOne').mockResolvedValue(existingRecentPurchase);
      const createSpy = jest.spyOn(Purchase, 'create');

      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: validPlanId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Existing pending purchase order returned');
      expect(res.body.data._id).toBe('existing_pending_order_id');
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/purchases (List User Purchases)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/purchases');
      expect(res.statusCode).toBe(401);
    });

    it('should list only purchases belonging to authenticated user with pagination', async () => {
      const userPurchases = [
        { _id: 'p1', userId: userOneId, status: PURCHASE_STATUS.PENDING },
        { _id: 'p2', userId: userOneId, status: PURCHASE_STATUS.PAID },
      ];

      jest.spyOn(Purchase, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Purchase, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(userPurchases),
      });

      const res = await request(app)
        .get('/api/v1/purchases?page=1&limit=20')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(Purchase.find).toHaveBeenCalledWith({ userId: userOneId });
    });

    it('should reject invalid pagination parameters with 400', async () => {
      const res = await request(app)
        .get('/api/v1/purchases?page=0&limit=999')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/purchases/:purchaseId (Get Single Purchase & Ownership)', () => {
    const purchaseId = '64e8b9281a8b123456789099';

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/v1/purchases/${purchaseId}`);
      expect(res.statusCode).toBe(401);
    });

    it('should reject malformed purchaseId with 400', async () => {
      const res = await request(app)
        .get('/api/v1/purchases/invalid-id')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.errors[0].message).toContain('Invalid purchase ID format');
    });

    it('should return 404 when purchase belongs to another user (IDOR protection)', async () => {
      // Query filters strictly by { _id: purchaseId, userId: userOneId }
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/purchases/${purchaseId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Purchase not found or access denied');
      expect(Purchase.findOne).toHaveBeenCalledWith({
        _id: purchaseId,
        userId: userOneId,
      });
    });

    it('should return purchase details when owned by authenticated user', async () => {
      const ownPurchase = {
        _id: purchaseId,
        userId: userOneId,
        planId: validPlanId,
        status: PURCHASE_STATUS.PENDING,
        planSnapshot: {
          planCode: 'basic',
          storageBytes: 314572800,
        },
      };

      jest.spyOn(Purchase, 'findOne').mockResolvedValue(ownPurchase);

      const res = await request(app)
        .get(`/api/v1/purchases/${purchaseId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(purchaseId);
    });
  });

  describe('REGRESSION: Plan Snapshot Immutability Verification', () => {
    it('proves that old purchase snapshot preserves original value when Plan document is updated later', async () => {
      // 1. Initial Plan state in MongoDB: Basic = 300 MB (314,572,800 bytes)
      const initialPlan = {
        _id: validPlanId,
        code: 'basic',
        name: 'Basic Plan',
        storageBytes: 314572800,
        price: null,
        currency: null,
        durationDays: null,
        status: PLAN_STATUS.ACTIVE,
      };

      const planFindOneSpy = jest.spyOn(Plan, 'findOne');
      planFindOneSpy.mockResolvedValueOnce(initialPlan);
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);

      let storedPurchase1;
      jest.spyOn(Purchase, 'create').mockImplementationOnce(async (doc) => {
        storedPurchase1 = { _id: 'purchase_id_1', ...doc };
        return storedPurchase1;
      });

      // 2. Create Purchase 1 for 300 MB
      const res1 = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ planId: validPlanId });

      expect(res1.statusCode).toBe(201);
      expect(res1.body.data.planSnapshot.storageBytes).toBe(314572800);

      // 3. Plan storageBytes is changed in MongoDB to 500 MB (524,288,000 bytes)
      const updatedPlan = {
        _id: validPlanId,
        code: 'basic',
        name: 'Basic Plan',
        storageBytes: 524288000, // Updated to 500 MB
        price: null,
        currency: null,
        durationDays: null,
        status: PLAN_STATUS.ACTIVE,
      };

      planFindOneSpy.mockResolvedValueOnce(updatedPlan);

      let storedPurchase2;
      jest.spyOn(Purchase, 'create').mockImplementationOnce(async (doc) => {
        storedPurchase2 = { _id: 'purchase_id_2', ...doc };
        return storedPurchase2;
      });

      // 4. Create Purchase 2 for updated Plan
      const res2 = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokenUserTwo}`)
        .send({ planId: validPlanId });

      expect(res2.statusCode).toBe(201);
      expect(res2.body.data.planSnapshot.storageBytes).toBe(524288000);

      // 5. Verify the existing Purchase 1 snapshot still contains 300 MB (IMMUTABLE)
      expect(storedPurchase1.planSnapshot.storageBytes).toBe(314572800);
      // And Purchase 2 contains 500 MB
      expect(storedPurchase2.planSnapshot.storageBytes).toBe(524288000);
    });
  });
});
