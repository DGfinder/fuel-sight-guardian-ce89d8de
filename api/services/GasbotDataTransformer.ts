/**
 * Gasbot Data Transformer
 * Transforms Gasbot webhook payloads to repository input formats
 *
 * Migrated from: api/gasbot-webhook.mjs (lines 115-286)
 *
 * Responsibilities:
 * - Transform Gasbot JSON to LocationCreateInput
 * - Transform Gasbot JSON to AssetCreateInput
 * - Transform Gasbot JSON to ReadingCreateInput
 * - Handle field mapping and type conversions
 * - Calculate derived fields (percentages, etc.)
 *
 * NOTE: Gasbot field names use Pascal case (LocationId, AssetGuid, etc.)
 * Database fields use snake_case (external_guid, customer_name, etc.)
 */

import { TimestampNormalizer } from '../lib/timestamp-normalizer.js';
import type { LocationCreateInput } from '../repositories/AgBotLocationRepository.js';
import type { AssetCreateInput } from '../repositories/AgBotAssetRepository.js';
import type { ReadingCreateInput } from '../repositories/ReadingsHistoryRepository.js';
import type { GasbotWebhookPayload } from './WebhookPayloadValidator.js';

export class GasbotDataTransformer {
  /**
   * Transforms Gasbot webhook payload to LocationCreateInput for repository
   */
  transformLocation(gasbotData: GasbotWebhookPayload): LocationCreateInput {
    // Use external LocationGuid if available, otherwise generate from location name
    const externalGuid = gasbotData.LocationGuid ||
      `location-${(gasbotData.LocationId || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

    // Parse address into components if available
    const addressParts = (gasbotData.LocationAddress || '').split(',').map(part => part.trim());

    return {
      external_guid: externalGuid,
      name: gasbotData.LocationId || 'Unknown Location',
      customer_name: gasbotData.TenancyName || 'Unknown Customer',
      customer_guid: gasbotData.CustomerGuid || `customer-${gasbotData.TenancyName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
      tenancy_name: gasbotData.TenancyName,

      // Address fields
      address: gasbotData.LocationAddress || addressParts[0] || '',
      state: addressParts.length >= 3 ? addressParts[2] : (gasbotData.LocationState || ''),
      postcode: addressParts.length >= 4 ? addressParts[3] : (gasbotData.LocationPostcode || ''),
      country: gasbotData.LocationCountry || 'Australia',
      latitude: this.parseFloat(gasbotData.LocationLat),
      longitude: this.parseFloat(gasbotData.LocationLng),

      // Status
      installation_status: gasbotData.LocationInstallationStatus || (gasbotData.DeviceOnline ? 1 : 0),
      installation_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
      is_disabled: gasbotData.LocationDisabledStatus || false,

      // Aggregated consumption (from webhook)
      daily_consumption_liters: this.parseFloat(gasbotData.LocationDailyConsumption),
      days_remaining: this.parseInt(gasbotData.LocationDaysRemaining),
      calibrated_fill_level: this.parseFloat(gasbotData.LocationCalibratedFillLevel),

      // Timestamps
      last_telemetry_at: TimestampNormalizer.validateAndNormalize(
        gasbotData.LocationLastCalibratedTelemetryTimestamp || gasbotData.AssetLastCalibratedTelemetryTimestamp,
        'last_telemetry_at'
      ),
      last_telemetry_epoch: TimestampNormalizer.convertEpochToBigInt(gasbotData.LocationLastCalibratedTelemetryEpoch) ||
        (gasbotData.LocationLastCalibratedTelemetryTimestamp ?
          Math.floor(new Date(TimestampNormalizer.validateAndNormalize(gasbotData.LocationLastCalibratedTelemetryTimestamp, 'last_telemetry_epoch')).getTime()) : Date.now())
    };
  }

