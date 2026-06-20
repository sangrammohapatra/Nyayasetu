require('dotenv').config();

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { connectRedis, redisClient } = require('./config/redis');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  try {
    // ── Connect to MongoDB ─────────────────────────────────────────────────
    await connectDB();

    // ── Connect to Redis ───────────────────────────────────────────────────
    await connectRedis();

    // ── Create HTTP server (needed for socket.io later) ────────────────────
    server = http.createServer(app);

    // ── Attach Socket.IO ───────────────────────────────────────────────────
    const { Server } = require('socket.io');
    const { initSocket } = require('./services/socket');

    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    // Make io accessible in request handlers via app.get('io')
    app.set('io', io);

    // Register all socket handlers (auth + consultation chat events)
    initSocket(io);

    // ── Start listening ────────────────────────────────────────────────────
    server.listen(PORT, () => {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`  NyayaSetu API Server`);
      logger.info(`  Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`  Port        : ${PORT}`);
      logger.info(`  AI Provider : ${process.env.AI_PROVIDER || 'gemini'}`);
      logger.info(`  Storage     : ${process.env.STORAGE_PROVIDER || 'cloudinary'}`);
      logger.info(`  Client URL  : ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');

      // Close Redis connection
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed.');
      }

      // Close Mongoose connection
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');

      logger.info('Graceful shutdown complete.');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Unhandled Rejections / Exceptions ────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in development — let nodemon restart
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

startServer();
