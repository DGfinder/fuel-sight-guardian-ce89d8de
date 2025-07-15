// AUTH CLEANUP UTILITIES
// These functions help recover from stuck authentication states

import { supabase } from './supabase';

/**
 * Emergency auth cleanup - clears all auth state and storage
 * Use this when users are stuck in login/logout loops
 */
export async function emergencyAuthCleanup(): Promise<void> {
  console.log('🚨 EMERGENCY AUTH CLEANUP STARTED');
  
  try {
    // Step 1: Clear all browser storage
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ Browser storage cleared');
    
    // Step 2: Clear IndexedDB (where Supabase might store data)
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases?.();
        if (databases) {
          for (const db of databases) {
            if (db.name?.includes('supabase')) {
              indexedDB.deleteDatabase(db.name);
              console.log(`✅ Deleted IndexedDB: ${db.name}`);
            }
          }
        }
      } catch (idbError) {
        console.warn('⚠️ IndexedDB cleanup failed:', idbError);
      }
    }
    
    // Step 3: Force sign out from Supabase
    await supabase.auth.signOut({ scope: 'global' });
    console.log('✅ Supabase global signout');
    
    // Step 4: Clear any remaining cookies (if accessible)
    if (document.cookie) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name.includes('supabase') || name.includes('auth')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          console.log(`✅ Cleared cookie: ${name}`);
        }
      }
    }
    
    console.log('🎉 Emergency auth cleanup completed successfully');
    
  } catch (error) {
    console.error('💥 Emergency auth cleanup failed:', error);
    // Even if cleanup fails, we still want to try redirecting
  }
}

/**
 * Browser console helper - users can run this directly in dev tools
 * Usage: Copy this into browser console when stuck
 */
export function generateCleanupScript(): string {
  return `
// === FUEL SIGHT AUTH CLEANUP SCRIPT ===
// Copy and paste this entire script into your browser console if you're stuck in a login loop

(async function authCleanup() {
  console.log('🚨 Starting Fuel Sight auth cleanup...');
  
  // Clear all storage
  localStorage.clear();
  sessionStorage.clear();
  console.log('✅ Storage cleared');
  
  // Clear Supabase auth if available
  if (window.supabase) {
    try {
      await window.supabase.auth.signOut({ scope: 'global' });
      console.log('✅ Supabase signout');
    } catch (e) {
      console.log('⚠️ Supabase signout failed (continuing)');
    }
  }
  
  // Clear React Query cache if available
  if (window.queryClient) {
    try {
      window.queryClient.clear();
      console.log('✅ React Query cache cleared');
    } catch (e) {
      console.log('⚠️ React Query clear failed (continuing)');
    }
  }
  
  // Clear cookies
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  console.log('✅ Cookies cleared');
  
  console.log('🎉 Cleanup complete! Redirecting to login...');
  window.location.replace('/login');
})();
`;
}

/**
 * Check for stuck auth state indicators
 */
export function detectStuckAuthState(): {isStuck: boolean, issues: string[]} {
  const issues: string[] = [];
  
  // Check for conflicting storage
  const localStorageAuth = localStorage.getItem('supabase.auth.token');
  const sessionStorageAuth = sessionStorage.getItem('supabase.auth.token');
  
  if (localStorageAuth && sessionStorageAuth && localStorageAuth !== sessionStorageAuth) {
    issues.push('Conflicting auth tokens in localStorage and sessionStorage');
  }
  
  // Check for old/malformed tokens
  try {
    if (localStorageAuth) {
      const parsed = JSON.parse(localStorageAuth);
      if (!parsed.access_token || !parsed.refresh_token) {
        issues.push('Malformed auth token in localStorage');
      }
    }
  } catch (e) {
    issues.push('Invalid JSON in auth token storage');
  }
  
  // Check for excessive auth retries
  const retryCount = sessionStorage.getItem('auth_retry_count');
  if (retryCount && parseInt(retryCount) > 3) {
    issues.push('Excessive auth retry attempts detected');
  }
  
  return {
    isStuck: issues.length > 0,
    issues
  };
}

/**
 * Auto-detect and fix common auth issues
 */
export async function autoFixAuthIssues(): Promise<{fixed: boolean, actions: string[]}> {
  const { isStuck, issues } = detectStuckAuthState();
  const actions: string[] = [];
  
  if (!isStuck) {
    return { fixed: false, actions: ['No auth issues detected'] };
  }
  
  console.log('🔧 Auto-fixing auth issues:', issues);
  
  // Clear conflicting tokens
  if (issues.some(i => i.includes('Conflicting auth tokens'))) {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.removeItem('supabase.auth.token');
    actions.push('Cleared conflicting auth tokens');
  }
  
  // Clear malformed tokens
  if (issues.some(i => i.includes('Malformed') || i.includes('Invalid JSON'))) {
    localStorage.removeItem('supabase.auth.token');
    actions.push('Cleared malformed auth token');
  }
  
  // Reset retry counter
  if (issues.some(i => i.includes('retry attempts'))) {
    sessionStorage.removeItem('auth_retry_count');
    actions.push('Reset auth retry counter');
  }
  
  // Refresh session
  try {
    await supabase.auth.refreshSession();
    actions.push('Refreshed auth session');
  } catch (error) {
    actions.push('Failed to refresh session - full cleanup may be needed');
  }
  
  return { fixed: true, actions };
}

// Make cleanup function globally available for console access
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).fuelSightAuthCleanup = emergencyAuthCleanup;
  (window as Record<string, unknown>).fuelSightCleanupScript = generateCleanupScript;
  (window as Record<string, unknown>).fuelSightAutoFix = autoFixAuthIssues;
}