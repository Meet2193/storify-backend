const ApiError = require('../../src/utils/apiError');
const ApiResponse = require('../../src/utils/apiResponse');

describe('ApiError and ApiResponse Utility Tests', () => {
  describe('ApiError', () => {
    it('should create an ApiError instance with correct properties', () => {
      const error = new ApiError(400, 'Invalid input', [{ field: 'email', message: 'required' }]);
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.errors).toHaveLength(1);
      expect(error.isOperational).toBe(true);
      expect(error.success).toBe(false);
    });

    it('should support static helper methods', () => {
      const badReq = ApiError.badRequest('Bad data');
      expect(badReq.statusCode).toBe(400);
      expect(badReq.message).toBe('Bad data');

      const unauthorized = ApiError.unauthorized('No access');
      expect(unauthorized.statusCode).toBe(401);

      const forbidden = ApiError.forbidden('Forbidden action');
      expect(forbidden.statusCode).toBe(403);

      const notFound = ApiError.notFound('Missing item');
      expect(notFound.statusCode).toBe(404);

      const conflict = ApiError.conflict('Duplicate key');
      expect(conflict.statusCode).toBe(409);

      const unprocessable = ApiError.unprocessable('Validation fail', ['err']);
      expect(unprocessable.statusCode).toBe(422);

      const internal = ApiError.internal('Server crashed');
      expect(internal.statusCode).toBe(500);
    });
  });

  describe('ApiResponse', () => {
    it('should structure response object correctly', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((val) => val),
      };

      const result = ApiResponse.success(mockRes, { item: 'sample' }, 'Fetched successfully', 200);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ item: 'sample' });
      expect(result.message).toBe('Fetched successfully');
    });

    it('should handle ApiResponse.created correctly', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((val) => val),
      };

      const result = ApiResponse.created(mockRes, { id: 1 }, 'Created');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(result.statusCode).toBe(201);
      expect(result.data).toEqual({ id: 1 });
    });
  });
});
