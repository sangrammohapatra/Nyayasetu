const mongoose = require('mongoose');

/**
 * Tracks anonymous (guest) triage usage by email + calendar day.
 * One document per (email, dateKey) pair; TTL deletes stale records after 48 h.
 */
const publicTriageSchema = new mongoose.Schema(
  {
    email:   { type: String, required: true, lowercase: true, trim: true },
    dateKey: { type: String, required: true },  // 'YYYY-MM-DD' in IST
    count:   { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Unique lookup key
publicTriageSchema.index({ email: 1, dateKey: 1 }, { unique: true });

// Auto-purge after 48 h so the collection stays tiny
publicTriageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('PublicTriage', publicTriageSchema);
