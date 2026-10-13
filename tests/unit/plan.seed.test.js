const Plan = require('../../src/models/plan.model');
const { seedPlans, INITIAL_PLANS } = require('../../src/seeds/plan.seed');

describe('Plan Seed Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should define initial plans with exact storage values 50, 300, 500, 900 MB', () => {
    expect(INITIAL_PLANS).toHaveLength(4);

    const planStorageMap = {};
    INITIAL_PLANS.forEach((p) => {
      planStorageMap[p.code] = p.storageBytes;
    });

    // 50 MB = 52,428,800 bytes
    expect(planStorageMap.free).toBe(52428800);
    // 300 MB = 314,572,800 bytes
    expect(planStorageMap.basic).toBe(314572800);
    // 500 MB = 524,288,000 bytes
    expect(planStorageMap.premium).toBe(524288000);
    // 900 MB = 943,718,400 bytes
    expect(planStorageMap.pro).toBe(943718400);
  });

  it('should NOT populate fake price or fake duration values in initial seed', () => {
    INITIAL_PLANS.forEach((plan) => {
      expect(plan.price).toBeNull();
      expect(plan.currency).toBeNull();
      expect(plan.durationDays).toBeNull();
    });
  });

  it('should seed plans on empty database (all created)', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(Plan, 'create').mockImplementation(async (data) => data);

    const result = await seedPlans();

    expect(result.created).toBe(4);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(4);
    expect(createSpy).toHaveBeenCalledTimes(4);
  });

  it('should be idempotent and skip existing plans without duplicating', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue({ _id: 'existing_id' });
    const createSpy = jest.spyOn(Plan, 'create');

    const result = await seedPlans();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(4);
    expect(result.total).toBe(4);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should NOT overwrite existing plan values if modified in database (e.g. 350 MB basic)', async () => {
    // Simulate database where basic plan was changed to 350 MB by an admin
    const customBasicPlan = {
      _id: 'db_plan_basic',
      code: 'basic',
      name: 'Basic Plan',
      storageBytes: 367001600, // 350 MB in DB
    };

    jest.spyOn(Plan, 'findOne').mockImplementation(async ({ code }) => {
      if (code === 'basic') return customBasicPlan;
      return null;
    });

    const createSpy = jest.spyOn(Plan, 'create').mockImplementation(async (data) => data);

    const result = await seedPlans();

    // basic was skipped, others created
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(3);
    // Verify Plan.create was never called with code: 'basic'
    expect(createSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'basic' })
    );
  });
});
