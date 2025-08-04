import { supabase } from '../lib/supabase';
import { CaptivePaymentsSupabaseService } from './captivePaymentsSupabaseService';
import { LytxSupabaseService } from './lytxSupabaseService';
import { GuardianSupabaseService } from './guardianSupabaseService';
import { DataMigrationService } from './dataMigrationService';
import { ScheduledSyncService } from './scheduledSyncService';

export interface DataCentreAnalytics {
  overview: {
    totalDeliveries: number;
    totalVolumeML: number;
    totalSafetyEvents: number;
    totalGuardianEvents: number;
    activeVehicles: number;
    avgSafetyScore: number;
  };
  captivePayments: {
    monthlyData: Array<{
      carrier: 'SMB' | 'GSF';
      month: string;
      year: number;
      deliveries: number;
      volumeML: number;
      topCustomer: string;
    }>;
    carrierComparison: {
      smb: { deliveries: number; volumeML: number };
      gsf: { deliveries: number; volumeML: number };
    };
  };
  safetyEvents: {
    monthlyData: Array<{
      carrier: 'Stevemacs' | 'Great Southern Fuels';
      depot: string;
      month: string;
      year: number;
      totalEvents: number;
      coachableEvents: number;
      avgScore: number;
    }>;
    eventsByType: Record<string, number>;
    riskDrivers: Array<{
      driverName: string;
      eventCount: number;
      avgScore: number;
    }>;
  };
  crossAnalytics: Array<{
    fleet: 'Stevemacs' | 'Great Southern Fuels';
    depot: string;
    month: string;
    year: number;
    deliveries: number;
    volumeML: number;
    safetyEvents: number;
    eventsPerVehicle: number;
  }>;
  dataHealth: {
    lastSync: Date | null;
    syncStatus: 'healthy' | 'degraded' | 'unhealthy';
    recentImports: Array<{
      source: string;
      status: string;
      recordsProcessed: number;
      completedAt: string;
    }>;
  };
}

export class DataCentreSupabaseService {
  private captiveService: CaptivePaymentsSupabaseService;
  private lytxService: LytxSupabaseService;
  private guardianService: GuardianSupabaseService;
  private migrationService: DataMigrationService;
  private syncService: ScheduledSyncService;

  constructor() {
    this.captiveService = new CaptivePaymentsSupabaseService();
    this.lytxService = new LytxSupabaseService();
    this.guardianService = new GuardianSupabaseService();
    this.migrationService = new DataMigrationService();
    this.syncService = new ScheduledSyncService();
  }

