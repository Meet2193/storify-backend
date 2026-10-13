const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const File = require('../../src/models/file.model');
const storageService = require('../../src/services/storage.service');
const LocalStorageProvider = require('../../src/storage/local.storage.provider');
const BunnyStorageProvider = require('../../src/storage/bunny.storage.provider');
const { generateToken } = require('../../src/utils/token.util');

describe('Storage & Files API with BunnyStorageProvider Integration Tests', () => {
  const userOneId = '64e8b9281a8b123456789101';
  const userTwoId = '64e8b9281a8b123456789102';
  let tokenUserOne;
  let tokenUserTwo;
  let server;
  let serverPort;
  let mockBunnyHandler;
  let bunnyProvider;
  let originalProvider;
  let testTempDir;

  beforeAll((done) => {
    tokenUserOne = generateToken({ id: userOneId, email: 'bunnyuser1@example.com', role: 'user' });
    tokenUserTwo = generateToken({ id: userTwoId, email: 'bunnyuser2@example.com', role: 'user' });
    testTempDir = path.join(os.tmpdir(), `storify_bunny_int_${Date.now()}`);
    fs.mkdirSync(testTempDir, { recursive: true });

    server = http.createServer((req, res) => {
      if (mockBunnyHandler) {
        mockBunnyHandler(req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      bunnyProvider = new BunnyStorageProvider({
        zoneName: 'integration-zone',
        accessKey: 'integration-secret-key',
        region: `127.0.0.1:${serverPort}`,
        protocol: 'http:',
        timeoutMs: 3000,
      });

      // Save original provider and inject Bunny provider into storageService
      originalProvider = storageService.getProvider();
      storageService.setProvider(bunnyProvider);
      done();
    });
  });

  afterAll(async () => {
    // Restore original provider
    storageService.setProvider(originalProvider);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockBunnyHandler = null;
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockResolvedValue({
      _id: userOneId,
      name: 'User One',
      email: 'bunnyuser1@example.com',
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

  describe('End-to-end Upload to Bunny Storage', () => {
    it('should upload physical file to Bunny Storage and create MongoDB file document', async () => {
      const sampleFilePath = path.join(testTempDir, 'upload_sample.png');
      const fileData = Buffer.from('Fake PNG Image Binary Data for Bunny');
      await fs.promises.writeFile(sampleFilePath, fileData);

      let receivedBunnyMethod;
      let receivedBunnyPath;
      let receivedBunnyKey;
      let receivedBody = '';

      mockBunnyHandler = (req, res) => {
        receivedBunnyMethod = req.method;
        receivedBunnyPath = req.url;
        receivedBunnyKey = req.headers['accesskey'];

        req.on('data', (c) => (receivedBody += c));
        req.on('end', () => {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 201, Message: 'File uploaded.' }));
        });
      };

      const mockCreatedFile = {
        _id: '64e8b9281a8b123456789abc',
        userId: userOneId,
        originalName: 'upload_sample.png',
        storageKey: 'mock-uuid.png',
        mimeType: 'image/png',
        sizeBytes: fileData.length,
        status: 'active',
        createdAt: new Date(),
      };
      jest.spyOn(File, 'create').mockResolvedValue(mockCreatedFile);

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', sampleFilePath);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(receivedBunnyMethod).toBe('PUT');
      expect(receivedBunnyPath).toMatch(/^\/integration-zone\/[a-f0-9-]+\.png$/);
      expect(receivedBunnyKey).toBe('integration-secret-key');
      expect(receivedBody).toBe(fileData.toString());
    });

    it('should rollback quota reservation and clean up temporary file if Bunny upload fails', async () => {
      const sampleFilePath = path.join(testTempDir, 'fail_sample.png');
      await fs.promises.writeFile(sampleFilePath, 'File destined to fail');

      // Simulate Bunny returning 500 error
      mockBunnyHandler = (_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 500, Message: 'Bunny storage error' }));
      };

      const rollbackSpy = jest.spyOn(storageService, 'rollbackQuotaReservation');

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', sampleFilePath);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(rollbackSpy).toHaveBeenCalledWith(userOneId, expect.any(Number));
    });

    it('should clean up Bunny remote object and rollback quota if MongoDB File.create fails', async () => {
      const sampleFilePath = path.join(testTempDir, 'db_fail_sample.png');
      await fs.promises.writeFile(sampleFilePath, 'Data for db fail test');

      let deleteInvokedOnBunny = false;
      mockBunnyHandler = (req, res) => {
        if (req.method === 'PUT') {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 201, Message: 'Uploaded' }));
        } else if (req.method === 'DELETE') {
          deleteInvokedOnBunny = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 200, Message: 'Deleted' }));
        }
      };

      jest.spyOn(File, 'create').mockRejectedValue(new Error('MongoDB Connection Error'));
      const rollbackSpy = jest.spyOn(storageService, 'rollbackQuotaReservation');

      const res = await request(app)
        .post('/api/v1/storage/files')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .attach('file', sampleFilePath);

      expect(res.statusCode).toBe(500);
      expect(deleteInvokedOnBunny).toBe(true);
      expect(rollbackSpy).toHaveBeenCalled();
    });
  });

  describe('Private File Access & Download Streaming', () => {
    it('should stream file from Bunny Storage to client with safe headers for authenticated owner', async () => {
      const fileId = '64e8b9281a8b123456789abc';
      const storageKey = 'uuid-stored-on-bunny.pdf';
      const fileContent = 'Bunny Streamed PDF Content';
      const fileBuffer = Buffer.from(fileContent);

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: fileId,
        userId: userOneId,
        originalName: 'MyDocument.pdf',
        storageKey,
        mimeType: 'application/pdf',
        sizeBytes: fileBuffer.length,
        status: 'active',
      });

      let requestedBunnyUrl;
      mockBunnyHandler = (req, res) => {
        requestedBunnyUrl = req.url;
        if (req.method === 'HEAD') {
          res.writeHead(200, {
            'Content-Length': fileBuffer.length.toString(),
            'Content-Type': 'application/pdf',
          });
          res.end();
        } else if (req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': fileBuffer.length.toString(),
          });
          res.end(fileBuffer);
        }
      };

      const res = await request(app)
        .get(`/api/v1/storage/files/${fileId}/access`)
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .buffer();

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('MyDocument.pdf');
      expect(res.body.toString()).toBe(fileContent);
      expect(requestedBunnyUrl).toBe(`/integration-zone/${storageKey}`);
    });

    it('should return 404 when user attempts to download another user file (IDOR prevention)', async () => {
      const fileId = '64e8b9281a8b123456789abc';

      // File belongs to userOne, but userTwo is querying
      jest.spyOn(File, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/storage/files/${fileId}/access`)
        .set('Authorization', `Bearer ${tokenUserTwo}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('File not found or access denied');
    });
  });

  describe('Delete File with Bunny Storage', () => {
    it('should delete remote Bunny object, remove MongoDB record, and reclaim quota exactly once', async () => {
      const fileId = '64e8b9281a8b123456789abc';
      const storageKey = 'uuid-to-delete.png';

      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: fileId,
        userId: userOneId,
        storageKey,
        sizeBytes: 2048,
        status: 'active',
      });

      let deleteRequested = false;
      mockBunnyHandler = (req, res) => {
        if (req.method === 'DELETE' && req.url === `/integration-zone/${storageKey}`) {
          deleteRequested = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 200, Message: 'Deleted' }));
        }
      };

      const deleteDocSpy = jest.spyOn(File, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const reclaimSpy = jest.spyOn(storageService, 'reclaimUserStorage');

      const res = await request(app)
        .delete(`/api/v1/storage/files/${fileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deleteRequested).toBe(true);
      expect(deleteDocSpy).toHaveBeenCalledWith({ _id: fileId });
      expect(reclaimSpy).toHaveBeenCalledTimes(1);
      expect(reclaimSpy).toHaveBeenCalledWith(userOneId, 2048);
    });

    it('should return 404 when user attempts to delete another user file (IDOR prevention)', async () => {
      const fileId = '64e8b9281a8b123456789abc';
      jest.spyOn(File, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/storage/files/${fileId}`)
        .set('Authorization', `Bearer ${tokenUserTwo}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should preserve MongoDB metadata and NOT reclaim quota if remote Bunny deletion fails with 500', async () => {
      const fileId = '64e8b9281a8b123456789abc';
      jest.spyOn(File, 'findOne').mockResolvedValue({
        _id: fileId,
        userId: userOneId,
        storageKey: 'storage-key.png',
        sizeBytes: 2048,
        status: 'active',
      });

      mockBunnyHandler = (_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 500, Message: 'Remote storage error' }));
      };

      const deleteDocSpy = jest.spyOn(File, 'deleteOne');
      const reclaimSpy = jest.spyOn(storageService, 'reclaimUserStorage');

      const res = await request(app)
        .delete(`/api/v1/storage/files/${fileId}`)
        .set('Authorization', `Bearer ${tokenUserOne}`);

      expect(res.statusCode).toBe(500);
      expect(deleteDocSpy).not.toHaveBeenCalled();
      expect(reclaimSpy).not.toHaveBeenCalled();
    });
  });
});
