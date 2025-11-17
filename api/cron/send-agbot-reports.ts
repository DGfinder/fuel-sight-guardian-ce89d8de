// AgBot Daily Reports Cron Job
// Sends daily email reports to customers about their AgBot tank statuses
// Scheduled to run daily at 7 AM AWST (Perth time)
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/cron/send-agbot-reports

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import AgBotDailyReport from '../../src/emails/agbot-daily-report';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email
const DEFAULT_FROM_EMAIL = 'Tank Alert <tankalert@greatsouthernfuels.com.au>';

// Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET || 'FSG-cron-secret-2025';

interface CustomerContact {
  id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string | null;
  report_frequency: string;
}

interface AgBotLocationData {
  id: string;
  location_id: string;
  address1: string;
  customer_name: string;
  latest_calibrated_fill_percentage: number;
  latest_telemetry: string;
  device_online: boolean;
  asset_profile_water_capacity: number | null;
  asset_daily_consumption: number | null;
  asset_days_remaining: number | null;
  device_serial_number: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  console.log('\n📧 AGBOT DAILY REPORTS CRON JOB STARTED');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);

  // Environment check
  console.log(`🔧 Environment check:`);
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);

  // Fail fast if environment not configured
  if (!supabaseUrl || !supabaseKey || !process.env.RESEND_API_KEY) {
    console.error('💥 CONFIGURATION ERROR: Missing required environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables'
    });
  }

  // Only accept POST requests (from Vercel Cron)
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'POST',
      received: req.method
    });
  }

  // Simple authentication for cron job
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== CRON_SECRET) {
    console.log('❌ Invalid cron secret');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid cron secret required'
    });
  }

  try {
    // Fetch all enabled customer contacts for daily reports
    console.log('\n📋 Fetching customer contacts...');
    const { data: contacts, error: contactsError } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('enabled', true)
      .eq('report_frequency', 'daily');

    if (contactsError) {
      throw new Error(`Failed to fetch customer contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      console.log('ℹ️  No enabled customer contacts found for daily reports');
      return res.status(200).json({
        success: true,
        message: 'No customers to email',
        emailsSent: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ Found ${contacts.length} customer(s) to email`);

    let emailsSent = 0;
    let emailsFailed = 0;
    const errors: string[] = [];

    // Process each customer contact
    for (const contact of contacts as CustomerContact[]) {
      try {
        console.log(`\n📬 Processing customer: ${contact.customer_name}`);
        console.log(`   Contact: ${contact.contact_name || 'N/A'} <${contact.contact_email}>`);

        let locations: any[] = [];

        // Step 1: Try to fetch specifically assigned tanks from junction table
        const { data: assignedTanks, error: assignedTanksError } = await supabase
          .from('customer_contact_tanks')
          .select(
            `
            agbot_location_id,
            agbot_locations!inner (
              id,
              location_id,
              address1,
              customer_name,
              latest_calibrated_fill_percentage,
              latest_telemetry,
              disabled,
              agbot_assets (
                device_online,
                asset_profile_water_capacity,
                asset_daily_consumption,
                asset_days_remaining,
                device_serial_number
              )
            )
          `
          )
          .eq('customer_contact_id', contact.id);

        if (!assignedTanksError && assignedTanks && assignedTanks.length > 0) {
          // Contact has specific tank assignments - use only these
          locations = assignedTanks
            .map((assignment: any) => assignment.agbot_locations)
            .filter((loc: any) => loc && !loc.disabled);
          console.log(`   🎯 Found ${locations.length} specifically assigned tank(s)`);
        } else {
          // Step 2: Fallback - fetch ALL tanks for this customer (backward compatible)
          console.log(`   ℹ️  No specific tanks assigned, fetching all customer tanks...`);
          const { data: allLocations, error: locationsError } = await supabase
            .from('agbot_locations')
            .select(
              `
              id,
              location_id,
              address1,
              customer_name,
              latest_calibrated_fill_percentage,
              latest_telemetry,
              agbot_assets (
                device_online,
                asset_profile_water_capacity,
                asset_daily_consumption,
                asset_days_remaining,
                device_serial_number
              )
            `
            )
            .eq('customer_name', contact.customer_name)
            .eq('disabled', false);

          if (locationsError) {
            throw new Error(`Failed to fetch locations: ${locationsError.message}`);
          }

          locations = allLocations || [];
          console.log(`   ✅ Found ${locations.length} total customer tank(s)`);
        }

        if (!locations || locations.length === 0) {
          console.log(`   ⚠️  No AgBot locations found for ${contact.customer_name}`);
          continue;
        }

        // Transform data for email template
        const emailData = locations.map((loc: any) => {
          const asset = loc.agbot_assets?.[0] || {}; // Take first asset for simplicity
          return {
            location_id: loc.location_id || 'Unknown',
            address1: loc.address1 || 'Unknown Location',
            latest_calibrated_fill_percentage: loc.latest_calibrated_fill_percentage || 0,
            latest_telemetry: loc.latest_telemetry,
            device_online: asset.device_online || false,
            asset_profile_water_capacity: asset.asset_profile_water_capacity || null,
            asset_daily_consumption: asset.asset_daily_consumption || null,
            asset_days_remaining: asset.asset_days_remaining || null,
            device_serial_number: asset.device_serial_number || null
          };
        });

        // Calculate alert counts
        const lowFuelCount = emailData.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
        const criticalCount = emailData.filter(
          (l) =>
            l.latest_calibrated_fill_percentage < 15 ||
            (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
        ).length;

        // Render email template
        const reportDate = new Date().toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const emailHtml = render(
          AgBotDailyReport({
            customerName: contact.customer_name,
            contactName: contact.contact_name || undefined,
            locations: emailData,
            reportDate
          })
        );

        // Send email via Resend
        console.log(`   📧 Sending email to ${contact.contact_email}...`);
        const emailResponse = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: contact.contact_email,
          subject: `Daily AgBot Report - ${contact.customer_name} - ${reportDate}`,
          html: emailHtml,
          replyTo: 'support@greatsouthernfuel.com.au',
          tags: [
            { name: 'type', value: 'daily_report' },
            { name: 'customer', value: contact.customer_name }
          ]
        });

        if (emailResponse.error) {
          throw new Error(`Resend error: ${emailResponse.error.message}`);
        }

        console.log(`   ✅ Email sent successfully! ID: ${emailResponse.data?.id}`);
        emailsSent++;

        // Log email delivery to database
        await supabase.from('customer_email_logs').insert({
          customer_contact_id: contact.id,
          customer_name: contact.customer_name,
          recipient_email: contact.contact_email,
          email_type: 'daily_report',
          email_subject: `Daily AgBot Report - ${contact.customer_name} - ${reportDate}`,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent',
          external_email_id: emailResponse.data?.id || null,
          locations_count: locations.length,
          low_fuel_alerts: lowFuelCount,
          critical_alerts: criticalCount
        });

        // Update last_email_sent_at on customer contact
        await supabase
          .from('customer_contacts')
          .update({ last_email_sent_at: new Date().toISOString() })
          .eq('id', contact.id);
      } catch (customerError) {
        console.error(`   ❌ Error processing ${contact.customer_name}:`, customerError);
        errors.push(`${contact.customer_name}: ${(customerError as Error).message}`);
        emailsFailed++;

        // Log failed email
        await supabase.from('customer_email_logs').insert({
          customer_contact_id: contact.id,
          customer_name: contact.customer_name,
          recipient_email: contact.contact_email,
          email_type: 'daily_report',
          email_subject: `Daily AgBot Report - ${contact.customer_name}`,
          sent_at: new Date().toISOString(),
          delivery_status: 'failed',
          error_message: (customerError as Error).message
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log('\n📈 EMAIL BATCH COMPLETED');
    console.log('='.repeat(50));
    console.log(`✅ Emails sent: ${emailsSent}`);
    console.log(`❌ Emails failed: ${emailsFailed}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('='.repeat(50));

    return res.status(200).json({
      success: true,
      message: 'Daily reports sent successfully',
      results: {
        emailsSent,
        emailsFailed,
        totalContacts: contacts.length,
        duration
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('\n💥 CRON JOB FAILED');
    console.error('Error:', (error as Error).message);
    console.error('Stack:', (error as Error).stack);

    return res.status(500).json({
      success: false,
      error: 'Cron job failed',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
