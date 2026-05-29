import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export const connectDB = async (retries = MAX_RETRIES) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 s to find a server
      socketTimeoutMS: 45000,          // 45 s for socket inactivity
      connectTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);

    if (retries > 0) {
      console.log(`🔄 Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    } else {
      console.error('🚨 All MongoDB connection attempts failed. Exiting process.');
      process.exit(1);
    }
  }
};
