/**
 * AgBot Webhook Orchestrator
 * Orchestrates the entire webhook processing flow
 *
 * Migrated from: api/gasbot-webhook.mjs (main handler logic, lines 368-594)
 *
 * Responsibilities:
 * - Coordinate all webhook services
 * - Process webhook payloads end-to-end
 * - Handle errors gracefully
 * - Track execution metrics
 * - Log results
 *
 * Flow:
 * 1. Validate payload (WebhookPayloadValidator)
 * 2. Normalize to array
 * 3. For each record:
 *    a. Transform & upsert location
 *    b. Transform & upsert asset
 *    c. Insert reading
 *    d. Check & create alerts
 *    e. Calculate consumption (non-blocking)
 * 4. Log execution results
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { WebhookPayloadValidator, type GasbotWebhookPayload } from './WebhookPayloadValidator.js';
import { GasbotDataTransformer } from './GasbotDataTransformer.js';
import { AlertGenerationService } from './AlertGenerationService.js';
import { WebhookSyncLogService } from './WebhookSyncLogService.js';
import { ConsumptionAnalysisService } from './ConsumptionAnalysisService.js';
import type { AgBotLocationRepository } from '../repositories/AgBotLocationRepository.js';
import type { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';
import type { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';

export interface WebhookResult {
  status: 'success' | 'partial' | 'error';
  locationsProcessed: number;
  assetsProcessed: number;
  readingsProcessed: number;
  alertsTriggered: number;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

export class AgBotWebhookOrchestrator {
  private validator: WebhookPayloadValidator;
  private transformer: GasbotDataTransformer;

  constructor(
    private db: SupabaseClient,
    private locationRepo: AgBotLocationRepository,
    private assetRepo: AgBotAssetRepository,
    private readingsRepo: ReadingsHistoryRepository,
    private alertService: AlertGenerationService,
    private consumptionService: ConsumptionAnalysisService,
    private syncLogService: WebhookSyncLogService
  ) {
    this.validator = new WebhookPayloadValidator();
    this.transformer = new GasbotDataTransformer();
  }

  /**
   * Processes webhook payload end-to-end
   */
  async processWebhook(payload: unknown): Promise<WebhookResult> {
    const startTime = Date.now();
    const result: WebhookResult = {
      status: 'success',
      locationsProcessed: 0,
      assetsProcessed: 0,
      readingsProcessed: 0,
      alertsTriggered: 0,
      errors: [],
      warnings: [],
      durationMs: 0,
    };

    console.log('\n' + '='.repeat(50));
    console.log('📥 WEBHOOK PROCESSING STARTED');
    console.log('='.repeat(50));

    try {
      // 1. Validate payload
      console.log('🔍 Validating payload...');
      const validationResult = this.validator.validatePayload(payload);

      if (!validationResult.valid) {
        result.status = 'error';
        result.errors = validationResult.errors;
        result.warnings = validationResult.warnings;
        result.durationMs = Date.now() - startTime;

        await this.syncLogService.logError(
          validationResult.errors.join('; '),
          result.durationMs,
          new Date(startTime).toISOString()
        );

        console.error('❌ Validation failed:', validationResult.errors);
        return result;
      }

      result.warnings = validationResult.warnings;
      console.log(`✅ Validation passed${validationResult.warnings.length > 0 ? ` (${validationResult.warnings.length} warnings)` : ''}`);

      // 2. Normalize to array
      const records = Array.isArray(payload) ? payload : [payload];
      console.log(`📊 Processing ${records.length} record(s)...`);

      // 3. Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i] as GasbotWebhookPayload;
        console.log(`\n   ⚙️  Processing record ${i + 1}/${records.length}...`);

        try {
          await this.processRecord(record, result);
        } catch (error) {
          const locationId = record.LocationId || record.LocationGuid || 'unknown';
          const errorMessage = `Record ${i + 1} (${locationId}): ${(error as Error).message}`;
          result.errors.push(errorMessage);
          console.error(`   ❌ ${errorMessage}`);
        }
      }

      // 4. Determine final status
      if (result.errors.length === 0) {
        result.status = 'success';
      } else if (result.assetsProcessed > 0) {
        result.status = 'partial';
      } else {
        result.status = 'error';
      }

      // 5. Log execution
      result.durationMs = Date.now() - startTime;
      await this.syncLogService.logWebhookExecution({
        status: result.status,
        locationsProcessed: result.locationsProcessed,
        assetsProcessed: result.assetsProcessed,
        readingsProcessed: result.readingsProcessed,
        alertsTriggered: result.alertsTriggered,
        errors: result.errors,
        durationMs: result.durationMs,
        startedAt: new Date(startTime).toISOString(),
      });

      // 6. Log completion
      console.log('\n🎉 WEBHOOK PROCESSING COMPLETE');
      console.log(`   ✅ Processed: ${result.assetsProcessed}/${records.length} records`);
      console.log(`   ❌ Errors: ${result.errors.length}`);
      console.log(`   ⚠️  Warnings: ${result.warnings.length}`);
      console.log(`   ⏱️  Duration: ${result.durationMs}ms`);
      console.log('='.repeat(50));

      return result;

    } catch (error) {
      result.status = 'error';
      result.errors.push(`Fatal error: ${(error as Error).message}`);
      result.durationMs = Date.now() - startTime;

      await this.syncLogService.logError(
        (error as Error).message,
        result.durationMs,
        new Date(startTime).toISOString()
      );

      console.error('\n💥 WEBHOOK PROCESSING FAILED');
      console.error('Error:', (error as Error).message);
      console.error('Stack:', (error as Error).stack);

      return result;
    }
  }

  /**
   * Processes a single webhook record
   */
  private async processRecord(record: GasbotWebhookPayload, result: WebhookResult): Promise<void> {
    // 1. Transform & upsert location
    const locationInput = this.transformer.transformLocation(record);
    const location = await this.locationRepo.upsert(locationInput);
    result.locationsProcessed++;
    console.log(`   📍 Location upserted: ${location.name} (${location.id})`);

    // 2. Get previous asset state (for alert comparison)
    const previousAsset = await this.assetRepo.findByExternalGuid(
      record.AssetGuid ||
      `asset-${(record.AssetSerialNumber || record.DeviceSerialNumber || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`
    );

    // 3. Transform & upsert asset
    const assetInput = this.transformer.transformAsset(record, location.id);
    const asset = await this.assetRepo.upsert(assetInput);
    result.assetsProcessed++;
    console.log(`   🛢️  Asset upserted: ${asset.name} (${asset.id})`);
    console.log(`       Level: ${asset.current_level_percent?.toFixed(1)}% | Battery: ${asset.battery_voltage?.toFixed(2)}V | Online: ${asset.is_online ? '✅' : '❌'}`);

    // 4. Insert reading
    const readingInput = this.transformer.transformReading(record, asset.id);
    await this.readingsRepo.create(readingInput);
    result.readingsProcessed++;
    console.log(`   📊 Reading recorded`);

    // 5. Check & create alerts
    try {
      const alertsTriggered = await this.alertService.checkAndCreateAlerts(
        asset as any,
        previousAsset as any,
        record
      );
      result.alertsTriggered += alertsTriggered;
      if (alertsTriggered > 0) {
        console.log(`   🚨 ${alertsTriggered} alert(s) triggered`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Alert generation failed: ${(error as Error).message}`);
      result.warnings.push(`Alert generation failed for ${asset.name}: ${(error as Error).message}`);
    }

    // 6. Calculate consumption (non-blocking, errors logged but don't fail the webhook)
    try {
      if (asset.current_level_percent !== null && asset.capacity_liters) {
        await this.consumptionService.calculateConsumption(
          asset.id,
          asset.current_level_percent,
          asset.capacity_liters
        );
        console.log(`   📈 Consumption calculated`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Consumption calculation failed: ${(error as Error).message}`);
      result.warnings.push(`Consumption calculation failed for ${asset.name}: ${(error as Error).message}`);
    }

    console.log(`   ✅ Record processed successfully`);
  }

  /**
   * Validates webhook authentication
   * Returns true if authorized
   */
  static isAuthorized(authHeader: string | undefined, secret: string): boolean {
    if (!authHeader) return false;

    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === secret;
  }

  /**
   * Gets orchestrator statistics
   */
  async getStatistics(startDate: Date, endDate: Date) {
    return this.syncLogService.getStatistics(startDate, endDate);
  }

  /**
   * Gets recent webhook executions
   */
  async getRecentExecutions(limit: number = 10) {
    return this.syncLogService.getRecentLogs(limit);
  }
}
