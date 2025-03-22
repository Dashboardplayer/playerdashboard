import connectDB, { initIndexes } from './db.js';
import User from './models/User.js';
import Company from './models/Company.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize MongoDB database with required data
 */
async function initMongoDB() {
  try {
    console.log('🚀 Starting MongoDB initialization...');
    
    // Connect to MongoDB
    const conn = await connectDB();
    
    // Initialize indexes
    await initIndexes();
    console.log('✅ MongoDB indexes initialized');
    
    // Check if the superadmin user exists
    const superadminExists = await User.findOne({ role: 'superadmin' });
    
    if (!superadminExists) {
      console.log('Creating initial superadmin user...');
      
      // Create default superadmin user
      const superadmin = new User({
        email: 'admin@example.com', // Change this to your desired default admin email
        role: 'superadmin'
      });
      
      // Set a default password (this should be changed immediately after first login)
      superadmin.setPassword('ChangeMe123!');
      
      await superadmin.save();
      console.log('✅ Superadmin user created successfully');
      console.log('⚠️ DEFAULT CREDENTIALS: admin@example.com / ChangeMe123!');
      console.log('⚠️ Please change these credentials immediately after first login!');
    } else {
      console.log('✅ Superadmin user already exists, skipping creation');
    }
    
    // Check if we need to import data from Supabase
    const supabaseCsvPath = path.join(__dirname, '..', 'Supabase Table.csv');
    if (fs.existsSync(supabaseCsvPath)) {
      console.log('Found Supabase Table.csv, you may want to import this data');
      console.log('Please implement data migration logic if needed');
      
      // Here you could add logic to parse the CSV and import the data
      // This would depend on the specific structure of your Supabase data
    }
    
    console.log('✅ MongoDB initialization completed successfully');
    
    // Close connection
    await conn.connection.close();
    console.log('MongoDB connection closed');
    
    return { success: true };
  } catch (error) {
    console.error('❌ MongoDB initialization error:', error);
    return { success: false, error };
  }
}

// Run if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initMongoDB()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error during initialization:', err);
      process.exit(1);
    });
}

export default initMongoDB;