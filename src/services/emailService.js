import Mailjet from 'node-mailjet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize Mailjet client only on the server-side
let mailjet;
if (!isBrowser) {
  if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
    console.error('Mailjet API credentials not found in environment variables');
  } else {
    mailjet = new Mailjet({
      apiKey: process.env.MAILJET_API_KEY,
      apiSecret: process.env.MAILJET_SECRET_KEY
    });
    console.log('Mailjet client initialized successfully');
  }
}

/**
 * Send an email using Mailjet
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 */
export const sendEmail = async (to, subject, text, html) => {
  // Don't try to send emails from browser environment
  if (isBrowser) {
    console.log('Browser mock: Would send email with:', { to, subject, text });
    return { success: true };
  }

  try {
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.EMAIL_FROM,
            Name: 'Display Beheer'
          },
          To: [
            {
              Email: to
            }
          ],
          Subject: subject,
          TextPart: text,
          HTMLPart: html || text
        }
      ]
    });

    const result = await request;
    console.log('Email sent successfully to:', to);
    return { success: true, result };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
};

/**
 * Send a password reset email
 * @param {string} to - Recipient email 
 * @param {string} resetToken - Password reset token
 */
export const sendPasswordResetEmail = async (to, resetToken) => {
  if (isBrowser) {
    console.log('Browser mock: Would send password reset email to:', to);
    console.log('Reset link would be:', `${window.location.origin}/reset-password?token=${resetToken}`);
    return { success: true };
  }

  const resetLink = `https://player-dashboard.onrender.com/reset-password?token=${resetToken}`;
  const subject = 'Wachtwoord resetten - Display Beheer';
  const text = `
Beste gebruiker,

Er is een verzoek ingediend om je wachtwoord voor Display Beheer te resetten.

Klik op de volgende link om een nieuw wachtwoord in te stellen:
${resetLink}

Let op: Deze link is 1 uur geldig.

Als je geen wachtwoord reset hebt aangevraagd, kun je deze e-mail negeren of contact opnemen met onze support afdeling.

Met vriendelijke groet,
Het Display Beheer Team
  `;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1976d2; padding: 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background-color: #fff; padding: 30px 20px; border-radius: 4px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #1976d2; 
          color: white !important; 
          text-decoration: none; 
          border-radius: 4px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .footer { 
          margin-top: 20px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          font-size: 12px; 
          color: #666; 
        }
        .warning { 
          background-color: #fff3e0; 
          padding: 15px; 
          border-radius: 4px; 
          margin: 20px 0; 
          border-left: 4px solid #ff9800; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Display Beheer</h1>
        </div>
        <div class="content">
          <h2>Wachtwoord resetten</h2>
          <p>Beste gebruiker,</p>
          <p>Er is een verzoek ingediend om je wachtwoord voor Display Beheer te resetten.</p>
          
          <p>Klik op onderstaande knop om een nieuw wachtwoord in te stellen:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Wachtwoord Resetten</a>
          </div>
          
          <div class="warning">
            <strong>Let op:</strong> Deze link is 1 uur geldig vanwege veiligheidsredenen.
          </div>
          
          <p>Of kopieer deze link in je browser:</p>
          <p style="word-break: break-all;"><a href="${resetLink}">${resetLink}</a></p>
          
          <p>Als je geen wachtwoord reset hebt aangevraagd, kun je deze e-mail negeren of contact opnemen met onze support afdeling.</p>
          
          <div class="footer">
            <p>Met vriendelijke groet,<br>Het Display Beheer Team</p>
            <p>Dit is een automatisch gegenereerd bericht. Antwoorden op deze e-mail worden niet gelezen.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(to, subject, text, html);
};

/**
 * Send a registration invitation email
 * @param {string} to - Recipient email 
 * @param {string} registrationToken - Registration token
 * @param {string} role - User role
 * @param {string} companyName - Company name
 */
export const sendRegistrationInvitationEmail = async (to, registrationToken, role, companyName) => {
  if (isBrowser) {
    console.log('Browser mock: Would send registration invitation email to:', to);
    console.log('Registration link would be:', `${window.location.origin}/complete-registration?token=${registrationToken}`);
    return { success: true };
  }

  const registrationLink = `https://player-dashboard.onrender.com/complete-registration?token=${registrationToken}`;
  const subject = 'Welkom bij Display Beheer - Activeer je account';
  const text = `
Beste toekomstige gebruiker,

Je bent uitgenodigd om deel uit te maken van Display Beheer!

Details van je account:
- Rol: ${role}
${companyName ? `- Bedrijf: ${companyName}` : ''}

Klik op de volgende link om je account te activeren:
${registrationLink}

Deze uitnodiging is 7 dagen geldig. Als je niet binnen deze periode registreert, ontvang je een herinnering.

We kijken ernaar uit je te verwelkomen bij Display Beheer!

Met vriendelijke groet,
Het Display Beheer Team
  `;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { 
          background-color: #1976d2; 
          padding: 30px 20px; 
          text-align: center;
          border-radius: 4px 4px 0 0;
        }
        .header h1 { 
          color: white; 
          margin: 0; 
          font-size: 28px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .content { 
          background-color: #fff; 
          padding: 40px 30px; 
          border-radius: 0 0 4px 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .welcome-message {
          font-size: 20px;
          color: #1976d2;
          margin-bottom: 25px;
        }
        .details-box {
          background-color: #f5f5f5;
          padding: 20px;
          border-radius: 4px;
          margin: 25px 0;
          border-left: 4px solid #1976d2;
        }
        .button { 
          display: inline-block; 
          padding: 14px 28px; 
          background-color: #2e7d32; 
          color: white !important; 
          text-decoration: none; 
          border-radius: 4px; 
          font-weight: bold;
          margin: 25px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .button:hover {
          background-color: #1b5e20;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          font-size: 12px; 
          color: #666; 
        }
        .info-note {
          background-color: #e3f2fd;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Display Beheer</h1>
        </div>
        <div class="content">
          <div class="welcome-message">
            Welkom bij Display Beheer!
          </div>
          
          <p>Je bent uitgenodigd om deel uit te maken van ons platform. We zijn blij je binnenkort te mogen verwelkomen!</p>
          
          <div class="details-box">
            <h3 style="margin-top: 0;">Je account details:</h3>
            <p><strong>Rol:</strong> ${role}</p>
            ${companyName ? `<p><strong>Bedrijf:</strong> ${companyName}</p>` : ''}
          </div>
          
          <p>Klik op onderstaande knop om je account te activeren:</p>
          
          <div style="text-align: center;">
            <a href="${registrationLink}" class="button">Account Activeren</a>
          </div>
          
          <div class="info-note">
            <strong>Let op:</strong> Deze uitnodiging is 7 dagen geldig. Als je niet binnen deze periode registreert, 
            ontvang je een herinnering.
          </div>
          
          <p>Of kopieer deze link in je browser:</p>
          <p style="word-break: break-all;"><a href="${registrationLink}">${registrationLink}</a></p>
          
          <div class="footer">
            <p>Met vriendelijke groet,<br>Het Display Beheer Team</p>
            <p>Dit is een automatisch gegenereerd bericht. Antwoorden op deze e-mail worden niet gelezen.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(to, subject, text, html);
};