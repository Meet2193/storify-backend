const { param } = require('express-validator');

const planIdValidator = [
  param('planId')
    .trim()
    .notEmpty()
    .withMessage('Plan ID is required')
    .isMongoId()
    .withMessage('Invalid plan ID format'),
];

module.exports = {
  planIdValidator,
};
