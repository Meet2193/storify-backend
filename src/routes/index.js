const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const healthRoutes = require('./health.routes');
const storageRoutes = require('./storage.routes');
const planRoutes = require('./plan.routes');
const purchaseRoutes = require('./purchase.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/storage', storageRoutes);
router.use('/plans', planRoutes);
router.use('/purchases', purchaseRoutes);

module.exports = router;
