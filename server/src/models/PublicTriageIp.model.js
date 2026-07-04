const mongoose = require('mongoose');

/**
 * Tracks anonymous (guest) triage usage by source IP + calendar day.
 * Closes the "rotate email addresses" bypass of the per-email daily cap in
 * PublicTriage.model.js — a single IP is still capped even if every request
 * uses a different email. One document per (ip, dateKey) pair; TTL deletes
 * stale records after 48 h.
 */
const publicTriageIpSchema = new mongoose.Schema(
  {
    ip:      { type: String, required: true, trim: true },
    dateKey: { type: String, required: true },  // 'YYYY-MM-DD' in IST
    count:   { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Unique lookup key
publicTriageIpSchema.index({ ip: 1, dateKey: 1 }, { unique: true });

// Auto-purge after 48 h so the collection stays tiny
publicTriageIpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('PublicTriageIp', publicTriageIpSchema);
