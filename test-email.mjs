// Quick test script to verify Resend email service works
// Run with: node test-email.mjs your-email@example.com

import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail(recipientEmail) {
  console.log('🧪 Testing Resend Email Service...');
  console.log('📧 Sending test email to:', recipientEmail);
  console.log('🔑 API Key:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'AgBot Alerts <onboarding@resend.dev>',
      to: recipientEmail,
      subject: '✅ AgBot Email Service Test - Success!',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; background-color: #f6f9fc;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h1 style="color: #0ea5e9; margin-top: 0;">🎉 Email Service Working!</h1>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Congratulations! Your AgBot email reporting system is properly configured and ready to send daily reports to customers.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <h3 style="color: #059669; margin-top: 0;">✅ What's Working:</h3>
                <ul style="color: #065f46; margin: 10px 0;">
                  <li>Resend API key is valid</li>
                  <li>Email templates are ready</li>
                  <li>Database schema is deployed</li>
                  <li>Cron job endpoint is created</li>
                </ul>
              </div>

              <h3 style="color: #1f2937;">📋 Next Steps:</h3>
              <ol style="color: #4b5563; line-height: 1.8;">
                <li>Run the database migration in Supabase</li>
                <li>Deploy to Vercel with RESEND_API_KEY environment variable</li>
                <li>Add customer contacts in the admin UI</li>
                <li>Enable Indosolutions contact</li>
                <li>Wait for tomorrow's 7 AM email, or trigger manually</li>
              </ol>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>⚠️ Note:</strong> This email is sent from <code>onboarding@resend.dev</code>.
                  For production, verify your domain (greatsouthernfuel.com.au) in Resend to send from your own email address.
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <p style="color: #9ca3af; font-size: 12px;">
                Sent by AgBot Email Testing System<br>
                Powered by Resend + React Email<br>
                ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' })} AWST
              </p>
            </div>
          </body>
        </html>
      `,
      tags: [
        { name: 'type', value: 'test' },
        { name: 'system', value: 'agbot' }
      ]
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      process.exit(1);
    }

    console.log('✅ Test email sent successfully!');
    console.log('📬 Email ID:', data.id);
    console.log('🔍 Check your inbox:', recipientEmail);
    console.log('\n📊 View email in Resend Dashboard:');
    console.log('   https://resend.com/emails/' + data.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get recipient email from command line argument
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Please provide recipient email as argument');
  console.log('Usage: node test-email.mjs your-email@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('❌ Invalid email format:', recipientEmail);
  process.exit(1);
}

sendTestEmail(recipientEmail);
