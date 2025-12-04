import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');
  
  // Clean up any test data or resources
  // This could include:
  // - Clearing test databases
  // - Cleaning up temporary files
  // - Resetting application state
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;