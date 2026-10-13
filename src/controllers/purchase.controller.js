const purchaseService = require('../services/purchase.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Create a new purchase record for the authenticated user
 * POST /api/v1/purchases
 */
const createPurchase = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const result = await purchaseService.createPurchase(req.user._id, planId);

  const statusCode = result.isExisting ? 200 : 201;
  const message = result.isExisting
    ? 'Existing pending purchase order returned'
    : 'Purchase record created successfully';

  return ApiResponse.success(res, result.purchase, message, statusCode);
});

/**
 * Get authenticated user's purchase history
 * GET /api/v1/purchases
 */
const getUserPurchases = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await purchaseService.getUserPurchases(req.user._id, { page, limit });
  return ApiResponse.success(res, result, 'Purchases retrieved successfully');
});

/**
 * Get details of one purchase belonging to the authenticated user
 * GET /api/v1/purchases/:purchaseId
 */
const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseById(req.user._id, req.params.purchaseId);
  return ApiResponse.success(res, purchase, 'Purchase details retrieved successfully');
});

module.exports = {
  createPurchase,
  getUserPurchases,
  getPurchaseById,
};
