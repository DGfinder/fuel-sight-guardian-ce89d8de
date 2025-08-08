import { useUserPermissions } from './useUserPermissions';

// DEPRECATED: Use useUserPermissions instead for new code
// This hook is maintained for backward compatibility but will be removed in the future
export interface UserRole {
  role: 'admin' | 'depot_manager' | 'operator';
  depot_id: string | null;
  group_id?: string | null;
}

/**
 * @deprecated Use useUserPermissions hook instead
 * This hook provides basic role information but lacks the comprehensive
 * permission structure needed for RBAC. It's mapped to useUserPermissions
 * internally for consistency.
 */
export function useUserRole() {
  const { data: permissions, isLoading, error } = useUserPermissions();
  
  return {
    data: permissions ? {
      role: mapToLegacyRole(permissions.role),
      depot_id: null, // Legacy field, not used in current RBAC
      group_id: permissions.accessibleGroups[0]?.id || null
    } : undefined,
    isLoading,
    error
  };
}

// Map modern role names to legacy role names
function mapToLegacyRole(modernRole: string): 'admin' | 'depot_manager' | 'operator' {
  switch (modernRole) {
    case 'admin':
    case 'manager':
      return 'admin';
    case 'depot_manager':
      return 'depot_manager';
    default:
      return 'operator';
  }
}
