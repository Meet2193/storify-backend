/**
 * Storage Provider Base Interface / Contract
 * Ensures controllers and services remain decoupled from physical storage technology.
 */
class StorageProvider {
  /**
   * Save or upload a file to storage
   * @param {string} storageKey - Unique internal identifier for the file
   * @param {string|Buffer|ReadableStream} fileSource - Local file path, Buffer, or stream
   * @param {Object} [options] - Optional metadata or upload settings
   * @returns {Promise<Object>} Storage save result
   */
  async saveFile(_storageKey, _fileSource, _options = {}) {
    throw new Error('Method saveFile() must be implemented by storage provider');
  }

  /**
   * Retrieve readable stream of the file
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<ReadableStream>} Readable file stream
   */
  async getFileStream(_storageKey) {
    throw new Error('Method getFileStream() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<boolean>} True if deleted or did not exist
   */
  async deleteFile(_storageKey) {
    throw new Error('Method deleteFile() must be implemented by storage provider');
  }

  /**
   * Check if a file exists in storage
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<boolean>}
   */
  async fileExists(_storageKey) {
    throw new Error('Method fileExists() must be implemented by storage provider');
  }

  /**
   * Get file stats/metadata from storage
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<Object>}
   */
  async getFileStats(_storageKey) {
    throw new Error('Method getFileStats() must be implemented by storage provider');
  }
}

module.exports = StorageProvider;
