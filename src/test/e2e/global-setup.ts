import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');
  
  // Start the development server if not already running
  // This is handled by webServer config in playwright.config.ts
  
  // Pre-authenticate or setup test data if needed
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    console.log('✅ Application is ready for testing');
  } catch (error) {
    console.error('❌ Failed to verify application readiness:', error);
    throw error;
  } finally {
    await page.close();
    await browser.close();
  }
  
  console.log('✅ Global setup completed');
}

export default globalSetup;