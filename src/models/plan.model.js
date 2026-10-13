const mongoose = require('mongoose');
const { PLAN_STATUS } = require('../constants');

const planSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Plan code is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    storageBytes: {
      type: Number,
      required: [true, 'Storage bytes is required'],
      min: [0, 'Storage bytes cannot be negative'],
    },
    price: {
      type: Number,
      default: null,
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    durationDays: {
      type: Number,
      default: null,
      min: [1, 'Duration days must be at least 1'],
    },
    status: {
      type: String,
      enum: Object.values(PLAN_STATUS),
      default: PLAN_STATUS.ACTIVE,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for efficient public catalog listing
planSchema.index({ status: 1, sortOrder: 1 });

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
