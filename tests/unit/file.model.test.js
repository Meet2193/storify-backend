const mongoose = require('mongoose');
const File = require('../../src/models/file.model');
const { FILE_STATUS } = require('../../src/constants');

describe('File Model Unit Tests', () => {
  const validFilePayload = {
    userId: new mongoose.Types.ObjectId(),
    originalName: 'document.pdf',
    storageKey: 'unique-storage-key-12345.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024,
    extension: 'pdf',
  };

  it('should validate a valid file model successfully', async () => {
    const file = new File(validFilePayload);
    let validationError;
    try {
      await file.validate();
    } catch (e) {
      validationError = e;
    }
    expect(validationError).toBeUndefined();
    expect(file.status).toBe(FILE_STATUS.ACTIVE);
    expect(file.extension).toBe('pdf');
  });

  it('should fail validation when required fields are missing', async () => {
    const fileMissingProps = new File({});
    await expect(fileMissingProps.validate()).rejects.toThrow();
  });

  it('should fail validation when sizeBytes is negative', async () => {
    const fileNegativeSize = new File({
      ...validFilePayload,
      sizeBytes: -100,
    });
    await expect(fileNegativeSize.validate()).rejects.toThrow();
  });

  it('should strip __v in toJSON', () => {
    const file = new File(validFilePayload);
    const json = file.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.originalName).toBe('document.pdf');
  });
});
