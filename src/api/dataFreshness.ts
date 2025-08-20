import { supabase } from '@/lib/supabase';

// Types for the data freshness system
export type FreshnessStatus = 'fresh' | 'stale' | 'very_stale' | 'critical';
export type DataSourceType = 'csv_upload' | 'api_sync' | 'manual_entry' | 'webhook' | 'scheduled_import';

export interface DataSourceRegistry {
  id: string;
  source_key: string;
  display_name: string;
  description: string;
  table_name: string;
  timestamp_column: string;
  fresh_threshold_hours: number;
  stale_threshold_hours: number;
  critical_threshold_hours: number;
  source_type: DataSourceType;
  route_path: string;
  icon_name: string;
  color_class: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DataFreshnessTracking {
  id: string;
  source_key: string;
  last_updated_at: string;
  record_count: number;
  total_records: number;
  freshness_status: FreshnessStatus;
  hours_since_update: number;
  last_upload_user_id?: string;
  last_upload_session_id?: string;
  last_upload_filename?: string;
  checked_at: string;
  created_at: string;
}

export interface DataFreshnessDashboard extends DataSourceRegistry {
  last_updated_at?: string;
  freshness_status?: FreshnessStatus;
  hours_since_update?: number;
  record_count?: number;
  total_records?: number;
  last_upload_filename?: string;
  freshness_percentage?: number;
}

export interface DataAvailabilityCalendar {
  id: string;
  source_key: string;
  display_name: string;
  data_date: string;
  record_count: number;
  upload_count: number;
  latest_upload_at?: string;
  latest_upload_filename?: string;
  day_of_week: number;
  week_number: number;
  month_number: number;
}

export interface CalendarDay {
  date: string;
  sources: {
    source_key: string;
    display_name: string;
    record_count: number;
    upload_count: number;
    latest_upload_filename?: string;
    color_class: string;
  }[];
  total_uploads: number;
  has_data: boolean;
}

/**
 * Get all data sources with their freshness status
 */
export async function getDataFreshnessDashboard(): Promise<{
  data: DataFreshnessDashboard[] | null;
  error: Error | null;
}> {
  try {
    // First refresh the freshness data
    await refreshDataFreshness();
    
    // Then get the dashboard view
    const { data, error } = await supabase
      .from('data_freshness_dashboard')
      .select('*')
      .order('freshness_status', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('Error fetching data freshness dashboard:', error);
    return { data: null, error };
  }
}

/**
 * Refresh freshness data for all sources
 */
export async function refreshDataFreshness(): Promise<{
  data: unknown;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('refresh_data_freshness');
    return { data, error };
  } catch (error) {
    console.error('Error refreshing data freshness:', error);
    return { data: null, error };
  }
}

/**
 * Get data availability calendar for a specific date range
 */
export async function getDataAvailabilityCalendar(
  startDate?: string,
  endDate?: string,
  sourceKey?: string
): Promise<{
  data: DataAvailabilityCalendar[] | null;
  error: Error | null;
}> {
  try {
    let query = supabase
      .from('data_availability_summary')
      .select('*');

    if (startDate) {
      query = query.gte('data_date', startDate);
    }
    if (endDate) {
      query = query.lte('data_date', endDate);
    }
    if (sourceKey) {
      query = query.eq('source_key', sourceKey);
    }

    query = query.order('data_date', { ascending: false });

    const { data, error } = await query;
    return { data, error };
  } catch (error) {
    console.error('Error fetching data availability calendar:', error);
    return { data: null, error };
  }
}

/**
 * Get calendar data formatted for calendar widget
 */
export async function getFormattedCalendarData(
  year: number,
  month: number
): Promise<{
  data: CalendarDay[] | null;
  error: Error | null;
}> {
  try {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: calendarData, error } = await getDataAvailabilityCalendar(
      startDate,
      endDate
    );

    if (error || !calendarData) {
      return { data: null, error };
    }

    // Group by date
    const dateMap = new Map<string, CalendarDay>();

    // First, get color classes for all unique sources
    const uniqueSourceKeys = [...new Set(calendarData.map(item => item.source_key))];
    const colorClassPromises = uniqueSourceKeys.map(async sourceKey => ({
      sourceKey,
      colorClass: await getSourceColorClass(sourceKey)
    }));
    const colorClassResults = await Promise.all(colorClassPromises);
    const colorClassMap = new Map(
      colorClassResults.map(({ sourceKey, colorClass }) => [sourceKey, colorClass])
    );

    calendarData.forEach(item => {
      if (!dateMap.has(item.data_date)) {
        dateMap.set(item.data_date, {
          date: item.data_date,
          sources: [],
          total_uploads: 0,
          has_data: false
        });
      }

      const day = dateMap.get(item.data_date)!;
      day.sources.push({
        source_key: item.source_key,
        display_name: item.display_name,
        record_count: item.record_count,
        upload_count: item.upload_count,
        latest_upload_filename: item.latest_upload_filename,
        color_class: colorClassMap.get(item.source_key) || 'bg-gray-500'
      });
      day.total_uploads += item.upload_count;
      day.has_data = day.has_data || item.record_count > 0;
    });

    // Convert to array and sort by date
    const formattedData = Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { data: formattedData, error: null };
  } catch (error) {
    console.error('Error formatting calendar data:', error);
    return { data: null, error };
  }
}

