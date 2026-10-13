const storageService = require('../services/storage.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get authenticated user's storage quota and usage summary
 * GET /api/v1/storage
 */
const getStorage = asyncHandler(async (req, res) => {
  const summary = await storageService.getStorageSummary(req.user._id);
  return ApiResponse.success(res, summary, 'Storage summary retrieved successfully');
});

/**
 * Upload a file for the authenticated user
 * POST /api/v1/storage/files
 */
const uploadFile = asyncHandler(async (req, res) => {
  const file = await storageService.uploadFile(req.user._id, req.file);
  return ApiResponse.created(res, file, 'File uploaded successfully');
});

/**
 * List files belonging to the authenticated user
 * GET /api/v1/storage/files
 */
const listFiles = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await storageService.listFiles(req.user._id, { page, limit });
  return ApiResponse.success(res, result, 'Files retrieved successfully');
});

/**
 * Get metadata for one file belonging to user
 * GET /api/v1/storage/files/:fileId
 */
const getFileDetails = asyncHandler(async (req, res) => {
  const file = await storageService.getFileDetails(req.user._id, req.params.fileId);
  return ApiResponse.success(res, file, 'File details retrieved successfully');
});

/**
 * Access or download a file stream
 * GET /api/v1/storage/files/:fileId/access
 */
const accessFile = asyncHandler(async (req, res) => {
  const { file, stream } = await storageService.accessFile(req.user._id, req.params.fileId);

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');

  // Use upstream stream content-length if available, otherwise file metadata sizeBytes
  const rawLength = stream.headers?.['content-length'] ?? file.sizeBytes;
  const contentLength = parseInt(rawLength, 10);
  if (Number.isInteger(contentLength) && contentLength >= 0) {
    res.setHeader('Content-Length', contentLength);
  }

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.originalName)}"`
  );

  req.on('close', () => {
    if (stream && typeof stream.destroy === 'function' && !stream.destroyed) {
      stream.destroy();
    }
  });

  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error streaming file' });
    } else {
      res.destroy(err);
    }
  });

  stream.pipe(res);
});

/**
 * Delete a file and reclaim storage
 * DELETE /api/v1/storage/files/:fileId
 */
const deleteFile = asyncHandler(async (req, res) => {
  const result = await storageService.deleteFile(req.user._id, req.params.fileId);
  return ApiResponse.success(res, null, result.message);
});

module.exports = {
  getStorage,
  uploadFile,
  listFiles,
  getFileDetails,
  accessFile,
  deleteFile,
};
