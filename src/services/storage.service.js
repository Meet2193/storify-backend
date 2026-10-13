const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const User = require('../models/user.model');
const File = require('../models/file.model');
const storageProvider = require('../storage');
const ApiError = require('../utils/apiError');
const { FILE_STATUS } = require('../constants');

/**
 * Format bytes into human-readable string
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

class StorageService {
  constructor(provider = storageProvider) {
    this.provider = provider;
  }

  /**
   * Get active storage provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Set active storage provider (supports dynamic injection / testing)
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Get authenticated user storage summary
   */
  async getStorageSummary(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const usedBytes = user.storage?.usedBytes || 0;
    const allocatedBytes = user.storage?.allocatedBytes || 0;
    const remainingBytes = Math.max(0, allocatedBytes - usedBytes);
    const usagePercentage = allocatedBytes > 0
      ? Math.min(100, parseFloat(((usedBytes / allocatedBytes) * 100).toFixed(2)))
      : 0;

    return {
      plan: user.plan,
      usedBytes,
      allocatedBytes,
      remainingBytes,
      usagePercentage,
      usedFormatted: formatBytes(usedBytes),
      allocatedFormatted: formatBytes(allocatedBytes),
      remainingFormatted: formatBytes(remainingBytes),
    };
  }

  /**
   * Upload and process a file for the authenticated user
   */
  async uploadFile(userId, file) {
    if (!file) {
      throw ApiError.badRequest('No file provided for upload.');
    }

    const fileSize = file.size;
    const tempFilePath = file.path;

    // 1. Check user and current quota availability
    const user = await User.findById(userId);
    if (!user) {
      this.cleanupTempFile(tempFilePath);
      throw ApiError.notFound('User not found.');
    }

    const currentUsed = user.storage?.usedBytes || 0;
    const allocated = user.storage?.allocatedBytes || 0;

    if (currentUsed + fileSize > allocated) {
      this.cleanupTempFile(tempFilePath);
      throw ApiError.badRequest(
        'Storage quota exceeded. Insufficient space to complete this upload.'
      );
    }

    // 2. Atomic quota reservation to prevent race conditions during concurrent uploads
    const reservedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        $expr: {
          $lte: [{ $add: ['$storage.usedBytes', fileSize] }, '$storage.allocatedBytes'],
        },
      },
      { $inc: { 'storage.usedBytes': fileSize } },
      { new: true }
    );

    if (!reservedUser) {
      this.cleanupTempFile(tempFilePath);
      throw ApiError.badRequest(
        'Storage quota exceeded. Concurrent upload pushed storage beyond limit.'
      );
    }

    // 3. Generate unique, unguessable storage key (path traversal immune)
    const rawExt = path.extname(file.originalname).toLowerCase();
    const cleanExt = rawExt.replace(/[^a-z0-9]/g, '');
    const storageKey = `${crypto.randomUUID()}${cleanExt ? `.${cleanExt}` : ''}`;

    // 4. Save physical file via StorageProvider abstraction
    try {
      await this.provider.saveFile(storageKey, tempFilePath);
    } catch (storageError) {
      // Rollback reservation and clean up temp file
      await this.rollbackQuotaReservation(userId, fileSize);
      this.cleanupTempFile(tempFilePath);
      throw ApiError.internal(`Storage failure: ${storageError.message}`);
    }

    // 5. Create database record
    let fileDoc;
    try {
      fileDoc = await File.create({
        userId,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: fileSize,
        extension: cleanExt,
        status: FILE_STATUS.ACTIVE,
      });
    } catch (dbError) {
      // Rollback physical file and quota reservation if DB creation fails
      await this.provider.deleteFile(storageKey);
      await this.rollbackQuotaReservation(userId, fileSize);
      this.cleanupTempFile(tempFilePath);
      throw dbError;
    }

    // 6. Ensure temporary file is cleaned up
    this.cleanupTempFile(tempFilePath);

    return fileDoc;
  }

  /**
   * List files belonging strictly to the authenticated user
   */
  async listFiles(userId, { page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      userId,
      status: FILE_STATUS.ACTIVE,
    };

    const [total, files] = await Promise.all([
      File.countDocuments(query),
      File.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      files,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  /**
   * Retrieve metadata for a single file belonging to user
   */
  async getFileDetails(userId, fileId) {
    const file = await File.findOne({
      _id: fileId,
      userId,
      status: FILE_STATUS.ACTIVE,
    });

    if (!file) {
      throw ApiError.notFound('File not found or access denied.');
    }

    return file;
  }

  /**
   * Get file stream for download / access
   */
  async accessFile(userId, fileId) {
    const file = await this.getFileDetails(userId, fileId);

    const exists = await this.provider.fileExists(file.storageKey);
    if (!exists) {
      throw ApiError.notFound('File content not found in physical storage.');
    }

    const stream = await this.provider.getFileStream(file.storageKey);
    return {
      file,
      stream,
    };
  }

  /**
   * Delete file and reclaim allocated storage
   */
  async deleteFile(userId, fileId) {
    const file = await File.findOne({
      _id: fileId,
      userId,
      status: FILE_STATUS.ACTIVE,
    });

    if (!file) {
      throw ApiError.notFound('File not found or access denied.');
    }

    // 1. Delete physical file via storage provider (protect against remote failures)
    try {
      await this.provider.deleteFile(file.storageKey);
    } catch (storageErr) {
      throw ApiError.internal(`Storage deletion failure: ${storageErr.message}`);
    }

    // 2. Delete DB record
    await File.deleteOne({ _id: file._id });

    // 3. Atomically reclaim user storage usedBytes (safeguarded against negative numbers)
    await this.reclaimUserStorage(userId, file.sizeBytes);

    return { message: 'File deleted successfully.' };
  }

  /**
   * Helper to clean up temporary upload file from disk
   */
  cleanupTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_e) {}
    }
  }

  /**
   * Rollback reserved quota on failure
   */
  async rollbackQuotaReservation(userId, sizeBytes) {
    await this.reclaimUserStorage(userId, sizeBytes);
  }

  /**
   * Safely decrement user used storage without allowing negative values
   */
  async reclaimUserStorage(userId, sizeBytes) {
    if (!sizeBytes || sizeBytes <= 0) return;

    // Atomically decrement if current usedBytes is greater than or equal to sizeBytes
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        'storage.usedBytes': { $gte: sizeBytes },
      },
      {
        $inc: { 'storage.usedBytes': -sizeBytes },
      },
      { new: true }
    );

    // If usedBytes was already less than sizeBytes, safely clamp to 0
    if (!updated) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'storage.usedBytes': 0 },
      });
    }
  }
}

module.exports = new StorageService();