/**
 * Get source color class by source key
 */
async function getSourceColorClass(sourceKey: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('data_source_registry')
      .select('color_class')
      .eq('source_key', sourceKey)
      .single();

    return data?.color_class || 'bg-gray-500';
  } catch {
    return 'bg-gray-500';
  }
}

/**
 * Get freshness status for a specific source
 */
export async function getSourceFreshness(sourceKey: string): Promise<{
  data: DataFreshnessTracking | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('data_freshness_tracking')
      .select('*')
      .eq('source_key', sourceKey)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error fetching source freshness:', error);
    return { data: null, error };
  }
}

/**
 * Get recent uploads for a specific source
 */
export async function getRecentUploads(
  sourceKey: string,
  limit: number = 10
): Promise<{
  data: unknown[] | null;
  error: Error | null;
}> {
  try {
    // This would need to be customized based on how uploads are tracked
    // for each specific source. For now, we'll use csv_upload_sessions
    const { data, error } = await supabase
      .from('csv_upload_sessions')
      .select(`
        id,
        original_filename,
        upload_status,
        created_at,
        completed_at,
        file_size,
        description,
        tags
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data, error };
  } catch (error) {
    console.error('Error fetching recent uploads:', error);
    return { data: null, error };
  }
}

/**
 * Update data availability when new data is uploaded
 */
export async function updateDataAvailability(
  sourceKey: string,
  dataDate: string,
  recordCount: number,
  uploadInfo: {
    user_id?: string;
    filename?: string;
    upload_session_id?: string;
  }
): Promise<{
  data: unknown;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('data_availability_calendar')
      .upsert({
        source_key: sourceKey,
        data_date: dataDate,
        record_count: recordCount,
        upload_count: 1, // This would be incremented in a real implementation
        latest_upload_at: new Date().toISOString(),
        latest_upload_user_id: uploadInfo.user_id,
        latest_upload_filename: uploadInfo.filename,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'source_key,data_date'
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating data availability:', error);
    return { data: null, error };
  }
}

/**
 * Get data freshness summary statistics
 */
export async function getFreshnessSummary(): Promise<{
  data: {
    total_sources: number;
    fresh_sources: number;
    stale_sources: number;
    critical_sources: number;
    last_refresh: string;
  } | null;
  error: Error | null;
}> {
  try {
    const { data: dashboardData, error } = await getDataFreshnessDashboard();
    
    if (error || !dashboardData) {
      return { data: null, error };
    }

    const summary = {
      total_sources: dashboardData.length,
      fresh_sources: dashboardData.filter(s => s.freshness_status === 'fresh').length,
      stale_sources: dashboardData.filter(s => 
        s.freshness_status === 'stale' || s.freshness_status === 'very_stale'
      ).length,
      critical_sources: dashboardData.filter(s => s.freshness_status === 'critical').length,
      last_refresh: new Date().toISOString()
    };

    return { data: summary, error: null };
  } catch (error) {
    console.error('Error getting freshness summary:', error);
    return { data: null, error };
  }
}