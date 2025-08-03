import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  default_depot_group: string | null;
  timezone: string;
  email_alerts: boolean;
  sms_alerts: boolean;
  webhook_alerts: boolean;
  low_fuel_threshold: number;
  critical_fuel_threshold: number;
  preferred_map_style: 'light' | 'dark' | 'satellite' | 'terrain';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  default_depot_group: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  email_alerts: true,
  sms_alerts: false,
  webhook_alerts: false,
  low_fuel_threshold: 20,
  critical_fuel_threshold: 10,
  preferred_map_style: 'light',
};

export function useUserPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

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

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async (): Promise<UserPreferences> => {
      if (!user?.id) return DEFAULT_PREFERENCES;
      
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error || !data) {
        return DEFAULT_PREFERENCES;
      }
      
      return {
        theme: data.theme || DEFAULT_PREFERENCES.theme,
        default_depot_group: data.default_depot_group,
        timezone: data.timezone || DEFAULT_PREFERENCES.timezone,
        email_alerts: data.email_alerts ?? DEFAULT_PREFERENCES.email_alerts,
        sms_alerts: data.sms_alerts ?? DEFAULT_PREFERENCES.sms_alerts,
        webhook_alerts: data.webhook_alerts ?? DEFAULT_PREFERENCES.webhook_alerts,
        low_fuel_threshold: data.low_fuel_threshold ?? DEFAULT_PREFERENCES.low_fuel_threshold,
        critical_fuel_threshold: data.critical_fuel_threshold ?? DEFAULT_PREFERENCES.critical_fuel_threshold,
        preferred_map_style: data.preferred_map_style || DEFAULT_PREFERENCES.preferred_map_style,
      };
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      if (!user?.id) throw new Error('No user logged in');
      
      const { data: existingData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      const mergedPreferences = {
        ...DEFAULT_PREFERENCES,
        ...existingData,
        ...newPreferences,
      };
      
      if (existingData) {
        const { error } = await supabase
          .from('user_preferences')
          .update(mergedPreferences)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_preferences')
          .insert([{ user_id: user.id, ...mergedPreferences }]);
        
        if (error) throw error;
      }
      
      return mergedPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences', user?.id] });
      toast({
        title: 'Preferences Updated',
        description: 'Your settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update preferences: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    preferences: preferences || DEFAULT_PREFERENCES,
    updatePreferences: updatePreferences.mutate,
    isLoading,
    isUpdating: updatePreferences.isPending,
  };
}