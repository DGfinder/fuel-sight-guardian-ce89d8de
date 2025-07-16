import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DipReading } from '@/types/fuel';

interface HistoryDipReading {
  id: string;
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by: string;
  notes: string;
  updated_at: string;
}

interface UseTankHistoryParams {
  tankId: string;
  enabled?: boolean;
  days?: number;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
  recordedBy?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: 'created_at' | 'value' | 'recorded_by';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface UseGroupTankHistoryParams {
  tankIds: string[];
  enabled?: boolean;
  days?: number;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
  recordedBy?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: 'created_at' | 'value' | 'recorded_by';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Enhanced hook for group-wide tank history
export function useGroupTankHistory({ 
  tankIds, 
  enabled = true, 
  days,
  dateFrom,
  dateTo,
  searchQuery,
  recordedBy,
  minValue,
  maxValue,
  sortBy = 'created_at',
  sortOrder = 'desc',
  limit = 1000,
  offset = 0
}: UseGroupTankHistoryParams) {
  return useQuery({
    queryKey: [
      'group-tank-history', 
      tankIds.sort().join(','), 
      days, 
      dateFrom?.toISOString(), 
      dateTo?.toISOString(),
      searchQuery,
      recordedBy,
      minValue,
      maxValue,
      sortBy,
      sortOrder,
      limit,
      offset
    ],
    queryFn: async () => {
      console.log(`Fetching group tank history for ${tankIds.length} tanks with filters`);
      
      if (tankIds.length === 0) {
        return {
          readings: [],
          totalCount: 0,
          hasMore: false
        };
      }

      let query = supabase
        .from('dip_readings')
        .select('*', { count: 'exact' })
        .in('tank_id', tankIds);

      // Date filtering
      if (dateFrom && dateTo) {
        query = query
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString());
      } else if (days) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte('created_at', fromDate.toISOString());
      }

      // Text search in notes and user full names
      if (searchQuery) {
        query = query.or(`notes.ilike.%${searchQuery}%,profiles.full_name.ilike.%${searchQuery}%`);
      }

      // Value range filtering
      if (minValue !== undefined) {
        query = query.gte('value', minValue);
      }
      if (maxValue !== undefined) {
        query = query.lte('value', maxValue);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching group tank history:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} dip readings for ${tankIds.length} tanks (total: ${count})`);
      
      // Get unique user IDs for profile lookup
      const userIds = [...new Set(data?.map(r => r.recorded_by).filter(Boolean))];
      
      // Fetch user profiles separately
      let userProfiles = new Map<string, string>();
      if (userIds.length > 0) {
        console.log(`Group Tank History: Looking up profiles for ${userIds.length} users:`, userIds);
        try {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          if (profileError) {
            console.warn('Profile lookup error:', profileError);
          } else if (profiles) {
            console.log(`Group Tank History: Found ${profiles.length} profiles:`, profiles);
            profiles.forEach(profile => {
              if (profile.full_name) {
                userProfiles.set(profile.id, profile.full_name);
              } else {
                console.warn(`Profile ${profile.id} has empty full_name`);
              }
            });
            console.log(`Group Tank History: Successfully mapped ${userProfiles.size} user names`);
          }
        } catch (profileError) {
          console.warn('Could not fetch user profiles:', profileError);
        }
      }
      
      let readings = (data || []).map((reading: any): DipReading => {
        const userId = reading.recorded_by;
        const fullName = userProfiles.get(userId);
        
        // Enhanced fallback logic for better UX
        let displayName = 'Unknown User';
        if (fullName) {
          displayName = fullName;
        } else if (userId && userId.length > 0) {
          // If we have a UUID, show a more user-friendly format
          if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            displayName = `User (${userId.substring(0, 8)}...)`;
          } else {
            displayName = userId; // Fallback to original value
          }
        }
        
        return {
          id: reading.id,
          tank_id: reading.tank_id,
          value: reading.value,
          created_at: reading.created_at,
          recorded_by: displayName,
          notes: reading.notes,
        };
      });

      // Client-side filtering by recorded_by (full name)
      if (recordedBy && recordedBy !== 'all') {
        readings = readings.filter(reading => reading.recorded_by === recordedBy);
      }

      return {
        readings,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + (data?.length || 0)
      };
    },
    enabled: enabled && tankIds.length > 0,
  });
}

export function useTankHistory({ 
  tankId, 
  enabled = true, 
  days,
  dateFrom,
  dateTo,
  searchQuery,
  recordedBy,
  minValue,
  maxValue,
  sortBy = 'created_at',
  sortOrder = 'desc',
  limit = 1000,
  offset = 0
}: UseTankHistoryParams) {
  return useQuery({
    queryKey: [
      'tank-history', 
      tankId, 
      days, 
      dateFrom?.toISOString(), 
      dateTo?.toISOString(),
      searchQuery,
      recordedBy,
      minValue,
      maxValue,
      sortBy,
      sortOrder,
      limit,
      offset
    ],
    queryFn: async () => {
      console.log(`Fetching tank history for tank ${tankId} with filters`);
      
      let query = supabase
        .from('dip_readings')
        .select('*', { count: 'exact' })
        .eq('tank_id', tankId);

      // Date filtering
      if (dateFrom && dateTo) {
        query = query
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString());
      } else if (days) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte('created_at', fromDate.toISOString());
      }

      // Text search in notes and user full names
      if (searchQuery) {
        query = query.or(`notes.ilike.%${searchQuery}%,profiles.full_name.ilike.%${searchQuery}%`);
      }

      // Filter by recorded_by (this will now be a full name, so we need to filter differently)
      // For now, we'll handle this filtering on the client side after getting the data
      // since we're matching full names but the database stores UUIDs

      // Value range filtering
      if (minValue !== undefined) {
        query = query.gte('value', minValue);
      }
      if (maxValue !== undefined) {
        query = query.lte('value', maxValue);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching tank history:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} dip readings for tank ${tankId} (total: ${count})`);
      
      // Get unique user IDs for profile lookup
      const userIds = [...new Set(data?.map(r => r.recorded_by).filter(Boolean))];
      
      // Fetch user profiles separately
      let userProfiles = new Map<string, string>();
      if (userIds.length > 0) {
        console.log(`Tank History: Looking up profiles for ${userIds.length} users:`, userIds);
        try {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          if (profileError) {
            console.warn('Profile lookup error:', profileError);
          } else if (profiles) {
            console.log(`Tank History: Found ${profiles.length} profiles:`, profiles);
            profiles.forEach(profile => {
              if (profile.full_name) {
                userProfiles.set(profile.id, profile.full_name);
              } else {
                console.warn(`Profile ${profile.id} has empty full_name`);
              }
            });
            console.log(`Tank History: Successfully mapped ${userProfiles.size} user names`);
          }
        } catch (profileError) {
          console.warn('Could not fetch user profiles:', profileError);
        }
      }
      
      let readings = (data || []).map((reading: any): DipReading => {
        const userId = reading.recorded_by;
        const fullName = userProfiles.get(userId);
        
        // Enhanced fallback logic for better UX
        let displayName = 'Unknown User';
        if (fullName) {
          displayName = fullName;
        } else if (userId && userId.length > 0) {
          // If we have a UUID, show a more user-friendly format
          if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            displayName = `User (${userId.substring(0, 8)}...)`;
          } else {
            displayName = userId; // Fallback to original value
          }
        }
        
        return {
          id: reading.id,
          tank_id: reading.tank_id,
          value: reading.value,
          created_at: reading.created_at,
          recorded_by: displayName,
          notes: reading.notes,
        };
      });

      // Client-side filtering by recorded_by (full name)
      if (recordedBy && recordedBy !== 'all') {
        readings = readings.filter(reading => reading.recorded_by === recordedBy);
      }

      return {
        readings,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + (data?.length || 0)
      };
    },
    enabled: enabled && !!tankId,
  });
}

