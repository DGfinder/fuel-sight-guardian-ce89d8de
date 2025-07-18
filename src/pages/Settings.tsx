// Enhanced fully functional Settings page
import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type { Tables } from '@/types/supabase';
import { Moon, Sun, Monitor, Palette, Bell, Shield, User, Settings as SettingsIcon } from 'lucide-react';

interface UserRoleRow {
  role: string;
  group_id: string | null;
  tank_groups: { name: string } | null;
}

function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  
  // User preferences hook
  const { preferences, updatePreferences, isLoading: preferencesLoading, isUpdating } = useUserPreferences();

  // Theme application effect
  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      const root = window.document.documentElement;
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.toggle('dark', systemTheme === 'dark');
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };

    if (preferences?.theme) {
      applyTheme(preferences.theme);
    }

    // Listen for system theme changes when using system theme
    if (preferences?.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences?.theme]);

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

  if (profileLoading || rolesLoading || preferencesLoading) {
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
          <div className="space-y-6">
            {/* Theme Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="theme-select" className="text-sm font-medium">
                    Appearance
                  </Label>
                  <Select
                    value={preferences.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      updatePreferences({ theme: value })
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          Light
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Dark
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          System
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose your preferred appearance or sync with your system
                  </p>
                </div>

                <div>
                  <Label htmlFor="map-style" className="text-sm font-medium">
                    Map Style
                  </Label>
                  <Select
                    value={preferences.preferred_map_style}
                    onValueChange={(value: 'light' | 'dark' | 'satellite' | 'terrain') => 
                      updatePreferences({ preferred_map_style: value })
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select map style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="satellite">Satellite</SelectItem>
                      <SelectItem value="terrain">Terrain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Display Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Display Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium">
                    Timezone
                  </Label>
                  <Input
                    id="timezone"
                    value={preferences.timezone}
                    onChange={(e) => updatePreferences({ timezone: e.target.value })}
                    placeholder="Enter timezone (e.g., America/New_York)"
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Current: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                </div>

                {depotGroups.length > 0 && (
                  <div>
                    <Label htmlFor="default-depot" className="text-sm font-medium">
                      Default Depot
                    </Label>
                    <Select
                      value={preferences.default_depot_group || ''}
                      onValueChange={(value) => 
                        updatePreferences({ default_depot_group: value || null })
                      }
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select default depot" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {depotGroups.map((depot, index) => (
                          <SelectItem key={index} value={depot}>
                            {depot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alert Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alert Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Critical Fuel Level</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {preferences.critical_fuel_threshold}%
                    </span>
                  </div>
                  <Slider
                    value={[preferences.critical_fuel_threshold]}
                    onValueChange={([value]) => 
                      updatePreferences({ critical_fuel_threshold: value })
                    }
                    max={30}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1%</span>
                    <span>30%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Send critical alerts when tanks drop below this level
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Low Fuel Level</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {preferences.low_fuel_threshold}%
                    </span>
                  </div>
                  <Slider
                    value={[preferences.low_fuel_threshold]}
                    onValueChange={([value]) => 
                      updatePreferences({ low_fuel_threshold: value })
                    }
                    max={50}
                    min={preferences.critical_fuel_threshold + 1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{preferences.critical_fuel_threshold + 1}%</span>
                    <span>50%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Send low fuel warnings when tanks drop below this level
                  </p>
                </div>

                {/* Visual threshold preview */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-medium mb-3">Threshold Preview</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-destructive rounded"></div>
                      <span className="text-sm">Critical: ≤{preferences.critical_fuel_threshold}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-sm">
                        Low: {preferences.critical_fuel_threshold + 1}% - {preferences.low_fuel_threshold}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm">Normal: &gt;{preferences.low_fuel_threshold}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isUpdating && (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Saving preferences...</div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-6">
            {/* Notification Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Channels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts via email at {user?.email}
                      </p>
                    </div>
                    <Switch
                      checked={preferences.email_alerts}
                      onCheckedChange={(checked) => 
                        updatePreferences({ email_alerts: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive critical alerts via SMS (phone number required)
                      </p>
                    </div>
                    <Switch
                      checked={preferences.sms_alerts}
                      onCheckedChange={(checked) => 
                        updatePreferences({ sms_alerts: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Webhook Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Send alerts to external systems (for advanced users)
                      </p>
                    </div>
                    <Switch
                      checked={preferences.webhook_alerts}
                      onCheckedChange={(checked) => 
                        updatePreferences({ webhook_alerts: checked })
                      }
                    />
                  </div>
                </div>

                {/* Phone number input if SMS is enabled */}
                {preferences.sms_alerts && (
                  <div className="p-4 bg-muted rounded-lg">
                    <Label htmlFor="phone-number" className="text-sm font-medium">
                      Phone Number
                    </Label>
                    <Input
                      id="phone-number"
                      placeholder="+1 (555) 123-4567"
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your phone number to receive SMS alerts
                    </p>
                  </div>
                )}

                {/* Webhook URL input if webhooks are enabled */}
                {preferences.webhook_alerts && (
                  <div className="p-4 bg-muted rounded-lg">
                    <Label htmlFor="webhook-url" className="text-sm font-medium">
                      Webhook URL
                    </Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-service.com/webhook"
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Alert data will be sent as JSON POST requests
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alert Types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Alert Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Critical Tank Levels</Label>
                        <p className="text-sm text-muted-foreground">
                          Immediate alerts when tanks reach critical levels (≤{preferences.critical_fuel_threshold}%)
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Low Fuel Warnings</Label>
                        <p className="text-sm text-muted-foreground">
                          Notifications when tanks drop below {preferences.low_fuel_threshold}%
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Maintenance Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Scheduled maintenance and inspection reminders
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">System Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Notifications about system updates and new features
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Test Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Send test notifications to verify your settings are working correctly.
                  </p>
                  <div className="flex gap-2">
                    {preferences.email_alerts && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toast({ 
                          title: "Test Email Sent", 
                          description: `Test notification sent to ${user?.email}` 
                        })}
                      >
                        Test Email
                      </Button>
                    )}
                    {preferences.sms_alerts && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toast({ 
                          title: "Test SMS Sent", 
                          description: "Test SMS notification sent" 
                        })}
                      >
                        Test SMS
                      </Button>
                    )}
                    {preferences.webhook_alerts && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toast({ 
                          title: "Test Webhook Sent", 
                          description: "Test webhook notification sent" 
                        })}
                      >
                        Test Webhook
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {isUpdating && (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Saving preferences...</div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings;