const authService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, acquisitionSource } = req.body;
  const result = await authService.register({ name, email, password, acquisitionSource });
  return ApiResponse.created(res, result, 'User registered successfully');
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  return ApiResponse.success(res, result, 'Login successful');
});

/**
 * Get current authenticated user
 * GET /api/v1/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, req.user, 'Current user profile retrieved');
});

/**
 * Request password reset token
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword({ email });
  return ApiResponse.success(res, result, result.message);
});

/**
 * Reset password using token
 * POST /api/v1/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword({ token, newPassword });
  return ApiResponse.success(res, null, result.message);
});

/**
 * Change authenticated user password
 * PUT or PATCH /api/v1/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userService = require('../services/user.service');
  const result = await userService.changePassword(req.user._id, {
    currentPassword,
    newPassword,
  });
  return ApiResponse.success(res, null, result.message);
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (_req, res) => {
  return ApiResponse.success(res, null, 'Logged out successfully');
});

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
};
