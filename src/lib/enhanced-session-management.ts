/**
 * ENHANCED SESSION MANAGEMENT WITH KV CACHING
 * 
 * Provides high-performance session management with KV caching for:
 * - User permissions and roles
 * - User preferences 
 * - Session metadata
 * - Activity tracking
 * - Multi-device session management
 */

import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { 
  cacheGet, 
  cacheSet, 
  cacheDel, 
  CACHE_CONFIG, 
  CACHE_KEYS,
  calculateSmartTTL,
  invalidatePattern
} from '@/lib/vercel-kv-cache';

// Session interfaces
export interface EnhancedSession {
  user: User;
  sessionId: string;
  permissions: UserPermissions;
  preferences: UserPreferences;
  metadata: SessionMetadata;
  lastActivity: string;
  deviceInfo: DeviceInfo;
  expiresAt: string;
}

export interface UserPermissions {
  role: string;
  isAdmin: boolean;
  accessibleGroups: Array<{
    id: string;
    name: string;
    subgroups: string[];
  }>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  default_depot_group: string | null;
  timezone: string;
  email_alerts: boolean;
  sms_alerts: boolean;
  webhook_alerts: boolean;
  low_fuel_threshold: number;
  critical_fuel_threshold: number;
  preferred_map_style: 'light' | 'dark' | 'satellite' | 'terrain';
}

export interface SessionMetadata {
  loginTime: string;
  loginLocation?: {
    ip: string;
    country?: string;
    city?: string;
  };
  userAgent: string;
  sessionDuration: number;
  activityCount: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenResolution?: string;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  deviceInfo: DeviceInfo;
  lastActivity: string;
  isActive: boolean;
}

/**
 * Enhanced Session Manager Class
 */
export class EnhancedSessionManager {
  private static instance: EnhancedSessionManager;
  private currentSession: EnhancedSession | null = null;

  static getInstance(): EnhancedSessionManager {
    if (!EnhancedSessionManager.instance) {
      EnhancedSessionManager.instance = new EnhancedSessionManager();
    }
    return EnhancedSessionManager.instance;
  }

