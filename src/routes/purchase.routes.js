const express = require('express');
const purchaseController = require('../controllers/purchase.controller');
const authenticate = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createPurchaseValidator,
  purchaseIdValidator,
  purchasePaginationValidator,
} = require('../validators/purchase.validator');

const router = express.Router();

// All purchase routes strictly require authentication
router.use(authenticate);

router.post('/', createPurchaseValidator, validate, purchaseController.createPurchase);
router.get('/', purchasePaginationValidator, validate, purchaseController.getUserPurchases);
router.get('/:purchaseId', purchaseIdValidator, validate, purchaseController.getPurchaseById);

module.exports = router;
