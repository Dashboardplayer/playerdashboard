import { mongoClient } from '../hooks/mongoClient.js';
import User from '../models/User.js';
import connectDB from '../db.js';

/**
 * Script to verify and create a superadmin profile
 * This addresses the issue where a user can authenticate but 
 * doesn't have a profile record with the superadmin role.
 */
export async function createSuperAdminProfile(email, password) {
  try {
    console.log("Starting superadmin verification...");
    
    // Ensure MongoDB is connected
    await connectDB();
    
    // 1. Try to authenticate the user first
    const { data: signInData, error: signInError } = await mongoClient.auth.signInWithPassword({
      email,
      password,
    });

    let userId;

    if (signInError) {
      // If authentication fails, check if we need to create a new user
      console.log("Authentication failed, checking if we should create a new user");
      
      // Check if user already exists in the database
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        console.error("Authentication error:", signInError.message);
        return { success: false, error: signInError.message };
      }
      
      // Create new user with superadmin role
      console.log("Creating new superadmin user");
      const newUser = new User({
        email,
        role: 'superadmin'
      });
      
      newUser.setPassword(password);
      await newUser.save();
      
      userId = newUser._id;
      console.log("Successfully created superadmin user with ID:", userId);
      
      return { 
        success: true, 
        message: "Superadmin account created successfully" 
      };
    } else {
      // User successfully authenticated
      const user = signInData.user;
      userId = user.id;
      console.log("Successfully authenticated with user ID:", userId);
      
      // 2. Check if profile exists with superadmin role
      const { data: profileData, error: profileError } = await mongoClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking for existing profile:", profileError.message);
        return { success: false, error: profileError.message };
      }
      
      // 3. If profile exists, make sure it has superadmin role
      if (profileData) {
        console.log("Found existing profile:", profileData);
        
        if (profileData.role === 'superadmin') {
          console.log("Profile already has superadmin role. No changes needed.");
          return { success: true, message: "Superadmin profile already exists" };
        }
        
        // Update role to superadmin
        const { error: updateError } = await mongoClient
          .from('profiles')
          .update({ role: 'superadmin' })
          .eq('id', userId);

        if (updateError) {
          console.error("Error updating profile role:", updateError.message);
          return { success: false, error: updateError.message };
        }
        
        console.log("Updated profile to superadmin role.");
        return { success: true, message: "Profile updated to superadmin role" };
      }
      
      // 4. If we got this far with authentication but no profile, create one
      console.log("No profile found, creating superadmin profile");
      
      // Update the user directly in MongoDB
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { role: 'superadmin' },
        { new: true }
      );
      
      if (!updatedUser) {
        console.error("Error updating user to superadmin");
        return { success: false, error: "Error updating user role" };
      }
      
      console.log("Successfully created/updated superadmin profile.");
      return { success: true, message: "Superadmin profile created successfully" };
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return { success: false, error: error.message };
  }
}