const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  updateProfileValidator,
  changePasswordValidator,
} = require('../validators/user.validator');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

router.get('/me', userController.getProfile);
router.patch('/me', updateProfileValidator, validate, userController.updateProfile);
router.put('/me/password', changePasswordValidator, validate, userController.changePassword);
router.patch('/me/password', changePasswordValidator, validate, userController.changePassword);
router.get('/me/storage', userController.getStorageSummary);

module.exports = router;
