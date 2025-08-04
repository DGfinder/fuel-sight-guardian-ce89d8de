import { LytxSupabaseService } from './lytxSupabaseService';
import { supabase } from '../lib/supabase';

interface SyncJob {
  id: string;
  type: 'lytx_events' | 'guardian_events' | 'captive_payments';
  schedule: string; // cron-like schedule
  lastRun?: Date;
  nextRun: Date;
  status: 'active' | 'paused' | 'error';
  enabled: boolean;
}

interface SyncResult {
  jobId: string;
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export class ScheduledSyncService {
  private lytxService: LytxSupabaseService;
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.lytxService = new LytxSupabaseService();
  }

  /**
   * Initialize scheduled sync jobs
   * This would typically be called on application startup
   */
  async initializeScheduledJobs(): Promise<void> {
    const jobs: SyncJob[] = [
      {
        id: 'lytx_events_sync',
        type: 'lytx_events',
        schedule: '*/15 * * * *', // Every 15 minutes
        nextRun: new Date(Date.now() + 15 * 60 * 1000),
        status: 'active',
        enabled: true
      },
      {
        id: 'lytx_events_daily',
        type: 'lytx_events',
        schedule: '0 2 * * *', // Daily at 2 AM
        nextRun: this.getNextDailyRun(2, 0),
        status: 'active',
        enabled: true
      }
    ];

    for (const job of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }

    console.log(`Initialized ${jobs.length} scheduled sync jobs`);
  }

  /**
   * Schedule a sync job
   */
  private scheduleJob(job: SyncJob): void {
    // Clear existing job if it exists
    if (this.activeJobs.has(job.id)) {
      clearTimeout(this.activeJobs.get(job.id)!);
    }

    const timeUntilRun = job.nextRun.getTime() - Date.now();
    
    if (timeUntilRun <= 0) {
      // Job is overdue, run immediately
      this.executeJob(job);
    } else {
      // Schedule job for future execution
      const timeout = setTimeout(() => {
        this.executeJob(job);
      }, timeUntilRun);

      this.activeJobs.set(job.id, timeout);
    }

    console.log(`Scheduled job ${job.id} to run at ${job.nextRun.toISOString()}`);
  }

