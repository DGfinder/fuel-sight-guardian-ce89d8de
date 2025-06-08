import { ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Navigate, useLocation } from 'react-router-dom';

type UserRole = 'admin' | 'depot_manager' | 'operator';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  allowedRoles 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuthContext();
  const location = useLocation();

  // Show loading state while auth is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} text="Checking access..." />
      </div>
    );
  }

  // Redirect to /login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Since we're using a mock user, we'll always have a user
  // Just check role-based access if specified
  if (requiredRole || allowedRoles) {
    const userRole = user?.role as UserRole | undefined;
    
    if (!userRole) {
      return <div>Unauthorized: No role assigned</div>;
    }

    if (requiredRole && userRole !== requiredRole) {
      return <div>Unauthorized: Required role {requiredRole}</div>;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return <div>Unauthorized: Not in allowed roles</div>;
    }
  }

  // If all checks pass, render the protected content
  return <>{children}</>;
} 