const mongoose = require('mongoose');
const Purchase = require('../../src/models/purchase.model');
const { PURCHASE_STATUS, ACQUISITION_SOURCE } = require('../../src/constants');

describe('Purchase Model Unit Tests', () => {
  const validSnapshot = {
    planId: new mongoose.Types.ObjectId(),
    planCode: 'basic',
    planName: 'Basic Plan',
    storageBytes: 314572800,
    price: null,
    currency: null,
    durationDays: null,
  };

  it('should validate a valid purchase document successfully', async () => {
    const validPurchase = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      planSnapshot: validSnapshot,
      status: PURCHASE_STATUS.PENDING,
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });

    let error;
    try {
      await validPurchase.validate();
    } catch (e) {
      error = e;
    }

    expect(error).toBeUndefined();
    expect(validPurchase.status).toBe(PURCHASE_STATUS.PENDING);
    expect(validPurchase.acquisitionSource).toBe(ACQUISITION_SOURCE.ORGANIC);
    expect(validPurchase.planSnapshot.storageBytes).toBe(314572800);
    expect(validPurchase.paymentReference).toBeNull();
  });

  it('should fail validation when userId is missing', async () => {
    const purchase = new Purchase({
      planId: validSnapshot.planId,
      planSnapshot: validSnapshot,
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });

    await expect(purchase.validate()).rejects.toThrow();
  });

  it('should fail validation when planId is missing', async () => {
    const purchase = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planSnapshot: validSnapshot,
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });

    await expect(purchase.validate()).rejects.toThrow();
  });

  it('should fail validation when planSnapshot is missing or invalid', async () => {
    const purchaseNoSnapshot = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });
    await expect(purchaseNoSnapshot.validate()).rejects.toThrow();

    const purchaseInvalidSnapshot = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      planSnapshot: {
        // missing planId, planCode, storageBytes
        planName: 'Incomplete',
      },
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });
    await expect(purchaseInvalidSnapshot.validate()).rejects.toThrow();
  });

  it('should fail validation when acquisitionSource is invalid or missing', async () => {
    const purchaseInvalidSource = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      planSnapshot: validSnapshot,
      acquisitionSource: 'social_referral', // not allowed
    });

    await expect(purchaseInvalidSource.validate()).rejects.toThrow();
  });

  it('should default status to pending and reject invalid status', async () => {
    const purchase = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      planSnapshot: validSnapshot,
      acquisitionSource: ACQUISITION_SOURCE.ADVERTISEMENT,
    });

    expect(purchase.status).toBe(PURCHASE_STATUS.PENDING);

    purchase.status = 'approved'; // invalid status
    await expect(purchase.validate()).rejects.toThrow();
  });

  it('should strip __v in toJSON', () => {
    const purchase = new Purchase({
      userId: new mongoose.Types.ObjectId(),
      planId: validSnapshot.planId,
      planSnapshot: validSnapshot,
      acquisitionSource: ACQUISITION_SOURCE.ORGANIC,
    });

    const json = purchase.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.status).toBe(PURCHASE_STATUS.PENDING);
  });
});
