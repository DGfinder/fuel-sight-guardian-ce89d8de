/**
 * ENHANCED SESSION HOOKS
 * 
 * React hooks that integrate with the enhanced session management system
 * providing high-performance cached access to user data
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { 
  sessionManager,
  EnhancedSession,
  UserPermissions,
  UserPreferences,
  ActiveSession
} from '@/lib/enhanced-session-management';

/**
 * Enhanced session hook with KV caching
 */
export function useEnhancedSession() {
  const [session, setSession] = useState<EnhancedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get initial session
    const currentSession = sessionManager.getCurrentSession();
    setSession(currentSession);
    setIsLoading(false);

    // Listen for session changes (you might need to implement an event system)
    const checkSession = () => {
      const updatedSession = sessionManager.getCurrentSession();
      setSession(updatedSession);
    };

    // Check session every minute
    const interval = setInterval(checkSession, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const currentSession = sessionManager.getCurrentSession();
      if (currentSession) {
        await sessionManager.refreshSession({
          user: currentSession.user,
          expires_at: Math.floor(new Date(currentSession.expiresAt).getTime() / 1000),
          access_token: '',
          refresh_token: ''
        } as any);
        setSession(sessionManager.getCurrentSession());
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await sessionManager.clearSession();
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  return {
    session,
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session,
    refreshSession,
    signOut
  };
}

/**
 * Enhanced user permissions hook with caching
 */
export function useEnhancedUserPermissions() {
  const { session } = useEnhancedSession();

  return useQuery<UserPermissions>({
    queryKey: ['enhanced-user-permissions', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) {
        return {
          role: 'viewer',
          isAdmin: false,
          accessibleGroups: []
        };
      }

      return await sessionManager.getUserPermissions(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: session?.permissions,
  });
}

/**
 * Enhanced user preferences hook with caching
 */
export function useEnhancedUserPreferences() {
  const { session } = useEnhancedSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['enhanced-user-preferences', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) {
        return {
          theme: 'system' as const,
          default_depot_group: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          email_alerts: true,
          sms_alerts: false,
          webhook_alerts: false,
          low_fuel_threshold: 20,
          critical_fuel_threshold: 10,
          preferred_map_style: 'light' as const,
        };
      }

      return await sessionManager.getUserPreferences(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    initialData: session?.preferences,
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      if (!session?.user?.id) throw new Error('No user logged in');
      
      await sessionManager.updateUserPreferences(session.user.id, newPreferences);
      return { ...preferences, ...newPreferences };
    },
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(
        ['enhanced-user-preferences', session?.user?.id], 
        updatedPreferences
      );
      toast({
        title: 'Preferences Updated',
        description: 'Your settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update preferences: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    preferences: preferences || {
      theme: 'system' as const,
      default_depot_group: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_alerts: true,
      sms_alerts: false,
      webhook_alerts: false,
      low_fuel_threshold: 20,
      critical_fuel_threshold: 10,
      preferred_map_style: 'light' as const,
    },
    updatePreferences: updatePreferences.mutate,
    isLoading,
    isUpdating: updatePreferences.isPending,
  };
}

/**
 * Hook for managing active sessions
 */
export function useActiveSessions() {
  const { session } = useEnhancedSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: activeSessions, isLoading } = useQuery<ActiveSession[]>({
    queryKey: ['active-sessions', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      return await sessionManager.getActiveSessions(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const terminateSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await sessionManager.terminateSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      toast({
        title: 'Session Terminated',
        description: 'The selected session has been terminated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to terminate session: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const terminateAllSessions = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('No user logged in');
      await sessionManager.terminateAllSessions(session.user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      toast({
        title: 'All Sessions Terminated',
        description: 'All active sessions have been terminated. You will be signed out.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to terminate sessions: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    activeSessions: activeSessions || [],
    isLoading,
    terminateSession: terminateSession.mutate,
    terminateAllSessions: terminateAllSessions.mutate,
    isTerminating: terminateSession.isPending || terminateAllSessions.isPending,
  };
}

/**
 * Hook for session analytics and monitoring
 */
export function useSessionAnalytics() {
  const { session } = useEnhancedSession();

  return useQuery({
    queryKey: ['session-analytics', session?.user?.id],
    queryFn: async () => {
      if (!session) return null;

      const sessionDuration = Date.now() - new Date(session.metadata.loginTime).getTime();
      const activeSessions = await sessionManager.getActiveSessions(session.user.id);

      return {
        currentSession: {
          duration: sessionDuration,
          activityCount: session.metadata.activityCount,
          deviceInfo: session.deviceInfo,
          loginTime: session.metadata.loginTime,
          lastActivity: session.lastActivity
        },
        totalActiveSessions: activeSessions.length,
        deviceBreakdown: activeSessions.reduce((acc, s) => {
          acc[s.deviceInfo.deviceType] = (acc[s.deviceInfo.deviceType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        browserBreakdown: activeSessions.reduce((acc, s) => {
          acc[s.deviceInfo.browser] = (acc[s.deviceInfo.browser] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    },
    enabled: !!session,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook for checking specific permissions
 */
export function usePermissionCheck() {
  const { data: permissions } = useEnhancedUserPermissions();

  const hasRole = useCallback((role: string) => {
    return permissions?.role === role;
  }, [permissions]);

  const isAdmin = useCallback(() => {
    return permissions?.isAdmin || false;
  }, [permissions]);

  const canAccessGroup = useCallback((groupId: string) => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;
    return permissions.accessibleGroups.some(group => group.id === groupId);
  }, [permissions]);

  const canAccessSubgroup = useCallback((groupId: string, subgroupName: string) => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;
    
    const group = permissions.accessibleGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    // If no subgroup restrictions, user can access all subgroups in the group
    if (group.subgroups.length === 0) return true;
    
    return group.subgroups.includes(subgroupName);
  }, [permissions]);

  const getAccessibleGroups = useCallback(() => {
    return permissions?.accessibleGroups || [];
  }, [permissions]);

  return {
    permissions,
    hasRole,
    isAdmin,
    canAccessGroup,
    canAccessSubgroup,
    getAccessibleGroups,
    isLoading: !permissions
  };
}

/**
 * Hook for session security features
 */
export function useSessionSecurity() {
  const { session } = useEnhancedSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateCache = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('No user logged in');
      await sessionManager.invalidateUserCache(session.user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: 'Cache Cleared',
        description: 'User cache has been cleared successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to clear cache: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const refreshPermissions = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('No user logged in');
      
      // Clear permissions cache and refetch
      await sessionManager.invalidateUserCache(session.user.id);
      return await sessionManager.getUserPermissions(session.user.id);
    },
    onSuccess: (newPermissions) => {
      queryClient.setQueryData(
        ['enhanced-user-permissions', session?.user?.id], 
        newPermissions
      );
      toast({
        title: 'Permissions Refreshed',
        description: 'Your permissions have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to refresh permissions: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    invalidateCache: invalidateCache.mutate,
    refreshPermissions: refreshPermissions.mutate,
    isProcessing: invalidateCache.isPending || refreshPermissions.isPending,
  };
}