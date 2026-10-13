const planService = require('../services/plan.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all available active plans
 * GET /api/v1/plans
 */
const getPlans = asyncHandler(async (req, res) => {
  const plans = await planService.getActivePlans();
  return ApiResponse.success(res, { plans }, 'Plans fetched successfully');
});

/**
 * Get details of one active plan
 * GET /api/v1/plans/:planId
 */
const getPlanById = asyncHandler(async (req, res) => {
  const plan = await planService.getPlanById(req.params.planId);
  return ApiResponse.success(res, plan, 'Plan details retrieved successfully');
});

module.exports = {
  getPlans,
  getPlanById,
};
