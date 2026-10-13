const { createStorageProvider } = require('../../src/storage');
const LocalStorageProvider = require('../../src/storage/local.storage.provider');
const BunnyStorageProvider = require('../../src/storage/bunny.storage.provider');

describe('Storage Provider Factory Unit Tests', () => {
  it('should select LocalStorageProvider when driver is local', () => {
    const provider = createStorageProvider('local', {
      uploadDir: 'custom/uploads',
    });
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it('should verify local provider remains fully functional', async () => {
    const provider = createStorageProvider('local', {
      uploadDir: 'uploads',
    });
    expect(typeof provider.saveFile).toBe('function');
    expect(typeof provider.getFileStream).toBe('function');
    expect(typeof provider.deleteFile).toBe('function');
    expect(typeof provider.fileExists).toBe('function');
    expect(typeof provider.getFileStats).toBe('function');
  });

  it('should select BunnyStorageProvider when driver is bunny with valid configuration', () => {
    const provider = createStorageProvider('bunny', {
      bunny: {
        zoneName: 'my-prod-zone',
        accessKey: 'secret-key-456',
        region: 'ny',
      },
    });
    expect(provider).toBeInstanceOf(BunnyStorageProvider);
    expect(provider.zoneName).toBe('my-prod-zone');
    expect(provider.hostname).toBe('ny.storage.bunnycdn.com');
  });

  it('should throw configuration error when bunny is selected but zoneName is missing', () => {
    expect(() => {
      createStorageProvider('bunny', {
        bunny: {
          zoneName: '',
          accessKey: 'valid-key',
        },
      });
    }).toThrow(/Bunny storage provider selected, but required credentials .* are missing/);
  });

  it('should throw configuration error when bunny is selected but accessKey is missing', () => {
    expect(() => {
      createStorageProvider('bunny', {
        bunny: {
          zoneName: 'my-zone',
          accessKey: '',
        },
      });
    }).toThrow(/Bunny storage provider selected, but required credentials .* are missing/);
  });

  it('should NOT silently fall back to local storage when bunny configuration is invalid', () => {
    expect(() => {
      createStorageProvider('bunny', {
        bunny: {},
      });
    }).toThrow();
  });

  it('should throw configuration error when an unsupported provider is requested', () => {
    expect(() => {
      createStorageProvider('s3');
    }).toThrow(/Unsupported storage provider 's3'/);
  });
});
