/**
 * VERCEL ENVIRONMENT VALIDATION
 * 
 * Validates Vercel environment setup and provides utilities
 * for checking service availability and configuration
 */

// Environment validation
export interface VercelEnvironmentStatus {
  blob: {
    available: boolean;
    token: boolean;
    error?: string;
  };
  kv: {
    available: boolean;
    configured: boolean;
    error?: string;
  };
  postgres: {
    available: boolean;
    connectionString: boolean;
    error?: string;
  };
  edgeConfig: {
    available: boolean;
    configured: boolean;
    error?: string;
  };
  overall: 'ready' | 'partial' | 'misconfigured';
}

/**
 * Check if we're running in a Vercel environment
 */
export function isVercelEnvironment(): boolean {
  return typeof process !== 'undefined' && 
         (!!process.env.VERCEL || !!process.env.VERCEL_ENV);
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || 
         process.env.VERCEL_ENV === 'production';
}

/**
 * Validate Vercel Blob configuration
 */
async function validateBlobConfiguration(): Promise<{
  available: boolean;
  token: boolean;
  error?: string;
}> {
  try {
    // Check for blob token
    const hasToken = !!(
      process.env.BLOB_READ_WRITE_TOKEN || 
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN
    );

    if (!hasToken) {
      return {
        available: false,
        token: false,
        error: 'BLOB_READ_WRITE_TOKEN environment variable not found'
      };
    }

    // Try to import and test blob functionality
    const { list } = await import('@vercel/blob');
    
    // Test basic functionality with a simple list call
    await list({ limit: 1 });
    
    return {
      available: true,
      token: true
    };
  } catch (error) {
    return {
      available: false,
      token: !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN),
      error: error instanceof Error ? error.message : 'Unknown blob configuration error'
    };
  }
}

/**
 * Validate Vercel KV configuration
 */
async function validateKVConfiguration(): Promise<{
  available: boolean;
  configured: boolean;
  error?: string;
}> {
  try {
    // Check for KV environment variables
    const hasConfig = !!(
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ||
      process.env.VERCEL_KV_REST_API_URL && process.env.VERCEL_KV_REST_API_TOKEN
    );

    if (!hasConfig) {
      return {
        available: false,
        configured: false,
        error: 'KV environment variables not found'
      };
    }

    // Try to import and test KV functionality
    const { kv } = await import('@vercel/kv');
    
    // Test basic functionality
    await kv.ping();
    
    return {
      available: true,
      configured: true
    };
  } catch (error) {
    return {
      available: false,
      configured: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
      error: error instanceof Error ? error.message : 'Unknown KV configuration error'
    };
  }
}

/**
 * Validate Vercel Postgres configuration
 */
async function validatePostgresConfiguration(): Promise<{
  available: boolean;
  connectionString: boolean;
  error?: string;
}> {
  try {
    // Check for Postgres connection string
    const hasConnectionString = !!(
      process.env.POSTGRES_URL ||
      process.env.VERCEL_POSTGRES_URL ||
      process.env.DATABASE_URL
    );

    if (!hasConnectionString) {
      return {
        available: false,
        connectionString: false,
        error: 'Postgres connection string not found'
      };
    }

    // Try to import and test Postgres functionality
    const { sql } = await import('@vercel/postgres');
    
    // Test basic connectivity with a simple query
    await sql`SELECT 1 as test`;
    
    return {
      available: true,
      connectionString: true
    };
  } catch (error) {
    return {
      available: false,
      connectionString: !!(process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL),
      error: error instanceof Error ? error.message : 'Unknown Postgres configuration error'
    };
  }
}

/**
 * Validate Vercel Edge Config
 */
async function validateEdgeConfigConfiguration(): Promise<{
  available: boolean;
  configured: boolean;
  error?: string;
}> {
  try {
    // Check for Edge Config
    const hasConfig = !!(
      process.env.EDGE_CONFIG ||
      process.env.VERCEL_EDGE_CONFIG
    );

    if (!hasConfig) {
      return {
        available: false,
        configured: false,
        error: 'Edge Config not configured (optional service)'
      };
    }

    // Try to import and test Edge Config functionality
    const { get } = await import('@vercel/edge-config');
    
    // Test basic functionality (this may fail if no config exists)
    try {
      await get('test_key');
    } catch (e) {
      // It's ok if the key doesn't exist, we just want to test connectivity
    }
    
    return {
      available: true,
      configured: true
    };
  } catch (error) {
    return {
      available: false,
      configured: !!process.env.EDGE_CONFIG,
      error: error instanceof Error ? error.message : 'Unknown Edge Config error'
    };
  }
}

/**
 * Comprehensive Vercel environment validation
 */
