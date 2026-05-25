const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Connects to MongoDB with retry logic.
 * Retries up to MAX_RETRIES times with RETRY_DELAY_MS delay between attempts.
 */
async function connectDB(attempt = 1) {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})...`);

    await mongoose.connect(mongoUri, {
      // These options are defaults in Mongoose 8+ but kept explicitly for clarity
      serverSelectionTimeoutMS: 10000, // Fail fast if MongoDB unreachable
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    logger.info('MongoDB connected successfully');

    // ── Connection Events ──────────────────────────────────────────────────
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Mongoose reconnected to MongoDB');
    });

    // Log the host we connected to
    const { host, port, name } = mongoose.connection;
    logger.info(`MongoDB → ${host}:${port}/${name}`);
  } catch (error) {
    logger.error(`MongoDB connection attempt ${attempt} failed: ${error.message}`);

    if (attempt < MAX_RETRIES) {
      logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }

    logger.error(`MongoDB connection failed after ${MAX_RETRIES} attempts. Exiting.`);
    throw error;
  }
}

/**
 * Closes the Mongoose connection gracefully.
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
}

module.exports = { connectDB, disconnectDB };
