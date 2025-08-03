import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('Homepage accessibility compliance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Map view accessibility', async ({ page }) => {
    await page.goto('/map');
    await page.waitForSelector('.leaflet-container');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Performance page accessibility', async ({ page }) => {
    await page.goto('/performance');
    await page.waitForSelector('canvas');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]');
    
    // Test Tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
    
    // Test Enter key on tank card
    await page.focus('[data-testid="tank-card"]:first-child button');
    await page.keyboard.press('Enter');
    
    // Should open modal
    await page.waitForSelector('[data-testid="tank-modal"]');
    const modal = page.locator('[data-testid="tank-modal"]');
    await expect(modal).toBeVisible();
    
    // Test Escape key to close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Screen reader compatibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]');
    
    // Check for proper ARIA labels and roles
    const tankCards = page.locator('[data-testid="tank-card"]');
    const firstCard = tankCards.first();
    
    // Should have accessible name
    const accessibleName = await firstCard.getAttribute('aria-label');
    expect(accessibleName).toBeTruthy();
    
    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingLevels = await headings.evaluateAll(elements => 
      elements.map(el => parseInt(el.tagName.charAt(1)))
    );
    
    // Should have logical heading hierarchy (no skipped levels)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('Color contrast compliance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Form accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Find any forms or form controls
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        
        // Check for proper labels
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          // Should have either label, aria-label, or aria-labelledby
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    }
  });

  test('Focus management', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="tank-card"]');
    
    // Open modal
    await page.click('[data-testid="tank-card"]:first-child button');
    await page.waitForSelector('[data-testid="tank-modal"]');
    
    // Focus should be trapped in modal
    const modal = page.locator('[data-testid="tank-modal"]');
    const focusableElements = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const count = await focusableElements.count();
    
    if (count > 0) {
      // Tab through all elements
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Focus should loop back to first element
      const firstElement = focusableElements.first();
      await expect(firstElement).toBeFocused();
    }
  });

  test('Mobile accessibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Check touch target sizes
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      
      if (box) {
        // Touch targets should be at least 44x44px
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('Error message accessibility', async ({ page }) => {
    // Navigate to page and trigger error boundary
    await page.goto('/');
    
    // Inject error to test error boundary accessibility
    await page.evaluate(() => {
      const event = new CustomEvent('react-error', {
        detail: {
          error: new Error('Test accessibility error'),
          errorInfo: { componentStack: 'Test stack' }
        }
      });
      window.dispatchEvent(event);
    });
    
    // Wait for error boundary
    await page.waitForSelector('[data-testid="error-boundary"]', { timeout: 5000 });
    
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    
    // Error should have proper ARIA attributes
    const role = await errorBoundary.getAttribute('role');
    const ariaLive = await errorBoundary.getAttribute('aria-live');
    const ariaLabel = await errorBoundary.getAttribute('aria-label');
    
    expect(role || ariaLive || ariaLabel).toBeTruthy();
  });
});