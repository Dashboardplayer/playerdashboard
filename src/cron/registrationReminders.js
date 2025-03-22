import cron from 'node-cron';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { sendRegistrationInvitationEmail } from '../services/emailService.js';

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('🕒 Running registration reminder cron job');

    // Find inactive users with expired registration tokens (older than 7 days)
    // who haven't received a reminder in the last 7 days
    const users = await User.find({
      isActive: false,
      registrationToken: { $exists: true },
      registrationTokenExpires: { $lt: new Date() },
      $or: [
        { lastReminderSent: { $exists: false } },
        { lastReminderSent: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    });

    console.log(`Found ${users.length} users needing registration reminders`);

    for (const user of users) {
      try {
        // Get company name if company_id exists
        let companyName = '';
        if (user.company_id) {
          const company = await Company.findOne({ company_id: user.company_id });
          if (company) {
            companyName = company.company_name;
          }
        }

        // Generate new registration token
        const registrationToken = user.generateRegistrationToken();
        user.lastReminderSent = new Date();
        await user.save();

        // Send reminder email
        const emailResult = await sendRegistrationInvitationEmail(
          user.email,
          registrationToken,
          user.role,
          companyName
        );

        if (emailResult.success) {
          console.log(`✅ Registration reminder sent to: ${user.email}`);
        } else {
          console.error(`❌ Failed to send reminder to ${user.email}:`, emailResult.error);
        }
      } catch (error) {
        console.error(`❌ Error processing reminder for ${user.email}:`, error);
      }
    }

    console.log('✅ Registration reminder cron job completed');
  } catch (error) {
    console.error('❌ Registration reminder cron job error:', error);
  }
}); 