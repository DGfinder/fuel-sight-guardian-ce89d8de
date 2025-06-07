import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TankAlert } from "@/types/fuel";

export function useTankAlerts(tankId: string) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ["tank-alerts", tankId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tank_alerts")
        .select("*")
        .eq("tank_id", tankId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TankAlert[];
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("tank_alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tank-alerts", tankId] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + 24); // Snooze for 24 hours

      const { error } = await supabase
        .from("tank_alerts")
        .update({ snoozed_until: snoozeUntil.toISOString() })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tank-alerts", tankId] });
    },
  });

  return {
    alerts,
    isLoading,
    error,
    acknowledgeAlert: acknowledgeMutation.mutate,
    snoozeAlert: snoozeMutation.mutate,
  };
} 