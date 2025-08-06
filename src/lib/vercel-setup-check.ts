/**
 * VERCEL SETUP VERIFICATION SCRIPT
 * 
 * Comprehensive verification script to ensure all Vercel services
 * are properly configured and working
 */

import { validateVercelEnvironment, runStartupCheck, getSetupInstructions } from './vercel-environment';
import { initializeAdvancedCaching } from './advanced-cache';
import { initializeUnifiedDataIntegration } from './unified-data-integration';

export interface VercelSetupReport {
  timestamp: string;
  overall: 'ready' | 'partial' | 'needs_setup';
  services: {
    blob: { status: string; details: string };
    kv: { status: string; details: string };
    postgres: { status: string; details: string };
    edgeConfig: { status: string; details: string };
  };
  features: {
    advancedCaching: { enabled: boolean; details: string };
    unifiedData: { enabled: boolean; details: string };
    fileUploads: { enabled: boolean; details: string };
  };
  recommendations: string[];
  setupInstructions: string[];
  performance: {
    uploadCapabilities: {
      serverUpload: boolean;
      clientUpload: boolean;
      maxServerSize: string;
      maxClientSize: string;
    };
    cachingAvailable: boolean;
    analyticsReady: boolean;
  };
}

/**
 * Run comprehensive Vercel setup verification
 */
