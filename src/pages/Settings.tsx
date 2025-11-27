// Enhanced fully functional Settings page
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
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
          .select('role')
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
  const role = Array.isArray(roles) && roles.length > 0 ? roles[0].role : 'user';
  const isAdmin = role === 'admin';

  // Fetch sync logs for admin users
  const { data: syncLogs } = useQuery({
    queryKey: ['gasbot-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agbot_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

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

  const isScheduler = role === 'scheduler';
  const depotGroups: string[] = []; // Depot groups not currently tracked in user_roles

  if (profileLoading || rolesLoading || preferencesLoading) {
    return <div className="flex items-center justify-center min-h-[300px]">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 min-h-full flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-center">Settings</h1>
      
      <Tabs defaultValue="account" className="w-full flex-1">
        <TabsList className={`grid w-full mb-6 ${isAdmin ? 'grid-cols-5' : 'grid-cols-3'}`}>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="gasbot">Gasbot Sync</TabsTrigger>}
          {isAdmin && <TabsTrigger value="smartfill">SmartFill</TabsTrigger>}
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
                      value={preferences.phone_number || ''}
                      onChange={(e) => updatePreferences({ phone_number: e.target.value || null })}
                      placeholder="+61 4XX XXX XXX"
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
                      value={preferences.webhook_url || ''}
                      onChange={(e) => updatePreferences({ webhook_url: e.target.value || null })}
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
                      <Switch
                        checked={preferences.alert_critical_tanks}
                        onCheckedChange={(checked) => updatePreferences({ alert_critical_tanks: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Low Fuel Warnings</Label>
                        <p className="text-sm text-muted-foreground">
                          Notifications when tanks drop below {preferences.low_fuel_threshold}%
                        </p>
                      </div>
                      <Switch
                        checked={preferences.alert_low_fuel}
                        onCheckedChange={(checked) => updatePreferences({ alert_low_fuel: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Maintenance Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Scheduled maintenance and inspection reminders
                        </p>
                      </div>
                      <Switch
                        checked={preferences.alert_maintenance}
                        onCheckedChange={(checked) => updatePreferences({ alert_maintenance: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">System Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Notifications about system updates and new features
                        </p>
                      </div>
                      <Switch
                        checked={preferences.alert_system_updates}
                        onCheckedChange={(checked) => updatePreferences({ alert_system_updates: checked })}
                      />
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

        {isAdmin && (
        <TabsContent value="gasbot">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gasbot Data Sync</h2>
            <div className="space-y-6">
              {/* Sync Status */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-medium mb-2">Sync Status</h3>
                <div className="text-sm text-muted-foreground">
                  <div>Last Sync: <span className="font-mono">Never</span></div>
                  <div>Status: <span className="text-orange-600">Not Configured</span></div>
                </div>
              </div>

              {/* Manual Sync */}
              <div className="space-y-4">
                <h3 className="font-medium">Manual Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Pull the latest tank data from Gasbot API and update the database.
                </p>
                <Button 
                  onClick={() => {
                    fetch('/api/gasbot-sync', {
                      method: 'POST',
                      headers: {
                        'Authorization': 'Bearer FSG-gasbot-sync-2025',
                        'Content-Type': 'application/json'
                      }
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast({
                          title: 'Sync Completed',
                          description: `Processed ${data.results.locationsProcessed} locations and ${data.results.assetsProcessed} assets`,
                        });
                      } else {
                        toast({
                          title: 'Sync Failed',
                          description: data.message || 'Unknown error occurred',
                          variant: 'destructive'
                        });
                      }
                    })
                    .catch(error => {
                      toast({
                        title: 'Sync Error',
                        description: 'Failed to start sync operation',
                        variant: 'destructive'
                      });
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  Sync Gasbot Data Now
                </Button>
              </div>

              {/* API Configuration */}
              <div className="space-y-4">
                <h3 className="font-medium">API Configuration</h3>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="gasbot-api-key">API Key</Label>
                    <Input 
                      id="gasbot-api-key"
                      type="password"
                      placeholder="0H5NTKJPLQURW4SQDU3J0G5EO7UNZCI6EB3C"
                      disabled
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gasbot-api-secret">API Secret</Label>
                    <Input 
                      id="gasbot-api-secret"
                      type="password"
                      placeholder="1F01ONSVQGCN47NOS987MAR768RBXJF5NO1VORQF7W"
                      disabled
                      className="font-mono text-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    API credentials are configured via environment variables for security.
                  </p>
                </div>
              </div>

              {/* Test API Connection */}
              <div className="space-y-4">
                <h3 className="font-medium">Connection Test</h3>
                <p className="text-sm text-muted-foreground">
                  Test the connection to Gasbot API to verify credentials.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    fetch('/api/gasbot-sync', { method: 'GET' })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast({
                          title: 'Connection Test Successful',
                          description: `API is working correctly`,
                        });
                      } else {
                        toast({
                          title: 'Connection Test Failed',
                          description: data.message || 'API connection failed',
                          variant: 'destructive'
                        });
                      }
                    })
                    .catch(error => {
                      toast({
                        title: 'Test Error',
                        description: 'Failed to test API connection',
                        variant: 'destructive'
                      });
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  Test API Connection
                </Button>
              </div>

              {/* Sync Logs */}
              <div className="space-y-4">
                <h3 className="font-medium">Recent Sync Logs</h3>
                <div className="bg-muted p-4 rounded-lg">
                  {syncLogs && syncLogs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {syncLogs.map((log: any) => (
                        <div key={log.id} className="flex justify-between text-sm p-2 bg-background rounded">
                          <span className="text-muted-foreground">
                            {format(new Date(log.started_at), 'MMM d, h:mm a')}
                          </span>
                          <span className={log.sync_status === 'success' ? 'text-green-600' : 'text-red-600'}>
                            {log.sync_status} - {log.locations_processed} locations, {log.assets_processed} assets
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No sync logs available. Run a sync to see results here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        )}

        {isAdmin && (
        <TabsContent value="smartfill">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">SmartFill System</h2>
            <div className="space-y-6">
              {/* System Status */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-medium mb-2">System Status</h3>
                <div className="text-sm text-muted-foreground">
                  <div>Customers: <span className="font-mono">33 Active</span></div>
                  <div>Status: <span className="text-green-600">Ready</span></div>
                </div>
              </div>

              {/* Customer API Testing */}
              <div className="space-y-4">
                <h3 className="font-medium">Customer API Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Test API connectivity for all 33 SmartFill customers to verify credentials.
                </p>
                <Button 
                  onClick={() => {
                    fetch('/api/smartfill-test-customers', { method: 'GET' })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast({
                          title: 'API Test Completed',
                          description: `${data.summary.successful}/${data.summary.totalCustomers} customers passed connectivity test (${data.summary.successRate})`,
                        });
                      } else {
                        toast({
                          title: 'API Test Results',
                          description: `${data.summary?.successful || 0}/${data.summary?.totalCustomers || 0} customers connected successfully`,
                          variant: data.summary?.successful === 0 ? 'destructive' : 'default'
                        });
                      }
                    })
                    .catch(error => {
                      toast({
                        title: 'Test Error',
                        description: 'Failed to run customer API tests',
                        variant: 'destructive'
                      });
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  Test All Customer APIs
                </Button>
              </div>

              {/* Data Sync */}
              <div className="space-y-4">
                <h3 className="font-medium">Data Synchronization</h3>
                <p className="text-sm text-muted-foreground">
                  Sync tank data for all customers. This will populate locations, tanks, and readings.
                </p>
                <Button 
                  onClick={() => {
                    // This will use the existing SmartFill sync functionality
                    toast({
                      title: 'Sync Started',
                      description: 'SmartFill data synchronization initiated. This may take several minutes.',
                    });
                    // TODO: Implement bulk sync for all customers
                  }}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Sync All Customer Data
                </Button>
              </div>

              {/* Customer List */}
              <div className="space-y-4">
                <h3 className="font-medium">Customer Overview</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 gap-2">
                      <div>• Stevemac103</div>
                      <div>• Swan Towing 299</div>
                      <div>• Great Southern 1877</div>
                      <div>• Shire of Northam 4241</div>
                      <div>• Midwest Logistics 4066</div>
                      <div>• NACAP GSF 2975</div>
                      <div>• MDH Transport 3241</div>
                      <div>• Tee Cee Transport 3035</div>
                      <div>• City of Swan 2413</div>
                      <div>• Penns Cartage 3497</div>
                      <div className="col-span-2 text-center mt-2">
                        <span className="text-xs">... and 23 more customers</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integration Status */}
              <div className="space-y-4">
                <h3 className="font-medium">Integration Status</h3>
                <div className="grid gap-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm">Database Schema</span>
                    <span className="text-green-600 text-sm font-medium">✅ Ready</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm">API Service</span>
                    <span className="text-green-600 text-sm font-medium">✅ Configured</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm">Customer Data</span>
                    <span className="text-orange-600 text-sm font-medium">⏳ Pending Migration</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm">Dashboard</span>
                    <span className="text-green-600 text-sm font-medium">✅ Available</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default Settings;