import mongoose from "mongoose";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// This is a browser-compatible version of the database connection code
// In a real production environment, browser code would connect to MongoDB via API calls

// Mock MongoDB Connection for browser
const connectDB = async () => {
  // In browser environment, we don't actually connect to MongoDB
  // Instead, we use the API endpoints
  if (typeof window !== 'undefined') {
    return {
      connection: {
        host: 'api-endpoint',
        readyState: 1
      }
    };
  }

  try {
    // This code only runs in Node.js (server-side)
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('Please check your MongoDB credentials in the .env file');
    process.exit(1);
  }
};

// Utility to check if MongoDB is connected
const isConnected = () => {
  // In browser, we're always "connected" to the API
  if (typeof window !== 'undefined') {
    return true;
  }
  return mongoose.connection.readyState === 1;
};

// Get the MongoDB connection
const getConnection = () => {
  // In browser, return a mock connection
  if (typeof window !== 'undefined') {
    return { readyState: 1 };
  }
  return mongoose.connection;
};

// Close the MongoDB connection
const closeConnection = async () => {
  // Only close connection in Node.js environment
  if (typeof window === 'undefined' && mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Initialize MongoDB indexes
const initIndexes = async () => {
  // Skip in browser environment
  if (typeof window !== 'undefined') {
    return;
  }
  
  try {
    // Make sure models are imported
    const models = mongoose.models;
    console.log(`Ensuring indexes for ${Object.keys(models).length} models`);
    
    // This will trigger the creation of any indexes defined in the schemas
    // Each model will handle its own indexes
    for (const modelName in models) {
      await models[modelName].init();
    }
    
    console.log('✅ MongoDB Indexes initialized');
  } catch (error) {
    console.error(`❌ Error initializing indexes: ${error.message}`);
    throw error;
  }
};

export {
  connectDB as default,
  isConnected,
  getConnection,
  closeConnection,
  initIndexes
};