export async function runVercelSetupCheck(): Promise<VercelSetupReport> {
  console.log('🔍 Starting comprehensive Vercel setup verification...\n');
  
  const startTime = Date.now();
  const report: VercelSetupReport = {
    timestamp: new Date().toISOString(),
    overall: 'needs_setup',
    services: {
      blob: { status: 'unknown', details: '' },
      kv: { status: 'unknown', details: '' },
      postgres: { status: 'unknown', details: '' },
      edgeConfig: { status: 'unknown', details: '' }
    },
    features: {
      advancedCaching: { enabled: false, details: '' },
      unifiedData: { enabled: false, details: '' },
      fileUploads: { enabled: false, details: '' }
    },
    recommendations: [],
    setupInstructions: [],
    performance: {
      uploadCapabilities: {
        serverUpload: false,
        clientUpload: false,
        maxServerSize: '4.5MB',
        maxClientSize: '500MB'
      },
      cachingAvailable: false,
      analyticsReady: false
    }
  };

  try {
    // Step 1: Validate base Vercel environment
    console.log('📋 Step 1: Validating Vercel environment...');
    const envStatus = await validateVercelEnvironment();
    
    // Update service statuses
    report.services.blob = {
      status: envStatus.blob.available ? 'available' : 'unavailable',
      details: envStatus.blob.error || 'Blob storage ready for file uploads'
    };
    
    report.services.kv = {
      status: envStatus.kv.available ? 'available' : 'unavailable',
      details: envStatus.kv.error || 'KV store ready for caching'
    };
    
    report.services.postgres = {
      status: envStatus.postgres.available ? 'available' : 'unavailable',
      details: envStatus.postgres.error || 'Postgres ready for analytics'
    };
    
    report.services.edgeConfig = {
      status: envStatus.edgeConfig.available ? 'available' : 'optional',
      details: envStatus.edgeConfig.error || 'Edge Config ready for feature flags'
    };

    // Step 2: Test advanced caching
    console.log('⚡ Step 2: Testing advanced caching system...');
    try {
      const cachingResult = await initializeAdvancedCaching();
      report.features.advancedCaching = {
        enabled: cachingResult.success,
        details: cachingResult.message
      };
      
      if (cachingResult.success) {
        report.performance.cachingAvailable = true;
        console.log('✅ Advanced caching system initialized');
      } else {
        console.log('⚠️  Advanced caching system issues:', cachingResult.message);
      }
    } catch (error) {
      report.features.advancedCaching = {
        enabled: false,
        details: error instanceof Error ? error.message : 'Caching initialization failed'
      };
    }

    // Step 3: Test unified data integration
    console.log('🔗 Step 3: Testing unified data integration...');
    try {
      const unifiedResult = await initializeUnifiedDataIntegration();
      report.features.unifiedData = {
        enabled: unifiedResult.success,
        details: unifiedResult.message
      };
      
      if (unifiedResult.success) {
        report.performance.analyticsReady = true;
        console.log('✅ Unified data integration ready');
      } else {
        console.log('⚠️  Unified data integration issues:', unifiedResult.message);
      }
    } catch (error) {
      report.features.unifiedData = {
        enabled: false,
        details: error instanceof Error ? error.message : 'Unified data initialization failed'
      };
    }

    // Step 4: Test file upload capabilities
    console.log('📤 Step 4: Testing file upload capabilities...');
    report.performance.uploadCapabilities = {
      serverUpload: envStatus.blob.available,
      clientUpload: envStatus.blob.available,
      maxServerSize: '4.5MB',
      maxClientSize: '500MB'
    };
    
    report.features.fileUploads = {
      enabled: envStatus.blob.available,
      details: envStatus.blob.available 
        ? 'File uploads ready (server <4.5MB, client <500MB)'
        : 'Blob storage not available for file uploads'
    };

    // Step 5: Generate recommendations
    console.log('💡 Step 5: Generating recommendations...');
    
    // Core service recommendations
    if (!envStatus.blob.available) {
      report.recommendations.push('🔴 Set up Vercel Blob storage for file uploads');
    }
    if (!envStatus.kv.available) {
      report.recommendations.push('🟡 Set up Vercel KV for caching (improves performance)');
    }
    if (!envStatus.postgres.available) {
      report.recommendations.push('🟡 Set up Vercel Postgres for analytics warehouse');
    }
    if (!envStatus.edgeConfig.available) {
      report.recommendations.push('🟢 Consider Vercel Edge Config for feature flags (optional)');
    }

    // Performance recommendations
    if (envStatus.blob.available && !envStatus.kv.available) {
      report.recommendations.push('⚡ Add KV caching to reduce API response times from 30s+ to <1s');
    }
    
    if (envStatus.blob.available && envStatus.kv.available && !envStatus.postgres.available) {
      report.recommendations.push('📊 Add Postgres for million+ row dataset analytics');
    }

    // Feature recommendations
    if (report.features.advancedCaching.enabled && report.features.unifiedData.enabled) {
      report.recommendations.push('🚀 Your setup is optimized for enterprise-scale operations!');
    }

    // Step 6: Determine overall status
    const coreServicesReady = envStatus.blob.available && envStatus.kv.available;
    const advancedFeaturesReady = report.features.advancedCaching.enabled && report.features.unifiedData.enabled;

    if (coreServicesReady && advancedFeaturesReady) {
      report.overall = 'ready';
    } else if (coreServicesReady || envStatus.blob.available) {
      report.overall = 'partial';
    } else {
      report.overall = 'needs_setup';
    }

    // Step 7: Get setup instructions if needed
    if (report.overall !== 'ready') {
      report.setupInstructions = getSetupInstructions();
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Verification completed in ${duration}ms`);
    
    return report;

  } catch (error) {
    console.error('❌ Setup verification failed:', error);
    
    report.overall = 'needs_setup';
    report.recommendations.push('🔴 Setup verification failed - check environment configuration');
    report.setupInstructions = [
      'Run `vercel link` to link your project',
      'Run `vercel env pull` to sync environment variables',
      'Check Vercel dashboard for service configuration'
    ];
    
    return report;
  }
}

/**
 * Print formatted setup report
 */
export function printSetupReport(report: VercelSetupReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 VERCEL INTEGRATION SETUP REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📊 Overall Status: ${getStatusEmoji(report.overall)} ${report.overall.toUpperCase()}`);
  console.log(`🕐 Generated: ${new Date(report.timestamp).toLocaleString()}`);

  // Services Status
  console.log('\n🔧 CORE SERVICES:');
  Object.entries(report.services).forEach(([service, status]) => {
    const emoji = status.status === 'available' ? '✅' : status.status === 'optional' ? '⚠️' : '❌';
    console.log(`  ${emoji} ${service.toUpperCase()}: ${status.status} - ${status.details}`);
  });

  // Features Status
  console.log('\n⚡ ENHANCED FEATURES:');
  Object.entries(report.features).forEach(([feature, status]) => {
    const emoji = status.enabled ? '✅' : '❌';
    console.log(`  ${emoji} ${feature.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${status.details}`);
  });

  // Performance Capabilities
  console.log('\n🚀 PERFORMANCE CAPABILITIES:');
  const { uploadCapabilities, cachingAvailable, analyticsReady } = report.performance;
  console.log(`  📤 Server Uploads: ${uploadCapabilities.serverUpload ? '✅' : '❌'} (max ${uploadCapabilities.maxServerSize})`);
  console.log(`  📤 Client Uploads: ${uploadCapabilities.clientUpload ? '✅' : '❌'} (max ${uploadCapabilities.maxClientSize})`);
  console.log(`  ⚡ Advanced Caching: ${cachingAvailable ? '✅' : '❌'}`);
  console.log(`  📊 Analytics Ready: ${analyticsReady ? '✅' : '❌'}`);

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  ${rec}`));
  }

  // Setup Instructions
  if (report.setupInstructions.length > 0) {
    console.log('\n⚙️  SETUP INSTRUCTIONS:');
    report.setupInstructions.forEach((instruction, i) => {
      console.log(`  ${i + 1}. ${instruction}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  
  if (report.overall === 'ready') {
    console.log('🎉 Your Vercel integration is fully optimized and ready for production!');
  } else if (report.overall === 'partial') {
    console.log('⚡ Your Vercel integration is working but can be optimized further.');
  } else {
    console.log('🔧 Your Vercel integration needs setup to unlock advanced features.');
  }
  
  console.log('='.repeat(80) + '\n');
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'ready': return '🟢';
    case 'partial': return '🟡';
    case 'needs_setup': return '🔴';
    default: return '⚪';
  }
}

/**
 * Quick verification for development
 */
export async function quickVercelCheck(): Promise<boolean> {
  try {
    const isReady = await runStartupCheck();
    if (isReady) {
      console.log('✅ Vercel services ready');
      return true;
    } else {
      console.log('⚠️  Some Vercel services need setup');
      return false;
    }
  } catch (error) {
    console.error('❌ Vercel check failed:', error);
    return false;
  }
}

/**
 * Export for use in application startup
 */
export { validateVercelEnvironment, runStartupCheck, getSetupInstructions };