export async function validateVercelEnvironment(): Promise<VercelEnvironmentStatus> {
  console.log('🔍 Validating Vercel environment configuration...');

  const [blob, kv, postgres, edgeConfig] = await Promise.all([
    validateBlobConfiguration(),
    validateKVConfiguration(),
    validatePostgresConfiguration(),
    validateEdgeConfigConfiguration()
  ]);

  // Determine overall status
  let overall: 'ready' | 'partial' | 'misconfigured' = 'ready';
  
  // Core services must be available for 'ready' status
  if (!blob.available || !kv.available || !postgres.available) {
    overall = blob.available || kv.available || postgres.available ? 'partial' : 'misconfigured';
  }

  const status: VercelEnvironmentStatus = {
    blob,
    kv,
    postgres,
    edgeConfig,
    overall
  };

  // Log results
  console.log('📊 Vercel Environment Status:');
  console.log(`  Overall: ${overall.toUpperCase()}`);
  console.log(`  Blob Storage: ${blob.available ? '✅' : '❌'} ${blob.error ? `(${blob.error})` : ''}`);
  console.log(`  KV Store: ${kv.available ? '✅' : '❌'} ${kv.error ? `(${kv.error})` : ''}`);
  console.log(`  Postgres: ${postgres.available ? '✅' : '❌'} ${postgres.error ? `(${postgres.error})` : ''}`);
  console.log(`  Edge Config: ${edgeConfig.available ? '✅' : '⚠️'} ${edgeConfig.error ? `(${edgeConfig.error})` : ''}`);

  return status;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const isVercel = isVercelEnvironment();
  const isProd = isProduction();
  
  return {
    isVercel,
    isProduction: isProd,
    isDevelopment: !isProd,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'local',
    
    // Service URLs (Vercel automatically sets these in production)
    blobToken: process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    kvUrl: process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN || process.env.VERCEL_KV_REST_API_TOKEN,
    postgresUrl: process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL || process.env.DATABASE_URL,
    edgeConfig: process.env.EDGE_CONFIG || process.env.VERCEL_EDGE_CONFIG,
    
    // Feature flags based on environment
    features: {
      blobStorage: !!process.env.BLOB_READ_WRITE_TOKEN,
      kvCache: !!process.env.KV_REST_API_URL,
      postgres: !!process.env.POSTGRES_URL,
      edgeConfig: !!process.env.EDGE_CONFIG,
      
      // Development vs Production features
      debugMode: !isProd,
      analytics: isProd,
      errorReporting: isProd
    }
  };
}

/**
 * Initialize Vercel services with proper error handling
 */
export async function initializeVercelServices(): Promise<{
  success: boolean;
  services: string[];
  errors: string[];
}> {
  const services: string[] = [];
  const errors: string[] = [];

  try {
    const status = await validateVercelEnvironment();
    
    if (status.blob.available) {
      services.push('Blob Storage');
    } else if (status.blob.error) {
      errors.push(`Blob: ${status.blob.error}`);
    }

    if (status.kv.available) {
      services.push('KV Store');
    } else if (status.kv.error) {
      errors.push(`KV: ${status.kv.error}`);
    }

    if (status.postgres.available) {
      services.push('Postgres');
    } else if (status.postgres.error) {
      errors.push(`Postgres: ${status.postgres.error}`);
    }

    if (status.edgeConfig.available) {
      services.push('Edge Config');
    }

    const success = status.overall === 'ready' || status.overall === 'partial';

    console.log(`✅ Initialized ${services.length} Vercel services: ${services.join(', ')}`);
    if (errors.length > 0) {
      console.warn(`⚠️  Service errors: ${errors.join('; ')}`);
    }

    return {
      success,
      services,
      errors
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown initialization error';
    errors.push(errorMsg);
    console.error('❌ Failed to initialize Vercel services:', error);
    
    return {
      success: false,
      services,
      errors
    };
  }
}

/**
 * Environment setup instructions
 */
export function getSetupInstructions(): string[] {
  const config = getEnvironmentConfig();
  const instructions: string[] = [];

  if (!config.isVercel) {
    instructions.push('Run `vercel link` to link your project to Vercel');
    instructions.push('Run `vercel env pull` to sync environment variables');
  }

  if (!config.features.blobStorage) {
    instructions.push('Configure Blob Storage in your Vercel dashboard');
  }

  if (!config.features.kvCache) {
    instructions.push('Set up KV Store in your Vercel dashboard');
  }

  if (!config.features.postgres) {
    instructions.push('Configure Postgres database in your Vercel dashboard');
  }

  if (instructions.length === 0) {
    instructions.push('✅ All Vercel services are configured!');
  }

  return instructions;
}

/**
 * Create a startup check for the application
 */
export async function runStartupCheck(): Promise<boolean> {
  console.log('🚀 Running Vercel environment startup check...');
  
  try {
    const result = await initializeVercelServices();
    
    if (result.success) {
      console.log('✅ Startup check passed - Vercel services ready');
      return true;
    } else {
      console.warn('⚠️  Startup check partial - Some services unavailable');
      console.warn('Setup instructions:');
      getSetupInstructions().forEach(instruction => {
        console.warn(`  - ${instruction}`);
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Startup check failed:', error);
    return false;
  }
}