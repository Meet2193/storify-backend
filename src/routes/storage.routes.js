const express = require('express');
const storageController = require('../controllers/storage.controller');
const authenticate = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { handleSingleUpload } = require('../middlewares/upload.middleware');
const {
  fileIdValidator,
  paginationValidator,
} = require('../validators/storage.validator');

const router = express.Router();

// All storage routes strictly require authentication
router.use(authenticate);

// Storage quota summary
router.get('/', storageController.getStorage);

// File operations
router.post('/files', handleSingleUpload('file'), storageController.uploadFile);
router.get('/files', paginationValidator, validate, storageController.listFiles);
router.get('/files/:fileId', fileIdValidator, validate, storageController.getFileDetails);
router.get('/files/:fileId/access', fileIdValidator, validate, storageController.accessFile);
router.delete('/files/:fileId', fileIdValidator, validate, storageController.deleteFile);

module.exports = router;
