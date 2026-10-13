const Purchase = require('../models/purchase.model');
const Plan = require('../models/plan.model');
const User = require('../models/user.model');
const { PURCHASE_STATUS, PLAN_STATUS, ACQUISITION_SOURCE } = require('../constants');
const ApiError = require('../utils/apiError');

class PurchaseService {
  /**
   * Create a new pending purchase order for an authenticated user
   * Captures an immutable snapshot of the active plan at purchase time
   * Employs idempotency window to prevent duplicate pending purchases from rapid clicks
   */
  async createPurchase(userId, planId) {
    // 1. Fetch active Plan from MongoDB (never trust client plan config)
    const plan = await Plan.findOne({ _id: planId, status: PLAN_STATUS.ACTIVE });
    if (!plan) {
      throw ApiError.notFound('Plan not found or currently unavailable.');
    }

    // 2. Fetch authenticated user to obtain durable trusted acquisitionSource
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }
    const acquisitionSource = user.acquisitionSource || ACQUISITION_SOURCE.ORGANIC;

    // 3. Duplicate protection: Reuse pending purchase if created within 5-minute cooldown
    const cooldownWindow = new Date(Date.now() - 5 * 60 * 1000);
    const recentPendingPurchase = await Purchase.findOne({
      userId,
      planId: plan._id,
      status: PURCHASE_STATUS.PENDING,
      createdAt: { $gte: cooldownWindow },
    });

    if (recentPendingPurchase) {
      return {
        purchase: recentPendingPurchase,
        isExisting: true,
      };
    }

    // 4. Capture immutable purchase-time snapshot
    const planSnapshot = {
      planId: plan._id,
      planCode: plan.code,
      planName: plan.name,
      storageBytes: plan.storageBytes,
      price: plan.price !== undefined ? plan.price : null,
      currency: plan.currency !== undefined ? plan.currency : null,
      durationDays: plan.durationDays !== undefined ? plan.durationDays : null,
    };

    // 5. Create new Purchase record (status starts as PENDING, zero payment/entitlement side effects)
    const purchase = await Purchase.create({
      userId,
      planId: plan._id,
      planSnapshot,
      status: PURCHASE_STATUS.PENDING,
      acquisitionSource,
      paymentReference: null,
    });

    return {
      purchase,
      isExisting: false,
    };
  }

  /**
   * List purchase history for authenticated user with pagination
   */
  async getUserPurchases(userId, { page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };

    const [total, purchases] = await Promise.all([
      Purchase.countDocuments(query),
      Purchase.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      purchases,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  /**
   * Retrieve details of a single purchase belonging strictly to the authenticated user
   */
  async getPurchaseById(userId, purchaseId) {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      userId,
    });

    if (!purchase) {
      throw ApiError.notFound('Purchase not found or access denied.');
    }

    return purchase;
  }
}

module.exports = new PurchaseService();
