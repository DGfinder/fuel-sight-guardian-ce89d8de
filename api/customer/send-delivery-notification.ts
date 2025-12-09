import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/**
 * API Route: Send Delivery Notification
 *
 * POST: Send email notifications for a delivery request
 * - Depot notification (order details)
 * - Customer confirmation (request received)
 *
 * Body: { deliveryRequestId: string }
 */

// AgBot customer email recipients (orders and key contacts)
const AGBOT_RECIPIENTS = [
  'orders.kewdale@gsfs.com.au',
  'Christopher.forte@gsfs.com.au',
  'hayden@stevemacs.com.au',
];

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

  const { deliveryRequestId } = req.body;

  if (!deliveryRequestId) {
    return res.status(400).json({ error: 'deliveryRequestId is required' });
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch delivery request with all related data
    const { data: request, error: requestError } = await supabase
      .from('delivery_requests')
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
          calibrated_fill_level,
          ta_agbot_assets (
            capacity_liters
          )
        )
      `)
      .eq('id', deliveryRequestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    const tank = request.ta_agbot_locations;
    const customerAccount = request.customer_accounts;

    // Get customer preferences for email
    const { data: preferences } = await supabase
      .from('customer_account_preferences')
      .select('delivery_notification_email, enable_delivery_confirmations')
      .eq('customer_account_id', request.customer_account_id)
      .maybeSingle();

    // Get customer email from auth
    let customerEmail = preferences?.delivery_notification_email;
    if (!customerEmail && customerAccount?.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(customerAccount.user_id);
      customerEmail = user?.email;
    }

    // Determine depot based on tank location
    const { data: depot } = await supabase
      .from('depot_contacts')
      .select('*')
      .eq('state', tank.state || 'WA')
      .eq('is_active', true)
      .limit(1)
      .single();

    const depotEmail = depot?.orders_email || 'orders@gsfs.com.au';

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Use verified domain from environment or fallback to tankalert.greatsouthernfuels.com.au
    const fromEmail = process.env.RESEND_VERIFIED_EMAIL || 'Tank Alert <alert@tankalert.greatsouthernfuels.com.au>';

    const errors: string[] = [];
    let depotSent = false;
    let customerSent = false;

    // Prepare email data
    const tankName = tank.name || tank.address || 'Tank';
    const tankAddress = tank.address || 'Address not available';
    const currentLevel = tank.calibrated_fill_level?.toFixed(1) || 'Unknown';
    const tankCapacity = Array.isArray(tank.ta_agbot_assets) && tank.ta_agbot_assets[0]?.capacity_liters
      ? tank.ta_agbot_assets[0].capacity_liters.toLocaleString()
      : 'Unknown';

    const requestedLitres = request.requested_litres
      ? `${request.requested_litres.toLocaleString()}L`
      : 'Full Tank';

    const priorityLabel = {
      standard: 'Standard (2-5 business days)',
      urgent: 'Urgent (1-2 business days)',
      scheduled: `Scheduled for ${request.requested_date ? new Date(request.requested_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'specific date'}`,
    }[request.request_type] || 'Standard';

    // 1. Send depot notification
    const depotSubject = `New Fuel Delivery Request - ${customerAccount?.customer_name || 'Customer'}`;
    const depotHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { font-weight: 600; width: 160px; color: #6b7280; }
    .detail-value { flex: 1; }
    .priority-urgent { color: #dc2626; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">New Delivery Request</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Action Required</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; color: #1f2937;">Customer Details</h2>
      <div class="detail-row">
        <div class="detail-label">Customer:</div>
        <div class="detail-value">${customerAccount?.customer_name || 'N/A'}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Contact:</div>
        <div class="detail-value">${customerAccount?.contact_name || 'N/A'}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Phone:</div>
        <div class="detail-value">${customerAccount?.contact_phone || 'N/A'}</div>
      </div>
      ${customerEmail ? `
      <div class="detail-row">
        <div class="detail-label">Email:</div>
        <div class="detail-value">${customerEmail}</div>
      </div>
      ` : ''}

      <h2 style="margin-top: 24px; color: #1f2937;">Tank Information</h2>
      <div class="detail-row">
        <div class="detail-label">Tank:</div>
        <div class="detail-value">${tankName}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Address:</div>
        <div class="detail-value">${tankAddress}${tank.state ? `, ${tank.state} ${tank.postcode || ''}` : ''}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Current Level:</div>
        <div class="detail-value"><strong>${currentLevel}%</strong></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Capacity:</div>
        <div class="detail-value">${tankCapacity}L</div>
      </div>

      <h2 style="margin-top: 24px; color: #1f2937;">Delivery Request</h2>
      <div class="detail-row">
        <div class="detail-label">Requested Amount:</div>
        <div class="detail-value">${requestedLitres}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Priority:</div>
        <div class="detail-value" ${request.request_type === 'urgent' ? 'class="priority-urgent"' : ''}>${priorityLabel}</div>
      </div>
      ${request.notes ? `
      <div class="detail-row">
        <div class="detail-label">Notes:</div>
        <div class="detail-value">${request.notes}</div>
      </div>
      ` : ''}

      <div style="margin-top: 24px; text-align: center;">
        <p style="color: #6b7280; margin-bottom: 12px;">Request submitted on ${new Date(request.created_at).toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">Great Southern Fuels | Automated Delivery Request System</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: AGBOT_RECIPIENTS,
        subject: depotSubject,
        html: depotHtml,
        tags: [
          { name: 'type', value: 'delivery_request' },
          { name: 'priority', value: request.request_type },
        ],
      });
      depotSent = true;
    } catch (error) {
      console.error('Failed to send depot email:', error);
      errors.push(`Depot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Send customer confirmation (if email available and enabled)
    if (customerEmail && preferences?.enable_delivery_confirmations !== false) {
      const customerSubject = 'Fuel Delivery Request Confirmed';
      const customerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .checkmark { font-size: 48px; margin-bottom: 16px; }
    .detail-box { background: white; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #10b981; }
    .footer { background: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="checkmark">✓</div>
      <h1 style="margin: 0;">Request Received</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Your fuel delivery request has been submitted</p>
    </div>
    <div class="content">
      <p>Hi${customerAccount?.contact_name ? ` ${customerAccount.contact_name}` : ''},</p>
      <p>We've received your fuel delivery request and our team will contact you shortly to schedule the delivery.</p>

      <div class="detail-box">
        <h3 style="margin-top: 0; color: #1f2937;">Request Summary</h3>
        <p style="margin: 8px 0;"><strong>Tank:</strong> ${tankName}</p>
        <p style="margin: 8px 0;"><strong>Current Level:</strong> ${currentLevel}%</p>
        <p style="margin: 8px 0;"><strong>Priority:</strong> ${priorityLabel}</p>
        <p style="margin: 8px 0;"><strong>Requested Amount:</strong> ${requestedLitres}</p>
      </div>

      <h3>What happens next?</h3>
      <ol>
        <li>Our dispatch team will review your request</li>
        <li>We'll contact you to confirm delivery date and time</li>
        <li>You'll receive a notification when the delivery is scheduled</li>
      </ol>

      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Need to make changes or have questions? Reply to this email or call us at ${depot?.phone || '1300 XXX XXX'}.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Great Southern Fuels</p>
      <p style="margin: 4px 0 0 0;">Email: ${depotEmail} | Phone: ${depot?.phone || '1300 XXX XXX'}</p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: customerEmail,
          subject: customerSubject,
          html: customerHtml,
          replyTo: depotEmail,
          tags: [
            { name: 'type', value: 'delivery_confirmation' },
          ],
        });
        customerSent = true;
      } catch (error) {
        console.error('Failed to send customer email:', error);
        errors.push(`Customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update delivery request with email status
    await supabase
      .from('delivery_requests')
      .update({
        depot_email: depotEmail,
        customer_email: customerEmail,
        notification_sent_at: new Date().toISOString(),
        notification_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', deliveryRequestId);

    return res.status(200).json({
      success: true,
      depot_sent: depotSent,
      customer_sent: customerSent,
      emails: {
        depot: depotEmail,
        customer: customerEmail || null,
      },
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    console.error('Send delivery notification error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
