const storageService = require('../../src/services/storage.service');
const User = require('../../src/models/user.model');
const File = require('../../src/models/file.model');
const storageProvider = require('../../src/storage');
const ApiError = require('../../src/utils/apiError');

describe('StorageService Unit Tests', () => {
  const mockUserId = '64e8b9281a8b123456789001';
  const mockFileId = '64e8b9281a8b123456789abc';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('reclaimUserStorage', () => {
    it('should ignore non-positive sizeBytes values safely', async () => {
      const updateSpy = jest.spyOn(User, 'findOneAndUpdate');
      await storageService.reclaimUserStorage(mockUserId, 0);
      await storageService.reclaimUserStorage(mockUserId, -500);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should atomically decrement usedBytes when current usedBytes >= sizeBytes', async () => {
      const updateSpy = jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
        _id: mockUserId,
        storage: { usedBytes: 5000, allocatedBytes: 52428800 },
      });

      await storageService.reclaimUserStorage(mockUserId, 1000);

      expect(updateSpy).toHaveBeenCalledWith(
        {
          _id: mockUserId,
          'storage.usedBytes': { $gte: 1000 },
        },
        {
          $inc: { 'storage.usedBytes': -1000 },
        },
        { new: true }
      );
    });

    it('should clamp usedBytes to 0 if usedBytes is less than sizeBytes (never negative)', async () => {
      // findOneAndUpdate returns null when $gte condition fails (i.e. usedBytes < sizeBytes)
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
      const clampSpy = jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(true);

      await storageService.reclaimUserStorage(mockUserId, 5000);

      expect(clampSpy).toHaveBeenCalledWith(mockUserId, {
        $set: { 'storage.usedBytes': 0 },
      });
    });
  });

  describe('deleteFile', () => {
    it('should throw 404 and NOT decrement storage if file does not exist or already deleted', async () => {
      jest.spyOn(File, 'findOne').mockResolvedValue(null);
      const reclaimSpy = jest.spyOn(storageService, 'reclaimUserStorage');

      await expect(storageService.deleteFile(mockUserId, mockFileId)).rejects.toThrow(ApiError);
      expect(reclaimSpy).not.toHaveBeenCalled();
    });

    it('should delete physical file, remove DB document, and reclaim storage', async () => {
      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: mockFileId,
        userId: mockUserId,
        storageKey: 'sample-key.pdf',
        sizeBytes: 2048,
        status: 'active',
      });

      const deleteStorageSpy = jest.spyOn(storageProvider, 'deleteFile').mockResolvedValue(true);
      const deleteDbSpy = jest.spyOn(File, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const reclaimSpy = jest.spyOn(storageService, 'reclaimUserStorage').mockResolvedValue();

      const result = await storageService.deleteFile(mockUserId, mockFileId);

      expect(result.message).toContain('deleted successfully');
      expect(deleteStorageSpy).toHaveBeenCalledWith('sample-key.pdf');
      expect(deleteDbSpy).toHaveBeenCalledWith({ _id: mockFileId });
      expect(reclaimSpy).toHaveBeenCalledWith(mockUserId, 2048);
    });
  });

  describe('uploadFile concurrency and rollback', () => {
    it('should reject upload when user does not have sufficient quota', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        storage: { usedBytes: 52428000, allocatedBytes: 52428800 }, // only 800 bytes left
      });

      await expect(
        storageService.uploadFile(mockUserId, {
          size: 1000, // exceeds remaining 800 bytes
          path: 'non-existent-temp-path.tmp',
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
        })
      ).rejects.toThrow('Storage quota exceeded');
    });

    it('should reject when concurrent upload atomic reservation fails', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        storage: { usedBytes: 1000, allocatedBytes: 52428800 },
      });

      // Atomic reservation returns null when another thread already consumed quota
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        storageService.uploadFile(mockUserId, {
          size: 2000,
          path: 'non-existent-temp-path.tmp',
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
        })
      ).rejects.toThrow('Concurrent upload pushed storage beyond limit');
    });
  });
});
