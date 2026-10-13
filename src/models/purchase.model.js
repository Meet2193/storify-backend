const mongoose = require('mongoose');
const { PURCHASE_STATUS, ACQUISITION_SOURCE } = require('../constants');

const planSnapshotSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Snapshot plan ID is required'],
    },
    planCode: {
      type: String,
      required: [true, 'Snapshot plan code is required'],
      trim: true,
    },
    planName: {
      type: String,
      required: [true, 'Snapshot plan name is required'],
      trim: true,
    },
    storageBytes: {
      type: Number,
      required: [true, 'Snapshot storage bytes is required'],
      min: [0, 'Snapshot storage bytes cannot be negative'],
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
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    planSnapshot: {
      type: planSnapshotSchema,
      required: [true, 'Plan snapshot is required'],
    },
    status: {
      type: String,
      enum: Object.values(PURCHASE_STATUS),
      default: PURCHASE_STATUS.PENDING,
      index: true,
    },
    acquisitionSource: {
      type: String,
      enum: Object.values(ACQUISITION_SOURCE),
      required: [true, 'Acquisition source is required'],
      index: true,
    },
    paymentReference: {
      type: String,
      default: null,
      trim: true,
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

// Compound indexes for optimal queries
purchaseSchema.index({ userId: 1, createdAt: -1 });
purchaseSchema.index({ userId: 1, status: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;
