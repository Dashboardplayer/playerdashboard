// This is a simple CommonJS script to create the initial admin account
// It's designed to be run directly from the command line

const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/player-dashboard';

// User schema and model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'bedrijfsadmin', 'user'], default: 'user' },
  company_id: { type: String, required: function() { return this.role !== 'superadmin'; } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Method to set password
userSchema.methods.setPassword = function(password) {
  const crypto = require('crypto');
  this.passwordSalt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = crypto
    .pbkdf2Sync(password, this.passwordSalt, 1000, 64, 'sha512')
    .toString('hex');
};

// Create the User model
const User = mongoose.model('User', userSchema);

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Admin credentials
    const email = 'dashboardplayer@gmail.com';
    const password = 'Nummer123';
    
    // Check if our specific superadmin already exists
    const existingAdmin = await User.findOne({ email, role: 'superadmin' });
    
    if (existingAdmin) {
      console.log("The requested superadmin already exists:", existingAdmin.email);
      console.log("You can log in with:");
      console.log("Email: dashboardplayer@gmail.com");
      console.log("Password: Nummer123");
      await mongoose.disconnect();
      return;
    }
    
    // Check if user with this email exists but isn't a superadmin
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log("User with this email exists, updating to superadmin role");
      existingUser.role = 'superadmin';
      await existingUser.save();
      console.log("Updated user to superadmin role:", existingUser.email);
    } else {
      // Create new superadmin user
      console.log("Creating a new superadmin user account");
      const newAdmin = new User({
        email,
        role: 'superadmin'
      });
      
      newAdmin.setPassword(password);
      await newAdmin.save();
      
      console.log("Successfully created superadmin user:", email);
    }
    
    console.log("Superadmin account is ready. You can now log in with:");
    console.log("Email: dashboardplayer@gmail.com");
    console.log("Password: Nummer123");
    
  } catch (error) {
    console.error("Error creating superadmin:", error);
  } finally {
    // Close the MongoDB connection
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the function
createSuperAdmin();