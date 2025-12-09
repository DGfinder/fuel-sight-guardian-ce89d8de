import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/**
 * API Route: Send Hazard Report Notification
 *
 * POST: Send email notification to dispatch team about a reported hazard
 *
 * Body: { hazardReportId: string }
 */

// AgBot customer email recipients (orders and key contacts)
const AGBOT_RECIPIENTS = [
  'orders.kewdale@gsfs.com.au',
  'Christopher.forte@gsfs.com.au',
  'hayden@stevemacs.com.au',
];

const SEVERITY_COLORS: Record<string, string> = {
  low: '#3B82F6',      // blue
  medium: '#F59E0B',   // yellow/amber
  high: '#F97316',     // orange
  critical: '#EF4444', // red
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'CRITICAL',
};

const HAZARD_TYPE_LABELS: Record<string, string> = {
  // Access hazards
  locked_gate: 'Locked Gate',
  road_damage: 'Road Damage',
  blocked_path: 'Blocked Path',
  overgrown_vegetation: 'Overgrown Vegetation',
  flooding: 'Flooding',
  other_access: 'Other Access Issue',
  // Safety hazards
  fuel_spill: 'Fuel Spill',
  fuel_leak: 'Fuel Leak',
  damaged_equipment: 'Damaged Equipment',
  power_lines: 'Power Lines/Electrical Hazard',
  structural_damage: 'Structural Damage',
  fire_risk: 'Fire Risk',
  other_safety: 'Other Safety Hazard',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get configuration
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  if (!resendApiKey) {
    return res.status(500).json({ error: 'Missing Resend API key' });
  }

  const { hazardReportId } = req.body;

  if (!hazardReportId) {
    return res.status(400).json({ error: 'hazardReportId is required' });
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch hazard report with all related data
    const { data: report, error: reportError } = await supabase
      .from('hazard_reports')
      .select(`
        *,
        customer_accounts (
          customer_name,
          contact_name,
          contact_phone,
          user_id
        ),
        ta_agbot_locations (
          id,
          name,
          address,
          state,
          postcode,
          latitude,
          longitude
        )
      `)
      .eq('id', hazardReportId)
      .single();

    if (reportError || !report) {
      console.error('Error fetching hazard report:', reportError);
      return res.status(404).json({ error: 'Hazard report not found' });
    }

    const tank = report.ta_agbot_locations;
    const customerAccount = report.customer_accounts;

    // Get customer email from auth
    let customerEmail = '';
    if (customerAccount?.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(customerAccount.user_id);
      customerEmail = user?.email || '';
    }

    // Determine dispatch email based on tank state
    let dispatchEmail = 'dispatch@gsfs.com.au'; // Default
    if (tank?.state) {
      const { data: depot } = await supabase
        .from('depot_contacts')
        .select('orders_email')
        .eq('state', tank.state)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (depot?.orders_email) {
        dispatchEmail = depot.orders_email;
      }
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Prepare email content
    const severityColor = SEVERITY_COLORS[report.severity] || SEVERITY_COLORS.medium;
    const severityLabel = SEVERITY_LABELS[report.severity] || 'Unknown';
    const hazardTypeLabel = HAZARD_TYPE_LABELS[report.hazard_type] || report.hazard_type;
    const categoryLabel = report.hazard_category === 'access' ? 'Access Issue' : 'Safety Hazard';
    const reportedAt = new Date(report.reported_at).toLocaleString('en-AU', {
      timeZone: 'Australia/Perth',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Build tank location string
    const tankLocation = tank
      ? [tank.name, tank.address, tank.state, tank.postcode].filter(Boolean).join(', ')
      : 'No specific tank selected';

    // Build Google Maps link if coordinates available
    const mapLink = tank?.latitude && tank?.longitude
      ? `https://www.google.com/maps?q=${tank.latitude},${tank.longitude}`
      : null;

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
    .section h3 { margin: 0 0 10px 0; color: #374151; font-size: 14px; text-transform: uppercase; }
    .section p { margin: 0; color: #111827; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; }
    .severity { background: ${severityColor}20; color: ${severityColor}; }
    .category { background: ${report.hazard_category === 'safety' ? '#FEE2E2' : '#FEF3C7'}; color: ${report.hazard_category === 'safety' ? '#DC2626' : '#D97706'}; }
    .photo-link { color: #2563EB; text-decoration: underline; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>HAZARD REPORTED</h1>
    <p>${severityLabel} Priority - ${categoryLabel}</p>
  </div>

  <div class="content">
    <div class="section">
      <h3>Hazard Details</h3>
      <p><span class="badge category">${categoryLabel}</span> <span class="badge severity">${severityLabel}</span></p>
      <p style="margin-top: 10px;"><strong>Type:</strong> ${hazardTypeLabel}</p>
    </div>

    <div class="section">
      <h3>Description</h3>
      <p>${report.description}</p>
      ${report.location_description ? `<p style="margin-top: 10px;"><strong>Location Notes:</strong> ${report.location_description}</p>` : ''}
    </div>

    ${report.photo_url ? `
    <div class="section">
      <h3>Photo</h3>
      <p><a href="${report.photo_url}" class="photo-link" target="_blank">View Photo</a></p>
    </div>
    ` : ''}

    <div class="section">
      <h3>Tank Location</h3>
      <p>${tankLocation}</p>
      ${mapLink ? `<p style="margin-top: 10px;"><a href="${mapLink}" class="photo-link" target="_blank">View on Google Maps</a></p>` : ''}
    </div>

    <div class="section">
      <h3>Reported By</h3>
      <p><strong>Customer:</strong> ${customerAccount?.customer_name || 'Unknown'}</p>
      <p><strong>Contact:</strong> ${customerAccount?.contact_name || 'N/A'}</p>
      <p><strong>Phone:</strong> ${customerAccount?.contact_phone || 'N/A'}</p>
      <p><strong>Email:</strong> ${customerEmail || 'N/A'}</p>
      <p><strong>Reported:</strong> ${reportedAt} (AWST)</p>
    </div>
  </div>

  <div class="footer">
    <p>This notification was automatically generated by TankAlert.</p>
    <p>Please review and take appropriate action before scheduling deliveries to this location.</p>
  </div>
</body>
</html>
    `.trim();

    // Send email to AgBot recipients
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: 'TankAlert <alerts@gsfs.com.au>',
      to: AGBOT_RECIPIENTS,
      subject: `[${severityLabel}] Hazard Report: ${hazardTypeLabel} at ${tank?.name || 'Unknown Location'}`,
      html: emailHtml,
    });

    if (sendError) {
      console.error('Error sending hazard notification:', sendError);

      // Update report with error
      await supabase
        .from('hazard_reports')
        .update({
          notification_error: sendError.message || 'Failed to send email',
        })
        .eq('id', hazardReportId);

      return res.status(500).json({ error: 'Failed to send notification', details: sendError });
    }

    // Update report with notification timestamp
    await supabase
      .from('hazard_reports')
      .update({
        dispatch_notified_at: new Date().toISOString(),
        notification_error: null,
      })
      .eq('id', hazardReportId);

    return res.status(200).json({
      success: true,
      message: 'Hazard notification sent successfully',
      emailId: sendResult?.id,
    });
  } catch (error) {
    console.error('Error in send-hazard-notification:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
