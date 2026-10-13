const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const File = require('../../src/models/file.model');
const storageProvider = require('../../src/storage');
const { generateToken } = require('../../src/utils/token.util');

describe('Storage & Files API Integration Tests', () => {
  const userOneId = '64e8b9281a8b123456789001';
  const userTwoId = '64e8b9281a8b123456789002';
  let tokenUserOne;
  let tokenUserTwo;
  let testTempDir;

  beforeAll(() => {
    tokenUserOne = generateToken({ id: userOneId, email: 'user1@example.com', role: 'user' });
    tokenUserTwo = generateToken({ id: userTwoId, email: 'user2@example.com', role: 'user' });
    testTempDir = path.join(os.tmpdir(), `storify_int_test_${Date.now()}`);
    fs.mkdirSync(testTempDir, { recursive: true });
  });

  afterAll(async () => {
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockResolvedValue({
      _id: userOneId,
      name: 'User One',
      email: 'user1@example.com',
      role: 'user',
      status: 'active',
      plan: 'free',
      storage: {
        usedBytes: 10485760, // 10 MB
        allocatedBytes: 52428800, // 50 MB
      },
    });

    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
      _id: userOneId,
      storage: {
        usedBytes: 10485760 + 2048,
        allocatedBytes: 52428800,
      },
    });

    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(true);
  });

  describe('GET /api/v1/storage', () => {
    it('should return 401 when accessed unauthenticated', async () => {
      const res = await request(app).get('/api/v1/storage');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return storage summary for authenticated user', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userOneId,
        plan: 'free',
        storage: {
          usedBytes: 10485760, // 10 MB
          allocatedBytes: 52428800, // 50 MB
        },
      });

      const res = await request(app)
        .get('/api/v1/storage')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('usedBytes', 10485760);
      expect(res.body.data).toHaveProperty('allocatedBytes', 52428800);
      expect(res.body.data).toHaveProperty('remainingBytes', 41943040);
      expect(res.body.data).toHaveProperty('usedFormatted', '10 MB');
      expect(res.body.data).toHaveProperty('allocatedFormatted', '50 MB');
    });
  });

  describe('POST /api/v1/storage/files (Upload)', () => {
    it('should reject upload without file attachment', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: 0, allocatedBytes: 52428800 },
      });

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('No file');
    });

    it('should reject file with unsupported MIME type', async () => {
      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', Buffer.from('executable binary code'), 'malicious.exe');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('not supported');
    });

    it('should reject upload when file exceeds user remaining storage quota', async () => {
      const userMock = {
        _id: userOneId,
        storage: {
          usedBytes: 52400000, // 52.4 MB used
          allocatedBytes: 52428800, // 50 MB total limit (only 28,800 bytes left)
        },
      };

      jest.spyOn(User, 'findById').mockResolvedValue(userMock);

      // Sending 100 KB file (102400 bytes) which exceeds remaining quota
      const testBuffer = Buffer.alloc(100 * 1024, 'A');

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', testBuffer, 'document.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('quota exceeded');
    });

    it('should upload a valid file, create metadata and update usedBytes', async () => {
      const initialUsed = 1000;
      const fileSize = 2048;

      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userOneId,
        storage: {
          usedBytes: initialUsed,
          allocatedBytes: 52428800,
        },
      });

      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
        _id: userOneId,
        storage: {
          usedBytes: initialUsed + fileSize,
          allocatedBytes: 52428800,
        },
      });

      jest.spyOn(storageProvider, 'saveFile').mockResolvedValue({
        storageKey: 'mock-key.png',
        sizeBytes: fileSize,
      });

      jest.spyOn(File, 'create').mockResolvedValue({
        _id: '64e8b9281a8b123456789abc',
        userId: userOneId,
        originalName: 'photo.png',
        storageKey: 'mock-key.png',
        mimeType: 'image/png',
        sizeBytes: fileSize,
        extension: 'png',
        status: 'active',
        createdAt: new Date(),
        toJSON: () => ({
          _id: '64e8b9281a8b123456789abc',
          userId: userOneId,
          originalName: 'photo.png',
          storageKey: 'mock-key.png',
          mimeType: 'image/png',
          sizeBytes: fileSize,
          extension: 'png',
          status: 'active',
        }),
      });

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', Buffer.alloc(fileSize, 'B'), 'photo.png');

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('originalName', 'photo.png');
      expect(res.body.data).toHaveProperty('storageKey');
      expect(res.body.data).toHaveProperty('sizeBytes', fileSize);
    });

    it('should rollback quota reservation if physical storage save fails', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: 0, allocatedBytes: 52428800 },
      });

      const userFindOneAndUpdateSpy = jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: 1024, allocatedBytes: 52428800 },
      });

      jest.spyOn(storageProvider, 'saveFile').mockRejectedValue(new Error('Disk write error'));

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', Buffer.alloc(1024, 'C'), 'report.pdf');

      expect(res.statusCode).toBe(500);
      expect(userFindOneAndUpdateSpy).toHaveBeenCalledTimes(2);
      expect(userFindOneAndUpdateSpy).toHaveBeenNthCalledWith(
        2,
        { _id: userOneId, 'storage.usedBytes': { $gte: 1024 } },
        { $inc: { 'storage.usedBytes': -1024 } },
        { new: true }
      );
    });

    it('should rollback physical file and quota reservation if File.create fails', async () => {
      const fileSize = 1024;
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: 0, allocatedBytes: 52428800 },
      });

      const userFindOneAndUpdateSpy = jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: fileSize, allocatedBytes: 52428800 },
      });

      jest.spyOn(storageProvider, 'saveFile').mockResolvedValue({
        storageKey: 'saved-key.pdf',
        sizeBytes: fileSize,
      });
      const deleteFileSpy = jest.spyOn(storageProvider, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(File, 'create').mockRejectedValue(new Error('DB write failed'));

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', Buffer.alloc(fileSize, 'C'), 'doc.pdf');

      expect(res.statusCode).toBe(500);
      expect(deleteFileSpy).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/));
      expect(userFindOneAndUpdateSpy).toHaveBeenCalledTimes(2);
      expect(userFindOneAndUpdateSpy).toHaveBeenNthCalledWith(
        2,
        { _id: userOneId, 'storage.usedBytes': { $gte: fileSize } },
        { $inc: { 'storage.usedBytes': -fileSize } },
        { new: true }
      );
    });
  });

  describe('GET /api/v1/storage/files (List & Pagination)', () => {
    it('should list only files belonging to the authenticated user', async () => {
      jest.spyOn(File, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(File, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { _id: 'file1', originalName: 'file1.pdf', sizeBytes: 100 },
          { _id: 'file2', originalName: 'file2.png', sizeBytes: 200 },
        ]),
      });

      const res = await request(app)
        .get('/api/v1/storage/files?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.files).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(File.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ userId: userOneId })
      );
    });

    it('should reject invalid pagination parameters', async () => {
      const res = await request(app)
        .get('/api/v1/storage/files?page=0&limit=500')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/storage/files/:fileId (File Details)', () => {
    it('should reject invalid MongoDB ObjectId for fileId', async () => {
      const res = await request(app)
        .get('/api/v1/storage/files/invalid-id-format')
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.errors[0].message).toContain('Invalid file ID format');
    });

    it('should return file details for owner', async () => {
      const validFileId = '64e8b9281a8b123456789abc';

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: validFileId,
        userId: userOneId,
        originalName: 'my_document.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

      const res = await request(app)
        .get(`/api/v1/storage/files/${validFileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.originalName).toBe('my_document.pdf');
    });

    it('should return 404 when file belongs to another user (isolation guarantee)', async () => {
      const foreignFileId = '64e8b9281a8b123456789def';

      // Query includes { userId: userOneId }, so userTwo's file returns null
      jest.spyOn(File, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/storage/files/${foreignFileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('not found or access denied');
    });
  });

  describe('GET /api/v1/storage/files/:fileId/access (Streaming Access)', () => {
    it('should return 404 when file does not belong to authenticated user', async () => {
      const targetFileId = '64e8b9281a8b123456789abc';
      jest.spyOn(File, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/storage/files/${targetFileId}/access`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(404);
    });

    it('should stream file contents when owned by authenticated user', async () => {
      const validFileId = '64e8b9281a8b123456789abc';
      const fileData = 'Binary content streamed safely';

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: validFileId,
        userId: userOneId,
        originalName: 'report.txt',
        storageKey: 'report-key.txt',
        mimeType: 'text/plain',
        sizeBytes: fileData.length,
      });

      const { Readable } = require('stream');
      const mockStream = Readable.from([Buffer.from(fileData)]);

      jest.spyOn(storageProvider, 'fileExists').mockResolvedValue(true);
      jest.spyOn(storageProvider, 'getFileStream').mockResolvedValue(mockStream);

      const res = await request(app)
        .get(`/api/v1/storage/files/${validFileId}/access`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toBe(fileData);
    });
  });

  describe('DELETE /api/v1/storage/files/:fileId (Deletion & Quota Reclaim)', () => {
    it('should return 404 when attempting to delete another user file', async () => {
      const foreignFileId = '64e8b9281a8b123456789abc';
      jest.spyOn(File, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/storage/files/${foreignFileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(404);
    });

    it('should delete file, remove physical storage, and decrease usedBytes', async () => {
      const validFileId = '64e8b9281a8b123456789abc';
      const fileSize = 50000;

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: validFileId,
        userId: userOneId,
        storageKey: 'key-to-delete.pdf',
        sizeBytes: fileSize,
      });

      const deleteFileSpy = jest.spyOn(storageProvider, 'deleteFile').mockResolvedValue(true);
      const deleteDbSpy = jest.spyOn(File, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const userUpdateSpy = jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
        _id: userOneId,
        storage: { usedBytes: 0, allocatedBytes: 52428800 },
      });

      const res = await request(app)
        .delete(`/api/v1/storage/files/${validFileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted successfully');
      expect(deleteFileSpy).toHaveBeenCalledWith('key-to-delete.pdf');
      expect(deleteDbSpy).toHaveBeenCalledWith({ _id: validFileId });
      expect(userUpdateSpy).toHaveBeenCalledWith(
        { _id: userOneId, 'storage.usedBytes': { $gte: fileSize } },
        { $inc: { 'storage.usedBytes': -fileSize } },
        { new: true }
      );
    });

    it('should safely clamp usedBytes to 0 if usedBytes is less than file size on deletion', async () => {
      const validFileId = '64e8b9281a8b123456789abc';
      const fileSize = 50000;

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: validFileId,
        userId: userOneId,
        storageKey: 'key-to-delete.pdf',
        sizeBytes: fileSize,
      });

      jest.spyOn(storageProvider, 'deleteFile').mockResolvedValue(true);
      jest.spyOn(File, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      // Simulate usedBytes was already less than fileSize, so atomic $gte match fails:
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
      const clampSpy = jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(true);

      const res = await request(app)
        .delete(`/api/v1/storage/files/${validFileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(clampSpy).toHaveBeenCalledWith(userOneId, {
        $set: { 'storage.usedBytes': 0 },
      });
    });
  });
});
