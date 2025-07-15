// Frontend Cache Invalidation Script
// This script helps invalidate React Query cache after RLS/view fixes
// Run this in the browser console or add to a component temporarily

// Method 1: Clear all React Query cache
function clearAllCache() {
  if (window.queryClient) {
    window.queryClient.clear();
    console.log('✅ All React Query cache cleared');
  } else {
    console.warn('⚠️ QueryClient not found on window object');
  }
}

// Method 2: Clear specific tank-related queries
function clearTankCache() {
  if (window.queryClient) {
    // Clear tank queries
    window.queryClient.invalidateQueries({ queryKey: ['tanks'] });
    window.queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
    window.queryClient.invalidateQueries({ queryKey: ['tank-access'] });
    
    console.log('✅ Tank-related cache cleared');
  } else {
    console.warn('⚠️ QueryClient not found on window object');
  }
}

// Method 3: Force refresh by reloading the page
function forceRefresh() {
  window.location.reload();
}

// Method 4: Reset localStorage if there's any cached data
function clearLocalStorage() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('tank') || key.includes('permission') || key.includes('fuel'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log(`✅ Removed ${keysToRemove.length} localStorage keys:`, keysToRemove);
}

// Main function to run all cache clearing methods
function fixCacheAfterRLSUpdate() {
  console.log('🔄 Starting cache invalidation after RLS fix...');
  
  try {
    clearTankCache();
    clearLocalStorage();
    
    // Give a moment for cache clearing, then refresh
    setTimeout(() => {
      console.log('🔄 Refreshing page to ensure clean state...');
      forceRefresh();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error during cache clearing:', error);
    console.log('🔄 Falling back to page refresh...');
    forceRefresh();
  }
}

// Expose functions globally for easy access
window.fixCacheAfterRLSUpdate = fixCacheAfterRLSUpdate;
window.clearTankCache = clearTankCache;
window.clearAllCache = clearAllCache;
window.forceRefresh = forceRefresh;

console.log(`
🛠️ Cache invalidation functions available:

1. fixCacheAfterRLSUpdate() - Run this after database fixes
2. clearTankCache() - Clear only tank-related queries  
3. clearAllCache() - Clear all React Query cache
4. forceRefresh() - Force page reload

Usage: Run fixCacheAfterRLSUpdate() in the browser console
`);

// Auto-run if this script is loaded during development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('🔧 Development mode detected - cache clearing functions ready');
}