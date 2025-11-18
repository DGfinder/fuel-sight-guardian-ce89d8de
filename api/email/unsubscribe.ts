// Unsubscribe API Endpoint
// Handles one-click unsubscribe and email preference management
// URL: /api/email/unsubscribe

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration error'
    });
  }

  // Support both GET and POST for one-click unsubscribe
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      expected: 'GET or POST'
    });
  }

  try {
    // Get token from query string (GET) or body (POST)
    const token = (req.query.token as string) || req.body?.token;

    if (!token) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'Unsubscribe token is required'
      });
    }

    // Call database function to handle unsubscribe
    const { data, error } = await supabase.rpc('unsubscribe_contact', {
      token
    });

    if (error) {
      console.error('Unsubscribe error:', error);
      return res.status(500).json({
        error: 'Failed to unsubscribe',
        message: error.message
      });
    }

    // Parse the JSONB result
    const result = data as { success: boolean; message: string; email?: string; customer?: string };

    if (!result.success) {
      return res.status(404).json({
        error: 'Invalid token',
        message: result.message
      });
    }

    // For POST requests (one-click unsubscribe), return plain text
    if (req.method === 'POST') {
      return res.status(200).send('You have been successfully unsubscribed.');
    }

    // For GET requests, return HTML page
    const htmlPage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed - AgBot Email Reports</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f6f9fc;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 500px;
            text-align: center;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #1f2937;
            font-size: 24px;
            margin: 0 0 10px 0;
          }
          p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.5;
            margin: 0 0 20px 0;
          }
          .email {
            background-color: #f9fafb;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            color: #374151;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #0ea5e9;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #0284c7;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from AgBot daily email reports for <strong>${result.customer}</strong>.</p>
          <div class="email">${result.email}</div>
          <p>You will no longer receive automated tank monitoring reports at this email address.</p>
          <a href="/email/preferences?token=${encodeURIComponent(token)}" class="button">
            Manage Preferences
          </a>
          <div class="footer">
            <p>Changed your mind? You can re-enable emails from the preferences page.</p>
            <p>For support, contact <a href="mailto:support@greatsouthernfuel.com.au" style="color: #0ea5e9;">support@greatsouthernfuel.com.au</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return res.status(200).setHeader('Content-Type', 'text/html').send(htmlPage);
  } catch (error) {
    console.error('Unsubscribe handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
}
