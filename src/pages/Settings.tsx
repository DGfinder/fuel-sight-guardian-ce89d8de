// Minimal stable Settings page
import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';

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
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
      } catch (error) {
        console.error('Session error:', error);
      }
    };
    getSession();
    
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery<Tables<'profiles'> | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) return null;
        return data as Tables<'profiles'>;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
    retry: false,
  });

  // Fetch user roles
  const { data: rolesRaw, isLoading: rolesLoading } = useQuery<UserRoleRow[]>({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, group_id, tank_groups(name)')
          .eq('user_id', user.id);
        if (error) return [];
        return data as UserRoleRow[];
      } catch {
        return [];
      }
    },
    enabled: !!user?.id,
    retry: false,
  });

  const roles: UserRoleRow[] = Array.isArray(rolesRaw) ? rolesRaw : [];
  
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
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
      toast({ title: 'Success', description: 'Name updated successfully.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const handleDepotChangeRequest = () => {
    toast({ title: 'Request Sent', description: 'Depot change request submitted.' });
  };

  const role = Array.isArray(roles) && roles.length > 0 ? roles[0].role : 'user';
  const isAdmin = role === 'admin';
  const isScheduler = role === 'scheduler';
  const depotGroups = Array.isArray(roles) ? roles.map(r => r.tank_groups?.name).filter(Boolean) : [];

  if (profileLoading || rolesLoading) {
    return <div className="flex items-center justify-center min-h-[300px]">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Settings</h1>
      
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <div className="flex space-x-2">
                  <input
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => updateNameMutation.mutate(fullName)}
                    disabled={updateNameMutation.isPending}
                  />
                  {updateNameMutation.isPending && <span className="text-sm text-gray-500">Saving...</span>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  className="w-full px-3 py-2 border rounded-md bg-gray-50"
                  value={user?.email || ''}
                  disabled
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {role.toUpperCase()}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Depot Access</label>
                <div className="space-x-2">
                  {depotGroups.length > 0 ? (
                    depotGroups.map((depot, index) => (
                      <span key={index} className="inline-block px-2 py-1 bg-gray-100 rounded text-sm">
                        {depot}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>
              
              <Button onClick={handleDepotChangeRequest} variant="outline">
                Request Depot Change
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900">Coming Soon</h3>
                <p className="text-sm text-blue-700">Theme and customization options will be available soon.</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-medium text-green-900">Coming Soon</h3>
                <p className="text-sm text-green-700">Email and SMS notification settings will be available soon.</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings;