const purchaseService = require('../../src/services/purchase.service');
const Purchase = require('../../src/models/purchase.model');
const Plan = require('../../src/models/plan.model');
const User = require('../../src/models/user.model');
const { PURCHASE_STATUS, PLAN_STATUS, ACQUISITION_SOURCE } = require('../../src/constants');
const ApiError = require('../../src/utils/apiError');

describe('PurchaseService Unit Tests', () => {
  const mockUserId = '64e8b9281a8b123456789001';
  const mockPlanId = '64e8b9281a8b123456789abc';

  const mockPlan = {
    _id: mockPlanId,
    code: 'basic',
    name: 'Basic Plan',
    storageBytes: 314572800,
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
  };

  const mockUser = {
    _id: mockUserId,
    name: 'Test User',
    email: 'user@example.com',
    acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPurchase', () => {
    it('should throw 404 when plan does not exist or is inactive', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(null);

      await expect(purchaseService.createPurchase(mockUserId, mockPlanId)).rejects.toThrow(ApiError);
      await expect(purchaseService.createPurchase(mockUserId, mockPlanId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Plan not found or currently unavailable.',
      });
    });

    it('should create pending purchase with snapshot and user acquisitionSource', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockPlan);
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);
      // No recent pending purchase
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);

      const createdPurchase = {
        _id: 'purchase123',
        userId: mockUserId,
        planId: mockPlanId,
        planSnapshot: {
          planId: mockPlanId,
          planCode: 'basic',
          planName: 'Basic Plan',
          storageBytes: 314572800,
          price: null,
          currency: null,
          durationDays: null,
        },
        status: PURCHASE_STATUS.PENDING,
        acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
      };

      const createSpy = jest.spyOn(Purchase, 'create').mockResolvedValue(createdPurchase);

      const result = await purchaseService.createPurchase(mockUserId, mockPlanId);

      expect(result.isExisting).toBe(false);
      expect(result.purchase.status).toBe(PURCHASE_STATUS.PENDING);
      expect(result.purchase.acquisitionSource).toBe(ACQUISITION_SOURCE.ADVERTISEMENT);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          planId: mockPlanId,
          status: PURCHASE_STATUS.PENDING,
          acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
          planSnapshot: expect.objectContaining({
            storageBytes: 314572800,
          }),
        })
      );
    });

    it('should reuse existing pending purchase if created within cooldown window', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue(mockPlan);
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const existingPendingPurchase = {
        _id: 'existing_purchase_id',
        userId: mockUserId,
        planId: mockPlanId,
        status: PURCHASE_STATUS.PENDING,
        createdAt: new Date(),
      };

      jest.spyOn(Purchase, 'findOne').mockResolvedValue(existingPendingPurchase);
      const createSpy = jest.spyOn(Purchase, 'create');

      const result = await purchaseService.createPurchase(mockUserId, mockPlanId);

      expect(result.isExisting).toBe(true);
      expect(result.purchase._id).toBe('existing_purchase_id');
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('getUserPurchases', () => {
    it('should return paginated purchases strictly for user', async () => {
      const mockPurchases = [
        { _id: 'p1', userId: mockUserId, status: PURCHASE_STATUS.PENDING },
        { _id: 'p2', userId: mockUserId, status: PURCHASE_STATUS.PAID },
      ];

      jest.spyOn(Purchase, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Purchase, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockPurchases),
      });

      const result = await purchaseService.getUserPurchases(mockUserId, { page: 1, limit: 10 });

      expect(Purchase.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result.purchases).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getPurchaseById', () => {
    it('should return purchase when found for owner', async () => {
      const mockPurchase = {
        _id: 'p123',
        userId: mockUserId,
        status: PURCHASE_STATUS.PENDING,
      };

      jest.spyOn(Purchase, 'findOne').mockResolvedValue(mockPurchase);

      const result = await purchaseService.getPurchaseById(mockUserId, 'p123');

      expect(Purchase.findOne).toHaveBeenCalledWith({
        _id: 'p123',
        userId: mockUserId,
      });
      expect(result._id).toBe('p123');
    });

    it('should throw 404 when purchase is not found or belongs to another user', async () => {
      jest.spyOn(Purchase, 'findOne').mockResolvedValue(null);

      await expect(purchaseService.getPurchaseById(mockUserId, 'foreign_p')).rejects.toThrow(ApiError);
      await expect(purchaseService.getPurchaseById(mockUserId, 'foreign_p')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Purchase not found or access denied.',
      });
    });
  });
});
