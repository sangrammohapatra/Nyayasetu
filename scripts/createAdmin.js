/**
 * scripts/createAdmin.js
 *
 * Creates (or updates) the NyayaSetu platform admin account.
 * Generates a random secure temp password and logs it once — save it immediately.
 *
 * Run: node scripts/createAdmin.js
 * Safe to re-run — updates existing admin rather than creating a duplicate.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';

const ADMIN_EMAIL = 'admin@nyayasetu.in';
const ADMIN_NAME = 'NyayaSetu Admin';
const ADMIN_PHONE = '+910000000000'; // placeholder — change before production

/**
 * Generate a random 16-character password.
 * Contains uppercase, lowercase, digits, and symbols for security.
 */
function generatePassword(length = 16) {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join('');
}

async function main() {
  console.log('🔐 NyayaSetu — Create/Update Admin Account');
  console.log('   Target email:', ADMIN_EMAIL);
  console.log('   MongoDB:', MONGO_URI.replace(/:\/\/[^@]+@/, '://***@'));
  console.log('');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

  let admin;
  let action;

  if (existingAdmin) {
    // Update existing admin — reset password and ensure correct fields
    existingAdmin.name = ADMIN_NAME;
    existingAdmin.persona = 'admin';
    existingAdmin.isEmailVerified = true;
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.subscription = { plan: 'pro', validUntil: new Date('2099-12-31') };
    existingAdmin.freeUsage = {
      docsGenerated: 0,
      docsLimit: 999999,
      casesTracked: 0,
      casesLimit: 999999,
      aiChatsUsed: 0,
      aiChatsLimit: 999999,
      resetDate: new Date('2099-12-31'),
    };
    await existingAdmin.save();
    admin = existingAdmin;
    action = 'updated';
    console.log('♻️  Existing admin account updated (password reset)');
  } else {
    // Create new admin
    admin = await User.create({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      name: ADMIN_NAME,
      persona: 'admin',
      isEmailVerified: true,
      passwordHash,
      preferredLanguage: 'en',
      preferredTheme: 'default',
      registrationSource: 'web',
      subscription: { plan: 'pro', validUntil: new Date('2099-12-31') },
      freeUsage: {
        docsGenerated: 0,
        docsLimit: 999999,
        casesTracked: 0,
        casesLimit: 999999,
        aiChatsUsed: 0,
        aiChatsLimit: 999999,
        resetDate: new Date('2099-12-31'),
      },
    });
    action = 'created';
    console.log('✅ Admin account created');
  }

  // Write audit log
  try {
    await AuditLog.create({
      user: admin._id,
      action: `admin_${action}`,
      entity: 'User',
      entityId: admin._id,
      ipAddress: '127.0.0.1',
      userAgent: 'seed-script/createAdmin.js',
      metadata: { email: ADMIN_EMAIL, script: 'createAdmin.js' },
    });
  } catch (auditErr) {
    console.warn('⚠️  Could not write audit log:', auditErr.message);
  }

  // Print credentials — only opportunity to see password
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔑  ADMIN CREDENTIALS — SAVE THESE NOW              ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${tempPassword}`);
  console.log(`   User ID  : ${admin._id}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  IMPORTANT:');
  console.log('   1. Save the password above immediately — it will not be shown again.');
  console.log('   2. Change the password after first login via Settings.');
  console.log('   3. Update ADMIN_PHONE in this script before production use.');
  console.log('   4. Enable 2FA for the admin account after setup.');
  console.log('');

  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