// Hook for getting unique recorded_by values for filter dropdown
export function useTankRecorders(tankId: string) {
  return useQuery({
    queryKey: ['tank-recorders', tankId],
    queryFn: async () => {
      // Get unique user IDs from dip readings
      const { data, error } = await supabase
        .from('dip_readings')
        .select('recorded_by')
        .eq('tank_id', tankId)
        .not('recorded_by', 'is', null);
      
      if (error) throw error;
      
      const uniqueUserIds = [...new Set(data.map(r => r.recorded_by))].filter(Boolean);
      
      if (uniqueUserIds.length === 0) return [];
      
      // Fetch user profiles for these IDs
      try {
        console.log(`Tank Recorders: Looking up profiles for ${uniqueUserIds.length} users:`, uniqueUserIds);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);
        
        if (profileError) throw profileError;
        
        console.log(`Tank Recorders: Found ${profiles?.length || 0} profiles:`, profiles);
        
        // Create map of user ID to full name
        const userMap = new Map<string, string>();
        profiles?.forEach(profile => {
          if (profile.full_name) {
            userMap.set(profile.id, profile.full_name);
          } else {
            console.warn(`Tank Recorders: Profile ${profile.id} has empty full_name`);
          }
        });
        
        // Create recorder objects with enhanced fallback
        const recorders = uniqueUserIds.map(userId => {
          const fullName = userMap.get(userId);
          
          if (fullName) {
            return {
              id: userId,
              fullName: fullName
            };
          } else {
            // Enhanced fallback for better UX
            let displayName = 'Unknown User';
            if (userId && userId.length > 0) {
              if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                displayName = `User (${userId.substring(0, 8)}...)`;
              } else {
                displayName = userId;
              }
            }
            
            return {
              id: userId,
              fullName: displayName
            };
          }
        });
        
        return recorders.sort((a, b) => a.fullName.localeCompare(b.fullName));
      } catch (profileError) {
        console.warn('Could not fetch user profiles:', profileError);
        return [];
      }
    },
    enabled: !!tankId,
  });
}

