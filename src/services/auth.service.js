const User = require('../models/user.model');
const ApiError = require('../utils/apiError');
const { generateToken } = require('../utils/token.util');
const { USER_STATUS } = require('../constants');

class AuthService {
  /**
   * Register a new user
   */
  async register({ name, email, password, acquisitionSource }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists.');
    }

    const userData = {
      name,
      email,
      password,
    };
    if (acquisitionSource) {
      userData.acquisitionSource = acquisitionSource;
    }

    const user = await User.create(userData);

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      user: user.toJSON(),
      token,
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login({ email, password }) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      throw ApiError.forbidden('Your account has been suspended. Please contact support.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      user: user.toJSON(),
      token,
    };
  }

  /**
   * Request password reset token
   */
  async forgotPassword({ email }) {
    const user = await User.findOne({ email });
    if (!user) {
      throw ApiError.notFound('No account found with this email address.');
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    return {
      resetToken,
      message: 'Password reset token generated successfully. Valid for 15 minutes.',
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword({ token, newPassword }) {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw ApiError.badRequest('Password reset token is invalid or has expired.');
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return {
      message: 'Password has been reset successfully. You can now login.',
    };
  }
}

module.exports = new AuthService();
