/**
 * One-time migration: drop the non-sparse unique index on Document.shareToken
 * that was created from the old schema definition (unique: true on the field).
 *
 * Run once:  node server/scripts/drop-sharetoken-index.js
 *
 * After this, Mongoose will recreate it correctly as a sparse+unique index
 * on next server start, which allows multiple documents with shareToken: null.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('documents');

  const indexes = await collection.indexes();
  const stale = indexes.find(
    (idx) => idx.key && idx.key.shareToken === 1 && !idx.sparse
  );

  if (!stale) {
    console.log('No non-sparse shareToken index found — nothing to drop.');
  } else {
    await collection.dropIndex(stale.name);
    console.log(`Dropped index: ${stale.name}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
