import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserPermissions {
  role: string;
  isAdmin: boolean;
  accessibleGroups: Array<{
    id: string;
    name: string;
    subgroups: string[];
  }>;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  permissions: UserPermissions | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserPermissions(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserPermissions(session.user.id);
      } else {
        setPermissions(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserPermissions = async (userId: string) => {
    try {
      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.warn('No role found for user, defaulting to viewer');
        setPermissions({
          role: 'viewer',
          isAdmin: false,
          accessibleGroups: []
        });
        setLoading(false);
        return;
      }

      const userRole = roleData.role;
      const isAdmin = ['admin', 'manager'].includes(userRole);

      // Get accessible groups
      let accessibleGroups: any[] = [];

      if (isAdmin) {
        // Admins can access all groups
        const { data: allGroups, error: groupsError } = await supabase
          .from('tank_groups')
          .select('id, name');

        if (!groupsError && allGroups) {
          accessibleGroups = allGroups.map(group => ({
            id: group.id,
            name: group.name,
            subgroups: []
          }));
        }
      } else {
        // Regular users: get their specific group permissions
        const { data: userGroups, error: userGroupsError } = await supabase
          .from('user_group_permissions')
          .select(`
            group_id,
            tank_groups!inner(id, name)
          `)
          .eq('user_id', userId);

        if (!userGroupsError && userGroups) {
          // Get subgroup restrictions
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

      setPermissions({
        role: userRole,
        isAdmin,
        accessibleGroups
      });

    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions({
        role: 'viewer',
        isAdmin: false,
        accessibleGroups: []
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
    // Redirect to main fuel app login or show login page
    window.location.href = '/login';
  };

  const checkPermission = (permission: string): boolean => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    // Define permission mappings
    const permissionMap: Record<string, string[]> = {
      'view_guardian': ['admin', 'manager', 'compliance_manager'],
      'manage_guardian': ['admin', 'manager', 'compliance_manager'],
      'view_deliveries': ['admin', 'manager'],
      'upload_data': ['admin', 'manager'],
      'generate_reports': ['admin', 'manager', 'compliance_manager'],
      'manage_settings': ['admin'],
    };

    const allowedRoles = permissionMap[permission] || [];
    return allowedRoles.includes(permissions.role);
  };

  const value = {
    user,
    session,
    permissions,
    loading,
    signOut,
    checkPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}