  /**
   * Get comprehensive Data Centre analytics
   */
  async getDataCentreAnalytics(
    filters?: {
      fleet?: 'Stevemacs' | 'Great Southern Fuels';
      depot?: string;
      carrier?: 'SMB' | 'GSF';
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<DataCentreAnalytics> {
    
    // Execute all analytics queries in parallel for performance
    const [
      overview,
      captivePayments,
      safetyEvents,
      crossAnalytics,
      dataHealth
    ] = await Promise.all([
      this.getOverviewAnalytics(filters),
      this.getCaptivePaymentsAnalytics(filters),
      this.getSafetyEventsAnalytics(filters),
      this.getCrossAnalytics(filters),
      this.getDataHealthStatus()
    ]);

    return {
      overview,
      captivePayments,
      safetyEvents,
      crossAnalytics,
      dataHealth
    };
  }

  /**
   * Get overview analytics
   */
  private async getOverviewAnalytics(filters?: any): Promise<DataCentreAnalytics['overview']> {
    const { data: crossData } = await supabase
      .from('cross_analytics_summary')
      .select('*')
      .gte('year', new Date().getFullYear() - 1); // Last 2 years

    const filtered = this.applyFilters(crossData || [], filters);

    return {
      totalDeliveries: filtered.reduce((sum, row) => sum + (row.captive_deliveries || 0), 0),
      totalVolumeML: filtered.reduce((sum, row) => sum + (row.captive_volume_ml || 0), 0),
      totalSafetyEvents: filtered.reduce((sum, row) => sum + (row.safety_events || 0), 0),
      totalGuardianEvents: filtered.reduce((sum, row) => sum + (row.guardian_events || 0), 0),
      activeVehicles: Math.max(...filtered.map(row => row.active_vehicles || 0), 0),
      avgSafetyScore: this.calculateAverage(filtered.map(row => row.avg_safety_score || 0))
    };
  }

  /**
   * Get captive payments analytics
   */
  private async getCaptivePaymentsAnalytics(filters?: any): Promise<DataCentreAnalytics['captivePayments']> {
    const { data: monthlyData } = await supabase
      .from('captive_payments_analytics')
      .select('*')
      .order('year', { ascending: false })
      .order('month');

    const filtered = this.applyFilters(monthlyData || [], filters);

    // Calculate carrier comparison
    const smbData = filtered.filter(row => row.carrier === 'SMB');
    const gsfData = filtered.filter(row => row.carrier === 'GSF');

    return {
      monthlyData: filtered.map(row => ({
        carrier: row.carrier,
        month: row.month,
        year: row.year,
        deliveries: row.total_deliveries,
        volumeML: row.total_volume_megalitres,
        topCustomer: row.top_customer
      })),
      carrierComparison: {
        smb: {
          deliveries: smbData.reduce((sum, row) => sum + row.total_deliveries, 0),
          volumeML: smbData.reduce((sum, row) => sum + row.total_volume_megalitres, 0)
        },
        gsf: {
          deliveries: gsfData.reduce((sum, row) => sum + row.total_deliveries, 0),
          volumeML: gsfData.reduce((sum, row) => sum + row.total_volume_megalitres, 0)
        }
      }
    };
  }

  /**
   * Get safety events analytics
   */
  private async getSafetyEventsAnalytics(filters?: any): Promise<DataCentreAnalytics['safetyEvents']> {
    const { data: monthlyData } = await supabase
      .from('lytx_safety_analytics')
      .select('*')
      .order('year', { ascending: false })
      .order('month');

    const filtered = this.applyFilters(monthlyData || [], filters);

    // Get event types breakdown
    const { data: eventTypes } = await supabase
      .from('lytx_safety_events')
      .select('event_type, count(*)')
      .not('excluded', 'eq', true);

    // Get high-risk drivers
    const { data: riskDrivers } = await supabase
      .from('lytx_safety_events')
      .select('driver_name, score')
      .gte('score', 70)
      .not('excluded', 'eq', true)
      .order('score', { ascending: false })
      .limit(10);

    // Process risk drivers data
    const driverStats = new Map<string, { scores: number[]; count: number }>();
    
    riskDrivers?.forEach(event => {
      if (!driverStats.has(event.driver_name)) {
        driverStats.set(event.driver_name, { scores: [], count: 0 });
      }
      const stats = driverStats.get(event.driver_name)!;
      stats.scores.push(event.score);
      stats.count++;
    });

    const processedRiskDrivers = Array.from(driverStats.entries()).map(([name, stats]) => ({
      driverName: name,
      eventCount: stats.count,
      avgScore: this.calculateAverage(stats.scores)
    })).sort((a, b) => b.avgScore - a.avgScore).slice(0, 10);

    return {
      monthlyData: filtered.map(row => ({
        carrier: row.carrier,
        depot: row.depot,
        month: row.month,
        year: row.year,
        totalEvents: row.total_events,
        coachableEvents: row.coachable_events,
        avgScore: row.avg_score
      })),
      eventsByType: this.processEventTypes(eventTypes || []),
      riskDrivers: processedRiskDrivers
    };
  }

  /**
   * Get cross-analytics data
   */
  private async getCrossAnalytics(filters?: any): Promise<DataCentreAnalytics['crossAnalytics']> {
    const { data: crossData } = await supabase
      .from('cross_analytics_summary')
      .select('*')
      .order('year', { ascending: false })
      .order('month');

    const filtered = this.applyFilters(crossData || [], filters);

    return filtered.map(row => ({
      fleet: row.fleet,
      depot: row.depot,
      month: row.month,
      year: row.year,
      deliveries: row.captive_deliveries,
      volumeML: row.captive_volume_ml,
      safetyEvents: row.safety_events,
      eventsPerVehicle: row.events_per_vehicle
    }));
  }

  /**
   * Get data health status
   */
  private async getDataHealthStatus(): Promise<DataCentreAnalytics['dataHealth']> {
    const { data: recentImports } = await supabase
      .from('data_import_batches')
      .select('source_type, source_subtype, status, records_processed, completed_at')
      .order('started_at', { ascending: false })
      .limit(10);

    const syncStatus = await this.syncService.healthCheck();
    
    const lastSync = recentImports?.find(batch => batch.completed_at)?.completed_at 
      ? new Date(recentImports.find(batch => batch.completed_at)!.completed_at!)
      : null;

    return {
      lastSync,
      syncStatus: syncStatus.status,
      recentImports: (recentImports || []).map(batch => ({
        source: `${batch.source_type}${batch.source_subtype ? ` (${batch.source_subtype})` : ''}`,
        status: batch.status,
        recordsProcessed: batch.records_processed,
        completedAt: batch.completed_at || 'In Progress'
      }))
    };
  }

  /**
   * Process data for Data Centre dashboard components
   */
  async getDataForComponent(
    component: 'captive-payments' | 'lytx-safety' | 'guardian-events' | 'cross-analytics',
    filters?: {
      dateRange?: { start: Date; end: Date };
      fleet?: string;
      depot?: string;
    }
  ): Promise<any> {
    switch (component) {
      case 'captive-payments':
        return await this.captiveService.getCaptivePaymentsAnalytics(
          filters?.fleet as 'SMB' | 'GSF' | undefined,
          filters?.dateRange?.start.getFullYear()
        );

      case 'lytx-safety':
        return await this.lytxService.getLytxSafetyAnalytics(
          filters?.fleet as 'Stevemacs' | 'Great Southern Fuels' | undefined,
          filters?.depot,
          filters?.dateRange?.start.getFullYear()
        );

      case 'guardian-events':
        return await this.guardianService.getGuardianEventsAnalytics(
          filters?.fleet as 'Stevemacs' | 'Great Southern Fuels' | undefined,
          filters?.depot,
          filters?.dateRange?.start,
          filters?.dateRange?.end
        );

      case 'cross-analytics':
        const { data } = await supabase
          .from('cross_analytics_summary')
          .select('*')
          .order('year', { ascending: false });
        
        return this.applyFilters(data || [], filters);

      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  /**
   * Trigger data refresh/sync
   */
  async refreshData(
    source?: 'captive-payments' | 'lytx-events' | 'guardian-events' | 'all'
  ): Promise<{
    success: boolean;
    message: string;
    results?: any[];
  }> {
    try {
      const results: any[] = [];

      if (!source || source === 'all' || source === 'lytx-events') {
        const lytxResult = await this.syncService.triggerManualSync('lytx_events', { daysBack: 7 });
        results.push({ source: 'lytx-events', ...lytxResult });
      }

      // Add other sources as needed
      if (!source || source === 'all' || source === 'guardian-events') {
        // Guardian events refresh would go here
        results.push({ source: 'guardian-events', success: true, message: 'Guardian refresh not implemented yet' });
      }

      return {
        success: true,
        message: `Data refresh completed for ${source || 'all'} sources`,
        results
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown refresh error'
      };
    }
  }

  /**
   * Get data import/migration status
   */
  async getImportStatus(): Promise<{
    migrations: any;
    recentImports: any[];
    scheduledJobs: any;
  }> {
    const [migrations, syncStatus] = await Promise.all([
      this.migrationService.getMigrationStatus(),
      this.syncService.getSyncStatus()
    ]);

    return {
      migrations,
      recentImports: migrations.batches,
      scheduledJobs: syncStatus
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(
    format: 'csv' | 'json',
    component: 'captive-payments' | 'lytx-safety' | 'cross-analytics' | 'all'
  ): Promise<string> {
    const data = await this.getDataForComponent(component as any);
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    } else {
      return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Helper methods
   */
  private applyFilters(data: any[], filters?: any): any[] {
    if (!filters || !data) return data;

    return data.filter(row => {
      if (filters.fleet && row.fleet !== filters.fleet && row.carrier !== filters.fleet) {
        return false;
      }
      if (filters.depot && row.depot !== filters.depot) {
        return false;
      }
      if (filters.dateRange) {
        const rowDate = new Date(row.year, this.getMonthNumber(row.month) - 1);
        if (rowDate < filters.dateRange.start || rowDate > filters.dateRange.end) {
          return false;
        }
      }
      return true;
    });
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + (num || 0), 0);
    return Math.round((sum / numbers.length) * 100) / 100;
  }

  private processEventTypes(eventTypes: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    eventTypes.forEach(row => {
      result[row.event_type] = row.count;
    });
    return result;
  }

  private getMonthNumber(monthName: string): number {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthName) + 1;
  }

  private convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
}