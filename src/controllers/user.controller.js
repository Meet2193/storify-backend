const userService = require('../services/user.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserProfile(req.user._id);
  return ApiResponse.success(res, user, 'User profile retrieved successfully');
});

/**
 * Update current user profile
 * PATCH /api/v1/users/me
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = await userService.updateProfile(req.user._id, { name });
  return ApiResponse.success(res, user, 'Profile updated successfully');
});

/**
 * Change current user password
 * PUT /api/v1/users/me/password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await userService.changePassword(req.user._id, {
    currentPassword,
    newPassword,
  });
  return ApiResponse.success(res, null, result.message);
});

/**
 * Get user storage summary
 * GET /api/v1/users/me/storage
 */
const getStorageSummary = asyncHandler(async (req, res) => {
  const storage = await userService.getStorageSummary(req.user._id);
  return ApiResponse.success(res, storage, 'Storage summary retrieved successfully');
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getStorageSummary,
};
