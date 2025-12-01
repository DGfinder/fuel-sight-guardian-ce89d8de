// Test Email API Endpoint
// Allows admins to send a test email to a specific customer contact
// URL: POST /api/test-send-email

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateAgBotEmail } from './lib/agbot-email-template.js';
import { generateFuelReport } from './lib/agbot-report-generator.js';

// Debug: Log environment variables at module load time
console.log('[MODULE INIT] Starting test-send-email module initialization');
console.log('[MODULE INIT] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
console.log('[MODULE INIT] RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);
console.log('[MODULE INIT] RESEND_VERIFIED_EMAIL:', process.env.RESEND_VERIFIED_EMAIL || 'not set');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Initialize Resend - lazy initialization to avoid module-level crashes
let resend: Resend | null = null;
const getResend = () => {
  if (!resend && process.env.RESEND_API_KEY) {
    console.log('[RESEND INIT] Creating Resend client');
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

// Sender email with fallback
// Use verified domain email if available, otherwise use Resend's default
const DEFAULT_FROM_EMAIL =
  process.env.RESEND_VERIFIED_EMAIL ||
  'Tank Alert <alert@tankalert.greatsouthernfuels.com.au>'; // Verified domain: tankalert.greatsouthernfuels.com.au

interface CustomerContact {
  id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string | null;
  report_frequency: string;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  console.log('[HANDLER START] Test email endpoint called');
  console.log('[HANDLER] Method:', req.method);
  console.log('[HANDLER] Request body keys:', Object.keys(req.body || {}));
  console.log('[HANDLER] Environment check:');
  console.log('  - SUPABASE_URL:', !!supabaseUrl);
  console.log('  - SUPABASE_ANON_KEY:', !!supabaseKey);
  console.log('  - RESEND_API_KEY:', !!process.env.RESEND_API_KEY);
  console.log('  - RESEND_VERIFIED_EMAIL:', !!process.env.RESEND_VERIFIED_EMAIL);

  if (!supabaseUrl || !supabaseKey) {
    console.error('[ERROR] Missing Supabase environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Supabase not configured'
    });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[ERROR] Missing RESEND_API_KEY');
    return res.status(500).json({
      error: 'Email service not configured',
      message: 'RESEND_API_KEY environment variable is not set'
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'POST',
      received: req.method
    });
  }

  try {
    // Get parameters from request body
    // Default to enhanced template now that it's ready
    const { contact_id, use_enhanced = true, frequency = 'daily' } = req.body;

    if (!contact_id) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'contact_id is required'
      });
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        error: 'Invalid frequency',
        message: `Frequency must be one of: ${validFrequencies.join(', ')}`
      });
    }

    // Fetch the specific contact
    const { data: contact, error: contactError } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('Contact not found:', contactError);
      return res.status(404).json({
        error: 'Contact not found',
        message: 'No customer contact found with that ID'
      });
    }

    const typedContact = contact as CustomerContact;
    let locations: any[] = [];

    // Step 1: Try to fetch specifically assigned tanks
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
      .eq('customer_contact_id', typedContact.id);

    if (!assignedTanksError && assignedTanks && assignedTanks.length > 0) {
      // Contact has specific tank assignments
      locations = assignedTanks
        .map((assignment: any) => assignment.agbot_locations)
        .filter((loc: any) => loc && !loc.disabled);
    } else {
      // Fallback - fetch ALL tanks for this customer
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
        .eq('customer_name', typedContact.customer_name)
        .eq('disabled', false);

      if (locationsError) {
        throw new Error(`Failed to fetch locations: ${locationsError.message}`);
      }

      locations = allLocations || [];
    }

    if (!locations || locations.length === 0) {
      return res.status(400).json({
        error: 'No tanks found',
        message: `No AgBot tanks found for customer: ${typedContact.customer_name}`
      });
    }

    // Ensure contact has unsubscribe token
    let unsubscribeToken = typedContact.unsubscribe_token;
    if (!unsubscribeToken) {
      // Generate token if missing
      unsubscribeToken = Buffer.from(crypto.randomBytes(32)).toString('hex');
      await supabase
        .from('customer_contacts')
        .update({ unsubscribe_token: unsubscribeToken })
        .eq('id', typedContact.id);
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
      const asset = loc.agbot_assets?.[0] || {};
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

    // Generate email HTML and plain text
    console.log('[EMAIL TEMPLATE] Generating email for', typedContact.customer_name);
    console.log('[EMAIL TEMPLATE] Using enhanced template:', use_enhanced);
    console.log('[EMAIL TEMPLATE] Report frequency:', frequency);
    console.log('[EMAIL TEMPLATE] Locations count:', emailData.length);

    let emailHtml: string;
    let emailText: string;
    let emailSubject: string;

    if (use_enhanced) {
      // Use new enhanced report generator with analytics
      console.log('[EMAIL TEMPLATE] Using enhanced report generator');
      const { html, text } = await generateFuelReport(
        supabase,
        emailData,
        {
          customerName: typedContact.customer_name,
          contactName: typedContact.contact_name || undefined,
          contactEmail: typedContact.contact_email,
          reportFrequency: frequency as 'daily' | 'weekly' | 'monthly',
          unsubscribeToken,
          logoUrl: 'https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp',
        }
      );
      emailHtml = html;
      emailText = text;

      const frequencyLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
      const reportDate = new Date().toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      emailSubject = `TEST - ${frequencyLabel} Fuel Report - ${typedContact.customer_name} - ${reportDate}`;
    } else {
      // Use legacy template
      console.log('[EMAIL TEMPLATE] Using legacy template');
      const reportDate = new Date().toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const result = generateAgBotEmail({
        customerName: typedContact.customer_name,
        contactName: typedContact.contact_name || undefined,
        locations: emailData,
        reportDate: `${reportDate} (TEST EMAIL)`,
        unsubscribeUrl
      });
      emailHtml = result.html;
      emailText = result.text;
      emailSubject = `TEST - Daily AgBot Report - ${typedContact.customer_name} - ${reportDate}`;
    }

    console.log('[EMAIL TEMPLATE] HTML generated, length:', emailHtml.length);
    console.log('[EMAIL TEMPLATE] Text generated, length:', emailText.length);

    // Send email via Resend
    console.log('[RESEND] Initializing Resend client');
    const resendClient = getResend();
    if (!resendClient) {
      console.error('[RESEND ERROR] Failed to initialize Resend client');
      return res.status(500).json({
        success: false,
        error: 'Email service initialization failed',
        message: 'Could not create Resend client - check RESEND_API_KEY'
      });
    }

    console.log('[RESEND] Sending email to:', typedContact.contact_email);
    console.log('[RESEND] From:', DEFAULT_FROM_EMAIL);

    // Parse CC emails if provided
    const ccEmails = (typedContact as any).cc_emails;
    const ccList = ccEmails
      ? ccEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
      : [];

    if (ccList.length > 0) {
      console.log('[RESEND] CC recipients:', ccList);
    }

    const emailResponse = await resendClient.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: typedContact.contact_email,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      replyTo: 'hayden@stevemacs.com.au',
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
      tags: [
        { name: 'type', value: use_enhanced ? `test_enhanced_${frequency}` : 'test_legacy' },
        { name: 'customer', value: sanitizeTagValue(typedContact.customer_name) }
      ]
    });

    console.log('[RESEND] Email send response received');

    if (emailResponse.error) {
      const errorMsg = emailResponse.error.message || JSON.stringify(emailResponse.error);
      console.error('[RESEND ERROR] Email send failed:', errorMsg);
      console.error('[RESEND ERROR] Full error:', JSON.stringify(emailResponse.error, null, 2));

      return res.status(500).json({
        success: false,
        error: 'Email sending failed',
        message: `Resend API error: ${errorMsg}`
      });
    }

    console.log('[RESEND SUCCESS] Email sent successfully');
    console.log('[RESEND SUCCESS] Email ID:', emailResponse.data?.id);

    // Log to database
    await supabase.from('customer_email_logs').insert({
      customer_contact_id: typedContact.id,
      customer_name: typedContact.customer_name,
      recipient_email: typedContact.contact_email,
      email_type: use_enhanced ? `test_enhanced_${frequency}` : 'test_legacy',
      email_subject: emailSubject,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      external_email_id: emailResponse.data?.id || null,
      locations_count: locations.length,
      low_fuel_alerts: lowFuelCount,
      critical_alerts: criticalCount
    });

    // Update last_email_sent_at on the contact record
    await supabase
      .from('customer_contacts')
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq('id', typedContact.id);

    const duration = Date.now() - startTime;

    console.log('[HANDLER SUCCESS] Test email completed successfully');
    console.log('[HANDLER SUCCESS] Duration:', duration, 'ms');

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        recipient: typedContact.contact_email,
        recipient_name: typedContact.contact_name,
        customer: typedContact.customer_name,
        tanks_included: locations.length,
        low_fuel_alerts: lowFuelCount,
        critical_alerts: criticalCount,
        email_id: emailResponse.data?.id,
        template_type: use_enhanced ? 'enhanced' : 'legacy',
        frequency: frequency,
        duration
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[HANDLER ERROR] Test email failed');
    console.error('[HANDLER ERROR] Error message:', (error as Error).message);
    console.error('[HANDLER ERROR] Error stack:', (error as Error).stack);
    console.error('[HANDLER ERROR] Error details:', JSON.stringify(error, null, 2));

    return res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
