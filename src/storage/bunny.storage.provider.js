const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const StorageProvider = require('./storage.provider');

/**
 * Regional hostname mapping for Bunny.net Storage API
 * Reference: https://docs.bunny.net/reference/storage-api
 */
const REGION_HOSTNAMES = {
  de: 'storage.bunnycdn.com',
  frankfurt: 'storage.bunnycdn.com',
  falkenstein: 'storage.bunnycdn.com',
  default: 'storage.bunnycdn.com',
  uk: 'uk.storage.bunnycdn.com',
  lon: 'uk.storage.bunnycdn.com',
  london: 'uk.storage.bunnycdn.com',
  ny: 'ny.storage.bunnycdn.com',
  'us-east': 'ny.storage.bunnycdn.com',
  la: 'la.storage.bunnycdn.com',
  'us-west': 'la.storage.bunnycdn.com',
  sg: 'sg.storage.bunnycdn.com',
  singapore: 'sg.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com',
  sydney: 'syd.storage.bunnycdn.com',
  oceania: 'syd.storage.bunnycdn.com',
  se: 'se.storage.bunnycdn.com',
  stockholm: 'se.storage.bunnycdn.com',
  br: 'br.storage.bunnycdn.com',
  saopaulo: 'br.storage.bunnycdn.com',
  jh: 'jh.storage.bunnycdn.com',
  johannesburg: 'jh.storage.bunnycdn.com',
};

class BunnyStorageProvider extends StorageProvider {
  /**
   * @param {Object} options
   * @param {string} options.zoneName - Storage Zone Name (required)
   * @param {string} options.accessKey - Storage Zone Password / API Access Key (required)
   * @param {string} [options.region='de'] - Regional identifier or custom hostname
   * @param {string} [options.cdnUrl] - Optional CDN base URL
   * @param {number} [options.timeoutMs=30000] - Request timeout in milliseconds
   * @param {string} [options.protocol] - Optional protocol override ('https:' or 'http:')
   */
  constructor(options = {}) {
    super();

    if (!options.zoneName || typeof options.zoneName !== 'string' || !options.zoneName.trim()) {
      throw new Error('Storage Configuration Error: Bunny storage zoneName is required.');
    }
    if (!options.accessKey || typeof options.accessKey !== 'string' || !options.accessKey.trim()) {
      throw new Error('Storage Configuration Error: Bunny storage accessKey is required.');
    }

    this.zoneName = options.zoneName.trim();
    this.accessKey = options.accessKey.trim();
    this.region = (options.region || 'de').trim();
    this.hostname = this.resolveHostname(this.region);
    this.cdnUrl = options.cdnUrl ? options.cdnUrl.trim() : null;
    this.timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 30000;

    // Detect protocol (default to https: unless explicitly set or testing on localhost)
    if (options.protocol) {
      this.protocol = options.protocol.endsWith(':') ? options.protocol : `${options.protocol}:`;
    } else if (this.hostname.includes('localhost') || this.hostname.includes('127.0.0.1')) {
      this.protocol = 'http:';
    } else {
      this.protocol = 'https:';
    }
  }

  /**
   * Resolve region code or custom host to official Bunny storage API hostname
   */
  resolveHostname(regionOrHost) {
    if (!regionOrHost) return 'storage.bunnycdn.com';

    let cleaned = regionOrHost.toLowerCase().trim();
    // Strip any protocol if mistakenly supplied
    if (cleaned.startsWith('https://')) cleaned = cleaned.slice(8);
    if (cleaned.startsWith('http://')) cleaned = cleaned.slice(7);
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);

    // If known region code, return mapped hostname
    if (REGION_HOSTNAMES[cleaned]) {
      return REGION_HOSTNAMES[cleaned];
    }

    // If already contains domain or port (e.g. ny.storage.bunnycdn.com, custom.domain, localhost:8080)
    if (cleaned.includes('.') || cleaned.includes(':')) {
      return cleaned;
    }

