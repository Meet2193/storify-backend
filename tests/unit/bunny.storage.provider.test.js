const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Readable } = require('stream');
const BunnyStorageProvider = require('../../src/storage/bunny.storage.provider');

describe('BunnyStorageProvider Unit Tests', () => {
  let server;
  let serverPort;
  let mockHandler;
  let testTempDir;

  beforeAll((done) => {
    testTempDir = path.join(os.tmpdir(), `storify_bunny_test_${Date.now()}`);
    fs.mkdirSync(testTempDir, { recursive: true });

    server = http.createServer((req, res) => {
      if (mockHandler) {
        mockHandler(req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  beforeEach(() => {
    mockHandler = null;
  });

  // Helper to create test provider pointing to local mock server
  const createMockProvider = (options = {}) => {
    return new BunnyStorageProvider({
      zoneName: 'test-zone',
      accessKey: 'test-secret-key-123',
      region: `127.0.0.1:${serverPort}`,
      protocol: 'http:',
      timeoutMs: 2000,
      ...options,
    });
  };

  describe('Constructor & Configuration Validation', () => {
    it('should throw when zoneName is missing or empty', () => {
      expect(() => {
        new BunnyStorageProvider({
          zoneName: '',
          accessKey: 'valid-key',
        });
      }).toThrow('Storage Configuration Error: Bunny storage zoneName is required.');
    });

    it('should throw when accessKey is missing or empty', () => {
      expect(() => {
        new BunnyStorageProvider({
          zoneName: 'my-zone',
          accessKey: '',
        });
      }).toThrow('Storage Configuration Error: Bunny storage accessKey is required.');
    });

    it('should initialize successfully with valid configuration', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'my-zone',
        accessKey: 'secret-pass',
        region: 'ny',
      });
      expect(provider.zoneName).toBe('my-zone');
      expect(provider.accessKey).toBe('secret-pass');
      expect(provider.hostname).toBe('ny.storage.bunnycdn.com');
      expect(provider.timeoutMs).toBe(30000);
    });
  });

  describe('Regional Endpoint Hostname Selection', () => {
    it('should select correct hostname for Falkenstein/Default region (de)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'de',
      });
      expect(provider.hostname).toBe('storage.bunnycdn.com');
    });

    it('should select correct hostname for London (uk)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'uk',
      });
      expect(provider.hostname).toBe('uk.storage.bunnycdn.com');
    });

    it('should select correct hostname for New York (ny)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'ny',
      });
      expect(provider.hostname).toBe('ny.storage.bunnycdn.com');
    });

    it('should select correct hostname for Los Angeles (la)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'la',
      });
      expect(provider.hostname).toBe('la.storage.bunnycdn.com');
    });

    it('should select correct hostname for Singapore (sg)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'sg',
      });
      expect(provider.hostname).toBe('sg.storage.bunnycdn.com');
    });

    it('should select correct hostname for Sydney (syd)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'syd',
      });
      expect(provider.hostname).toBe('syd.storage.bunnycdn.com');
    });

    it('should select correct hostname for Stockholm (se)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'se',
      });
      expect(provider.hostname).toBe('se.storage.bunnycdn.com');
    });

    it('should select correct hostname for São Paulo (br)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'br',
      });
      expect(provider.hostname).toBe('br.storage.bunnycdn.com');
    });

    it('should select correct hostname for Johannesburg (jh)', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'jh',
      });
      expect(provider.hostname).toBe('jh.storage.bunnycdn.com');
    });

    it('should support full custom domain or port directly', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'custom.storage.internal:9000',
      });
      expect(provider.hostname).toBe('custom.storage.internal:9000');
    });

    it('should strip https:// or trailing slashes in region input gracefully', () => {
      const provider = new BunnyStorageProvider({
        zoneName: 'z',
        accessKey: 'k',
        region: 'https://sg.storage.bunnycdn.com/',
      });
      expect(provider.hostname).toBe('sg.storage.bunnycdn.com');
    });
  });

  describe('Path Traversal & Key Sanitization', () => {
    it('should strip directory traversal and sanitize storage keys', () => {
      const provider = createMockProvider();
      const safeKey = provider.resolveStorageKey('../../../etc/passwd');
      expect(safeKey).toBe('passwd');
    });

    it('should throw when storage key is invalid or empty', () => {
      const provider = createMockProvider();
      expect(() => provider.resolveStorageKey('')).toThrow('Security Error');
      expect(() => provider.resolveStorageKey('.')).toThrow('Security Error');
      expect(() => provider.resolveStorageKey('..')).toThrow('Security Error');
      expect(() => provider.resolveStorageKey(null)).toThrow('Security Error');
    });
  });

  describe('Upload (saveFile)', () => {
    it('should send HTTP PUT with AccessKey header and upload Buffer successfully', async () => {
      let receivedMethod;
      let receivedPath;
      let receivedAccessKey;
      let receivedContentType;
      let receivedBody = '';

      mockHandler = (req, res) => {
        receivedMethod = req.method;
        receivedPath = req.url;
        receivedAccessKey = req.headers['accesskey'];
        receivedContentType = req.headers['content-type'];

        req.on('data', (c) => {
          receivedBody += c;
        });
        req.on('end', () => {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 201, Message: 'File uploaded.' }));
        });
      };

      const provider = createMockProvider();
      const content = Buffer.from('Test Buffer Content for Bunny');
      const result = await provider.saveFile('test-uuid.png', content, { mimeType: 'image/png' });

      expect(receivedMethod).toBe('PUT');
      expect(receivedPath).toBe('/test-zone/test-uuid.png');
      expect(receivedAccessKey).toBe('test-secret-key-123');
      expect(receivedContentType).toBe('image/png');
      expect(receivedBody).toBe('Test Buffer Content for Bunny');
      expect(result.storageKey).toBe('test-uuid.png');
      expect(result.sizeBytes).toBe(content.length);
      expect(result.path).toBe('/test-zone/test-uuid.png');
    });

    it('should upload from temporary file path and clean up source temp file', async () => {
      const tempPath = path.join(testTempDir, 'temp_upload.txt');
      await fs.promises.writeFile(tempPath, 'Temporary disk file content');

      mockHandler = (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 200, Message: 'File uploaded.' }));
        });
      };

      const provider = createMockProvider();
      const result = await provider.saveFile('uploaded-from-path.txt', tempPath, {
        mimeType: 'text/plain',
      });

      expect(result.storageKey).toBe('uploaded-from-path.txt');
      expect(result.sizeBytes).toBe(Buffer.byteLength('Temporary disk file content'));
      expect(fs.existsSync(tempPath)).toBe(false); // Cleaned up
    });

    it('should upload from a ReadableStream source', async () => {
      let receivedBody = '';
      mockHandler = (req, res) => {
        req.on('data', (c) => (receivedBody += c));
        req.on('end', () => {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ HttpCode: 201, Message: 'Stream uploaded.' }));
        });
      };

      const provider = createMockProvider();
      const stream = Readable.from(['Chunk 1 ', 'Chunk 2']);
      const result = await provider.saveFile('stream-file.txt', stream, {
        mimeType: 'text/plain',
        sizeBytes: 15,
      });

      expect(result.storageKey).toBe('stream-file.txt');
      expect(receivedBody).toBe('Chunk 1 Chunk 2');
    });
  });

  describe('Download (getFileStream)', () => {
    it('should send HTTP GET with AccessKey and return readable stream of file bytes', async () => {
      let receivedMethod;
      let receivedPath;
      let receivedAccessKey;

      mockHandler = (req, res) => {
        receivedMethod = req.method;
        receivedPath = req.url;
        receivedAccessKey = req.headers['accesskey'];

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '16',
        });
        res.end('Bunny Stream 123');
      };

      const provider = createMockProvider();
      const stream = await provider.getFileStream('download-test.bin');

      expect(receivedMethod).toBe('GET');
      expect(receivedPath).toBe('/test-zone/download-test.bin');
      expect(receivedAccessKey).toBe('test-secret-key-123');

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(Buffer.concat(chunks).toString()).toBe('Bunny Stream 123');
    });

    it('should throw File does not exist in storage when file returns 404', async () => {
      mockHandler = (req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 404, Message: 'Object not found' }));
      };

      const provider = createMockProvider();
      await expect(provider.getFileStream('missing.png')).rejects.toThrow(
        'File does not exist in storage'
      );
    });
  });

  describe('Delete (deleteFile)', () => {
    it('should send HTTP DELETE with AccessKey and return true on 200 OK', async () => {
      let receivedMethod;
      let receivedPath;
      let receivedAccessKey;

      mockHandler = (req, res) => {
        receivedMethod = req.method;
        receivedPath = req.url;
        receivedAccessKey = req.headers['accesskey'];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 200, Message: 'File deleted.' }));
      };

      const provider = createMockProvider();
      const deleted = await provider.deleteFile('delete-me.txt');

      expect(receivedMethod).toBe('DELETE');
      expect(receivedPath).toBe('/test-zone/delete-me.txt');
      expect(receivedAccessKey).toBe('test-secret-key-123');
      expect(deleted).toBe(true);
    });

    it('should handle already-missing remote object (404) safely as successful deletion', async () => {
      mockHandler = (req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 404, Message: 'File not found.' }));
      };

      const provider = createMockProvider();
      const deleted = await provider.deleteFile('already-deleted.txt');
      expect(deleted).toBe(true);
    });
  });

  describe('File Exists & Stats (fileExists & getFileStats)', () => {
    it('should return true when fileExists gets 200 via HEAD request', async () => {
      let receivedMethod;
      mockHandler = (req, res) => {
        receivedMethod = req.method;
        res.writeHead(200, {
          'Content-Length': '1024',
          'Content-Type': 'image/jpeg',
          'Last-Modified': 'Sun, 11 Oct 2026 12:00:00 GMT',
        });
        res.end();
      };

      const provider = createMockProvider();
      const exists = await provider.fileExists('profile.jpg');
      expect(receivedMethod).toBe('HEAD');
      expect(exists).toBe(true);
    });

    it('should return false when fileExists gets 404 via HEAD request', async () => {
      mockHandler = (req, res) => {
        res.writeHead(404);
        res.end();
      };

      const provider = createMockProvider();
      const exists = await provider.fileExists('missing.jpg');
      expect(exists).toBe(false);
    });

    it('should return file metadata object in getFileStats on 200', async () => {
      mockHandler = (req, res) => {
        res.writeHead(200, {
          'Content-Length': '52428',
          'Content-Type': 'application/pdf',
          'Last-Modified': 'Sun, 11 Oct 2026 12:00:00 GMT',
        });
        res.end();
      };

      const provider = createMockProvider();
      const stats = await provider.getFileStats('document.pdf');
      expect(stats.size).toBe(52428);
      expect(stats.contentType).toBe('application/pdf');
      expect(stats.lastModified).toBeInstanceOf(Date);
    });

    it('should throw File does not exist in storage when getFileStats gets 404', async () => {
      mockHandler = (req, res) => {
        res.writeHead(404);
        res.end();
      };

      const provider = createMockProvider();
      await expect(provider.getFileStats('missing.pdf')).rejects.toThrow(
        'File does not exist in storage'
      );
    });
  });

  describe('Error Handling & Security Protections', () => {
    it('should throw unauthorized error on 401 response without leaking access key', async () => {
      mockHandler = (req, res) => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 401, Message: 'Unauthorized' }));
      };

      const provider = createMockProvider();
      await expect(provider.saveFile('test.bin', Buffer.from('data'))).rejects.toThrow(
        /Unauthorized: Invalid Bunny Storage credentials/
      );
    });

    it('should handle 429 rate limit exceeded response safely', async () => {
      mockHandler = (req, res) => {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 429, Message: 'Too many requests' }));
      };

      const provider = createMockProvider();
      await expect(provider.saveFile('test.bin', Buffer.from('data'))).rejects.toThrow(
        /rate limit exceeded/i
      );
    });

    it('should throw server error on 500 response safely', async () => {
      mockHandler = (req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ HttpCode: 500, Message: 'Internal Storage Error' }));
      };

      const provider = createMockProvider();
      await expect(provider.saveFile('test.bin', Buffer.from('data'))).rejects.toThrow(
        /HTTP 500/
      );
    });

    it('should abort and reject when network timeout occurs', async () => {
      mockHandler = (_req, _res) => {
        // Deliberately hold connection open without responding
      };

      const provider = createMockProvider({ timeoutMs: 150 });
      await expect(provider.saveFile('timeout.bin', Buffer.from('data'))).rejects.toThrow(
        /timed out after 150ms/
      );
    });
  });
});
