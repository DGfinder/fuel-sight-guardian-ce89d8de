// Resend Webhook Handler
// Processes delivery events from Resend (bounces, complaints, delivered, etc.)
// URL: /api/webhooks/resend

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

// Webhook secret for security (optional - Resend provides signature verification)
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      type: 'hard' | 'soft';
      message: string;
    };
    complaint?: {
      type: string;
      message: string;
    };
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📧 Resend webhook received');
  console.log('Method:', req.method);
  console.log('Headers:', Object.keys(req.headers));

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return res.status(500).json({
      error: 'Server configuration error'
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'POST'
    });
  }

  // Optional: Verify webhook secret
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== WEBHOOK_SECRET) {
      console.error('Invalid webhook secret');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook secret'
      });
    }
  }

  try {
    const event = req.body as ResendWebhookEvent;

    console.log(`Event type: ${event.type}`);
    console.log(`Email ID: ${event.data.email_id}`);
    console.log(`To: ${event.data.to.join(', ')}`);

    switch (event.type) {
      case 'email.delivered':
        await handleDelivered(event);
        break;

      case 'email.bounced':
        await handleBounced(event);
        break;

      case 'email.complained':
        await handleComplaint(event);
        break;

      case 'email.opened':
        await handleOpened(event);
        break;

      case 'email.clicked':
        await handleClicked(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed',
      event_type: event.type
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: (error as Error).message
    });
  }
}

/**
 * Handle email delivered event
 */
async function handleDelivered(event: ResendWebhookEvent) {
  console.log('✅ Email delivered:', event.data.email_id);

  const { error } = await supabase
    .from('customer_email_logs')
    .update({
      delivery_status: 'delivered',
      delivered_at: event.created_at
    })
    .eq('external_email_id', event.data.email_id);

  if (error) {
    console.error('Failed to update delivery status:', error);
  }
}

/**
 * Handle email bounced event
 */
async function handleBounced(event: ResendWebhookEvent) {
  const bounceType = event.data.bounce?.type || 'hard';
  const bounceReason = event.data.bounce?.message || 'Unknown bounce reason';

  console.log(`🚫 Email bounced (${bounceType}):`, event.data.email_id);
  console.log('Reason:', bounceReason);

  // Update email log
  const { error: logError } = await supabase
    .from('customer_email_logs')
    .update({
      delivery_status: 'bounced',
      bounce_type: bounceType,
      bounce_reason: bounceReason
    })
    .eq('external_email_id', event.data.email_id);

  if (logError) {
    console.error('Failed to update bounce status:', logError);
  }

  // Call database function to handle bounce (auto-disables after 3 hard bounces)
  const { error: bounceError } = await supabase.rpc('record_email_bounce', {
    email_id: event.data.email_id,
    bounce_type: bounceType,
    bounce_reason: bounceReason
  });

  if (bounceError) {
    console.error('Failed to record bounce:', bounceError);
  }

  // If hard bounce, immediately disable the contact
  if (bounceType === 'hard') {
    const recipientEmail = event.data.to[0];

    const { error: disableError } = await supabase
      .from('customer_contacts')
      .update({
        enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('contact_email', recipientEmail);

    if (disableError) {
      console.error('Failed to disable contact:', disableError);
    } else {
      console.log(`Disabled contact due to hard bounce: ${recipientEmail}`);
    }
  }
}

/**
 * Handle spam complaint event
 */
async function handleComplaint(event: ResendWebhookEvent) {
  const complaintType = event.data.complaint?.type || 'spam';
  const complaintMessage = event.data.complaint?.message || 'Marked as spam';

  console.log(`⚠️ Spam complaint:`, event.data.email_id);
  console.log('Type:', complaintType);

  // Update email log
  const { error: logError } = await supabase
    .from('customer_email_logs')
    .update({
      delivery_status: 'bounced',
      bounce_type: 'complaint',
      bounce_reason: complaintMessage
    })
    .eq('external_email_id', event.data.email_id);

  if (logError) {
    console.error('Failed to update complaint status:', logError);
  }

  // Immediately disable the contact
  const recipientEmail = event.data.to[0];

  const { error: disableError } = await supabase
    .from('customer_contacts')
    .update({
      enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq('contact_email', recipientEmail);

  if (disableError) {
    console.error('Failed to disable contact:', disableError);
  } else {
    console.log(`Disabled contact due to spam complaint: ${recipientEmail}`);
  }
}

/**
 * Handle email opened event (optional - for engagement tracking)
 */
async function handleOpened(event: ResendWebhookEvent) {
  console.log('👁️ Email opened:', event.data.email_id);

  const { error } = await supabase
    .from('customer_email_logs')
    .update({
      opened_at: event.created_at
    })
    .eq('external_email_id', event.data.email_id);

  if (error) {
    console.error('Failed to update open status:', error);
  }
}

/**
 * Handle email clicked event (optional - for engagement tracking)
 */
async function handleClicked(event: ResendWebhookEvent) {
  console.log('🖱️ Email clicked:', event.data.email_id);

  const { error } = await supabase
    .from('customer_email_logs')
    .update({
      clicked_at: event.created_at
    })
    .eq('external_email_id', event.data.email_id);

  if (error) {
    console.error('Failed to update click status:', error);
  }
}
