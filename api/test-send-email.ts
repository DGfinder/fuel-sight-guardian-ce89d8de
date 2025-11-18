// Test Email API Endpoint
// Allows admins to send a test email to a specific customer contact
// URL: POST /api/test-send-email

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateAgBotEmailHtml } from './lib/agbot-email-template';

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
    // Get contact_id from request body
    const { contact_id } = req.body;

    if (!contact_id) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'contact_id is required'
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
            device_online,
            asset_profile_water_capacity,
            asset_daily_consumption,
            asset_days_remaining,
            device_serial_number
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
            device_online,
            asset_profile_water_capacity,
            asset_daily_consumption,
            asset_days_remaining,
            device_serial_number
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

    // Transform data for email template
    const emailData = locations.map((loc: any) => {
      const asset = loc.agbot_assets?.[0] || {};
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

    // Generate email HTML
    console.log('[EMAIL TEMPLATE] Generating email HTML for', typedContact.customer_name);
    const reportDate = new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log('[EMAIL TEMPLATE] Report date:', reportDate);
    console.log('[EMAIL TEMPLATE] Locations count:', emailData.length);

    const emailHtml = generateAgBotEmailHtml({
      customerName: typedContact.customer_name,
      contactName: typedContact.contact_name || undefined,
      locations: emailData,
      reportDate: `${reportDate} (TEST EMAIL)`
    });

    console.log('[EMAIL TEMPLATE] HTML generated, length:', emailHtml.length);

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

    const emailResponse = await resendClient.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: typedContact.contact_email,
      subject: `🧪 TEST - Daily AgBot Report - ${typedContact.customer_name} - ${reportDate}`,
      html: emailHtml,
      replyTo: 'support@greatsouthernfuel.com.au',
      tags: [
        { name: 'type', value: 'test' },
        { name: 'customer', value: typedContact.customer_name }
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
      email_type: 'test',
      email_subject: `🧪 TEST - Daily AgBot Report - ${typedContact.customer_name}`,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      external_email_id: emailResponse.data?.id || null,
      locations_count: locations.length,
      low_fuel_alerts: lowFuelCount,
      critical_alerts: criticalCount
    });

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
