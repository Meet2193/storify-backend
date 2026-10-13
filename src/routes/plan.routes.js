const express = require('express');
const planController = require('../controllers/plan.controller');
const authenticate = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { planIdValidator } = require('../validators/plan.validator');

const router = express.Router();

// Public authenticated plan catalog
router.use(authenticate);

router.get('/', planController.getPlans);
router.get('/:planId', planIdValidator, validate, planController.getPlanById);

module.exports = router;
