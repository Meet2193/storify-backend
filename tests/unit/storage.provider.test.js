const path = require('path');
const fs = require('fs');
const os = require('os');
const LocalStorageProvider = require('../../src/storage/local.storage.provider');

describe('LocalStorageProvider Unit Tests', () => {
  let testUploadDir;
  let provider;

  beforeAll(() => {
    testUploadDir = path.join(os.tmpdir(), `storify_provider_test_${Date.now()}`);
    provider = new LocalStorageProvider(testUploadDir);
  });

  afterAll(async () => {
    if (fs.existsSync(testUploadDir)) {
      await fs.promises.rm(testUploadDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('should save a file from Buffer successfully', async () => {
    const key = 'test-file-1.txt';
    const content = Buffer.from('Hello Storify Unit Test');

    const result = await provider.saveFile(key, content);
    expect(result.storageKey).toBe(key);
    expect(result.sizeBytes).toBe(content.length);

    const exists = await provider.fileExists(key);
    expect(exists).toBe(true);
  });

  it('should stream an existing file correctly', async () => {
    const key = 'test-stream.txt';
    const content = Buffer.from('Streamable Content');
    await provider.saveFile(key, content);

    const stream = await provider.getFileStream(key);
    expect(stream).toBeDefined();

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const readContent = Buffer.concat(chunks).toString();
    expect(readContent).toBe('Streamable Content');
  });

  it('should delete a file from storage', async () => {
    const key = 'test-delete.txt';
    await provider.saveFile(key, Buffer.from('To be deleted'));

    expect(await provider.fileExists(key)).toBe(true);
    await provider.deleteFile(key);
    expect(await provider.fileExists(key)).toBe(false);
  });

  it('should prevent path traversal attacks', () => {
    expect(() => {
      provider.resolvePath('../../../../../etc/passwd');
    }).not.toThrow(); // path.basename strips directory structure, resolving safely to uploadDir/passwd

    const resolved = provider.resolvePath('../../../../../etc/passwd');
    expect(resolved.startsWith(provider.uploadDir)).toBe(true);
    expect(path.basename(resolved)).toBe('passwd');
  });

  it('should throw when getting stream of non-existent file', async () => {
    await expect(provider.getFileStream('non-existent-key.txt')).rejects.toThrow();
  });
});
