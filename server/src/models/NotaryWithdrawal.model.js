'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const notaryWithdrawalSchema = new Schema(
  {
    notaryProfile: {
      type: Schema.Types.ObjectId,
      ref: 'NotaryProfile',
      required: true,
      index: true,
    },
    notaryUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    // Snapshot of bank details at time of request (account number masked)
    bankSnapshot: {
      accountHolderName: { type: String, trim: true },
      maskedAccountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },
    notes: { type: String, trim: true },
    reference: { type: String, trim: true }, // UTR / transfer reference from admin
    processedAt: { type: Date },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NotaryWithdrawal', notaryWithdrawalSchema);
