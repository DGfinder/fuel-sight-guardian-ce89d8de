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

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FEATURES } from '@/lib/features';
import type { TenantContext } from '@/lib/tenant-context';

// State machine for tenant initialization
type TenantInitState =
  | 'IDLE'           // Not started
  | 'INITIALIZING'   // In progress
  | 'READY'          // Successfully initialized (with or without tenant)
  | 'ERROR'          // Failed with error
  | 'TIMEOUT';       // Initialization timed out

interface TenantInitResult {
  isReady: boolean;
  tenant: TenantContext | null;
  error: Error | null;
  state: TenantInitState;
}

export function useTenantInit(): TenantInitResult {
  const [state, setState] = useState<TenantInitState>('IDLE');
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const initializingRef = useRef(false); // Guard against re-initialization
  const hasCompletedInitialInit = useRef(false); // Track first init completion
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const INIT_TIMEOUT_MS = FEATURES.TENANT_INIT_TIMEOUT_MS;

    const initTenant = async () => {
      // Guard: Prevent concurrent initialization
      if (initializingRef.current) {
        console.log('[TENANT INIT] Already initializing, skipping duplicate call');
        return;
      }

      initializingRef.current = true;
      setState('INITIALIZING');

      // Set timeout protection
      timeoutRef.current = setTimeout(() => {
        console.error('[TENANT INIT] Initialization timeout after 10 seconds');
        setState('TIMEOUT');
        setError(new Error('Tenant initialization timeout - please refresh the page'));
        initializingRef.current = false;
      }, INIT_TIMEOUT_MS);

      try {
        // If feature flag is disabled, skip tenant initialization
        if (!FEATURES.USE_TENANT_SCHEMA) {
          console.log('[TENANT INIT] Feature flag disabled, skipping tenant init');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setState('READY');
          hasCompletedInitialInit.current = true;
          initializingRef.current = false;
          return;
        }

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.log('[TENANT INIT] No authenticated user, skipping tenant init');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setState('READY');
          hasCompletedInitialInit.current = true;
          initializingRef.current = false;
          return;
        }

        console.log('[TENANT INIT] Initializing for user:', user.id);

        // Initialize tenant context and set search_path
        await supabase.initialize();

        // Get tenant context
        const tenantContext = supabase.getTenantContext();

        if (tenantContext) {
          setTenant(tenantContext);
          console.log(
            `[TENANT INIT] Success: ${tenantContext.companyName} (${tenantContext.schemaName})`
          );
        } else {
          console.warn('[TENANT INIT] User authenticated but no tenant assigned - using public schema');
          // This is OK - user can still use the app with public schema
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setState('READY');
        hasCompletedInitialInit.current = true;
      } catch (err) {
        console.error('[TENANT INIT] Failed:', err);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setState('ERROR');
        hasCompletedInitialInit.current = true;
      } finally {
        initializingRef.current = false;
      }
    };

    // Start initial initialization
    initTenant();

    // Set up auth state change listener
    // CRITICAL: Only allow re-initialization AFTER initial init completes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log('[TENANT INIT] Auth state changed:', event);

        // GUARD: Ignore events during initial initialization
        if (!hasCompletedInitialInit.current) {
          console.log('[TENANT INIT] Ignoring auth event during initial init:', event);
          return;
        }

        if (event === 'SIGNED_IN') {
          console.log('[TENANT INIT] User signed in - reinitializing tenant context');
          setState('IDLE'); // Reset state machine
          await initTenant();
        } else if (event === 'SIGNED_OUT') {
          console.log('[TENANT INIT] User signed out - clearing tenant context');
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setTenant(null);
          setError(null);
          setState('READY');
          hasCompletedInitialInit.current = false;
          initializingRef.current = false;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isReady = state === 'READY' || state === 'ERROR' || state === 'TIMEOUT';

  return { isReady, tenant, error, state };
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
