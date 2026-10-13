const Plan = require('../../src/models/plan.model');
const { PLAN_STATUS } = require('../../src/constants');

describe('Plan Model Unit Tests', () => {
  it('should validate a valid plan with storageBytes successfully', async () => {
    const validPlan = new Plan({
      name: 'Basic Plan',
      code: 'basic',
      description: 'Standard 300 MB tier plan',
      storageBytes: 314572800, // 300 MB
      status: PLAN_STATUS.ACTIVE,
      sortOrder: 1,
    });

    let error;
    try {
      await validPlan.validate();
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    expect(validPlan.status).toBe(PLAN_STATUS.ACTIVE);
    expect(validPlan.storageBytes).toBe(314572800);
    // Unconfirmed fields must default to null (no fake values)
    expect(validPlan.price).toBeNull();
    expect(validPlan.currency).toBeNull();
    expect(validPlan.durationDays).toBeNull();
  });

  it('should fail validation when name is missing', async () => {
    const plan = new Plan({
      code: 'basic',
      storageBytes: 314572800,
    });

    await expect(plan.validate()).rejects.toThrow();
  });

  it('should fail validation when code is missing', async () => {
    const plan = new Plan({
      name: 'Basic Plan',
      storageBytes: 314572800,
    });

    await expect(plan.validate()).rejects.toThrow();
  });

  it('should fail validation when storageBytes is missing or negative', async () => {
    const missingStorage = new Plan({
      name: 'Test Plan',
      code: 'test',
    });
    await expect(missingStorage.validate()).rejects.toThrow();

    const negativeStorage = new Plan({
      name: 'Negative Plan',
      code: 'negative',
      storageBytes: -100,
    });
    await expect(negativeStorage.validate()).rejects.toThrow();
  });

  it('should fail validation when status is invalid', async () => {
    const plan = new Plan({
      name: 'Invalid Status Plan',
      code: 'invalid_status',
      storageBytes: 524288000,
      status: 'archived',
    });

    await expect(plan.validate()).rejects.toThrow();
  });

  it('should strip __v in toJSON', () => {
    const plan = new Plan({
      name: 'Pro Plan',
      code: 'pro',
      storageBytes: 943718400,
    });

    const json = plan.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.name).toBe('Pro Plan');
    expect(json.storageBytes).toBe(943718400);
  });
});
