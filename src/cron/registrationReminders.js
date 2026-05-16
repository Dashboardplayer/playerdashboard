const cron = require('node-cron');
const User = require('../models/User');
const Company = require('../models/Company');
const { sendRegistrationInvitationEmail } = require('../services/emailService');

const runRegistrationReminders = async () => {
  try {
    console.log('Running registration reminder cron job');

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
        let companyName = '';
        if (user.company_id) {
          const company = await Company.findOne({ company_id: user.company_id });
          if (company) {
            companyName = company.company_name;
          }
        }

        const registrationToken = user.generateRegistrationToken();
        user.lastReminderSent = new Date();
        await user.save();

        const emailResult = await sendRegistrationInvitationEmail(
          user.email,
          registrationToken,
          user.role,
          companyName
        );

        if (emailResult.success) {
          console.log(`Registration reminder sent to: ${user.email}`);
        } else {
          console.error(`Failed to send reminder to ${user.email}:`, emailResult.error);
        }
      } catch (error) {
        console.error(`Error processing reminder for ${user.email}:`, error);
      }
    }

    console.log('Registration reminder cron job completed');
  } catch (error) {
    console.error('Registration reminder cron job error:', error);
  }
};

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', runRegistrationReminders);
}

module.exports = runRegistrationReminders;