// Hook for getting unique recorded_by values for group-wide filter dropdown
export function useGroupTankRecorders(tankIds: string[]) {
  return useQuery({
    queryKey: ['group-tank-recorders', tankIds.sort().join(',')],
    queryFn: async () => {
      if (tankIds.length === 0) return [];
      
      // Get unique user IDs from dip readings across all tanks
      const { data, error } = await supabase
        .from('dip_readings')
        .select('recorded_by')
        .in('tank_id', tankIds)
        .not('recorded_by', 'is', null);
      
      if (error) throw error;
      
      const uniqueUserIds = [...new Set(data.map(r => r.recorded_by))].filter(Boolean);
      
      if (uniqueUserIds.length === 0) return [];
      
      // Fetch user profiles for these IDs
      try {
        console.log(`Group Tank Recorders: Looking up profiles for ${uniqueUserIds.length} users:`, uniqueUserIds);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);
        
        if (profileError) throw profileError;
        
        console.log(`Group Tank Recorders: Found ${profiles?.length || 0} profiles:`, profiles);
        
        // Create map of user ID to full name
        const userMap = new Map<string, string>();
        profiles?.forEach(profile => {
          if (profile.full_name) {
            userMap.set(profile.id, profile.full_name);
          } else {
            console.warn(`Group Tank Recorders: Profile ${profile.id} has empty full_name`);
          }
        });
        
        // Create recorder objects with enhanced fallback
        const recorders = uniqueUserIds.map(userId => {
          const fullName = userMap.get(userId);
          
          if (fullName) {
            return {
              id: userId,
              fullName: fullName
            };
          } else {
            // Enhanced fallback for better UX
            let displayName = 'Unknown User';
            if (userId && userId.length > 0) {
              if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                displayName = `User (${userId.substring(0, 8)}...)`;
              } else {
                displayName = userId;
              }
            }
            
            return {
              id: userId,
              fullName: displayName
            };
          }
        });
        
        return recorders.sort((a, b) => a.fullName.localeCompare(b.fullName));
      } catch (profileError) {
        console.warn('Could not fetch user profiles:', profileError);
        return [];
      }
    },
    enabled: tankIds.length > 0,
  });
}

// Hook for getting reading statistics
export function useTankReadingStats(tankId: string, dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['tank-reading-stats', tankId, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('dip_readings')
        .select('value, created_at')
        .eq('tank_id', tankId);

      if (dateFrom && dateTo) {
        query = query
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          average: 0,
          latest: null,
          oldest: null
        };
      }

      const values = data.map(r => r.value).filter(v => v !== null);
      const sortedByDate = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        latest: sortedByDate[sortedByDate.length - 1],
        oldest: sortedByDate[0]
      };
    },
    enabled: !!tankId,
  });
}