  /**
   * Execute a sync job
   */
  private async executeJob(job: SyncJob): Promise<void> {
    const startTime = Date.now();
    console.log(`Executing job ${job.id} at ${new Date().toISOString()}`);

    const result: SyncResult = {
      jobId: job.id,
      success: false,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      switch (job.type) {
        case 'lytx_events':
          const lytxResult = await this.syncLytxEvents(job);
          result.recordsProcessed = lytxResult.eventsProcessed;
          result.recordsFailed = lytxResult.eventsFailed;
          result.errors = lytxResult.errors;
          result.success = lytxResult.eventsFailed === 0;
          break;

        default:
          result.errors.push(`Unknown job type: ${job.type}`);
          break;
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Job ${job.id} failed:`, error);
    }

    result.duration = Date.now() - startTime;

    // Log result to database for monitoring
    await this.logJobResult(result);

    // Update job status and schedule next run
    job.lastRun = new Date();
    job.nextRun = this.calculateNextRun(job);
    job.status = result.success ? 'active' : 'error';

    // Schedule next run
    this.scheduleJob(job);

    console.log(`Job ${job.id} completed in ${result.duration}ms. Next run: ${job.nextRun.toISOString()}`);
  }

  /**
   * Sync LYTX events
   */
  private async syncLytxEvents(job: SyncJob): Promise<{
    eventsProcessed: number;
    eventsFailed: number;
    errors: string[];
  }> {
    // Determine how far back to sync based on job schedule
    const daysBack = job.schedule.includes('*/15') ? 1 : 7; // 15-minute jobs sync last day, daily jobs sync last week
    
    const result = await this.lytxService.syncEventsFromApi(daysBack);
    
    return {
      eventsProcessed: result.eventsProcessed,
      eventsFailed: result.eventsFailed,
      errors: result.errors
    };
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(job: SyncJob): Date {
    const now = new Date();
    
    if (job.schedule === '*/15 * * * *') {
      // Every 15 minutes
      return new Date(now.getTime() + 15 * 60 * 1000);
    } else if (job.schedule === '0 2 * * *') {
      // Daily at 2 AM
      return this.getNextDailyRun(2, 0);
    }
    
    // Default: run again in 1 hour
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Get next daily run time
   */
  private getNextDailyRun(hour: number, minute: number): Date {
    const now = new Date();
    const nextRun = new Date(now);
    
    nextRun.setHours(hour, minute, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun;
  }

  /**
   * Log job result to database
   */
  private async logJobResult(result: SyncResult): Promise<void> {
    try {
      await supabase
        .from('data_import_batches')
        .insert({
          source_type: 'lytx_events',
          source_subtype: 'Scheduled Sync',
          batch_reference: `scheduled_${result.jobId}_${Date.now()}`,
          records_processed: result.recordsProcessed,
          records_failed: result.recordsFailed,
          status: result.success ? 'completed' : 'failed',
          error_summary: result.errors.length > 0 ? { errors: result.errors } : null,
          processing_metadata: {
            job_id: result.jobId,
            duration_ms: result.duration,
            scheduled_run: true
          },
          started_at: new Date(result.timestamp.getTime() - result.duration).toISOString(),
          completed_at: result.timestamp.toISOString()
        });
    } catch (error) {
      console.error('Failed to log job result:', error);
    }
  }

  /**
   * Manual sync trigger (for immediate sync requests)
   */
  async triggerManualSync(
    type: 'lytx_events' | 'guardian_events' | 'captive_payments',
    options?: {
      daysBack?: number;
      carrier?: string;
    }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    
    const result: SyncResult = {
      jobId: `manual_${type}_${Date.now()}`,
      success: false,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      switch (type) {
        case 'lytx_events':
          const lytxResult = await this.lytxService.syncEventsFromApi(options?.daysBack || 7);
          result.recordsProcessed = lytxResult.eventsProcessed;
          result.recordsFailed = lytxResult.eventsFailed;
          result.errors = lytxResult.errors;
          result.success = lytxResult.eventsFailed === 0;
          break;

        default:
          result.errors.push(`Manual sync not implemented for type: ${type}`);
          break;
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    result.duration = Date.now() - startTime;
    await this.logJobResult(result);

    return result;
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<{
    activeJobs: number;
    lastSyncResults: Array<{
      source_type: string;
      status: string;
      records_processed: number;
      records_failed: number;
      started_at: string;
      completed_at: string | null;
    }>;
    upcomingJobs: Array<{
      jobId: string;
      type: string;
      nextRun: Date;
      status: string;
    }>;
  }> {
    // Get recent sync results
    const { data: recentBatches } = await supabase
      .from('data_import_batches')
      .select('source_type, status, records_processed, records_failed, started_at, completed_at')
      .or('source_subtype.eq.Scheduled Sync,source_subtype.eq.API')
      .order('started_at', { ascending: false })
      .limit(10);

    // Mock upcoming jobs (in a real implementation, you'd track these)
    const upcomingJobs = [
      {
        jobId: 'lytx_events_sync',
        type: 'lytx_events',
        nextRun: new Date(Date.now() + 15 * 60 * 1000),
        status: 'active'
      },
      {
        jobId: 'lytx_events_daily',
        type: 'lytx_events',
        nextRun: this.getNextDailyRun(2, 0),
        status: 'active'
      }
    ];

    return {
      activeJobs: this.activeJobs.size,
      lastSyncResults: recentBatches || [],
      upcomingJobs
    };
  }

  /**
   * Pause/resume scheduled jobs
   */
  pauseJob(jobId: string): boolean {
    if (this.activeJobs.has(jobId)) {
      clearTimeout(this.activeJobs.get(jobId)!);
      this.activeJobs.delete(jobId);
      console.log(`Paused job ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Stop all scheduled jobs (for graceful shutdown)
   */
  stopAllJobs(): void {
    for (const [jobId, timeout] of this.activeJobs.entries()) {
      clearTimeout(timeout);
      console.log(`Stopped job ${jobId}`);
    }
    this.activeJobs.clear();
  }

  /**
   * Health check for sync service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      activeJobs: number;
      lastSuccessfulSync?: Date;
      failedJobsLast24h: number;
      systemErrors: string[];
    };
  }> {
    const details = {
      activeJobs: this.activeJobs.size,
      lastSuccessfulSync: undefined as Date | undefined,
      failedJobsLast24h: 0,
      systemErrors: [] as string[]
    };

    try {
      // Check for recent successful syncs
      const { data: successfulBatches } = await supabase
        .from('data_import_batches')
        .select('completed_at')
        .eq('status', 'completed')
        .or('source_subtype.eq.Scheduled Sync,source_subtype.eq.API')
        .order('completed_at', { ascending: false })
        .limit(1);

      if (successfulBatches?.[0]?.completed_at) {
        details.lastSuccessfulSync = new Date(successfulBatches[0].completed_at);
      }

      // Count failed jobs in last 24 hours
      const { data: failedBatches } = await supabase
        .from('data_import_batches')
        .select('id')
        .eq('status', 'failed')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      details.failedJobsLast24h = failedBatches?.length || 0;

    } catch (error) {
      details.systemErrors.push(error instanceof Error ? error.message : 'Database health check failed');
    }

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (details.systemErrors.length > 0) {
      status = 'unhealthy';
    } else if (details.failedJobsLast24h > 5 || details.activeJobs === 0) {
      status = 'degraded';
    } else if (details.lastSuccessfulSync && 
               Date.now() - details.lastSuccessfulSync.getTime() > 60 * 60 * 1000) {
      // No successful sync in last hour
      status = 'degraded';
    }

    return { status, details };
  }
}