// AgBot Reports Cron Job V2 - Enhanced with Analytics
// Sends daily/weekly/monthly email reports to customers about their AgBot tank statuses
// Scheduled to run daily at 7 AM AWST (Perth time)
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/cron/send-agbot-reports

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateAgBotEmail } from '../lib/agbot-email-template.js';
import { generateFuelReport, shouldSendReport } from '../lib/agbot-report-generator.js';
import { recalculateAllAssets } from '../lib/consumption-calculator.js';
import crypto from 'crypto';

// Feature flag: Set to true to use new enhanced reports, false to use legacy
const USE_ENHANCED_REPORTS = true;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email with environment variable fallback
const DEFAULT_FROM_EMAIL =
  process.env.RESEND_VERIFIED_EMAIL ||
  'Tank Alert <alert@tankalert.greatsouthernfuels.com.au>'; // Verified domain: tankalert.greatsouthernfuels.com.au

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

/**
 * Sanitize tag values to meet Resend's requirements
 * Tags should only contain ASCII letters, numbers, underscores, or dashes
 */
function sanitizeTagValue(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-\s]/g, '') // Remove special characters
    .replace(/\s+/g, '-')              // Replace spaces with dashes
    .substring(0, 50);                  // Limit length for Resend
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rate limiting configuration
const BATCH_SIZE = 50; // Send 50 emails per batch
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  if (!supabaseUrl || !supabaseKey || !process.env.RESEND_API_KEY) {
    console.error('Missing required environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables'
    });
  }

  // Only accept POST requests (from Vercel Cron)
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  // Authentication for cron job
  // Vercel crons pass special headers - check for those OR manual Bearer token
  const isVercelCron = req.headers['x-vercel-signature'] !== undefined ||
                       (req.headers['user-agent'] as string)?.includes('vercel-cron');
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // Allow if: Vercel cron request OR valid manual Bearer token
  if (!isVercelCron && (!token || token !== CRON_SECRET)) {
    console.log('[CRON AUTH] Failed - not Vercel cron and no valid token');
    console.log('[CRON AUTH] Headers:', JSON.stringify({
      'user-agent': req.headers['user-agent'],
      'x-vercel-signature': req.headers['x-vercel-signature'] ? 'present' : 'missing',
      'authorization': authHeader ? 'present' : 'missing'
    }));
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid cron secret required'
    });
  }

  console.log('[CRON AUTH] Passed - isVercelCron:', isVercelCron, 'hasToken:', !!token);

  try {
    const currentDate = new Date();

    // Step 1: Recalculate consumption for all assets before sending emails
    console.log('[CRON] Recalculating consumption for all assets...');
    const consumptionResult = await recalculateAllAssets();
    console.log(`[CRON] Consumption recalculation: ${consumptionResult.updated} updated, ${consumptionResult.failed} failed`);

    // Fetch all enabled customer contacts for all report frequencies
    const { data: allContacts, error: contactsError} = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('enabled', true)
      .in('report_frequency', ['daily', 'weekly', 'monthly']);

    if (contactsError) {
      throw new Error(`Failed to fetch customer contacts: ${contactsError.message}`);
    }

    if (!allContacts || allContacts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No customers to email',
        emailsSent: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Filter contacts based on report frequency and current date
    const contacts = (allContacts as CustomerContact[]).filter((contact) => {
      const frequency = contact.report_frequency as 'daily' | 'weekly' | 'monthly';
      return shouldSendReport(frequency, currentDate);
    });

    if (contacts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No reports scheduled for today',
        emailsSent: 0,
        totalContacts: allContacts.length,
        timestamp: new Date().toISOString()
      });
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const errors: string[] = [];

    // Process contacts in batches for rate limiting
    const contactList = contacts as CustomerContact[];
    for (let i = 0; i < contactList.length; i += BATCH_SIZE) {
      const batch = contactList.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contactList.length / BATCH_SIZE)}: ${batch.length} contacts`);

      // Process each customer contact in the batch
      for (const contact of batch) {
        try {
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
                id,
                device_online,
                asset_profile_water_capacity,
                asset_daily_consumption,
                asset_days_remaining,
                device_serial_number,
                asset_reported_litres,
                asset_refill_capacity_litres,
                device_battery_voltage,
                asset_profile_commodity
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
        } else {
          // Step 2: Fallback - fetch ALL tanks for this customer (backward compatible)
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
                id,
                device_online,
                asset_profile_water_capacity,
                asset_daily_consumption,
                asset_days_remaining,
                device_serial_number,
                asset_reported_litres,
                asset_refill_capacity_litres,
                device_battery_voltage,
                asset_profile_commodity
              )
            `
            )
            .eq('customer_name', contact.customer_name)
            .eq('disabled', false);

          if (locationsError) {
            throw new Error(`Failed to fetch locations: ${locationsError.message}`);
          }

          locations = allLocations || [];
        }

        if (!locations || locations.length === 0) {
          continue;
        }

        // Ensure contact has unsubscribe token
        let unsubscribeToken = (contact as any).unsubscribe_token;
        if (!unsubscribeToken) {
          // Generate token if missing
          unsubscribeToken = crypto.randomBytes(32).toString('hex');
          await supabase
            .from('customer_contacts')
            .update({ unsubscribe_token: unsubscribeToken })
            .eq('id', contact.id);
        }

        // Build unsubscribe URL
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://fuel-sight-guardian-ce89d8de.vercel.app';
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(
          unsubscribeToken
        )}`;

        // Transform data for email template
        const emailData = locations.map((loc: any) => {
          const asset = loc.agbot_assets?.[0] || {}; // Take first asset for simplicity
          return {
            location_id: loc.location_id || 'Unknown',
            asset_id: asset.id || null, // Asset UUID for querying readings history
            address1: loc.address1 || 'Unknown Location',
            latest_calibrated_fill_percentage: loc.latest_calibrated_fill_percentage || 0,
            latest_telemetry: loc.latest_telemetry,
            device_online: asset.device_online || false,
            asset_profile_water_capacity: asset.asset_profile_water_capacity || null,
            asset_daily_consumption: asset.asset_daily_consumption || null,
            asset_days_remaining: asset.asset_days_remaining || null,
            device_serial_number: asset.device_serial_number || null,
            asset_reported_litres: asset.asset_reported_litres || null,
            asset_refill_capacity_litres: asset.asset_refill_capacity_litres || null,
            device_battery_voltage: asset.device_battery_voltage || null,
            asset_profile_commodity: asset.asset_profile_commodity || null
          };
        });

        // Calculate alert counts
        const lowFuelCount = emailData.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
        const criticalCount = emailData.filter(
          (l) =>
            l.latest_calibrated_fill_percentage < 15 ||
            (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
        ).length;

        // Determine report frequency and type
        const reportFrequency = (contact.report_frequency || 'daily') as 'daily' | 'weekly' | 'monthly';
        const reportType = reportFrequency === 'daily' ? 'Daily' : reportFrequency === 'weekly' ? 'Weekly' : 'Monthly';

        // Generate email HTML and plain text
        let emailHtml: string;
        let emailText: string;
        let emailSubject: string;

        if (USE_ENHANCED_REPORTS) {
          // Use new enhanced report generator with analytics
          const { html, text } = await generateFuelReport(
            supabase,
            emailData,
            {
              customerName: contact.customer_name,
              contactName: contact.contact_name || undefined,
              contactEmail: contact.contact_email,
              reportFrequency,
              unsubscribeToken,
              logoUrl: 'https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp',
            }
          );
          emailHtml = html;
          emailText = text;

          // Generate subject based on frequency
          const date = new Date().toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          emailSubject = `${reportType} Fuel Report - ${contact.customer_name} - ${date}`;
        } else {
          // Use legacy template (backward compatible)
          const reportDate = new Date().toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          const result = generateAgBotEmail({
            customerName: contact.customer_name,
            contactName: contact.contact_name || undefined,
            locations: emailData,
            reportDate,
            unsubscribeUrl
          });
          emailHtml = result.html;
          emailText = result.text;
          emailSubject = `Daily AgBot Report - ${contact.customer_name} - ${reportDate}`;
        }

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: contact.contact_email,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          replyTo: 'hayden@stevemacs.com.au',
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          },
          tags: [
            { name: 'type', value: `${reportFrequency}_report` },
            { name: 'customer', value: sanitizeTagValue(contact.customer_name) }
          ]
        });

        if (emailResponse.error) {
          throw new Error(`Resend error: ${emailResponse.error.message}`);
        }

        emailsSent++;

        // Log email delivery to database
        await supabase.from('customer_email_logs').insert({
          customer_contact_id: contact.id,
          customer_name: contact.customer_name,
          recipient_email: contact.contact_email,
          email_type: `${reportFrequency}_report`,
          email_subject: emailSubject,
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
        console.error(`Error processing ${contact.customer_name}:`, (customerError as Error).message);
        errors.push(`${contact.customer_name}: ${(customerError as Error).message}`);
        emailsFailed++;

        // Log failed email
        const reportFreq = (contact.report_frequency || 'daily') as 'daily' | 'weekly' | 'monthly';
        await supabase.from('customer_email_logs').insert({
          customer_contact_id: contact.id,
          customer_name: contact.customer_name,
          recipient_email: contact.contact_email,
          email_type: `${reportFreq}_report`,
          email_subject: `Fuel Report - ${contact.customer_name}`,
          sent_at: new Date().toISOString(),
          delivery_status: 'failed',
          error_message: (customerError as Error).message
        });
        }
      }

      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < contactList.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Fuel reports sent successfully',
      results: {
        emailsSent,
        emailsFailed,
        totalContacts: contacts.length,
        totalEligibleToday: allContacts.length,
        usingEnhancedReports: USE_ENHANCED_REPORTS,
        duration
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Cron job failed:', (error as Error).message);

    return res.status(500).json({
      success: false,
      error: 'Cron job failed',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
