/**
 * useTenantInit Hook
 *
 * Initializes tenant context for the authenticated user.
 * Must be called at the root of your application (App.tsx) before rendering any components.
 *
 * Usage:
 *   function App() {
 *     const { isReady, tenant, error } = useTenantInit();
 *
 *     if (!isReady) return <LoadingSpinner />;
 *     if (error) return <ErrorBoundary error={error} />;
 *
 *     return <AppRoutes />;
 *   }
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FEATURES } from '@/lib/features';
import type { TenantContext } from '@/lib/tenant-context';

interface TenantInitResult {
  isReady: boolean;
  tenant: TenantContext | null;
  error: Error | null;
}

export function useTenantInit(): TenantInitResult {
  const [isReady, setIsReady] = useState(false);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initTenant = async () => {
      try {
        // If feature flag is disabled, skip tenant initialization
        if (!FEATURES.USE_TENANT_SCHEMA) {
          setIsReady(true);
          return;
        }

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // No user logged in - skip tenant initialization
          setIsReady(true);
          return;
        }

        // Initialize tenant context and set search_path
        // This must be called before any queries
        await supabase.initialize();

        // Get tenant context
        const tenantContext = supabase.getTenantContext();

        if (tenantContext) {
          setTenant(tenantContext);
          console.log(
            `Tenant initialized: ${tenantContext.companyName} (${tenantContext.schemaName})`
          );
        } else {
          console.warn('User authenticated but no tenant assigned');
        }

        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize tenant:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsReady(true); // Mark as ready even on error to prevent infinite loading
      }
    };

    initTenant();

    // Re-initialize on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN') {
          console.log('User signed in - reinitializing tenant context');
          setIsReady(false);
          await initTenant();
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing tenant context');
          setTenant(null);
          setIsReady(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { isReady, tenant, error };
}

/**
 * useTenantContext Hook
 *
 * Returns current tenant context if available.
 * Must be used after useTenantInit has completed.
 */
export function useTenantContext() {
  const [tenant, setTenant] = useState<TenantContext | null>(null);

  useEffect(() => {
    if (FEATURES.USE_TENANT_SCHEMA) {
      const context = supabase.getTenantContext();
      setTenant(context);
    }
  }, []);

  return tenant;
}
