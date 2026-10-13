const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const { ALLOWED_MIME_TYPES } = require('../constants');
const ApiError = require('../utils/apiError');

// Ensure temporary upload directory exists
if (!fs.existsSync(config.storage.tempDir)) {
  fs.mkdirSync(config.storage.tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.storage.tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `tmp_${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `File type '${file.mimetype}' is not supported. Please upload an accepted file format.`
      )
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxFileSizeBytes,
    files: 1,
  },
  fileFilter,
});

/**
 * Single file upload middleware with structured error handling
 */
const handleSingleUpload = (fieldName = 'file') => {
  const uploadSingle = upload.single(fieldName);

  return (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        // Ensure any partially written or temporary file is immediately removed
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_e) {}
        }
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMB = (config.storage.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
            return next(
              ApiError.badRequest(`File size exceeds maximum allowed limit of ${maxMB} MB.`)
            );
          }
          return next(ApiError.badRequest(`Upload error: ${err.message}`));
        }
        return next(err);
      }
      next();
    });
  };
};

module.exports = {
  upload,
  handleSingleUpload,
};
