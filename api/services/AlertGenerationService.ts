/**
 * Alert Generation Service
 * Checks thresholds and creates alerts for AgBot assets
 *
 * Migrated from: api/gasbot-webhook.mjs (lines 289-365)
 *
 * Responsibilities:
 * - Check battery voltage thresholds
 * - Check fuel level thresholds
 * - Detect device online/offline transitions
 * - Deduplicate alerts (one active alert per type per asset)
 * - Insert alerts to database
 *
 * Alert Types:
 * - low_battery: <3.3V warning, <3.2V critical
 * - low_fuel: ≤7 days remaining OR ≤15% fill
 * - device_offline: Online → offline transition
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AlertThresholds {
  batteryWarning: number;      // 3.3V
  batteryCritical: number;      // 3.2V
  fuelDaysWarning: number;      // 7 days
  fuelDaysCritical: number;     // 3 days
  fuelPercentWarning: number;   // 15%
  fuelPercentCritical: number;  // 10%
}

export interface Alert {
  asset_id: string;
  alert_type: 'low_battery' | 'low_fuel' | 'device_offline';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  current_value: number;
  threshold_value: number;
  previous_value: number | null;
}

export interface AgBotAsset {
  id: string;
  serial_number?: string;
  device_serial?: string;
  battery_voltage?: number | null;
  current_level_percent?: number | null;
  days_remaining?: number | null;
  is_online: boolean;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  batteryWarning: 3.3,
  batteryCritical: 3.2,
  fuelDaysWarning: 7,
  fuelDaysCritical: 3,
  fuelPercentWarning: 15,
  fuelPercentCritical: 10,
};

export class AlertGenerationService {
  constructor(
    private db: SupabaseClient,
    private config: AlertThresholds = DEFAULT_THRESHOLDS
  ) {}

  /**
   * Checks asset thresholds and creates alerts if needed
   * Returns number of alerts triggered
   */
  async checkAndCreateAlerts(
    asset: AgBotAsset,
    previousAsset: AgBotAsset | null,
    webhookData?: any
  ): Promise<number> {
    const alerts: Alert[] = [];

    // Check low battery
    if (asset.battery_voltage !== null && asset.battery_voltage !== undefined) {
      const batteryAlert = this.checkBatteryVoltage(asset, previousAsset);
      if (batteryAlert) alerts.push(batteryAlert);
    }

    // Check low fuel (days remaining OR percentage)
    if (asset.days_remaining !== null && asset.days_remaining !== undefined) {
      const fuelAlert = this.checkFuelDaysRemaining(asset, previousAsset);
      if (fuelAlert) alerts.push(fuelAlert);
    } else if (asset.current_level_percent !== null && asset.current_level_percent !== undefined) {
      const fuelAlert = this.checkFuelPercentage(asset, previousAsset);
      if (fuelAlert) alerts.push(fuelAlert);
    }

    // Check device offline transition
    if (previousAsset) {
      const offlineAlert = this.checkDeviceOffline(asset, previousAsset, webhookData);
      if (offlineAlert) alerts.push(offlineAlert);
    }

    // Insert alerts (with deduplication)
    for (const alert of alerts) {
      await this.insertAlertIfNotExists(alert);
    }

    return alerts.length;
  }

  /**
   * Checks battery voltage threshold
   * Returns alert if voltage is below warning threshold
   */
  private checkBatteryVoltage(asset: AgBotAsset, previousAsset: AgBotAsset | null): Alert | null {
    const voltage = asset.battery_voltage!;

    if (voltage < this.config.batteryWarning) {
      return {
        asset_id: asset.id,
        alert_type: 'low_battery',
        severity: voltage < this.config.batteryCritical ? 'critical' : 'warning',
        title: `Low Battery: ${voltage.toFixed(2)}V`,
        message: `Device battery is ${voltage < this.config.batteryCritical ? 'critically' : ''} low at ${voltage.toFixed(2)}V`,
        current_value: voltage,
        threshold_value: this.config.batteryWarning,
        previous_value: previousAsset?.battery_voltage || null
      };
    }

    return null;
  }

  /**
   * Checks fuel days remaining threshold
   * Returns alert if days remaining is at or below warning threshold
   */
  private checkFuelDaysRemaining(asset: AgBotAsset, previousAsset: AgBotAsset | null): Alert | null {
    const daysRemaining = asset.days_remaining!;

    if (daysRemaining <= this.config.fuelDaysWarning) {
      return {
        asset_id: asset.id,
        alert_type: 'low_fuel',
        severity: daysRemaining <= this.config.fuelDaysCritical ? 'critical' : 'warning',
        title: `Low Fuel: ${daysRemaining} days remaining`,
        message: `Tank has approximately ${daysRemaining} days of fuel remaining`,
        current_value: daysRemaining,
        threshold_value: this.config.fuelDaysWarning,
        previous_value: previousAsset?.days_remaining || null
      };
    }

    return null;
  }

  /**
   * Checks fuel percentage threshold
   * Returns alert if fill level is at or below warning threshold
   */
  private checkFuelPercentage(asset: AgBotAsset, previousAsset: AgBotAsset | null): Alert | null {
    const fillPercent = asset.current_level_percent!;

    if (fillPercent <= this.config.fuelPercentWarning) {
      return {
        asset_id: asset.id,
        alert_type: 'low_fuel',
        severity: fillPercent <= this.config.fuelPercentCritical ? 'critical' : 'warning',
        title: `Low Fill Level: ${fillPercent.toFixed(1)}%`,
        message: `Tank is at ${fillPercent.toFixed(1)}% fill level`,
        current_value: fillPercent,
        threshold_value: this.config.fuelPercentWarning,
        previous_value: previousAsset?.current_level_percent || null
      };
    }

    return null;
  }

  /**
   * Checks for device online -> offline transition
   * Returns alert if device just went offline
   */
  private checkDeviceOffline(asset: AgBotAsset, previousAsset: AgBotAsset, webhookData?: any): Alert | null {
    if (previousAsset.is_online === true && asset.is_online === false) {
      const deviceSerial = asset.device_serial || asset.serial_number || webhookData?.DeviceSerialNumber || 'Unknown';

      return {
        asset_id: asset.id,
        alert_type: 'device_offline',
        severity: 'warning',
        title: 'Device Offline',
        message: `Device ${deviceSerial} has gone offline`,
        current_value: 0,
        threshold_value: 1,
        previous_value: 1
      };
    }

    return null;
  }

  /**
   * Inserts alert if no active alert of same type exists for this asset
   * Deduplicates alerts to avoid spam
   */
  private async insertAlertIfNotExists(alert: Alert): Promise<boolean> {
    try {
      // Check if there's already an active alert of this type for this asset
      const { data: existingAlert, error: queryError } = await this.db
        .from('ta_agbot_alerts')
        .select('id')
        .eq('asset_id', alert.asset_id)
        .eq('alert_type', alert.alert_type)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) {
        console.error('[AlertGenerationService] Error checking existing alert:', queryError);
        return false;
      }

      if (existingAlert) {
        console.log(`   ⏭️  Skipping duplicate ${alert.alert_type} alert for asset ${alert.asset_id}`);
        return false;
      }

      // Insert new alert
      const { error: insertError } = await this.db
        .from('ta_agbot_alerts')
        .insert(alert);

      if (insertError) {
        console.error('[AlertGenerationService] Error inserting alert:', insertError);
        return false;
      }

      console.log(`   🚨 Created ${alert.severity} ${alert.alert_type} alert: ${alert.title}`);
      return true;
    } catch (error) {
      console.error('[AlertGenerationService] Unexpected error:', error);
      return false;
    }
  }

  /**
   * Resolves an alert (marks as inactive)
   */
  async resolveAlert(assetId: string, alertType: string): Promise<boolean> {
    try {
      const { error } = await this.db
        .from('ta_agbot_alerts')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('asset_id', assetId)
        .eq('alert_type', alertType)
        .eq('is_active', true);

      if (error) {
        console.error('[AlertGenerationService] Error resolving alert:', error);
        return false;
      }

      console.log(`   ✅ Resolved ${alertType} alert for asset ${assetId}`);
      return true;
    } catch (error) {
      console.error('[AlertGenerationService] Unexpected error resolving alert:', error);
      return false;
    }
  }

  /**
   * Gets all active alerts for an asset
   */
  async getActiveAlerts(assetId: string): Promise<Alert[]> {
    try {
      const { data, error } = await this.db
        .from('ta_agbot_alerts')
        .select('*')
        .eq('asset_id', assetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AlertGenerationService] Error fetching active alerts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AlertGenerationService] Unexpected error fetching alerts:', error);
      return [];
    }
  }
}
