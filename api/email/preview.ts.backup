/**
 * Email Preview API Endpoint
 * Allows admins to preview email content before sending
 * URL: POST /api/email/preview
 * Part of Phase 2: Configuration System
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateFuelReport } from '../lib/agbot-report-generator.js';
import { generateAgBotEmail } from '../lib/agbot-email-template.js';
import { getBrandingConfig } from '../lib/config.js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

interface CustomerContact {
  id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string | null;
  report_frequency: string;
  unsubscribe_token: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  console.log('[PREVIEW] Email preview endpoint called');
  console.log('[PREVIEW] Method:', req.method);

  if (!supabaseUrl || !supabaseKey) {
    console.error('[PREVIEW ERROR] Missing Supabase environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Supabase not configured'
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

  // Authentication check - require Bearer token
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const ADMIN_SECRET = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET;

  if (!token || token !== ADMIN_SECRET) {
    console.error('[PREVIEW AUTH ERROR] Unauthorized preview request');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid Bearer token required. Set ADMIN_API_SECRET environment variable.'
    });
  }

  console.log('[PREVIEW AUTH] Preview request authenticated successfully');

  try {
    // Get parameters from request body
    const {
      contact_id,
      use_enhanced = true,
      frequency = 'daily',
      format = 'html' // 'html', 'text', or 'both'
    } = req.body;

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

    // Validate format
    const validFormats = ['html', 'text', 'both'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: `Format must be one of: ${validFormats.join(', ')}`
      });
    }

    console.log('[PREVIEW] Fetching contact:', contact_id);

    // Fetch the specific contact
    const { data: contact, error: contactError } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('[PREVIEW] Contact not found:', contactError);
      return res.status(404).json({
        error: 'Contact not found',
        message: 'No customer contact found with that ID'
      });
    }

    const typedContact = contact as CustomerContact;
    let locations: any[] = [];

    console.log('[PREVIEW] Fetching tanks for contact:', typedContact.customer_name);

    // Step 1: Try to fetch specifically assigned tanks
    const { data: tankAssignments, error: assignmentsError } = await supabase
      .from('customer_contact_tanks')
      .select('agbot_location_id')
      .eq('customer_contact_id', typedContact.id);

    if (!assignmentsError && tankAssignments && tankAssignments.length > 0) {
      const tankIds = tankAssignments.map(a => a.agbot_location_id);
      const { data: assignedTanks, error: tanksError } = await supabase
        .from('ta_agbot_locations')
        .select(
          `
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          is_disabled,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        `
        )
        .in('id', tankIds);

      if (!tanksError && assignedTanks && assignedTanks.length > 0) {
        locations = assignedTanks.filter((loc: any) => !loc.is_disabled);
      }
    }

    if (locations.length === 0) {
      // Fallback - fetch ALL tanks for this customer
      const { data: allLocations, error: locationsError } = await supabase
        .from('ta_agbot_locations')
        .select(
          `
          id,
          name,
          address,
          customer_name,
          calibrated_fill_level,
          last_telemetry_at,
          ta_agbot_assets (
            id,
            is_online,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            device_serial,
            current_level_liters,
            ullage_liters,
            battery_voltage,
            commodity
          )
        `
        )
        .eq('customer_name', typedContact.customer_name)
        .eq('is_disabled', false);

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

    console.log('[PREVIEW] Found', locations.length, 'tanks');

    // Ensure contact has unsubscribe token (generate if missing)
    let unsubscribeToken = typedContact.unsubscribe_token;
    if (!unsubscribeToken) {
      unsubscribeToken = crypto.randomBytes(32).toString('hex');
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
      const asset = loc.ta_agbot_assets?.[0] || {};
      return {
        location_id: loc.name || 'Unknown',
        asset_id: asset.id || null,
        address1: loc.address || 'Unknown Location',
        latest_calibrated_fill_percentage: loc.calibrated_fill_level || 0,
        latest_telemetry: loc.last_telemetry_at,
        device_online: asset.is_online || false,
        asset_profile_water_capacity: asset.capacity_liters || null,
        asset_daily_consumption: asset.daily_consumption_liters || null,
        asset_days_remaining: asset.days_remaining || null,
        device_serial_number: asset.device_serial || null,
        asset_reported_litres: asset.current_level_liters || null,
        asset_refill_capacity_litres: asset.ullage_liters || null,
        device_battery_voltage: asset.battery_voltage || null,
        asset_profile_commodity: asset.commodity || null
      };
    });

    // Get branding config
    const brandingConfig = await getBrandingConfig(supabase);

    // Generate email HTML and plain text
    console.log('[PREVIEW] Generating email preview');
    console.log('[PREVIEW] Using enhanced template:', use_enhanced);
    console.log('[PREVIEW] Report frequency:', frequency);

    let emailHtml: string;
    let emailText: string;
    let emailSubject: string;

    if (use_enhanced) {
      // Use enhanced template with analytics
      const { html, text } = await generateFuelReport(
        supabase,
        emailData,
        {
          customerName: typedContact.customer_name,
          contactName: typedContact.contact_name || undefined,
          contactEmail: typedContact.contact_email,
          reportFrequency: frequency as 'daily' | 'weekly' | 'monthly',
          unsubscribeToken,
          logoUrl: brandingConfig.logoUrl,
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
      emailSubject = `PREVIEW - ${frequencyLabel} Fuel Report - ${typedContact.customer_name} - ${reportDate}`;
    } else {
      // Use legacy template
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
        reportDate: `${reportDate} (PREVIEW)`,
        unsubscribeUrl
      });
      emailHtml = result.html;
      emailText = result.text;
      emailSubject = `PREVIEW - Daily AgBot Report - ${typedContact.customer_name} - ${reportDate}`;
    }

    const duration = Date.now() - startTime;

    console.log('[PREVIEW] Email preview generated successfully');
    console.log('[PREVIEW] HTML length:', emailHtml.length);
    console.log('[PREVIEW] Text length:', emailText.length);
    console.log('[PREVIEW] Duration:', duration, 'ms');

    // Return based on requested format
    if (format === 'html') {
      // Return HTML directly for browser rendering
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(emailHtml);
    } else if (format === 'text') {
      // Return plain text
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(emailText);
    } else {
      // Return JSON with both formats
      return res.status(200).json({
        success: true,
        preview: {
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
          metadata: {
            contact_email: typedContact.contact_email,
            contact_name: typedContact.contact_name,
            customer_name: typedContact.customer_name,
            tanks_count: locations.length,
            template_type: use_enhanced ? 'enhanced' : 'legacy',
            frequency: frequency,
            duration
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[PREVIEW ERROR] Failed to generate preview');
    console.error('[PREVIEW ERROR] Error message:', (error as Error).message);
    console.error('[PREVIEW ERROR] Error stack:', (error as Error).stack);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate email preview',
      message: (error as Error).message,
      duration,
      timestamp: new Date().toISOString()
    });
  }
}
