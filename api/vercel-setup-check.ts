/**
 * VERCEL SETUP CHECK API ENDPOINT
 * 
 * API endpoint to verify Vercel integration setup and provide
 * recommendations for optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { runVercelSetupCheck, printSetupReport } from '@/lib/vercel-setup-check';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Running Vercel setup verification...');
    
    const report = await runVercelSetupCheck();
    
    // Print to server console
    printSetupReport(report);
    
    return NextResponse.json({
      success: true,
      data: report,
      message: 'Setup verification completed'
    });

  } catch (error) {
    console.error('❌ Setup verification failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup verification failed',
        data: null
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'quick-check':
        // Quick verification for development
        const { quickVercelCheck } = await import('@/lib/vercel-setup-check');
        const isReady = await quickVercelCheck();
        
        return NextResponse.json({
          success: true,
          data: { ready: isReady },
          message: isReady ? 'Vercel services ready' : 'Some services need setup'
        });

      case 'detailed-check':
        // Full detailed report
        const detailedReport = await runVercelSetupCheck();
        
        return NextResponse.json({
          success: true,
          data: detailedReport,
          message: 'Detailed setup verification completed'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use "quick-check" or "detailed-check"' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Setup check API failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup check failed'
      },
      { status: 500 }
    );
  }
}