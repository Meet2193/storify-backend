const mongoose = require('mongoose');
const Plan = require('../models/plan.model');
const { PLAN_STATUS, DEFAULT_STORAGE } = require('../constants');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');

const INITIAL_PLANS = [
  {
    code: 'free',
    name: 'Free Plan',
    description: 'Free tier with 50 MB storage allocation.',
    storageBytes: DEFAULT_STORAGE.FREE_BYTES, // 52,428,800 bytes (50 MB)
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
    sortOrder: 0,
  },
  {
    code: 'basic',
    name: 'Basic Plan',
    description: 'Basic tier with 300 MB storage allocation.',
    storageBytes: DEFAULT_STORAGE.BASIC_BYTES, // 314,572,800 bytes (300 MB)
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
    sortOrder: 1,
  },
  {
    code: 'premium',
    name: 'Premium Plan',
    description: 'Premium tier with 500 MB storage allocation.',
    storageBytes: DEFAULT_STORAGE.PREMIUM_BYTES, // 524,288,000 bytes (500 MB)
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
    sortOrder: 2,
  },
  {
    code: 'pro',
    name: 'Pro Plan',
    description: 'Pro tier with 900 MB storage allocation.',
    storageBytes: DEFAULT_STORAGE.PRO_BYTES, // 943,718,400 bytes (900 MB)
    price: null,
    currency: null,
    durationDays: null,
    status: PLAN_STATUS.ACTIVE,
    sortOrder: 3,
  },
];

/**
 * Idempotently seed initial plans into the database.
 * Only creates missing plan records. Never overwrites or resets existing plans.
 */
const seedPlans = async () => {
  const results = {
    created: 0,
    skipped: 0,
    total: INITIAL_PLANS.length,
  };

  for (const planData of INITIAL_PLANS) {
    const existing = await Plan.findOne({ code: planData.code });
    if (!existing) {
      await Plan.create(planData);
      results.created += 1;
    } else {
      results.skipped += 1;
    }
  }

  return results;
};

// CLI execution handling
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      logger.info('Connected to MongoDB for plan seeding');
      const results = await seedPlans();
      logger.info(
        `Plan seed completed: ${results.created} created, ${results.skipped} already existed (total: ${results.total})`
      );
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      logger.error(`Plan seeding failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

module.exports = {
  INITIAL_PLANS,
  seedPlans,
};
