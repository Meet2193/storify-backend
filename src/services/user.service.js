const User = require('../models/user.model');
const ApiError = require('../utils/apiError');

/**
 * Format bytes into human-readable string
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, { name }) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    if (name !== undefined) {
      user.name = name;
    }

    await user.save();
    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect.');
    }

    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully.' };
  }

  /**
   * Get user storage quota and usage summary
   */
  async getStorageSummary(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const usedBytes = user.storage?.usedBytes || 0;
    const allocatedBytes = user.storage?.allocatedBytes || 0;
    const remainingBytes = Math.max(0, allocatedBytes - usedBytes);
    const usagePercentage = allocatedBytes > 0 
      ? Math.min(100, parseFloat(((usedBytes / allocatedBytes) * 100).toFixed(2)))
      : 0;

    return {
      plan: user.plan,
      usedBytes,
      allocatedBytes,
      remainingBytes,
      usagePercentage,
      usedFormatted: formatBytes(usedBytes),
      allocatedFormatted: formatBytes(allocatedBytes),
      remainingFormatted: formatBytes(remainingBytes),
    };
  }
}

module.exports = new UserService();
