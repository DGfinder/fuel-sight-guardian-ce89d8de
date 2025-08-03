import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for fonts and assets to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for any animations to complete
    await page.waitForTimeout(1000);
  });

  test('Homepage visual consistency', async ({ page }) => {
    // Test the main homepage layout
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Tank cards visual consistency', async ({ page }) => {
    // Navigate to tank overview and wait for data to load
    await page.goto('/');
    
    // Wait for tank cards to load
    await page.waitForSelector('[data-testid="tank-card"]', { timeout: 10000 });
    
    // Take screenshot of the tank grid
    const tankGrid = page.locator('[data-testid="tank-grid"]');
    await expect(tankGrid).toHaveScreenshot('tank-cards.png', {
      animations: 'disabled'
    });
  });

  test('Map view visual consistency', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for map to load
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
    await page.waitForTimeout(2000); // Additional time for map tiles
    
    // Hide dynamic elements that might cause visual differences
    await page.addStyleTag({
      content: `
        .leaflet-control-attribution,
        .leaflet-control-zoom {
          display: none !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('map-view.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Performance page visual consistency', async ({ page }) => {
    await page.goto('/performance');
    
    // Wait for charts to render
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500); // Wait for chart animations
    
    // Hide dynamic timestamp elements
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="dynamic-value"] {
          opacity: 0 !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('performance-page.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Mobile tank card responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForSelector('[data-testid="tank-card"]', { timeout: 10000 });
    
    const mobileLayout = page.locator('[data-testid="tank-grid"]');
    await expect(mobileLayout).toHaveScreenshot('mobile-tank-cards.png', {
      animations: 'disabled'
    });
  });

  test('Error boundary visual consistency', async ({ page }) => {
    // Navigate to a page that triggers an error boundary
    await page.goto('/');
    
    // Inject an error to trigger error boundary
    await page.evaluate(() => {
      // Create a component that will throw an error
      const errorDiv = document.createElement('div');
      errorDiv.id = 'error-trigger';
      document.body.appendChild(errorDiv);
      
      // Simulate a React error
      const event = new CustomEvent('react-error', {
        detail: {
          error: new Error('Test error for visual regression'),
          errorInfo: { componentStack: 'Test component stack' }
        }
      });
      window.dispatchEvent(event);
    });
    
    // Wait for error boundary to render
    await page.waitForSelector('[data-testid="error-boundary"]', { timeout: 5000 });
    
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    await expect(errorBoundary).toHaveScreenshot('error-boundary.png', {
      animations: 'disabled'
    });
  });

  test('Loading states visual consistency', async ({ page }) => {
    // Test skeleton loading states
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Capture loading state before data loads
    const loadingContainer = page.locator('[data-testid="loading-container"]');
    await expect(loadingContainer).toHaveScreenshot('loading-state.png', {
      animations: 'disabled'
    });
  });

  test('Modal visual consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]', { timeout: 10000 });
    
    // Click on first tank card to open modal
    await page.click('[data-testid="tank-card"]:first-child');
    
    // Wait for modal to open and render
    await page.waitForSelector('[data-testid="tank-modal"]', { timeout: 5000 });
    
    // Hide dynamic elements
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"] {
          opacity: 0 !important;
        }
      `
    });
    
    const modal = page.locator('[data-testid="tank-modal"]');
    await expect(modal).toHaveScreenshot('tank-modal.png', {
      animations: 'disabled'
    });
  });

  test('Dark mode consistency (if implemented)', async ({ page }) => {
    await page.goto('/');
    
    // Toggle dark mode if available
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
      
      await expect(page).toHaveScreenshot('homepage-dark.png', {
        fullPage: true,
        animations: 'disabled'
      });
    } else {
      // Skip test if dark mode not implemented
      test.skip();
    }
  });

  test('Table sorting visual consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-table"]', { timeout: 10000 });
    
    // Click on a sortable column header
    await page.click('[data-testid="sort-fuel-level"]');
    await page.waitForTimeout(500); // Wait for sort to complete
    
    const sortedTable = page.locator('[data-testid="tank-table"]');
    await expect(sortedTable).toHaveScreenshot('table-sorted.png', {
      animations: 'disabled'
    });
  });
});