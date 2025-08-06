/**
 * VERCEL SETUP CHECK API ENDPOINT
 * 
 * API endpoint to verify Vercel integration setup and provide
 * recommendations for optimization
 */

import { runVercelSetupCheck, printSetupReport } from './lib/vercel-setup-check';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      console.log('🚀 Running Vercel setup verification...');
      
      const report = await runVercelSetupCheck();
      
      // Print to server console
      printSetupReport(report);
      
      return res.json({
        success: true,
        data: report,
        message: 'Setup verification completed'
      });

    } catch (error) {
      console.error('❌ Setup verification failed:', error);
      
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Setup verification failed',
        data: null
      });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { action } = req.body;

      switch (action) {
        case 'quick-check':
          // Quick verification for development
          const { quickVercelCheck } = await import('./lib/vercel-setup-check');
          const isReady = await quickVercelCheck();
          
          return res.json({
            success: true,
            data: { ready: isReady },
            message: isReady ? 'Vercel services ready' : 'Some services need setup'
          });

        case 'detailed-check':
          // Full detailed report
          const detailedReport = await runVercelSetupCheck();
          
          return res.json({
            success: true,
            data: detailedReport,
            message: 'Detailed setup verification completed'
          });

        default:
          return res.status(400).json({
            success: false, 
            error: 'Invalid action. Use "quick-check" or "detailed-check"'
          });
      }

    } catch (error) {
      console.error('❌ Setup check API failed:', error);
      
      return res.status(500).json({
        success: false, 
        error: error instanceof Error ? error.message : 'Setup check failed'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}