    // Fallback: format as regional endpoint
    return `${cleaned}.storage.bunnycdn.com`;
  }

  /**
   * Resolve and sanitize storageKey to prevent path traversal or remote path manipulation
   */
  resolveStorageKey(storageKey) {
    if (!storageKey || typeof storageKey !== 'string') {
      throw new Error('Security Error: Invalid storage key provided');
    }

    // Strip directory traversal sequences and extract filename only
    const safeKey = path.basename(storageKey.trim());
    if (!safeKey || safeKey === '.' || safeKey === '..' || safeKey.includes('/') || safeKey.includes('\\')) {
      throw new Error('Security Error: Malformed storage key detected');
    }

    return safeKey;
  }

  /**
   * Build request options for Bunny API HTTP call
   */
  buildRequestOptions(method, safeKey, customHeaders = {}) {
    const encodedZone = encodeURIComponent(this.zoneName);
    const encodedKey = encodeURIComponent(safeKey);
    const requestPath = `/${encodedZone}/${encodedKey}`;

    const hostParts = this.hostname.split(':');
    const hostname = hostParts[0];
    const port = hostParts[1] ? parseInt(hostParts[1], 10) : (this.protocol === 'http:' ? 80 : 443);

    return {
      method,
      hostname,
      port,
      path: requestPath,
      headers: {
        AccessKey: this.accessKey,
        ...customHeaders,
      },
      timeout: this.timeoutMs,
    };
  }

  /**
   * Select transport module (http or https)
   */
  getTransport() {
    return this.protocol === 'http:' ? http : https;
  }

  /**
   * Save a file to Bunny Storage via HTTP PUT
   * @param {string} storageKey - Unique internal identifier
   * @param {string|Buffer|ReadableStream} fileSource - Local file path, Buffer, or stream
   * @param {Object} [options] - Optional metadata (e.g., mimeType, sizeBytes)
   * @returns {Promise<Object>} Save result
   */
  async saveFile(storageKey, fileSource, options = {}) {
    const safeKey = this.resolveStorageKey(storageKey);

    let dataStream;
    let sizeBytes;
    let tempFilePathToCleanup = null;

    if (typeof fileSource === 'string') {
      const stats = await fs.promises.stat(fileSource);
      sizeBytes = stats.size;
      dataStream = fs.createReadStream(fileSource);
      tempFilePathToCleanup = fileSource;
    } else if (Buffer.isBuffer(fileSource)) {
      sizeBytes = fileSource.length;
      dataStream = fileSource;
    } else if (fileSource && typeof fileSource.pipe === 'function') {
      dataStream = fileSource;
      sizeBytes = options.sizeBytes || null;
    } else {
      throw new Error('Unsupported file source format');
    }

    const headers = {
      'Content-Type': options.mimeType || 'application/octet-stream',
    };
    if (sizeBytes !== null && sizeBytes !== undefined) {
      headers['Content-Length'] = sizeBytes;
    }

    const reqOptions = this.buildRequestOptions('PUT', safeKey, headers);
    const transport = this.getTransport();

    try {
      await new Promise((resolve, reject) => {
        const req = transport.request(reqOptions, (res) => {
          let responseBody = '';
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve();
            } else if (res.statusCode === 401 || res.statusCode === 403) {
              reject(new Error('Unauthorized: Invalid Bunny Storage credentials.'));
            } else if (res.statusCode === 429) {
              reject(new Error('Bunny storage rate limit exceeded: HTTP 429.'));
            } else {
              let errorDetail = `HTTP ${res.statusCode}`;
              try {
                const parsed = JSON.parse(responseBody);
                if (parsed.Message) errorDetail += ` - ${parsed.Message}`;
              } catch (_e) {}
              reject(new Error(`Bunny storage upload failed: ${errorDetail}`));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy(new Error(`Bunny storage upload timed out after ${this.timeoutMs}ms.`));
        });

        req.on('error', (err) => {
          reject(err);
        });

        if (Buffer.isBuffer(dataStream)) {
          req.end(dataStream);
        } else {
          dataStream.pipe(req);
          dataStream.on('error', (streamErr) => {
            req.destroy(streamErr);
          });
        }
      });

      // Cleanup local source file if it was a temp file path (consistent with LocalStorageProvider)
      if (tempFilePathToCleanup && fs.existsSync(tempFilePathToCleanup)) {
        await fs.promises.unlink(tempFilePathToCleanup).catch(() => {});
      }

      return {
        storageKey: safeKey,
        sizeBytes,
        path: `/${this.zoneName}/${safeKey}`,
      };
    } catch (uploadError) {
      // Best-effort cleanup of any partial remote object on upload failure
      try {
        await this.deleteFile(safeKey);
      } catch (_cleanupErr) {}

      throw uploadError;
    }
  }

  /**
   * Retrieve readable stream of a file from Bunny Storage via HTTP GET
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<ReadableStream>}
   */
  async getFileStream(storageKey) {
    const safeKey = this.resolveStorageKey(storageKey);
    const reqOptions = this.buildRequestOptions('GET', safeKey);
    const transport = this.getTransport();

    return new Promise((resolve, reject) => {
      const req = transport.request(reqOptions, (res) => {
        if (res.statusCode === 200) {
          resolve(res);
        } else if (res.statusCode === 404) {
          res.resume();
          reject(new Error('File does not exist in storage'));
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          res.resume();
          reject(new Error('Unauthorized: Invalid Bunny Storage credentials.'));
        } else if (res.statusCode === 429) {
          res.resume();
          reject(new Error('Bunny storage rate limit exceeded: HTTP 429.'));
        } else {
          res.resume();
          reject(new Error(`Bunny storage download failed: HTTP ${res.statusCode}`));
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Bunny storage download timed out after ${this.timeoutMs}ms.`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Delete a file from Bunny Storage via HTTP DELETE
   * Handles already-missing objects (404) safely as successful deletion.
   * Throws on remote API errors (5xx/network) to protect database synchronization.
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<boolean>} True if deleted or already absent
   */
  async deleteFile(storageKey) {
    const safeKey = this.resolveStorageKey(storageKey);
    const reqOptions = this.buildRequestOptions('DELETE', safeKey);
    const transport = this.getTransport();

    return new Promise((resolve, reject) => {
      const req = transport.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 404) {
            // 200: Successfully removed
            // 404: Already absent from remote storage (safe idempotent completion)
            resolve(true);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error('Unauthorized: Invalid Bunny Storage credentials.'));
          } else if (res.statusCode === 429) {
            reject(new Error('Bunny storage rate limit exceeded: HTTP 429.'));
          } else {
            reject(new Error(`Bunny storage delete failed: HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Bunny storage delete timed out after ${this.timeoutMs}ms.`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Check if a file exists in Bunny Storage via HTTP HEAD
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<boolean>}
   */
  async fileExists(storageKey) {
    try {
      const safeKey = this.resolveStorageKey(storageKey);
      const reqOptions = this.buildRequestOptions('HEAD', safeKey);
      const transport = this.getTransport();

      return await new Promise((resolve, reject) => {
        const req = transport.request(reqOptions, (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve(true);
          } else if (res.statusCode === 404) {
            resolve(false);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error('Unauthorized: Invalid Bunny Storage credentials.'));
          } else {
            resolve(false);
          }
        });

        req.on('timeout', () => {
          req.destroy(new Error(`Bunny storage check timed out after ${this.timeoutMs}ms.`));
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });
    } catch (err) {
      if (err.message && err.message.includes('Unauthorized')) {
        throw err;
      }
      return false;
    }
  }

  /**
   * Get file metadata/stats from Bunny Storage via HTTP HEAD
   * @param {string} storageKey - Unique internal identifier
   * @returns {Promise<Object>}
   */
  async getFileStats(storageKey) {
    const safeKey = this.resolveStorageKey(storageKey);
    const reqOptions = this.buildRequestOptions('HEAD', safeKey);
    const transport = this.getTransport();

    return new Promise((resolve, reject) => {
      const req = transport.request(reqOptions, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve({
            size: parseInt(res.headers['content-length'] || '0', 10),
            contentType: res.headers['content-type'] || 'application/octet-stream',
            lastModified: res.headers['last-modified'] ? new Date(res.headers['last-modified']) : null,
            server: res.headers['server'] || null,
          });
        } else if (res.statusCode === 404) {
          reject(new Error('File does not exist in storage'));
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error('Unauthorized: Invalid Bunny Storage credentials.'));
        } else {
          reject(new Error(`Bunny storage metadata lookup failed: HTTP ${res.statusCode}`));
        }
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Bunny storage metadata lookup timed out after ${this.timeoutMs}ms.`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }
}

module.exports = BunnyStorageProvider;
