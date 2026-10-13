const { body, param, query } = require('express-validator');

const createPurchaseValidator = [
  body('planId')
    .trim()
    .notEmpty()
    .withMessage('Plan ID is required')
    .isMongoId()
    .withMessage('Invalid plan ID format'),
];

const purchaseIdValidator = [
  param('purchaseId')
    .trim()
    .notEmpty()
    .withMessage('Purchase ID is required')
    .isMongoId()
    .withMessage('Invalid purchase ID format'),
];

const purchasePaginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer (minimum 1)'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
];

module.exports = {
  createPurchaseValidator,
  purchaseIdValidator,
  purchasePaginationValidator,
};
