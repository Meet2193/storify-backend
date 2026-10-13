const planService = require('../../src/services/plan.service');
const Plan = require('../../src/models/plan.model');
const { PLAN_STATUS } = require('../../src/constants');
const ApiError = require('../../src/utils/apiError');

describe('PlanService Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getActivePlans', () => {
    it('should query MongoDB for active plans sorted by sortOrder and exclude metadata', async () => {
      const mockDbPlans = [
        {
          _id: 'plan_free',
          name: 'Free Plan',
          code: 'free',
          storageBytes: 52428800,
          sortOrder: 0,
          status: PLAN_STATUS.ACTIVE,
        },
        {
          _id: 'plan_basic',
          name: 'Basic Plan',
          code: 'basic',
          storageBytes: 314572800,
          sortOrder: 1,
          status: PLAN_STATUS.ACTIVE,
        },
      ];

      const selectMock = jest.fn().mockReturnThis();
      const sortMock = jest.fn().mockResolvedValue(mockDbPlans);

      jest.spyOn(Plan, 'find').mockReturnValue({
        select: selectMock,
        sort: sortMock,
      });

      const result = await planService.getActivePlans();

      // Must read from MongoDB
      expect(Plan.find).toHaveBeenCalledWith({ status: PLAN_STATUS.ACTIVE });
      expect(selectMock).toHaveBeenCalledWith('-metadata');
      expect(sortMock).toHaveBeenCalledWith({ sortOrder: 1, createdAt: 1 });
      expect(result).toHaveLength(2);
      expect(result[0].storageBytes).toBe(52428800);
      expect(result[1].storageBytes).toBe(314572800);
    });
  });

  describe('getPlanById', () => {
    it('should query MongoDB and return latest DB document for active plan', async () => {
      const mockDbPlan = {
        _id: '64e8b9281a8b123456789abc',
        name: 'Pro Plan',
        code: 'pro',
        storageBytes: 943718400,
        status: PLAN_STATUS.ACTIVE,
      };

      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockDbPlan),
      });

      const result = await planService.getPlanById('64e8b9281a8b123456789abc');

      expect(Plan.findOne).toHaveBeenCalledWith({
        _id: '64e8b9281a8b123456789abc',
        status: PLAN_STATUS.ACTIVE,
      });
      expect(result.storageBytes).toBe(943718400);
    });

    it('should throw 404 when plan is not found or inactive in MongoDB', async () => {
      jest.spyOn(Plan, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(planService.getPlanById('64e8b9281a8b123456789abc')).rejects.toThrow(ApiError);
      await expect(planService.getPlanById('64e8b9281a8b123456789abc')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Plan not found or currently unavailable.',
      });
    });
  });
});
