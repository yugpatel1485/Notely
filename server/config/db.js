'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB Atlas.
 * Exits the process on initial failure so PM2 / Docker can restart cleanly.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[DB] MONGODB_URI is not set in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected — attempting reconnect…');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[DB] Mongoose runtime error:', err.message);
  });
}

module.exports = connectDB;
