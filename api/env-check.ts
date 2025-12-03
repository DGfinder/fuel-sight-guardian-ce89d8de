/**
 * ENVIRONMENT HEALTH CHECK ENDPOINT
 *
 * SECURITY: Only shows boolean status, no values or variable names exposed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // SECURITY: Only expose boolean health status, never values or variable names
    const healthCheck = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

      // Only boolean checks - no values exposed
      services: {
        // Check backend-only environment variables (not VITE_ prefixed)
        database: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY,
        storage: !!process.env.BLOB_READ_WRITE_TOKEN,
        configured: !!(
          process.env.SUPABASE_URL &&
          process.env.SUPABASE_ANON_KEY
        )
      },

      status: 'ok'
    };

    return res.status(200).json(healthCheck);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
}
