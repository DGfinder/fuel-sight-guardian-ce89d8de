import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Shield, Database, AlertTriangle } from 'lucide-react';

interface DebugInfo {
  session: any;
  userPermissions: any[];
  carrierAccess: any[];
  analyticsPermissions: any[];
  directQuery: any;
}

export default function LytxDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get user permissions
      const { data: userPermissions } = await supabase
        .from('user_group_permissions')
        .select('*')
        .eq('user_id', session?.user?.id || '');

      // Get carrier access
      const { data: carrierAccess } = await supabase
        .from('user_subgroup_permissions')
        .select('*')
        .eq('user_id', session?.user?.id || '');

      // Get analytics permissions
      const { data: analyticsPermissions } = await supabase
        .from('analytics_permissions')
        .select('*')
        .eq('user_id', session?.user?.id || '');

      // Try direct query with current user
      const { data: directQuery, error: directQueryError } = await supabase
        .from('lytx_safety_events')
        .select('carrier, depot, event_datetime, event_type')
        .limit(3);

      setDebugInfo({
        session,
        userPermissions: userPermissions || [],
        carrierAccess: carrierAccess || [],
        analyticsPermissions: analyticsPermissions || [],
        directQuery: directQueryError ? { error: directQueryError.message } : directQuery
      });
    } catch (error) {
      console.error('Debug failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showDebug) {
      runDiagnostics();
    }
  }, [showDebug]);

  if (!showDebug) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDebug(true)}
          className="bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-red-700 flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Debug LYTX Access
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">LYTX Access Debug Panel</h2>
            <button
              onClick={() => setShowDebug(false)}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Running diagnostics...</p>
            </div>
          )}

          {debugInfo && (
            <div className="space-y-6">
              {/* Session Info */}
              <div className="border rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <User className="h-5 w-5" />
                  User Session
                </h3>
                {debugInfo.session ? (
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <p><strong>User ID:</strong> {debugInfo.session.user.id}</p>
                    <p><strong>Email:</strong> {debugInfo.session.user.email}</p>
                    <p><strong>Role:</strong> {debugInfo.session.user.app_metadata?.role || 'No role set'}</p>
                    <p><strong>Groups:</strong> {JSON.stringify(debugInfo.session.user.user_metadata?.groups) || 'No groups'}</p>
                  </div>
                ) : (
                  <p className="text-red-600">❌ No active session</p>
                )}
              </div>

              {/* User Permissions */}
              <div className="border rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <Shield className="h-5 w-5" />
                  User Permissions ({debugInfo.userPermissions.length})
                </h3>
                {debugInfo.userPermissions.length > 0 ? (
                  <div className="space-y-2">
                    {debugInfo.userPermissions.map((perm, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-sm">
                        <p><strong>Group:</strong> {perm.group_name}</p>
                        <p><strong>Role:</strong> {perm.role}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-600">⚠️ No group permissions found</p>
                )}
              </div>

              {/* Carrier Access */}
              <div className="border rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <Database className="h-5 w-5" />
                  Carrier Access ({debugInfo.carrierAccess.length})
                </h3>
                {debugInfo.carrierAccess.length > 0 ? (
                  <div className="space-y-2">
                    {debugInfo.carrierAccess.map((access, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-sm">
                        <p><strong>Subgroup:</strong> {access.subgroup_name}</p>
                        <p><strong>Role:</strong> {access.role}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-600">⚠️ No carrier access permissions</p>
                )}
              </div>

              {/* Analytics Permissions */}
              <div className="border rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <Database className="h-5 w-5" />
                  Analytics Permissions ({debugInfo.analyticsPermissions.length})
                </h3>
                {debugInfo.analyticsPermissions.length > 0 ? (
                  <div className="space-y-2">
                    {debugInfo.analyticsPermissions.map((perm, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-sm">
                        <p><strong>Permission:</strong> {perm.permission}</p>
                        <p><strong>Granted:</strong> {perm.granted_at}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-red-600">❌ No analytics permissions found</p>
                )}
              </div>

              {/* Direct Query Test */}
              <div className="border rounded-lg p-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg mb-3">
                  <Database className="h-5 w-5" />
                  Direct Query Test
                </h3>
                {debugInfo.directQuery.error ? (
                  <div className="text-red-600">
                    <p>❌ Query failed: {debugInfo.directQuery.error}</p>
                    <p className="text-sm mt-2">This indicates RLS is blocking access</p>
                  </div>
                ) : (
                  <div className="text-green-600">
                    <p>✅ Query successful - {Array.isArray(debugInfo.directQuery) ? debugInfo.directQuery.length : 0} events returned</p>
                    {Array.isArray(debugInfo.directQuery) && debugInfo.directQuery.length > 0 && (
                      <div className="mt-2 bg-gray-50 p-2 rounded text-xs text-gray-700">
                        <p>Sample: {debugInfo.directQuery[0].carrier} | {debugInfo.directQuery[0].depot}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="border-t pt-4 space-y-2">
                <button
                  onClick={runDiagnostics}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Running...' : 'Refresh Diagnostics'}
                </button>
                <button
                  onClick={() => {
                    console.log('🐛 LYTX Debug Info:', debugInfo);
                    alert('Debug info logged to browser console');
                  }}
                  className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                >
                  Log to Console
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}