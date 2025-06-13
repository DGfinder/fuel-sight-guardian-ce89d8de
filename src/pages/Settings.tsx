import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
import { Link } from 'react-router-dom';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { 
  User, 
  Palette, 
  Bell, 
  Shield, 
  Users, 
  Code, 
  AlertTriangle,
  Save,
  Edit,
  Mail,
  MessageSquare,
  Webhook,
  Clock,
  Globe,
  Fuel,
  Monitor,
  Smartphone,
  Settings as SettingsIcon,
  Heart,
  ExternalLink
} from 'lucide-react';

// Types for roles
interface UserRoleRow {
  role: string;
  group_id: string | null;
  tank_groups: { name: string } | null;
}

function Settings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const { preferences, updatePreferences, isLoading: prefsLoading, isUpdating } = useUserPreferences();
  const [isEditingName, setIsEditingName] = useState(false);

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
      toast({ title: 'Success', description: 'Full name updated successfully.' });
      setIsEditingName(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Request depot change (dummy for now)
  const handleDepotChangeRequest = () => {
    toast({ title: 'Request Sent', description: 'Depot assignment change request has been submitted for admin review.' });
  };

  // Role logic
  const role = Array.isArray(roles) && roles.length > 0 ? roles[0].role : user?.role || 'user';
  const isAdmin = role === 'admin';
  const isScheduler = role === 'scheduler';
  const isDepotStaff = role === 'depot_staff';

  // Depot group names
  const depotGroups = Array.isArray(roles) ? roles.map(r => r.tank_groups?.name).filter((n): n is string => typeof n === 'string') : [];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'scheduler': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'depot_staff': return 'bg-green-100 text-green-800 hover:bg-green-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  if (profileLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <SettingsIcon className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Settings
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Customize your Fuel Sight Guardian experience, manage preferences, and configure alerts
        </p>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Link to="/settings/health">
          <Button variant="outline" className="space-x-2">
            <Heart className="h-4 w-4" />
            <span>System Health</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
        <Button 
          variant="outline" 
          onClick={handleDepotChangeRequest}
          className="space-x-2"
        >
          <Users className="h-4 w-4" />
          <span>Request Depot Change</span>
        </Button>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto p-1">
          <TabsTrigger value="account" className="flex items-center space-x-2 py-3">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center space-x-2 py-3">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2 py-3">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          {(isAdmin || isScheduler) && (
            <TabsTrigger value="permissions" className="flex items-center space-x-2 py-3">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissions</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="flex items-center space-x-2 py-3">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="api" className="flex items-center space-x-2 py-3">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Account Information</span>
              </CardTitle>
              <CardDescription>
                Manage your profile details and account settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-bold">
                  {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Profile Picture</p>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                </div>
              </div>

              <Separator />

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="flex space-x-2">
                    {isEditingName ? (
                      <>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Enter your full name"
                          className="flex-1"
                        />
                        <Button 
                          size="sm"
                          onClick={() => updateNameMutation.mutate(fullName)}
                          disabled={updateNameMutation.isPending}
                        >
                          {updateNameMutation.isPending ? (
                            <SettingsIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setIsEditingName(false)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          value={fullName || 'Not set'}
                          disabled
                          className="flex-1"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setIsEditingName(true)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    value={user?.email || 'Not available'} 
                    disabled 
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>
              </div>

              <Separator />

              {/* Role and Access */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Role & Access</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Current Role</Label>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleBadgeColor(role)}>
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {isAdmin && <Shield className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Depot Access</Label>
                    <div className="flex flex-wrap gap-2">
                      {depotGroups.length > 0 ? (
                        depotGroups.map((depot, index) => (
                          <Badge key={index} variant="secondary">
                            {depot}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">No depot access</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="space-y-6 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="h-5 w-5" />
                  <span>Appearance</span>
                </CardTitle>
                <CardDescription>
                  Customize the look and feel of your interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {prefsLoading ? (
                  <div className="text-center py-4">
                    <SettingsIcon className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading preferences...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="theme-select" className="flex items-center space-x-2">
                        <Monitor className="h-4 w-4" />
                        <span>Theme</span>
                      </Label>
                      <Select
                        value={preferences.theme}
                        onValueChange={(value: 'light' | 'dark' | 'system') => 
                          updatePreferences({ theme: value })
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">☀️ Light</SelectItem>
                          <SelectItem value="dark">🌙 Dark</SelectItem>
                          <SelectItem value="system">💻 System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone-select" className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <span>Timezone</span>
                      </Label>
                      <Select
                        value={preferences.timezone}
                        onValueChange={(value: string) => 
                          updatePreferences({ timezone: value })
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">🌍 UTC</SelectItem>
                          <SelectItem value="America/New_York">🗽 Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">🏢 Central Time</SelectItem>
                          <SelectItem value="America/Denver">🏔️ Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">🌴 Pacific Time</SelectItem>
                          <SelectItem value="Australia/Sydney">🇦🇺 Sydney</SelectItem>
                          <SelectItem value="Australia/Melbourne">🇦🇺 Melbourne</SelectItem>
                          <SelectItem value="Australia/Perth">🇦🇺 Perth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Fuel Monitoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Fuel className="h-5 w-5" />
                  <span>Fuel Monitoring</span>
                </CardTitle>
                <CardDescription>
                  Configure fuel level thresholds for alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {prefsLoading ? (
                  <div className="text-center py-4">
                    <SettingsIcon className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Low Fuel Warning</Label>
                        <Badge variant="outline">{preferences.low_fuel_threshold}%</Badge>
                      </div>
                      <Slider
                        value={[preferences.low_fuel_threshold]}
                        onValueChange={([value]) => updatePreferences({ low_fuel_threshold: value })}
                        max={100}
                        min={0}
                        step={5}
                        disabled={isUpdating}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Alert when fuel drops to this level
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Critical Fuel Alert</Label>
                        <Badge variant="destructive">{preferences.critical_fuel_threshold}%</Badge>
                      </div>
                      <Slider
                        value={[preferences.critical_fuel_threshold]}
                        onValueChange={([value]) => updatePreferences({ critical_fuel_threshold: value })}
                        max={preferences.low_fuel_threshold}
                        min={0}
                        step={5}
                        disabled={isUpdating}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Urgent alert for critically low fuel
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
              <CardDescription>
                Choose how you want to receive alerts and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prefsLoading ? (
                <div className="text-center py-8">
                  <SettingsIcon className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading notification settings...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Email Alerts */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-blue-500" />
                      <div>
                        <Label htmlFor="email-alerts" className="text-base font-medium">Email Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications for fuel levels and system updates
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email-alerts"
                      checked={preferences.email_alerts}
                      onCheckedChange={(checked) => updatePreferences({ email_alerts: checked })}
                      disabled={isUpdating}
                    />
                  </div>

                  {/* SMS Alerts (Admin/Scheduler only) */}
                  {(isAdmin || isScheduler) && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="h-5 w-5 text-green-500" />
                        <div>
                          <Label htmlFor="sms-alerts" className="text-base font-medium">SMS Alerts</Label>
                          <p className="text-sm text-muted-foreground">
                            Urgent alerts sent directly to your phone
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="sms-alerts"
                        checked={preferences.sms_alerts}
                        onCheckedChange={(checked) => updatePreferences({ sms_alerts: checked })}
                        disabled={isUpdating}
                      />
                    </div>
                  )}

                  {/* Webhook/Slack Alerts (Admin only) */}
                  {isAdmin && (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Webhook className="h-5 w-5 text-purple-500" />
                        <div>
                          <Label htmlFor="webhook-alerts" className="text-base font-medium">Webhook Alerts</Label>
                          <p className="text-sm text-muted-foreground">
                            Send alerts to Slack, Teams, or custom endpoints
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="webhook-alerts"
                        checked={preferences.webhook_alerts}
                        onCheckedChange={(checked) => updatePreferences({ webhook_alerts: checked })}
                        disabled={isUpdating}
                      />
                    </div>
                  )}

                  {/* Alert Summary */}
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center space-x-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <h4 className="font-medium">Alert Thresholds</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Low fuel warning:</span>
                        <Badge variant="outline">{preferences.low_fuel_threshold}%</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Critical fuel alert:</span>
                        <Badge variant="destructive">{preferences.critical_fuel_threshold}%</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Adjust thresholds in the Preferences tab
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Continue with other tabs... */}
        {(isAdmin || isScheduler) && (
          <TabsContent value="permissions" className="space-y-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Permissions Matrix</span>
                </CardTitle>
                <CardDescription>
                  Role-based access control overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Feature</th>
                        <th className="text-center p-3 font-medium">Admin</th>
                        <th className="text-center p-3 font-medium">Scheduler</th>
                        <th className="text-center p-3 font-medium">Depot Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3">View all tanks</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">❌</td>
                      </tr>
                      <tr>
                        <td className="p-3">Add/Edit dip readings</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">✅</td>
                      </tr>
                      <tr>
                        <td className="p-3">View reports</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">🔒</td>
                      </tr>
                      <tr>
                        <td className="p-3">Manage users</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">❌</td>
                        <td className="p-3 text-center">❌</td>
                      </tr>
                      <tr>
                        <td className="p-3">System configuration</td>
                        <td className="p-3 text-center">✅</td>
                        <td className="p-3 text-center">❌</td>
                        <td className="p-3 text-center">❌</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* User Management */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <CardDescription>
                  Invite, manage, and configure user access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button className="h-20 flex-col space-y-2">
                    <Users className="h-6 w-6" />
                    <span>Invite User</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <Edit className="h-6 w-6" />
                    <span>Manage Roles</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <SettingsIcon className="h-6 w-6" />
                    <span>Reset Password</span>
                  </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Quick Actions</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Export user list</p>
                    <p>• Bulk role assignments</p>
                    <p>• Activity monitoring</p>
                    <p>• Access log review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* API/Developer */}
        {isAdmin && (
          <TabsContent value="api" className="space-y-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Developer Tools</span>
                </CardTitle>
                <CardDescription>
                  API tokens, webhooks, and integration settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">API Tokens</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button variant="outline" className="w-full">
                        Generate New Token
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Create secure tokens for API access
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Webhooks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button variant="outline" className="w-full">
                        Configure Endpoints
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Set up webhook destinations
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Documentation & Examples</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• API reference documentation</p>
                    <p>• Sample code snippets</p>
                    <p>• Integration examples</p>
                    <p>• Rate limiting information</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default Settings;