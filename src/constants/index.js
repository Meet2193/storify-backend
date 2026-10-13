/**
 * Application Constants
 */

const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

const PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  PRO: 'pro',
};

// Storage defaults in bytes (50 MB free, 300 MB basic, 500 MB premium, 900 MB pro)
const DEFAULT_STORAGE = {
  FREE_BYTES: 50 * 1024 * 1024, // 50 MB (52,428,800 bytes)
  BASIC_BYTES: 300 * 1024 * 1024, // 300 MB (314,572,800 bytes)
  PREMIUM_BYTES: 500 * 1024 * 1024, // 500 MB (524,288,000 bytes)
  PRO_BYTES: 900 * 1024 * 1024, // 900 MB (943,718,400 bytes)
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

const FILE_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
};

// Centralized allowed MIME types across standard categories
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Audio & Video
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Compressed Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const PLAN_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const PURCHASE_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const ACQUISITION_SOURCE = {
  ORGANIC: 'organic',
  ADVERTISEMENT: 'advertisement',
};

const FILE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB max single file size
};

module.exports = {
  ROLES,
  USER_STATUS,
  PLANS,
  DEFAULT_STORAGE,
  HTTP_STATUS,
  FILE_STATUS,
  PLAN_STATUS,
  PURCHASE_STATUS,
  ACQUISITION_SOURCE,
  ALLOWED_MIME_TYPES,
  FILE_LIMITS,
};
