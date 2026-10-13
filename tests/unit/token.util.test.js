const { generateToken, verifyToken } = require('../../src/utils/token.util');

describe('Token Utility Unit Tests', () => {
  const payload = {
    id: '64e8b9281a8b123456789abc',
    email: 'test@example.com',
    role: 'user',
  };

  it('should generate a valid JWT token string', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('should verify and decode a generated token correctly', () => {
    const token = generateToken(payload, '1h');
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.exp).toBeDefined();
  });

  it('should throw an error for an invalid/tampered token', () => {
    const token = generateToken(payload);
    const tamperedToken = token.slice(0, -5) + 'abcde';

    expect(() => {
      verifyToken(tamperedToken);
    }).toThrow();
  });

  it('should throw an error for a malformed token string', () => {
    expect(() => {
      verifyToken('not-a-valid-token');
    }).toThrow();
  });
});
