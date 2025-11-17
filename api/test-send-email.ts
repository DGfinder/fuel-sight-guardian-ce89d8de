// Test Email API Endpoint
// Allows admins to send a test email to a specific customer contact
// URL: POST /api/test-send-email

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import AgBotDailyReport from '../src/emails/agbot-daily-report';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email
const DEFAULT_FROM_EMAIL = 'AgBot Alerts <alerts@greatsouthernfuel.com.au>';

interface CustomerContact {
  id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string | null;
  report_frequency: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  console.log('\n📧 TEST EMAIL REQUEST');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);

  // Environment check
  if (!supabaseUrl || !supabaseKey || !process.env.RESEND_API_KEY) {
    console.error('💥 Missing environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables'
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

    console.log(`📋 Fetching contact: ${contact_id}`);

    // Fetch the specific contact
    const { data: contact, error: contactError } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('❌ Contact not found:', contactError);
      return res.status(404).json({
        error: 'Contact not found',
        message: 'No customer contact found with that ID'
      });
    }

    const typedContact = contact as CustomerContact;
    console.log(`✅ Found contact: ${typedContact.contact_name || 'N/A'} <${typedContact.contact_email}>`);

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
      console.log(`   🎯 Using ${locations.length} specifically assigned tank(s)`);
    } else {
      // Fallback - fetch ALL tanks for this customer
      console.log(`   ℹ️  No specific tanks assigned, using all customer tanks...`);
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
      console.log(`   ✅ Using ${locations.length} total customer tank(s)`);
    }

    if (!locations || locations.length === 0) {
      console.log(`   ⚠️  No tanks found for ${typedContact.customer_name}`);
      return res.status(400).json({
        error: 'No tanks found',
        message: `No AgBot tanks found for customer: ${typedContact.customer_name}`,
        suggestion: 'Make sure tanks exist and are not disabled'
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

    // Render email template
    const reportDate = new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = render(
      AgBotDailyReport({
        customerName: typedContact.customer_name,
        contactName: typedContact.contact_name || undefined,
        locations: emailData,
        reportDate: `${reportDate} (TEST EMAIL)`
      })
    );

    // Send email via Resend
    console.log(`   📧 Sending test email to ${typedContact.contact_email}...`);
    const emailResponse = await resend.emails.send({
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

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message}`);
    }

    console.log(`   ✅ Test email sent! ID: ${emailResponse.data?.id}`);

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

    console.log('\n📈 TEST EMAIL SENT SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`✅ Recipient: ${typedContact.contact_email}`);
    console.log(`📊 Tanks included: ${locations.length}`);
    console.log(`⚠️  Low fuel alerts: ${lowFuelCount}`);
    console.log(`🚨 Critical alerts: ${criticalCount}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📬 Email ID: ${emailResponse.data?.id}`);
    console.log('='.repeat(50));

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

    console.error('\n💥 TEST EMAIL FAILED');
    console.error('Error:', (error as Error).message);
    console.error('Stack:', (error as Error).stack);

    return res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