  /**
   * Transforms Gasbot webhook payload to AssetCreateInput for repository
   */
  transformAsset(gasbotData: GasbotWebhookPayload, locationId: string): AssetCreateInput {
    // Use external AssetGuid if available, otherwise generate from serial
    const externalGuid = gasbotData.AssetGuid ||
      `asset-${(gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

    // Calculate percentage from liters if AssetCalibratedFillLevel is missing
    const reportedLiters = this.parseFloat(gasbotData.AssetReportedLitres);
    const capacity = this.parseFloat(gasbotData.AssetProfileWaterCapacity);
    const calibratedPercent = this.parseFloat(gasbotData.AssetCalibratedFillLevel);

    // Use calibrated percentage if available, otherwise calculate from liters/capacity
    let levelPercent = calibratedPercent;
    if (!levelPercent && levelPercent !== 0 && reportedLiters && capacity && capacity > 0) {
      levelPercent = (reportedLiters / capacity) * 100;
    }

    return {
      location_id: locationId,
      external_guid: externalGuid,

      // Tank Identity
      name: gasbotData.AssetSerialNumber || gasbotData.AssetProfileName || 'Unknown Asset',
      serial_number: gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber,
      profile_name: gasbotData.AssetProfileName || 'Gasbot Tank',
      profile_guid: gasbotData.AssetProfileGuid || 'profile-gasbot-tank',
      commodity: gasbotData.AssetProfileCommodity,

      // Tank Dimensions
      capacity_liters: capacity,
      max_depth_m: this.parseFloat(gasbotData.AssetProfileMaxDepth),
      max_pressure_bar: this.parseFloat(gasbotData.AssetProfileMaxPressureBar),
      max_display_percent: this.parseFloat(gasbotData.AssetProfileMaxDisplayPercentageFill),

      // Current Tank Level
      current_level_liters: reportedLiters,
      current_level_percent: levelPercent || 0,
      current_raw_percent: this.parseFloat(gasbotData.AssetRawFillLevel || gasbotData.AssetCalibratedFillLevel) || levelPercent || 0,
      current_depth_m: this.parseFloat(gasbotData.AssetDepth),
      current_pressure_bar: this.parseFloat(gasbotData.AssetPressureBar),
      ullage_liters: this.parseFloat(gasbotData.AssetRefillCapacityLitres),

      // Consumption Analytics (from Gasbot)
      daily_consumption_liters: this.parseFloat(gasbotData.AssetDailyConsumption),
      days_remaining: this.parseInt(gasbotData.AssetDaysRemaining),

      // Device Hardware
      device_guid: gasbotData.DeviceGuid || `device-${gasbotData.DeviceSerialNumber}`,
      device_serial: gasbotData.DeviceSerialNumber,
      device_model: gasbotData.DeviceModel || 43111,
      device_model_name: gasbotData.DeviceModelLabel || 'Gasbot Cellular Tank Monitor',
      device_sku: gasbotData.DeviceSKU,
      device_network_id: gasbotData.DeviceNetworkId,
      helmet_serial: gasbotData.HelmetSerialNumber,

      // Device Health
      is_online: gasbotData.DeviceOnline || false,
      is_disabled: gasbotData.AssetDisabledStatus || false,
      device_state: gasbotData.DeviceState,
      battery_voltage: this.parseFloat(gasbotData.DeviceBatteryVoltage),
      temperature_c: this.parseFloat(gasbotData.DeviceTemperature),

      // Timestamps
      device_activated_at: gasbotData.DeviceActivationTimestamp ?
        TimestampNormalizer.validateAndNormalize(gasbotData.DeviceActivationTimestamp, 'device_activated_at') : null,
      device_activation_epoch: TimestampNormalizer.convertEpochToBigInt(gasbotData.DeviceActivationEpoch),
      last_telemetry_at: TimestampNormalizer.validateAndNormalize(
        gasbotData.AssetLastCalibratedTelemetryTimestamp,
        'last_telemetry_at'
      ),
      last_telemetry_epoch: TimestampNormalizer.convertEpochToBigInt(gasbotData.AssetLastCalibratedTelemetryEpoch) ||
        (gasbotData.AssetLastCalibratedTelemetryTimestamp ?
          Math.floor(new Date(TimestampNormalizer.validateAndNormalize(gasbotData.AssetLastCalibratedTelemetryTimestamp, 'last_telemetry_epoch')).getTime()) : Date.now()),
      last_raw_telemetry_at: gasbotData.AssetLastRawTelemetryTimestamp ?
        TimestampNormalizer.validateAndNormalize(gasbotData.AssetLastRawTelemetryTimestamp, 'last_raw_telemetry_at') : null,
      last_calibrated_telemetry_at: gasbotData.AssetLastCalibratedTelemetryTimestamp ?
        TimestampNormalizer.validateAndNormalize(gasbotData.AssetLastCalibratedTelemetryTimestamp, 'last_calibrated_telemetry_at') : null,
      asset_updated_at: gasbotData.AssetUpdatedTimestamp ?
        TimestampNormalizer.validateAndNormalize(gasbotData.AssetUpdatedTimestamp, 'asset_updated_at') : null,
      asset_updated_epoch: TimestampNormalizer.convertEpochToBigInt(gasbotData.AssetUpdatedEpoch),

      raw_data: gasbotData as any
    };
  }

  /**
   * Transforms Gasbot webhook payload to ReadingCreateInput for repository
   */
  transformReading(gasbotData: GasbotWebhookPayload, assetId: string): ReadingCreateInput {
    // Calculate percentage from liters if AssetCalibratedFillLevel is missing
    const reportedLiters = this.parseFloat(gasbotData.AssetReportedLitres);
    const capacity = this.parseFloat(gasbotData.AssetProfileWaterCapacity);
    const calibratedPercent = this.parseFloat(gasbotData.AssetCalibratedFillLevel);

    // Use calibrated percentage if available, otherwise calculate from liters/capacity
    let levelPercent = calibratedPercent;
    if (!levelPercent && levelPercent !== 0 && reportedLiters && capacity && capacity > 0) {
      levelPercent = (reportedLiters / capacity) * 100;
      console.log(`   📊 Calculated level_percent from liters: ${levelPercent.toFixed(2)}% (${reportedLiters}L / ${capacity}L)`);
    }

    return {
      asset_id: assetId,

      // Tank level readings
      level_liters: reportedLiters,
      level_percent: levelPercent || 0,
      raw_percent: this.parseFloat(gasbotData.AssetRawFillLevel || gasbotData.AssetCalibratedFillLevel) || levelPercent || 0,
      depth_m: this.parseFloat(gasbotData.AssetDepth),
      pressure_bar: this.parseFloat(gasbotData.AssetPressureBar),

      // Device state snapshot
      is_online: gasbotData.DeviceOnline || false,
      battery_voltage: this.parseFloat(gasbotData.DeviceBatteryVoltage),
      temperature_c: this.parseFloat(gasbotData.DeviceTemperature),
      device_state: gasbotData.DeviceState,

      // Pre-calculated analytics
      daily_consumption: this.parseFloat(gasbotData.AssetDailyConsumption || gasbotData.LocationDailyConsumption),
      days_remaining: this.parseInt(gasbotData.AssetDaysRemaining || gasbotData.LocationDaysRemaining),

      // Timestamps
      reading_at: TimestampNormalizer.validateAndNormalize(
        gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
        'reading_at'
      ),
      telemetry_epoch: TimestampNormalizer.convertEpochToBigInt(gasbotData.AssetLastCalibratedTelemetryEpoch) ||
        (gasbotData.AssetLastCalibratedTelemetryTimestamp ?
          Math.floor(new Date(gasbotData.AssetLastCalibratedTelemetryTimestamp as any).getTime()) : Date.now())
    };
  }

  /**
   * Safely parses float value, returns null if invalid
   */
  private parseFloat(value: any): number | null {
    if (value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Safely parses integer value, returns null if invalid
   */
  private parseInt(value: any): number | null {
    if (value === null || value === undefined) return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
}
