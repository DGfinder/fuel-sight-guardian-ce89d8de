export type AuthUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  depot_id?: string;
  created_at: string;
  updated_at: string;
};

export type UserRole = 'admin' | 'manager' | 'user';

export interface UserPermissions {
  role: UserRole;
  accessibleGroups: Array<{
    id: string;
    name: string;
  }>;
  isAdmin: boolean;
  isManager: boolean;
  isPrivileged: boolean;
  canManageUsers: boolean;
  canManageGroups: boolean;
  canViewAllTanks: boolean;
  canEditAllTanks: boolean;
  canDeleteTanks: boolean;
  canViewAllDips: boolean;
  canEditAllDips: boolean;
  canDeleteDips: boolean;
  canViewAllAlerts: boolean;
  canAcknowledgeAlerts: boolean;
  canManageAlerts: boolean;
} 