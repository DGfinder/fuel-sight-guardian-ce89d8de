/**
 * DipRecordingService
 * Handles validation, recording, and processing of manual tank dip readings
 */

import { createClient } from '@supabase/supabase-js';

interface DipRecordResult {
  success: boolean;
  tankId: string;
  tankName: string;
  error?: string;
  levelPercentage?: number;
  alertsTriggered?: string[];
}

interface TankDetails {
  id: string;
  name: string;
  capacity_liters: number;
  min_level_liters: number;
  critical_level_liters: number;
  customer_id: string;
}

export class DipRecordingService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Record a dip reading for a tank
   * @param tankId Tank UUID
   * @param dipValue Dip reading in liters
   * @param dipDate Date of the reading
   * @returns Result with success status and any errors
   */
  async recordDip(
    tankId: string,
    dipValue: number,
    dipDate: string
  ): Promise<DipRecordResult> {
    try {
      // 1. Fetch tank details
      const { data: tank, error: tankError } = await this.supabase
        .from('ta_tanks')
        .select('id, name, capacity_liters, min_level_liters, critical_level_liters, customer_id')
        .eq('id', tankId)
        .single();

      if (tankError || !tank) {
        return {
          success: false,
          tankId,
          tankName: 'Unknown',
          error: `Tank not found: ${tankError?.message || 'No data'}`,
        };
      }

      // 2. Validate dip value
      if (dipValue < 0) {
        return {
          success: false,
          tankId,
          tankName: tank.name,
          error: 'Dip value cannot be negative',
        };
      }

      if (dipValue > tank.capacity_liters) {
        return {
          success: false,
          tankId,
          tankName: tank.name,
          error: `Dip value (${dipValue}L) exceeds tank capacity (${tank.capacity_liters}L)`,
        };
      }

      // 3. Insert into ta_tank_dips
      const { error: dipInsertError } = await this.supabase
        .from('ta_tank_dips')
        .insert({
          tank_id: tankId,
          dip_datetime: new Date(dipDate).toISOString(),
          level_liters: dipValue,
          source: 'kalgoorlie_webhook',
          created_at: new Date().toISOString(),
        });

      if (dipInsertError) {
        return {
          success: false,
          tankId,
          tankName: tank.name,
          error: `Failed to insert dip: ${dipInsertError.message}`,
        };
      }

      // 4. Update ta_tanks current level
      const { error: tankUpdateError } = await this.supabase
        .from('ta_tanks')
        .update({
          current_level_liters: dipValue,
          current_level_datetime: new Date(dipDate).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tankId);

      if (tankUpdateError) {
        console.error(`[DipRecordingService] Failed to update tank ${tank.name}:`, tankUpdateError);
      }

      // 5. Calculate level percentage
      const levelPercentage = (dipValue / tank.capacity_liters) * 100;

      // 6. Check for alerts
      const alertsTriggered = await this.checkAndTriggerAlerts(
        tank,
        dipValue,
        levelPercentage
      );

      return {
        success: true,
        tankId,
        tankName: tank.name,
        levelPercentage: Math.round(levelPercentage * 10) / 10,
        alertsTriggered,
      };
    } catch (error) {
      console.error('[DipRecordingService] Unexpected error:', error);
      return {
        success: false,
        tankId,
        tankName: 'Unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if alerts should be triggered and create them
   * @param tank Tank details
   * @param currentLevel Current fuel level
   * @param levelPercentage Level as percentage
   * @returns Array of alert types triggered
   */
  private async checkAndTriggerAlerts(
    tank: TankDetails,
    currentLevel: number,
    levelPercentage: number
  ): Promise<string[]> {
    const alerts: string[] = [];

    // Critical alert (highest priority)
    if (currentLevel <= tank.critical_level_liters) {
      await this.createAlert(
        tank,
        'critical',
        `CRITICAL: ${tank.name} is at ${levelPercentage.toFixed(1)}% (${currentLevel.toLocaleString()}L). Immediate refill required.`
      );
      alerts.push('critical');
    }
    // Low fuel alert
    else if (currentLevel <= tank.min_level_liters) {
      await this.createAlert(
        tank,
        'low_fuel',
        `${tank.name} is low at ${levelPercentage.toFixed(1)}% (${currentLevel.toLocaleString()}L). Please schedule a delivery.`
      );
      alerts.push('low_fuel');
    }

    return alerts;
  }

  /**
   * Create an alert in ta_alerts table
   * @param tank Tank details
   * @param alertType Type of alert
   * @param message Alert message
   */
  private async createAlert(
    tank: TankDetails,
    alertType: string,
    message: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ta_alerts')
        .insert({
          tank_id: tank.id,
          customer_id: tank.customer_id,
          alert_type: alertType,
          message,
          severity: alertType === 'critical' ? 'high' : 'medium',
          is_resolved: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error(`[DipRecordingService] Failed to create ${alertType} alert:`, error);
      } else {
        console.log(`[DipRecordingService] Created ${alertType} alert for ${tank.name}`);
      }
    } catch (error) {
      console.error('[DipRecordingService] Error creating alert:', error);
    }
  }

  /**
   * Record multiple dips in batch
   * @param dips Array of dip readings
   * @returns Array of results
   */
  async recordMultipleDips(
    dips: Array<{ tankId: string; dipValue: number; dipDate: string }>
  ): Promise<DipRecordResult[]> {
    const results: DipRecordResult[] = [];

    for (const dip of dips) {
      const result = await this.recordDip(dip.tankId, dip.dipValue, dip.dipDate);
      results.push(result);
    }

    return results;
  }
}
