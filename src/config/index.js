const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  env: process.env.APP_ENV_M || process.env.NODE_ENV || 'development',
  isProduction: (process.env.APP_ENV_M || process.env.NODE_ENV) === 'production',
  isTest: (process.env.APP_ENV_M || process.env.NODE_ENV) === 'test',
  
  server: {
    port: parseInt(process.env.APP_SRV_P || process.env.PORT || '3000', 10),
  },

  db: {
    uri: process.env.APP_DB_U || process.env.MONGODB_URI || 'mongodb://localhost:27017/storify',
  },

  jwt: {
    secret: process.env.APP_AUTH_S || process.env.JWT_SECRET || 'storify_default_dev_secret_key_change_in_production',
    expiresIn: process.env.APP_AUTH_E || process.env.JWT_EXPIRES_IN || '24h',
  },

  security: {
    corsOrigin: process.env.APP_SEC_O || process.env.CORS_ORIGIN || '*',
  },

  storage: {
    provider: (process.env.APP_STG_DRIVER || process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim(),
    uploadDir: process.env.APP_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
    tempDir: path.resolve(process.env.APP_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'), 'temp'),
    maxFileSizeBytes: parseInt(process.env.APP_MAX_FILE_SIZE || String(50 * 1024 * 1024), 10),
    bunny: {
      zoneName: process.env.APP_STG_ZN || process.env.BUNNY_STORAGE_ZONE_NAME || '',
      accessKey: process.env.APP_STG_AK || process.env.BUNNY_STORAGE_ACCESS_KEY || '',
      region: process.env.APP_STG_REG || process.env.BUNNY_STORAGE_REGION || 'de',
      cdnUrl: process.env.APP_STG_CDN || process.env.BUNNY_CDN_URL || '',
      timeoutMs: parseInt(process.env.APP_STG_TIMEOUT || process.env.BUNNY_STORAGE_TIMEOUT || '30000', 10),
    },
  },

  appSettings: {
    // Neutral configuration placeholders for business logic / storage caps / rate limits
    val1: parseInt(process.env.APP_VAL_1 || '50', 10),
    val2: process.env.APP_VAL_2 === 'true',
    val3: parseInt(process.env.APP_VAL_3 || '300', 10),
  },
};

module.exports = config;
