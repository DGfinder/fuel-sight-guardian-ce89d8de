/**
 * Activity Logger Service
 *
 * Provides frontend logging of user activities to the user_activity_log table.
 * Used for tracking auth events, user actions, and application usage.
 */

import { supabase } from '@/lib/supabase';

// Action categories
export type ActionCategory = 'auth' | 'customer' | 'tank' | 'delivery' | 'settings';

// Action types
export type ActionType =
  // Auth actions
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset_requested'
  | 'password_changed'
  // Customer actions (handled by DB triggers, but can also be logged manually)
  | 'account_created'
  | 'account_updated'
  | 'account_activated'
  | 'account_deactivated'
  // Tank actions (handled by DB triggers)
  | 'tank_assigned'
  | 'tank_unassigned'
  | 'tank_access_updated'
  // Delivery actions (handled by DB triggers)
  | 'request_created'
  | 'request_acknowledged'
  | 'request_scheduled'
  | 'request_completed'
  | 'request_cancelled'
  // Settings actions
  | 'preferences_updated'
  | 'notifications_updated';

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  action_category: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityLogFilters {
  category?: ActionCategory;
  action_type?: ActionType;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivitySummary {
  category: string;
  action_type: string;
  count: number;
}

/**
 * Log a user activity to the database
 */
export async function logActivity(
  actionType: ActionType,
  category: ActionCategory,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_user_activity', {
      p_action_type: actionType,
      p_action_category: category,
      p_resource_type: resourceType || null,
      p_resource_id: resourceId || null,
      p_details: details || {},
      p_user_agent: navigator.userAgent
    });

    if (error) {
      console.error('Failed to log activity:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('Activity logging error:', err);
    return null;
  }
}

/**
 * Log a successful login
 */
export async function logLogin(email?: string): Promise<void> {
  await logActivity('login_success', 'auth', undefined, undefined, {
    email,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log a logout event
 */
export async function logLogout(): Promise<void> {
  await logActivity('logout', 'auth', undefined, undefined, {
    timestamp: new Date().toISOString()
  });
}

/**
 * Log a password change
 */
export async function logPasswordChange(isReset: boolean = false): Promise<void> {
  await logActivity('password_changed', 'auth', undefined, undefined, {
    is_reset: isReset,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log a password reset request
 */
export async function logPasswordResetRequest(email: string): Promise<void> {
  await logActivity('password_reset_requested', 'auth', undefined, undefined, {
    email,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log settings/preferences update
 */
export async function logSettingsUpdate(
  settingsType: 'preferences' | 'notifications',
  changes: Record<string, unknown>
): Promise<void> {
  const actionType = settingsType === 'preferences' ? 'preferences_updated' : 'notifications_updated';
  await logActivity(actionType, 'settings', 'user_settings', undefined, changes);
}

/**
 * Fetch activity logs with filters
 */
export async function getActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogEntry[]> {
  try {
    const { data, error } = await supabase.rpc('get_activity_logs', {
      p_category: filters.category || null,
      p_action_type: filters.action_type || null,
      p_user_id: filters.user_id || null,
      p_resource_type: filters.resource_type || null,
      p_resource_id: filters.resource_id || null,
      p_start_date: filters.start_date?.toISOString() || null,
      p_end_date: filters.end_date?.toISOString() || null,
      p_limit: filters.limit || 100,
      p_offset: filters.offset || 0
    });

    if (error) {
      console.error('Failed to fetch activity logs:', error);
      return [];
    }

    return (data as ActivityLogEntry[]) || [];
  } catch (err) {
    console.error('Activity logs fetch error:', err);
    return [];
  }
}

/**
 * Get activity summary statistics
 */
export async function getActivitySummary(hours: number = 24): Promise<ActivitySummary[]> {
  try {
    const { data, error } = await supabase.rpc('get_activity_summary', {
      p_hours: hours
    });

    if (error) {
      console.error('Failed to fetch activity summary:', error);
      return [];
    }

    return (data as ActivitySummary[]) || [];
  } catch (err) {
    console.error('Activity summary fetch error:', err);
    return [];
  }
}

/**
 * Format action type for display
 */
export function formatActionType(actionType: string): string {
  const displayNames: Record<string, string> = {
    login_success: 'Logged In',
    login_failed: 'Login Failed',
    logout: 'Logged Out',
    password_reset_requested: 'Password Reset Requested',
    password_changed: 'Password Changed',
    account_created: 'Account Created',
    account_updated: 'Account Updated',
    account_activated: 'Account Activated',
    account_deactivated: 'Account Deactivated',
    tank_access_created: 'Tank Assigned',
    tank_access_updated: 'Tank Access Updated',
    tank_access_deleted: 'Tank Unassigned',
    request_created: 'Delivery Requested',
    request_updated: 'Delivery Updated',
    request_deleted: 'Delivery Cancelled'
  };

  return displayNames[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format category for display
 */
export function formatCategory(category: string): string {
  const displayNames: Record<string, string> = {
    auth: 'Authentication',
    customer: 'Customer',
    tank: 'Tank Access',
    delivery: 'Delivery',
    settings: 'Settings'
  };

  return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Get category color for UI
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    auth: 'blue',
    customer: 'purple',
    tank: 'green',
    delivery: 'orange',
    settings: 'gray'
  };

  return colors[category] || 'gray';
}

/**
 * Export activity logs to CSV format
 */
export function exportToCSV(logs: ActivityLogEntry[]): string {
  const headers = [
    'Timestamp',
    'User Email',
    'Category',
    'Action',
    'Resource Type',
    'Resource ID',
    'Details'
  ];

  const rows = logs.map(log => [
    new Date(log.created_at).toISOString(),
    log.user_email || '',
    log.action_category,
    log.action_type,
    log.resource_type || '',
    log.resource_id || '',
    JSON.stringify(log.details)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(logs: ActivityLogEntry[], filename?: string): void {
  const csv = exportToCSV(logs);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
