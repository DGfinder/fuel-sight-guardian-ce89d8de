/**
 * Audit Logging Service
 * 
 * This service provides functions to interact with the audit logging system,
 * allowing the application to track and query data modifications.
 */

import { supabase } from './supabase';

// Types for audit log entries
export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  user_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditTrailEntry {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_email: string | null;
  created_at: string;
}

export interface AuditActivity {
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_email: string | null;
  created_at: string;
}

export interface AuditSummary {
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_email: string | null;
  created_at: string;
  affected_item: string;
  record_id: string;
}

// Audit service class
export class AuditService {
  /**
   * Get audit trail for a specific record
   */
  static async getAuditTrail(
    tableName: string,
    recordId: string,
    limit = 50
  ): Promise<{ data: AuditTrailEntry[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_audit_trail', {
          p_table_name: tableName,
          p_record_id: recordId,
          p_limit: limit
        });

      if (error) {
        console.error('Error fetching audit trail:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getAuditTrail:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  /**
   * Get recent audit activity across all tables
   */
  static async getRecentActivity(
    hours = 24,
    limit = 100
  ): Promise<{ data: AuditActivity[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_recent_audit_activity', {
          p_hours: hours,
          p_limit: limit
        });

      if (error) {
        console.error('Error fetching recent activity:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  /**
   * Get audit summary with formatted information
   */
  static async getAuditSummary(
    limit = 100
  ): Promise<{ data: AuditSummary[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('audit_summary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching audit summary:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getAuditSummary:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  /**
   * Get audit logs for a specific table
   */
  static async getTableAuditLogs(
    tableName: string,
    limit = 50
  ): Promise<{ data: AuditLogEntry[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('table_name', tableName)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching table audit logs:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getTableAuditLogs:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  /**
   * Get audit logs for a specific user
   */
  static async getUserAuditLogs(
    userId: string,
    limit = 50
  ): Promise<{ data: AuditLogEntry[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user audit logs:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error in getUserAuditLogs:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  /**
   * Format audit entry for display
   */
  static formatAuditEntry(entry: AuditTrailEntry): string {
    const { action, old_values, new_values, user_email, created_at } = entry;
    const date = new Date(created_at).toLocaleString();
    const user = user_email || 'System';

    switch (action) {
      case 'INSERT':
        return `${user} created a new record on ${date}`;
      case 'UPDATE': {
        const changes = AuditService.getChanges(old_values, new_values);
        return `${user} updated ${changes} on ${date}`;
      }
      case 'DELETE':
        return `${user} deleted record on ${date}`;
      default:
        return `${user} performed ${action} on ${date}`;
    }
  }

  /**
   * Get human-readable changes between old and new values
   */
  static getChanges(
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ): string {
    if (!oldValues || !newValues) return 'record';

    const changes: string[] = [];
    const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of keys) {
      if (key === 'updated_at' || key === 'created_at') continue; // Skip timestamp fields
      
      const oldVal = oldValues[key];
      const newVal = newValues[key];

      if (oldVal !== newVal) {
        changes.push(key);
      }
    }

    if (changes.length === 0) return 'record';
    if (changes.length === 1) return changes[0];
    if (changes.length <= 3) return changes.join(', ');
    return `${changes.length} fields`;
  }

  /**
   * Get formatted table name for display
   */
  static formatTableName(tableName: string): string {
    const tableNames: Record<string, string> = {
      'dip_readings': 'Fuel Dip Reading',
      'fuel_tanks': 'Fuel Tank',
      'tank_alerts': 'Tank Alert',
      'user_roles': 'User Role',
      'user_group_permissions': 'User Permissions',
      'profiles': 'User Profile',
    };

    return tableNames[tableName] || tableName;
  }

  /**
   * Get action color for UI display
   */
  static getActionColor(action: string): string {
    switch (action) {
      case 'INSERT': return 'text-green-600';
      case 'UPDATE': return 'text-blue-600';
      case 'DELETE': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  /**
   * Get action icon for UI display
   */
  static getActionIcon(action: string): string {
    switch (action) {
      case 'INSERT': return '➕';
      case 'UPDATE': return '✏️';
      case 'DELETE': return '🗑️';
      default: return '📝';
    }
  }
}

// Audit tracking utilities
export class AuditTracker {
  /**
   * Log a manual audit entry (for client-side actions that don't trigger DB triggers)
   */
  static async logManualAction(
    action: string,
    details: Record<string, unknown>,
    context?: string
  ): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      console.log('Manual audit action:', {
        action,
        details,
        context,
        user: user.user?.email,
        timestamp: new Date().toISOString()
      });
      
      // In a production environment, you might want to send this to a logging service
      // or store it in a separate client_actions table
    } catch (error) {
      console.error('Error logging manual action:', error);
    }
  }

  /**
   * Track user session activity
   */
  static async logUserActivity(
    activityType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      console.log('User activity:', {
        activityType,
        metadata,
        user: user.user?.email,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }
}

export default AuditService;