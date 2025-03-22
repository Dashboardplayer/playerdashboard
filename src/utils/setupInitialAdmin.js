// Use CommonJS require for Node.js environment
const User = require('../models/User.js');
const connectDB = require('../db.js');

/**
 * Creates the initial superadmin user directly in the database
 * This is meant to be run once to set up the first admin account
 */
async function createInitialSuperAdmin() {
  try {
    // Connect to the database
    await connectDB();
    console.log("Connected to MongoDB, checking for existing superadmin...");
    
    // Check if any superadmin already exists
    const existingAdmin = await User.findOne({ role: 'superadmin' });
    
    if (existingAdmin) {
      console.log("Superadmin already exists:", existingAdmin.email);
      return { 
        success: true, 
        message: "Superadmin already exists", 
        user: existingAdmin 
      };
    }
    
    // Create the superadmin account with fixed credentials
    const email = 'dashboardplayer@gmail.com';
    const password = 'Nummer123';
    
    // Check if user with this email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log("User with this email already exists, updating role to superadmin");
      
      existingUser.role = 'superadmin';
      await existingUser.save();
      
      return { 
        success: true, 
        message: "Existing user updated to superadmin role", 
        user: existingUser 
      };
    }
    
    // Create new superadmin user
    console.log("Creating new superadmin user:", email);
    const newAdmin = new User({
      email,
      role: 'superadmin'
    });
    
    newAdmin.setPassword(password);
    await newAdmin.save();
    
    console.log("Successfully created superadmin user with ID:", newAdmin._id);
    
    return { 
      success: true, 
      message: "Superadmin account created successfully",
      user: newAdmin
    };
  } catch (error) {
    console.error("Error creating superadmin:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Execute the function if running directly
// This helps when running as a script: node src/utils/setupInitialAdmin.js
if (typeof require !== 'undefined' && require.main === module) {
  createInitialSuperAdmin()
    .then(result => {
      console.log(result);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default createInitialSuperAdmin;