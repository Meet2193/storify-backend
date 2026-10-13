const bcrypt = require('bcryptjs');
const User = require('../../src/models/user.model');
const { ROLES, USER_STATUS, PLANS, DEFAULT_STORAGE } = require('../../src/constants');

describe('User Model Unit Tests', () => {
  it('should validate a valid user object successfully', async () => {
    const validUser = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    });

    let validationError;
    try {
      await validUser.validate();
    } catch (e) {
      validationError = e;
    }
    expect(validationError).toBeUndefined();
    expect(validUser.role).toBe(ROLES.USER);
    expect(validUser.status).toBe(USER_STATUS.ACTIVE);
    expect(validUser.plan).toBe(PLANS.FREE);
    expect(validUser.storage.allocatedBytes).toBe(50 * 1024 * 1024); // Exactly 50 MB
    expect(validUser.storage.allocatedBytes).toBe(DEFAULT_STORAGE.FREE_BYTES);
    expect(validUser.storage.usedBytes).toBe(0);
  });

  it('should generate and hash password reset token properly', () => {
    const user = new User({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'someHashedPassword',
    });

    const resetToken = user.createPasswordResetToken();
    expect(typeof resetToken).toBe('string');
    expect(resetToken.length).toBe(64); // 32 bytes hex
    expect(user.passwordResetToken).toBeDefined();
    expect(user.passwordResetExpires).toBeDefined();
    expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());

    // toJSON should strip passwordResetToken and passwordResetExpires
    const json = user.toJSON();
    expect(json.passwordResetToken).toBeUndefined();
    expect(json.passwordResetExpires).toBeUndefined();
  });

  it('should fail validation when name is missing or too short', async () => {
    const userMissingName = new User({
      email: 'test@example.com',
      password: 'password123',
    });
    await expect(userMissingName.validate()).rejects.toThrow();

    const userShortName = new User({
      name: 'A',
      email: 'test@example.com',
      password: 'password123',
    });
    await expect(userShortName.validate()).rejects.toThrow();
  });

  it('should fail validation when email is invalid', async () => {
    const userInvalidEmail = new User({
      name: 'Valid Name',
      email: 'invalid-email',
      password: 'password123',
    });
    await expect(userInvalidEmail.validate()).rejects.toThrow();
  });

  it('should fail validation when password is too short', async () => {
    const userShortPass = new User({
      name: 'Valid Name',
      email: 'valid@example.com',
      password: '123',
    });
    await expect(userShortPass.validate()).rejects.toThrow();
  });

  it('should compare password correctly against hashed value', async () => {
    const rawPassword = 'mySecurePassword123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const user = new User({
      name: 'Alice',
      email: 'alice@example.com',
      password: hashedPassword,
    });

    const isMatch = await user.comparePassword(rawPassword);
    expect(isMatch).toBe(true);

    const isWrongMatch = await user.comparePassword('wrongpassword');
    expect(isWrongMatch).toBe(false);
  });

  it('should strip password and __v in toJSON output', () => {
    const user = new User({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'someHashedPassword',
    });

    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.name).toBe('Alice');
    expect(json.email).toBe('alice@example.com');
  });
});
