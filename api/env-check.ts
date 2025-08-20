/**
 * ENVIRONMENT VARIABLE VERIFICATION ENDPOINT
 * 
 * Helps diagnose which environment variables are available in production
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const envCheck = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      
      // Supabase Environment Variables
      supabase: {
        url: !!process.env.VITE_SUPABASE_URL,
        urlValue: process.env.VITE_SUPABASE_URL ? 
          process.env.VITE_SUPABASE_URL.substring(0, 30) + '...' : 'undefined',
        anonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
        anonKeyValue: process.env.VITE_SUPABASE_ANON_KEY ? 
          process.env.VITE_SUPABASE_ANON_KEY.substring(0, 30) + '...' : 'undefined',
        serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      
      // Vercel Environment Variables
      vercel: {
        region: process.env.VERCEL_REGION || 'unknown',
        env: process.env.VERCEL_ENV || 'unknown',
        url: process.env.VERCEL_URL || 'unknown',
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown'
      },
      
      // Other API Keys
      apis: {
        lytx: !!process.env.VITE_LYTX_API_KEY,
        athara: !!process.env.VITE_ATHARA_API_KEY,
        blobToken: !!process.env.BLOB_READ_WRITE_TOKEN
      },
      
      // Environment Variable Count
      totalEnvVars: Object.keys(process.env).length,
      
      // VITE_ prefixed variables
      viteVars: Object.keys(process.env).filter(key => key.startsWith('VITE_')).length,
      viteVarsList: Object.keys(process.env).filter(key => key.startsWith('VITE_'))
    };

    return res.status(200).json(envCheck);
  } catch (error) {
    console.error('Environment check error:', error);
    return res.status(500).json({
      error: 'Failed to check environment variables',
      timestamp: new Date().toISOString()
    });
  }
}