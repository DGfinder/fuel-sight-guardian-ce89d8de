// Settings.tsx
// Responsive, role-based settings page for Fuel Sight Guardian
// NOTE: This is a prototype. Replace mockUser with real user/role data from auth context or API.

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
import { Link } from 'react-router-dom';

// Types for roles
interface UserRoleRow {
  role: string;
  group_id: string | null;
  tank_groups: { name: string } | null;
}

function Settings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile (full name, email)
  const { data: profile, isLoading: profileLoading } = useQuery<Tables<'profiles'> | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error || !data || typeof data !== 'object') return null;
      return data as Tables<'profiles'>;
    },
    enabled: !!user?.id
  });

  // Fetch user roles (depot assignments)
  const { data: rolesRaw, isLoading: rolesLoading } = useQuery<UserRoleRow[]>({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, group_id, tank_groups(name)')
        .eq('user_id', user.id);
      if (error || !Array.isArray(data)) return [] as UserRoleRow[];
      return data as UserRoleRow[];
    },
    enabled: !!user?.id
  });
  const roles: UserRoleRow[] = Array.isArray(rolesRaw) ? rolesRaw : [];

  // Editable full name
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    if (profile && typeof profile === 'object' && 'full_name' in profile && typeof profile.full_name === 'string') {
      setFullName(profile.full_name);
    } else {
      setFullName('');
    }
  }, [profile]);

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!user?.id) return;
      const { error } = await supabase.from('profiles').update({ full_name: newName }).eq('id', user.id);
      if (error) throw error;
      return newName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({ title: 'Saved', description: 'Full name updated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Request depot change (dummy for now)
  const handleDepotChangeRequest = () => {
    toast({ title: 'Request sent', description: 'Depot assignment change requested.' });
  };

  // Role logic
  const role = Array.isArray(roles) && roles.length > 0 ? roles[0].role : user?.role || 'user';
  const isAdmin = role === 'admin';
  const isScheduler = role === 'scheduler';
  const isDepotStaff = role === 'depot_staff';

  // Depot group names
  const depotGroups = Array.isArray(roles) ? roles.map(r => r.tank_groups?.name).filter((n): n is string => typeof n === 'string') : [];

  if (profileLoading || rolesLoading) {
    return <div className="flex items-center justify-center min-h-[300px]">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full py-8 px-2 sm:px-4 animate-fade-in">
      <h1 className="text-3xl font-bold mb-6 text-center">Settings</h1>
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="flex flex-wrap gap-2 justify-center mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {(isAdmin || isScheduler) && (
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          )}
          {isAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
          {isAdmin && <TabsTrigger value="api">API / Developer Tools</TabsTrigger>}
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* System Health Link */}
        <div className="mb-6 flex justify-center">
          <Link
            to="/settings/health"
            className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-semibold shadow transition"
          >
            🩺 System Health
          </Link>
        </div>

        {/* 1. Account Settings */}
        <TabsContent value="account">
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-2">Account Settings</h2>
            <p className="text-sm text-muted-foreground mb-4">Manage your profile and depot access.</p>
            <div className="space-y-2">
              <div>
                <b>Full Name:</b>{' '}
                <input
                  className="border rounded px-2 py-1 text-base"
                  value={fullName}
                  onChange={e => setFullName(typeof e.target.value === 'string' ? e.target.value : '')}
                  onBlur={() => updateNameMutation.mutate(fullName)}
                  disabled={updateNameMutation.isPending}
                  style={{ minWidth: 120 }}
                />
                {updateNameMutation.isPending && <span className="ml-2 text-xs text-gray-400">Saving...</span>}
              </div>
              <div><b>Email:</b> {(profile && typeof profile === 'object' && 'email' in profile && typeof profile.email === 'string' && profile.email) || user?.email} (read-only)</div>
              <div><b>Role:</b> {role}</div>
              <div><b>Depot Access:</b> {Array.isArray(depotGroups) && depotGroups.length > 0 ? depotGroups.join(', ') : 'None'}</div>
              <button className="underline text-primary" onClick={handleDepotChangeRequest}>Request depot change</button>
            </div>
          </Card>
        </TabsContent>

        {/* 2. Preferences */}
        <TabsContent value="preferences">
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-2">Preferences</h2>
            <p className="text-sm text-muted-foreground mb-4">Theme, default depot, and timezone.</p>
            {/* TODO: Add theme toggle, depot dropdown, timezone select */}
            <div className="space-y-2">
              <div>Theme: Light / Dark / System (toggle)</div>
              <div>Default Depot Group: (dropdown)</div>
              <div>Default Timezone: (dropdown or auto-detect)</div>
            </div>
          </Card>
        </TabsContent>

        {/* 3. Notifications */}
        <TabsContent value="notifications">
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-2">Notifications</h2>
            <p className="text-sm text-muted-foreground mb-4">Manage email, SMS, and webhook alerts.</p>
            {/* TODO: Add toggles for email/SMS/webhook notifications */}
            <div className="space-y-2">
              <div>Email Alerts: Toggle (Low Tank, Overfill)</div>
              {(isAdmin || isScheduler) && <div>SMS Alerts: Toggle (if enabled)</div>}
              {isAdmin && <div>Webhook/Slack Alerts: Toggle</div>}
            </div>
          </Card>
        </TabsContent>

        {/* 4. User Management (Admin only) */}
        {isAdmin && (
          <TabsContent value="users">
            <Card className="p-6 mb-4">
              <h2 className="text-xl font-semibold mb-2">User Management</h2>
              <p className="text-sm text-muted-foreground mb-4">Invite, remove, or manage users and roles.</p>
              {/* TODO: Add invite form, user list, role management */}
              <div className="space-y-2">
                <div>Invite new user (email, role, depot)</div>
                <div>Reset password link</div>
                <div>Remove/deactivate users</div>
                <div>Change user roles</div>
                <div>Export user list</div>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* 5. Permissions Summary (Admin + Scheduler) */}
        {(isAdmin || isScheduler) && (
          <TabsContent value="permissions">
            <Card className="p-6 mb-4">
              <h2 className="text-xl font-semibold mb-2">Permissions Summary</h2>
              <p className="text-sm text-muted-foreground mb-4">Role-based access matrix.</p>
              {/* TODO: Add permissions matrix table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 border">Feature</th>
                      <th className="p-2 border">Admin</th>
                      <th className="p-2 border">Scheduler</th>
                      <th className="p-2 border">Depot Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border">View all tanks</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">❌ (Only assigned depot)</td>
                    </tr>
                    <tr>
                      <td className="p-2 border">Add/Edit Dip Reading</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">✅</td>
                    </tr>
                    <tr>
                      <td className="p-2 border">View Reports</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">✅ (filtered)</td>
                    </tr>
                    <tr>
                      <td className="p-2 border">Manage Users</td>
                      <td className="p-2 border">✅</td>
                      <td className="p-2 border">❌</td>
                      <td className="p-2 border">❌</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* 6. API / Developer Tools (Admin only) */}
        {isAdmin && (
          <TabsContent value="api">
            <Card className="p-6 mb-4">
              <h2 className="text-xl font-semibold mb-2">API / Developer Tools</h2>
              <p className="text-sm text-muted-foreground mb-4">Manage API tokens and webhooks.</p>
              {/* TODO: Add API token management, webhook secret, docs */}
              <div className="space-y-2">
                <div>API token management</div>
                <div>Webhook secret</div>
                <div>Example queries / API docs</div>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* 7. Danger Zone */}
        <TabsContent value="danger">
          <Card className="p-6 mb-4">
            <h2 className="text-xl font-semibold mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">Sensitive account actions.</p>
            {/* TODO: Add change password, delete account, download data */}
            <div className="space-y-2">
              <div>Change password</div>
              <div>Delete account (admin-guarded)</div>
              <div>Download user data (GDPR)</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings; 