import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DipReading } from "@/types/fuel";

// Use the correct type for dip_readings
interface DipReading {
  id: string;
  tank_id: string;
  reading: number;
  recorded_at: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
// SwanDip type for fallback/mock
interface SwanDip {
  created_at: string | null;
  dip_litres: number | null;
  id: string;
  refill_detected: boolean | null;
  tank_id: string;
  user_id: string | null;
}

export type TankHistoryPoint = {
  timestamp: string;
  level: number;
  source: 'dip_reading' | 'swan_dip';
};

export interface TankHistoryOptions {
  tankId: string;
  enabled?: boolean;
  days?: 7 | 30;
}

export function useTankHistory({ tankId, enabled = true, days = 30 }: TankHistoryOptions) {
  return useQuery({
    queryKey: ["tank-history", tankId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dip_readings")
        .select("*")
        .eq("tank_id", tankId)
        .order("created_at", { ascending: false })
        .limit(days);

      if (error) throw error;
      return data as DipReading[];
    },
    enabled,
  });
}

// Helper function to generate mock data for demo/testing
function generateMockData(days: number): TankHistoryPoint[] {
  const points: TankHistoryPoint[] = [];
  const now = new Date();
  const baseLevel = 50000; // 50,000L base level
  const variance = 5000; // 5,000L variance

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate a slightly random level around the base
    const randomFactor = Math.random() * 2 - 1; // -1 to 1
    const level = Math.round(baseLevel + (randomFactor * variance));
    
    points.push({
      timestamp: date.toISOString(),
      level,
      source: 'dip_reading' as const
    });
  }

  return points;
} 