const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
} = require('../validators/auth.validator');

const router = express.Router();

// Public routes
router.post('/register', registerValidator, validate, authController.register);
router.post('/login', loginValidator, validate, authController.login);
router.post('/forgot-password', forgotPasswordValidator, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, authController.resetPassword);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, changePasswordValidator, validate, authController.changePassword);
router.patch('/change-password', authenticate, changePasswordValidator, validate, authController.changePassword);
router.put('/password', authenticate, changePasswordValidator, validate, authController.changePassword);
router.patch('/password', authenticate, changePasswordValidator, validate, authController.changePassword);

module.exports = router;
