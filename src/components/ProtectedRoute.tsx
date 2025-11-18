import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'depot_manager' | 'operator' | 'viewer';
  requiredGroup?: string;
}

export function ProtectedRoute({ children, requiredRole, requiredGroup }: ProtectedRouteProps) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('🔒 Auth session error:', error);
          // Clear any corrupted auth state
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.clear();
          setSession(null);
        } else {
          setSession(data.session);
        }
      } catch (error) {
        console.error('🔒 Failed to get session:', error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    
    getSession();
    
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle specific auth events
      if (event === 'SIGNED_OUT') {
        // Clear all storage on signout
        localStorage.clear();
        sessionStorage.clear();
        setSession(null);
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(session);
      } else if (event === 'USER_UPDATED') {
        setSession(session);
      }
    });
    
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!permissions || permissions.role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this application.</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your administrator.</p>
          <button
            onClick={async () => {
              localStorage.clear();
              sessionStorage.clear();
              await supabase.auth.signOut();
              window.location.replace('/login');
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Session & Login Again
          </button>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRole && permissions.role !== requiredRole && !permissions.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have the required role to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">Required: {requiredRole}</p>
        </div>
      </div>
    );
  }

  // Check group-based access
  if (requiredGroup && !permissions.isAdmin) {
    const hasGroupAccess = permissions.accessibleGroups.some(group => 
      group.name.toLowerCase() === requiredGroup.toLowerCase()
    );
    
    if (!hasGroupAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have access to the {requiredGroup} group.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
} 