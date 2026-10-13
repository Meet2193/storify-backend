const fs = require('fs');
const path = require('path');
const StorageProvider = require('./storage.provider');

class LocalStorageProvider extends StorageProvider {
  /**
   * @param {string} uploadDir - Base directory where files will be stored
   */
  constructor(uploadDir) {
    super();
    this.uploadDir = path.resolve(uploadDir);
    this.ensureDirExists(this.uploadDir);
  }

  /**
   * Ensure directory exists
   */
  ensureDirExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Resolve and sanitize file path to prevent directory traversal
   */
  resolvePath(storageKey) {
    // Strip any path traversal sequences and keep only filename
    const safeKey = path.basename(storageKey);
    const resolvedPath = path.resolve(this.uploadDir, safeKey);

    // Verify resolved path is strictly within uploadDir
    if (!resolvedPath.startsWith(this.uploadDir)) {
      throw new Error('Security Error: Path traversal attempt detected');
    }

    return resolvedPath;
  }

  /**
   * Save a file to local storage
   */
  async saveFile(storageKey, fileSource) {
    const destPath = this.resolvePath(storageKey);

    if (typeof fileSource === 'string') {
      // Source is a temporary file path
      await fs.promises.copyFile(fileSource, destPath);
      // Clean up the source temporary file if distinct
      if (path.resolve(fileSource) !== destPath && fs.existsSync(fileSource)) {
        await fs.promises.unlink(fileSource).catch(() => {});
      }
    } else if (Buffer.isBuffer(fileSource)) {
      await fs.promises.writeFile(destPath, fileSource);
    } else if (fileSource && typeof fileSource.pipe === 'function') {
      // Source is a readable stream
      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(destPath);
        fileSource.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } else {
      throw new Error('Unsupported file source format');
    }

    const stats = await fs.promises.stat(destPath);
    return {
      storageKey,
      sizeBytes: stats.size,
      path: destPath,
    };
  }

  /**
   * Get readable stream for downloading / streaming
   */
  async getFileStream(storageKey) {
    const filePath = this.resolvePath(storageKey);
    const exists = await this.fileExists(storageKey);
    if (!exists) {
      throw new Error('File does not exist in storage');
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Delete a file from local storage
   */
  async deleteFile(storageKey) {
    try {
      const filePath = this.resolvePath(storageKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(storageKey) {
    try {
      const filePath = this.resolvePath(storageKey);
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(storageKey) {
    const filePath = this.resolvePath(storageKey);
    return fs.promises.stat(filePath);
  }
}

module.exports = LocalStorageProvider;
