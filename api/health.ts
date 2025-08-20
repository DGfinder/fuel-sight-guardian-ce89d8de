import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = {
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        envVars: Object.keys(process.env).length,
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
        hasLytxKey: !!process.env.LYTX_API_KEY
      },
      vercel: {
        region: process.env.VERCEL_REGION || 'unknown',
        deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'local'
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      ok: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}