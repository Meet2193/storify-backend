const config = require('../config');
const LocalStorageProvider = require('./local.storage.provider');
const BunnyStorageProvider = require('./bunny.storage.provider');

/**
 * Storage Provider Factory
 * Instantiates the active storage provider based on centralized configuration.
 *
 * @param {string} [driver] - Provider name ('local' or 'bunny')
 * @param {Object} [storageConfig] - Storage configuration options
 * @returns {LocalStorageProvider|BunnyStorageProvider}
 */
function createStorageProvider(driver = config.storage.provider, storageConfig = config.storage) {
  const selectedDriver = (driver || 'local').toLowerCase().trim();

  if (selectedDriver === 'local') {
    return new LocalStorageProvider(storageConfig.uploadDir);
  }

  if (selectedDriver === 'bunny') {
    const bunnyConfig = storageConfig.bunny || {};
    if (!bunnyConfig.zoneName || !bunnyConfig.accessKey) {
      throw new Error(
        'Storage Configuration Error: Bunny storage provider selected, but required credentials (APP_STG_ZN or APP_STG_AK) are missing.'
      );
    }

    return new BunnyStorageProvider({
      zoneName: bunnyConfig.zoneName,
      accessKey: bunnyConfig.accessKey,
      region: bunnyConfig.region,
      cdnUrl: bunnyConfig.cdnUrl,
      timeoutMs: bunnyConfig.timeoutMs,
    });
  }

  throw new Error(
    `Storage Configuration Error: Unsupported storage provider '${selectedDriver}'. Supported providers are: 'local', 'bunny'.`
  );
}

// Active singleton storage provider instance
const storageProvider = createStorageProvider();
storageProvider.createStorageProvider = createStorageProvider;

module.exports = storageProvider;
