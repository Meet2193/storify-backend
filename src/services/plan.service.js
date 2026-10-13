const Plan = require('../models/plan.model');
const { PLAN_STATUS } = require('../constants');
const ApiError = require('../utils/apiError');

class PlanService {
  /**
   * Retrieve all active plans sorted by sortOrder
   * Excludes inactive plans and internal metadata
   */
  async getActivePlans() {
    const plans = await Plan.find({ status: PLAN_STATUS.ACTIVE })
      .select('-metadata')
      .sort({ sortOrder: 1, createdAt: 1 });
    return plans;
  }

  /**
   * Retrieve a single active plan by ID
   * Throws 404 if plan does not exist or is inactive
   */
  async getPlanById(planId) {
    const plan = await Plan.findOne({
      _id: planId,
      status: PLAN_STATUS.ACTIVE,
    }).select('-metadata');

    if (!plan) {
      throw ApiError.notFound('Plan not found or currently unavailable.');
    }

    return plan;
  }
}

module.exports = new PlanService();
