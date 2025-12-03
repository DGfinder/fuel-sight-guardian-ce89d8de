/**
 * Webhook Sync Log Service
 * Logs webhook execution results to ta_agbot_sync_log table
 *
 * Migrated from: api/gasbot-webhook.mjs (lines 560-574, 602-616)
 *
 * Responsibilities:
 * - Log webhook execution start/end times
 * - Track processed counts (locations, assets, readings, alerts)
 * - Record errors and status
 * - Calculate execution duration
 *
 * Sync Types:
 * - gasbot_webhook: Webhook POST from Gasbot
 * - manual_sync: Manual sync triggered by user (future)
 * - scheduled_sync: Cron job sync (future)
 *
 * Status Values:
 * - success: All records processed successfully
 * - partial: Some records failed, some succeeded
 * - error: Complete failure, no records processed
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WebhookExecutionResult {
  status: 'success' | 'partial' | 'error';
  locationsProcessed: number;
  assetsProcessed: number;
  readingsProcessed: number;
  alertsTriggered: number;
  errors: string[];
  durationMs: number;
  startedAt: string;
}

export interface SyncLogEntry {
  sync_type: string;
  status: 'success' | 'partial' | 'error';
  locations_processed: number;
  assets_processed: number;
  readings_processed: number;
  alerts_triggered: number;
  error_message?: string | null;
  duration_ms: number;
  started_at: string;
  completed_at: string;
}

export class WebhookSyncLogService {
  constructor(private db: SupabaseClient) {}

  /**
   * Logs webhook execution result to ta_agbot_sync_log
   */
  async logWebhookExecution(result: WebhookExecutionResult): Promise<void> {
    try {
      const entry: SyncLogEntry = {
        sync_type: 'gasbot_webhook',
        status: result.status,
        locations_processed: result.locationsProcessed,
        assets_processed: result.assetsProcessed,
        readings_processed: result.readingsProcessed,
        alerts_triggered: result.alertsTriggered,
        error_message: result.errors.length > 0 ? result.errors.slice(0, 3).join('; ') : null,
        duration_ms: result.durationMs,
        started_at: result.startedAt,
        completed_at: new Date().toISOString()
      };

      const { error } = await this.db
        .from('ta_agbot_sync_log')
        .insert(entry);

      if (error) {
        console.error('[WebhookSyncLogService] Failed to log execution:', error);
      } else {
        console.log(`   📝 Logged webhook execution: ${result.status} (${result.durationMs}ms)`);
      }
    } catch (error) {
      console.error('[WebhookSyncLogService] Unexpected error logging execution:', error);
    }
  }

  /**
   * Logs successful webhook execution
   */
  async logSuccess(
    stats: {
      locationsProcessed: number;
      assetsProcessed: number;
      readingsProcessed: number;
      alertsTriggered: number;
    },
    durationMs: number,
    startedAt: string
  ): Promise<void> {
    const result: WebhookExecutionResult = {
      status: 'success',
      ...stats,
      errors: [],
      durationMs,
      startedAt,
    };

    await this.logWebhookExecution(result);
  }

  /**
   * Logs partial webhook execution (some records failed)
   */
  async logPartial(
    stats: {
      locationsProcessed: number;
      assetsProcessed: number;
      readingsProcessed: number;
      alertsTriggered: number;
    },
    errors: string[],
    durationMs: number,
    startedAt: string
  ): Promise<void> {
    const result: WebhookExecutionResult = {
      status: 'partial',
      ...stats,
      errors,
      durationMs,
      startedAt,
    };

    await this.logWebhookExecution(result);
  }

  /**
   * Logs failed webhook execution
   */
  async logError(
    errorMessage: string,
    durationMs: number,
    startedAt: string
  ): Promise<void> {
    const result: WebhookExecutionResult = {
      status: 'error',
      locationsProcessed: 0,
      assetsProcessed: 0,
      readingsProcessed: 0,
      alertsTriggered: 0,
      errors: [errorMessage],
      durationMs,
      startedAt,
    };

    await this.logWebhookExecution(result);
  }

  /**
   * Gets recent sync log entries
   */
  async getRecentLogs(limit: number = 10): Promise<SyncLogEntry[]> {
    try {
      const { data, error } = await this.db
        .from('ta_agbot_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[WebhookSyncLogService] Error fetching logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[WebhookSyncLogService] Unexpected error fetching logs:', error);
      return [];
    }
  }

  /**
   * Gets sync statistics for a time period
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    partialExecutions: number;
    failedExecutions: number;
    totalLocationsProcessed: number;
    totalAssetsProcessed: number;
    totalReadingsProcessed: number;
    totalAlertsTriggered: number;
    averageDurationMs: number;
  }> {
    try {
      const { data, error } = await this.db
        .from('ta_agbot_sync_log')
        .select('*')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());

      if (error) {
        console.error('[WebhookSyncLogService] Error fetching statistics:', error);
        return this.emptyStatistics();
      }

      if (!data || data.length === 0) {
        return this.emptyStatistics();
      }

      const stats = data.reduce(
        (acc, entry) => {
          acc.totalExecutions++;
          if (entry.status === 'success') acc.successfulExecutions++;
          if (entry.status === 'partial') acc.partialExecutions++;
          if (entry.status === 'error') acc.failedExecutions++;
          acc.totalLocationsProcessed += entry.locations_processed || 0;
          acc.totalAssetsProcessed += entry.assets_processed || 0;
          acc.totalReadingsProcessed += entry.readings_processed || 0;
          acc.totalAlertsTriggered += entry.alerts_triggered || 0;
          acc.totalDurationMs += entry.duration_ms || 0;
          return acc;
        },
        {
          totalExecutions: 0,
          successfulExecutions: 0,
          partialExecutions: 0,
          failedExecutions: 0,
          totalLocationsProcessed: 0,
          totalAssetsProcessed: 0,
          totalReadingsProcessed: 0,
          totalAlertsTriggered: 0,
          totalDurationMs: 0,
        }
      );

      return {
        ...stats,
        averageDurationMs: stats.totalExecutions > 0 ? stats.totalDurationMs / stats.totalExecutions : 0,
      };
    } catch (error) {
      console.error('[WebhookSyncLogService] Unexpected error fetching statistics:', error);
      return this.emptyStatistics();
    }
  }

  /**
   * Returns empty statistics object
   */
  private emptyStatistics() {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      partialExecutions: 0,
      failedExecutions: 0,
      totalLocationsProcessed: 0,
      totalAssetsProcessed: 0,
      totalReadingsProcessed: 0,
      totalAlertsTriggered: 0,
      averageDurationMs: 0,
    };
  }

  /**
   * Deletes old sync logs (for maintenance)
   */
  async deleteOldLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error, count } = await this.db
        .from('ta_agbot_sync_log')
        .delete()
        .lt('started_at', cutoffDate.toISOString());

      if (error) {
        console.error('[WebhookSyncLogService] Error deleting old logs:', error);
        return 0;
      }

      console.log(`   🗑️  Deleted ${count || 0} logs older than ${olderThanDays} days`);
      return count || 0;
    } catch (error) {
      console.error('[WebhookSyncLogService] Unexpected error deleting logs:', error);
      return 0;
    }
  }
}