  /**
   * Initialize session management
   */
  async initialize(): Promise<void> {
    // Listen for Supabase auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this.createEnhancedSession(session);
      } else if (event === 'SIGNED_OUT') {
        await this.clearSession();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        await this.refreshSession(session);
      }
    });

    // Initialize current session if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await this.createEnhancedSession(session);
    }

    // Start activity tracking
    this.startActivityTracking();
  }

  /**
   * Create enhanced session with caching
   */
  async createEnhancedSession(session: Session): Promise<EnhancedSession> {
    const sessionId = `session_${session.user.id}_${Date.now()}`;
    const deviceInfo = this.getDeviceInfo();

    // Check if we have cached session data
    const cachedSession = await this.getCachedSession(session.user.id);
    
    let permissions: UserPermissions;
    let preferences: UserPreferences;

    if (cachedSession && this.isSessionValid(cachedSession)) {
      // Use cached data but update activity
      permissions = cachedSession.permissions;
      preferences = cachedSession.preferences;
    } else {
      // Fetch fresh data
      permissions = await this.fetchUserPermissions(session.user.id);
      preferences = await this.fetchUserPreferences(session.user.id);
    }

    const enhancedSession: EnhancedSession = {
      user: session.user,
      sessionId,
      permissions,
      preferences,
      metadata: {
        loginTime: new Date().toISOString(),
        loginLocation: await this.getLocationInfo(),
        userAgent: navigator.userAgent,
        sessionDuration: 0,
        activityCount: 1
      },
      lastActivity: new Date().toISOString(),
      deviceInfo,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 
                  new Date(Date.now() + CACHE_CONFIG.USER_SESSIONS * 1000).toISOString()
    };

    // Cache the session
    await this.cacheSession(enhancedSession);
    
    // Track active session
    await this.trackActiveSession(enhancedSession);

    this.currentSession = enhancedSession;
    return enhancedSession;
  }

  /**
   * Get cached session data
   */
  async getCachedSession(userId: string): Promise<EnhancedSession | null> {
    const cacheKey = `${CACHE_KEYS.USER_SESSION}${userId}`;
    return await cacheGet<EnhancedSession>(cacheKey);
  }

  /**
   * Cache session data with smart TTL
   */
  async cacheSession(session: EnhancedSession): Promise<void> {
    const cacheKey = `${CACHE_KEYS.USER_SESSION}${session.user.id}`;
    const smartTTL = calculateSmartTTL('USER_SESSIONS', 'high');
    
    await cacheSet(cacheKey, session, smartTTL);

    // Also cache permissions separately for faster access
    const permissionsCacheKey = `${CACHE_KEYS.USER_PREFS}permissions_${session.user.id}`;
    await cacheSet(permissionsCacheKey, session.permissions, smartTTL);

    // Cache preferences separately
    const preferencesCacheKey = `${CACHE_KEYS.USER_PREFS}preferences_${session.user.id}`;
    await cacheSet(preferencesCacheKey, session.preferences, smartTTL);
  }

  /**
   * Refresh session data
   */
  async refreshSession(session: Session): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.lastActivity = new Date().toISOString();
    this.currentSession.metadata.sessionDuration = 
      Date.now() - new Date(this.currentSession.metadata.loginTime).getTime();
    this.currentSession.metadata.activityCount++;

    // Update cache
    await this.cacheSession(this.currentSession);
    await this.trackActiveSession(this.currentSession);
  }

  /**
   * Clear session and cache
   */
  async clearSession(): Promise<void> {
    if (this.currentSession) {
      // Remove from cache
      await this.invalidateUserCache(this.currentSession.user.id);
      
      // Remove from active sessions
      await this.removeActiveSession(this.currentSession.sessionId);
      
      this.currentSession = null;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.lastActivity = new Date().toISOString();
    this.currentSession.metadata.activityCount++;
    
    // Update cached session
    await this.cacheSession(this.currentSession);
  }

  /**
   * Check if session is valid
   */
  isSessionValid(session: EnhancedSession): boolean {
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    const lastActivity = new Date(session.lastActivity);
    
    // Check if session expired
    if (now > expiresAt) return false;
    
    // Check if session is too old (inactive for more than 24 hours)
    const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours
    if (now.getTime() - lastActivity.getTime() > maxInactivity) return false;
    
    return true;
  }

  /**
   * Get current enhanced session
   */
  getCurrentSession(): EnhancedSession | null {
    return this.currentSession;
  }

  /**
   * Get user permissions with caching
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const cacheKey = `${CACHE_KEYS.USER_PREFS}permissions_${userId}`;
    const cached = await cacheGet<UserPermissions>(cacheKey);
    
    if (cached) return cached;
    
    const permissions = await this.fetchUserPermissions(userId);
    const smartTTL = calculateSmartTTL('USER_SESSIONS', 'high');
    await cacheSet(cacheKey, permissions, smartTTL);
    
    return permissions;
  }

  /**
   * Get user preferences with caching
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const cacheKey = `${CACHE_KEYS.USER_PREFS}preferences_${userId}`;
    const cached = await cacheGet<UserPreferences>(cacheKey);
    
    if (cached) return cached;
    
    const preferences = await this.fetchUserPreferences(userId);
    const smartTTL = calculateSmartTTL('USER_SESSIONS', 'medium');
    await cacheSet(cacheKey, preferences, smartTTL);
    
    return preferences;
  }

  /**
   * Update user preferences with cache invalidation
   */
  async updateUserPreferences(userId: string, newPreferences: Partial<UserPreferences>): Promise<void> {
    // Update in database
    const { data: existingData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    const mergedPreferences = {
      theme: 'system' as const,
      default_depot_group: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_alerts: true,
      sms_alerts: false,
      webhook_alerts: false,
      low_fuel_threshold: 20,
      critical_fuel_threshold: 10,
      preferred_map_style: 'light' as const,
      ...existingData,
      ...newPreferences,
    };

    if (existingData) {
      await supabase
        .from('user_preferences')
        .update(mergedPreferences)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('user_preferences')
        .insert([{ user_id: userId, ...mergedPreferences }]);
    }

    // Update cache
    const cacheKey = `${CACHE_KEYS.USER_PREFS}preferences_${userId}`;
    const smartTTL = calculateSmartTTL('USER_SESSIONS', 'medium');
    await cacheSet(cacheKey, mergedPreferences, smartTTL);

    // Update current session if it matches
    if (this.currentSession && this.currentSession.user.id === userId) {
      this.currentSession.preferences = mergedPreferences;
      await this.cacheSession(this.currentSession);
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const cacheKey = `${CACHE_KEYS.USER_SESSION}active_${userId}`;
    const cached = await cacheGet<ActiveSession[]>(cacheKey);
    
    if (cached) {
      // Filter out expired sessions
      const activeSessions = cached.filter(session => {
        const lastActivity = new Date(session.lastActivity);
        const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours
        return Date.now() - lastActivity.getTime() < maxInactivity;
      });
      
      if (activeSessions.length !== cached.length) {
        // Update cache with filtered sessions
        await cacheSet(cacheKey, activeSessions, CACHE_CONFIG.USER_SESSIONS);
      }
      
      return activeSessions;
    }
    
    return [];
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.removeActiveSession(sessionId);
    
    // If it's the current session, clear it
    if (this.currentSession && this.currentSession.sessionId === sessionId) {
      await supabase.auth.signOut();
    }
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllSessions(userId: string): Promise<void> {
    await this.invalidateUserCache(userId);
    
    // Sign out from Supabase (this will trigger the auth state change)
    if (this.currentSession && this.currentSession.user.id === userId) {
      await supabase.auth.signOut();
    }
  }

  /**
   * Invalidate all cached data for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `${CACHE_KEYS.USER_SESSION}${userId}*`,
      `${CACHE_KEYS.USER_PREFS}*${userId}*`
    ];
    
    await Promise.all(patterns.map(pattern => invalidatePattern(pattern)));
  }

  /**
   * Private helper methods
   */
  private async fetchUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        return {
          role: 'viewer',
          isAdmin: false,
          accessibleGroups: []
        };
      }

      const userRole = roleData.role;
      const isAdmin = ['admin', 'manager'].includes(userRole);

      let accessibleGroups: any[] = [];

      if (isAdmin) {
        const { data: allGroups } = await supabase
          .from('tank_groups')
          .select('id, name');

        if (allGroups) {
          accessibleGroups = allGroups.map(group => ({
            id: group.id,
            name: group.name,
            subgroups: []
          }));
        }
      } else {
        const { data: userGroups } = await supabase
          .from('user_group_permissions')
          .select(`
            group_id,
            tank_groups!inner(id, name)
          `)
          .eq('user_id', userId);

        if (userGroups) {
          const { data: subgroupRestrictions } = await supabase
            .from('user_subgroup_permissions')
            .select('group_id, subgroup_name')
            .eq('user_id', userId);

          const subgroupsByGroup = new Map();
          subgroupRestrictions?.forEach(restriction => {
            if (!subgroupsByGroup.has(restriction.group_id)) {
              subgroupsByGroup.set(restriction.group_id, []);
            }
            subgroupsByGroup.get(restriction.group_id).push(restriction.subgroup_name);
          });

          accessibleGroups = userGroups.map(userGroup => ({
            id: userGroup.group_id,
            name: (userGroup as any).tank_groups.name,
            subgroups: subgroupsByGroup.get(userGroup.group_id) || []
          }));
        }
      }

      return {
        role: userRole,
        isAdmin,
        accessibleGroups
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return {
        role: 'viewer',
        isAdmin: false,
        accessibleGroups: []
      };
    }
  }

  private async fetchUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      const defaults: UserPreferences = {
        theme: 'system',
        default_depot_group: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        email_alerts: true,
        sms_alerts: false,
        webhook_alerts: false,
        low_fuel_threshold: 20,
        critical_fuel_threshold: 10,
        preferred_map_style: 'light',
      };

      if (error || !data) return defaults;

      return {
        theme: data.theme || defaults.theme,
        default_depot_group: data.default_depot_group,
        timezone: data.timezone || defaults.timezone,
        email_alerts: data.email_alerts ?? defaults.email_alerts,
        sms_alerts: data.sms_alerts ?? defaults.sms_alerts,
        webhook_alerts: data.webhook_alerts ?? defaults.webhook_alerts,
        low_fuel_threshold: data.low_fuel_threshold ?? defaults.low_fuel_threshold,
        critical_fuel_threshold: data.critical_fuel_threshold ?? defaults.critical_fuel_threshold,
        preferred_map_style: data.preferred_map_style || defaults.preferred_map_style,
      };
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return {
        theme: 'system',
        default_depot_group: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        email_alerts: true,
        sms_alerts: false,
        webhook_alerts: false,
        low_fuel_threshold: 20,
        critical_fuel_threshold: 10,
        preferred_map_style: 'light',
      };
    }
  }

  private getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent;
    
    // Simple device detection
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/Mobile|Android|iPhone/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/iPad|Tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Simple browser detection
    let browser = 'unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Simple OS detection
    let os = 'unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return {
      deviceId: `${deviceType}_${browser}_${Date.now()}`,
      deviceType,
      browser,
      os,
      screenResolution: `${screen.width}x${screen.height}`
    };
  }

  private async getLocationInfo(): Promise<{ ip: string; country?: string; city?: string } | undefined> {
    try {
      // This would typically use a geolocation service
      // For now, return undefined as we don't want to add external dependencies
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async trackActiveSession(session: EnhancedSession): Promise<void> {
    const userId = session.user.id;
    const cacheKey = `${CACHE_KEYS.USER_SESSION}active_${userId}`;
    
    const activeSessions = await this.getActiveSessions(userId);
    
    const newSession: ActiveSession = {
      sessionId: session.sessionId,
      userId,
      deviceInfo: session.deviceInfo,
      lastActivity: session.lastActivity,
      isActive: true
    };

    // Remove any existing session with the same device info and add the new one
    const updatedSessions = activeSessions
      .filter(s => s.deviceInfo.deviceId !== newSession.deviceInfo.deviceId)
      .concat(newSession);

    await cacheSet(cacheKey, updatedSessions, CACHE_CONFIG.USER_SESSIONS);
  }

  private async removeActiveSession(sessionId: string): Promise<void> {
    if (!this.currentSession) return;
    
    const userId = this.currentSession.user.id;
    const cacheKey = `${CACHE_KEYS.USER_SESSION}active_${userId}`;
    
    const activeSessions = await this.getActiveSessions(userId);
    const updatedSessions = activeSessions.filter(s => s.sessionId !== sessionId);
    
    await cacheSet(cacheKey, updatedSessions, CACHE_CONFIG.USER_SESSIONS);
  }

  private startActivityTracking(): void {
    // Update activity every 5 minutes
    setInterval(() => {
      if (this.currentSession) {
        this.updateActivity();
      }
    }, 5 * 60 * 1000);

    // Track user interactions
    const events = ['click', 'scroll', 'keypress', 'mousemove'];
    let lastActivityUpdate = 0;
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        const now = Date.now();
        // Throttle updates to once per minute
        if (now - lastActivityUpdate > 60 * 1000) {
          lastActivityUpdate = now;
          this.updateActivity();
        }
      }, { passive: true });
    });
  }
}

// Export singleton instance
export const sessionManager = EnhancedSessionManager.getInstance();

// Initialize session management
if (typeof window !== 'undefined') {
  sessionManager.initialize().catch(console.error);
}