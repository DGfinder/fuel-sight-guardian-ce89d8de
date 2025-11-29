/**
 * Alert Service for Tank Management
 * 
 * Generates and manages alerts for fuel tanks and Agbot devices based on operational conditions.
 * Provides non-annoying alert generation with deduplication and auto-resolution.
 */

import { supabase } from './supabase';
import type { Tank } from '@/types/fuel';
import type { AgbotLocation } from '@/services/agbot-api';

export type AlertType = 'low_fuel' | 'critical_fuel' | 'no_reading' | 'maintenance' | 'device_offline' | 'signal_issue' | 'data_stale';

interface AlertCondition {
  type: AlertType;
  message: string;
  priority: 'high' | 'medium' | 'low';
  deviceType: 'tank' | 'agbot';
  deviceId: string;
}

interface ExistingAlert {
  id: string;
  tank_id?: string;
  agbot_asset_id?: string;
  alert_type: AlertType;
  created_at: string;
  acknowledged_at: string | null;
  snoozed_until: string | null;
}

/**
 * Check if tank meets critical fuel alert conditions
 */
function checkCriticalFuel(tank: Tank): AlertCondition | null {
  const percent = tank.current_level_percent ?? 0;
  const daysToMin = tank.days_to_min_level;
  
  // Critical: ≤ 10% OR ≤ 1.5 days to minimum
  if (percent <= 10 || (daysToMin !== null && daysToMin <= 1.5)) {
    return {
      type: 'critical_fuel',
      message: `Critical fuel level at ${tank.location}: ${percent}% remaining${daysToMin ? ` (${daysToMin} days to minimum)` : ''}`,
      priority: 'high',
      deviceType: 'tank',
      deviceId: tank.id
    };
  }
  
  return null;
}

/**
 * Check if tank meets low fuel alert conditions
 */
function checkLowFuel(tank: Tank): AlertCondition | null {
  const percent = tank.current_level_percent ?? 0;
  const daysToMin = tank.days_to_min_level;
  
  // Low: ≤ 20% OR ≤ 2.5 days to minimum (but not critical)
  if (percent <= 20 || (daysToMin !== null && daysToMin <= 2.5)) {
    // Skip if already critical
    if (percent <= 10 || (daysToMin !== null && daysToMin <= 1.5)) {
      return null;
    }
    
    return {
      type: 'low_fuel',
      message: `Low fuel level at ${tank.location}: ${percent}% remaining${daysToMin ? ` (${daysToMin} days to minimum)` : ''}`,
      priority: 'medium',
      deviceType: 'tank',
      deviceId: tank.id
    };
  }
  
  return null;
}

/**
 * Check if tank has no recent dip reading
 */
function checkNoReading(tank: Tank): AlertCondition | null {
  if (!tank.last_dip_ts) {
    return {
      type: 'no_reading',
      message: `No dip reading recorded for ${tank.location}`,
      priority: 'medium',
      deviceType: 'tank',
      deviceId: tank.id
    };
  }
  
  const lastDipDate = new Date(tank.last_dip_ts);
  const daysSinceReading = (Date.now() - lastDipDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Alert if no reading in 7+ days
  if (daysSinceReading >= 7) {
    return {
      type: 'no_reading',
      message: `No dip reading for ${tank.location} in ${Math.round(daysSinceReading)} days`,
      priority: 'medium',
      deviceType: 'tank',
      deviceId: tank.id
    };
  }
  
  return null;
}

// =============================================
// AGBOT-SPECIFIC ALERT FUNCTIONS
// =============================================

/**
 * Check if Agbot device is offline
 */
function checkAgbotDeviceOffline(location: AgbotLocation): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  
  for (const asset of location.assets) {
    if (!asset.deviceOnline) {
      alerts.push({
        type: 'device_offline',
        message: `Agbot device offline at ${location.locationId}: ${asset.deviceSerialNumber} not responding`,
        priority: 'high',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
  }
  
  return alerts;
}

/**
 * Check if Agbot device has critical fuel levels
 */
function checkAgbotCriticalFuel(location: AgbotLocation): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  
  for (const asset of location.assets) {
    const percent = asset.latestCalibratedFillPercentage ?? 0;
    
    // Critical: ≤ 10%
    if (percent <= 10) {
      alerts.push({
        type: 'critical_fuel',
        message: `Critical fuel level at ${location.locationId}: ${percent}% remaining (${asset.deviceSerialNumber})`,
        priority: 'high',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
  }
  
  return alerts;
}

/**
 * Check if Agbot device has low fuel levels
 */
function checkAgbotLowFuel(location: AgbotLocation): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  
  for (const asset of location.assets) {
    const percent = asset.latestCalibratedFillPercentage ?? 0;
    
    // Low: ≤ 20% (but not critical)
    if (percent <= 20 && percent > 10) {
      alerts.push({
        type: 'low_fuel',
        message: `Low fuel level at ${location.locationId}: ${percent}% remaining (${asset.deviceSerialNumber})`,
        priority: 'medium',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
  }
  
  return alerts;
}

/**
 * Check if Agbot device has stale data
 */
function checkAgbotDataStale(location: AgbotLocation): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  
  for (const asset of location.assets) {
    if (!asset.latestTelemetryEventTimestamp) {
      alerts.push({
        type: 'data_stale',
        message: `No telemetry data from ${location.locationId} device ${asset.deviceSerialNumber}`,
        priority: 'medium',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
      continue;
    }
    
    const lastReportDate = new Date(asset.latestTelemetryEventTimestamp);
    const hoursSinceReport = (Date.now() - lastReportDate.getTime()) / (1000 * 60 * 60);
    
    // Alert if no data in 24+ hours
    if (hoursSinceReport >= 24) {
      alerts.push({
        type: 'data_stale',
        message: `Stale data from ${location.locationId}: No updates in ${Math.round(hoursSinceReport)} hours (${asset.deviceSerialNumber})`,
        priority: 'medium',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
  }
  
  return alerts;
}

/**
 * Check for signal or connectivity issues
 */
function checkAgbotSignalIssues(location: AgbotLocation): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  
  for (const asset of location.assets) {
    // Check for signal issues based on device state
    if (asset.deviceState !== 1) { // 1 = Active
      alerts.push({
        type: 'signal_issue',
        message: `Signal issue at ${location.locationId}: Device ${asset.deviceSerialNumber} state is ${asset.deviceStateLabel}`,
        priority: 'medium',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
    
    // Check for inconsistent readings (raw vs calibrated)
    const rawPercent = asset.latestRawFillPercentage ?? 0;
    const calibratedPercent = asset.latestCalibratedFillPercentage ?? 0;
    const difference = Math.abs(rawPercent - calibratedPercent);
    
    // Alert if difference is > 15% (indicates sensor/calibration issues)
    if (difference > 15) {
      alerts.push({
        type: 'signal_issue',
        message: `Sensor calibration issue at ${location.locationId}: ${difference}% difference between raw and calibrated readings (${asset.deviceSerialNumber})`,
        priority: 'medium',
        deviceType: 'agbot',
        deviceId: asset.assetGuid
      });
    }
  }
  
  return alerts;
}

/**
 * Get all alert conditions for a tank
 */
function getTankAlertConditions(tank: Tank): AlertCondition[] {
  const conditions: AlertCondition[] = [];
  
  // Only check tanks with valid data
  if (!tank.current_level_percent && tank.current_level_percent !== 0) {
    return conditions;
  }
  
  // Check each condition
  const critical = checkCriticalFuel(tank);
  const low = checkLowFuel(tank);
  const noReading = checkNoReading(tank);
  
  if (critical) conditions.push(critical);
  if (low) conditions.push(low);
  if (noReading) conditions.push(noReading);
  
  return conditions;
}

/**
 * Get all alert conditions for an Agbot location
 */
function getAgbotAlertConditions(location: AgbotLocation): AlertCondition[] {
  const conditions: AlertCondition[] = [];
  
  // Check each type of alert for all assets in the location
  conditions.push(...checkAgbotDeviceOffline(location));
  conditions.push(...checkAgbotCriticalFuel(location));
  conditions.push(...checkAgbotLowFuel(location));
  conditions.push(...checkAgbotDataStale(location));
  conditions.push(...checkAgbotSignalIssues(location));
  
  return conditions;
}

/**
 * Get existing alerts for tanks (within last 24 hours to avoid spam)
 */
async function getExistingTankAlerts(tankIds: string[]): Promise<ExistingAlert[]> {
  if (tankIds.length === 0) return [];
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('tank_alerts')
    .select('id, tank_id, alert_type, created_at, acknowledged_at, snoozed_until')
    .in('tank_id', tankIds)
    .gte('created_at', twentyFourHoursAgo);
  
  if (error) {
    console.error('Error fetching existing tank alerts:', error);
    return [];
  }
  
  return data as ExistingAlert[];
}

/**
 * Get existing alerts for Agbot devices (within last 24 hours to avoid spam)
 */
async function getExistingAgbotAlerts(assetIds: string[]): Promise<ExistingAlert[]> {
  if (assetIds.length === 0) return [];
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('agbot_alerts')
    .select('id, agbot_asset_id, alert_type, created_at, acknowledged_at, snoozed_until')
    .in('agbot_asset_id', assetIds)
    .gte('created_at', twentyFourHoursAgo);
  
  if (error) {
    console.error('Error fetching existing agbot alerts:', error);
    return [];
  }
  
  return data.map(item => ({
    ...item,
    agbot_asset_id: item.agbot_asset_id
  })) as ExistingAlert[];
}

/**
 * Check if tank alert already exists (same tank + type + within 24 hours)
 */
function tankAlertExists(tankId: string, alertType: AlertType, existingAlerts: ExistingAlert[]): boolean {
  return existingAlerts.some(alert => 
    alert.tank_id === tankId && 
    alert.alert_type === alertType &&
    !alert.acknowledged_at && // Not acknowledged
    (!alert.snoozed_until || new Date(alert.snoozed_until) < new Date()) // Not snoozed
  );
}

/**
 * Check if agbot alert already exists (same asset + type + within 24 hours)
 */
function agbotAlertExists(assetId: string, alertType: AlertType, existingAlerts: ExistingAlert[]): boolean {
  return existingAlerts.some(alert => 
    alert.agbot_asset_id === assetId && 
    alert.alert_type === alertType &&
    !alert.acknowledged_at && // Not acknowledged
    (!alert.snoozed_until || new Date(alert.snoozed_until) < new Date()) // Not snoozed
  );
}

/**
 * Create new tank alert in database
 */
async function createTankAlert(tankId: string, condition: AlertCondition): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tank_alerts')
      .insert({
        tank_id: tankId,
        alert_type: condition.type,
        message: condition.message,
        priority: condition.priority,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating tank alert:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception creating tank alert:', error);
    return false;
  }
}

/**
 * Create new agbot alert in database
 */
async function createAgbotAlert(assetId: string, condition: AlertCondition): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('agbot_alerts')
      .insert({
        agbot_asset_id: assetId,
        alert_type: condition.type,
        message: condition.message,
        priority: condition.priority,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating agbot alert:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception creating agbot alert:', error);
    return false;
  }
}

/**
 * Auto-resolve alerts when conditions no longer apply
 */
async function autoResolveAlerts(tanks: Tank[], existingAlerts: ExistingAlert[]): Promise<void> {
  const alertsToResolve: string[] = [];
  
  for (const alert of existingAlerts) {
    // Skip already acknowledged alerts
    if (alert.acknowledged_at) continue;
    
    const tank = tanks.find(t => t.id === alert.tank_id);
    if (!tank) continue;
    
    let shouldResolve = false;
    
    // Check if alert condition is no longer valid
    switch (alert.alert_type) {
      case 'critical_fuel':
        const criticalCondition = checkCriticalFuel(tank);
        shouldResolve = !criticalCondition;
        break;
        
      case 'low_fuel':
        const lowCondition = checkLowFuel(tank);
        shouldResolve = !lowCondition;
        break;
        
      case 'no_reading':
        const noReadingCondition = checkNoReading(tank);
        shouldResolve = !noReadingCondition;
        break;
        
      // Maintenance alerts are manual - don't auto-resolve
      case 'maintenance':
        break;
    }
    
    if (shouldResolve) {
      alertsToResolve.push(alert.id);
    }
  }
  
  // Resolve alerts in batch
  if (alertsToResolve.length > 0) {
    try {
      const { error } = await supabase
        .from('tank_alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .in('id', alertsToResolve);
      
      if (error) {
        console.error('Error auto-resolving alerts:', error);
      }
    } catch (error) {
      console.error('Exception auto-resolving alerts:', error);
    }
  }
}

/**
 * Main alert generation function for tanks
 * Call this with tank data to generate appropriate alerts
 */
export async function generateAlerts(tanks: Tank[]): Promise<{ 
  generated: number; 
  resolved: number; 
}> {
  if (!tanks || tanks.length === 0) {
    return { generated: 0, resolved: 0 };
  }
  
  try {
    // Get existing alerts to avoid duplicates
    const tankIds = tanks.map(tank => tank.id);
    const existingAlerts = await getExistingTankAlerts(tankIds);
    
    // Auto-resolve alerts where conditions no longer apply
    await autoResolveAlerts(tanks, existingAlerts);
    
    let generatedCount = 0;
    
    // Check each tank for alert conditions
    for (const tank of tanks) {
      const conditions = getTankAlertConditions(tank);
      
      for (const condition of conditions) {
        // Skip if alert already exists
        if (tankAlertExists(tank.id, condition.type, existingAlerts)) {
          continue;
        }
        
        // Create new alert
        const success = await createTankAlert(tank.id, condition);
        if (success) {
          generatedCount++;
        }
      }
    }

    return { 
      generated: generatedCount, 
      resolved: existingAlerts.filter(a => !a.acknowledged_at).length 
    };
    
  } catch (error) {
    console.error('Error in generateAlerts:', error);
    return { generated: 0, resolved: 0 };
  }
}

/**
 * Alert generation function for Agbot devices
 * Call this with Agbot location data to generate appropriate alerts
 */
export async function generateAgbotAlerts(locations: AgbotLocation[]): Promise<{ 
  generated: number; 
  resolved: number; 
}> {
  if (!locations || locations.length === 0) {
    return { generated: 0, resolved: 0 };
  }
  
  try {
    // Get all asset IDs for existing alert lookup
    const assetIds: string[] = [];
    locations.forEach(location => {
      location.assets.forEach(asset => {
        assetIds.push(asset.assetGuid);
      });
    });
    
    // Get existing alerts to avoid duplicates
    const existingAlerts = await getExistingAgbotAlerts(assetIds);
    
    let generatedCount = 0;
    
    // Check each location for alert conditions
    for (const location of locations) {
      const conditions = getAgbotAlertConditions(location);
      
      for (const condition of conditions) {
        // Skip if alert already exists
        if (agbotAlertExists(condition.deviceId, condition.type, existingAlerts)) {
          continue;
        }
        
        // Create new alert
        const success = await createAgbotAlert(condition.deviceId, condition);
        if (success) {
          generatedCount++;
        }
      }
    }

    return { 
      generated: generatedCount, 
      resolved: existingAlerts.filter(a => !a.acknowledged_at).length 
    };
    
  } catch (error) {
    console.error('Error in generateAgbotAlerts:', error);
    return { generated: 0, resolved: 0 };
  }
}

/**
 * Get active tank alerts count for display in UI
 */
export async function getActiveTankAlertsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tank_alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null)
      .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString());
    
    if (error) {
      console.error('Error getting active tank alerts count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Exception getting active tank alerts count:', error);
    return 0;
  }
}

/**
 * Get active agbot alerts count for display in UI
 */
export async function getActiveAgbotAlertsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('agbot_alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null)
      .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString());
    
    if (error) {
      // Suppress 404 errors (table doesn't exist) - just return 0
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return 0;
      }
      console.error('Error getting active agbot alerts count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Exception getting active agbot alerts count:', error);
    return 0;
  }
}

/**
 * Get total active alerts count (tanks + agbot) for display in UI
 */
export async function getActiveAlertsCount(): Promise<number> {
  try {
    const [tankCount, agbotCount] = await Promise.all([
      getActiveTankAlertsCount(),
      getActiveAgbotAlertsCount()
    ]);
    
    return tankCount + agbotCount;
  } catch (error) {
    console.error('Exception getting total active alerts count:', error);
    return 0;
  }
}

/**
 * Get detailed alerts breakdown for dashboard
 */
export async function getAlertsBreakdown(): Promise<{
  tank: { total: number; critical: number; low: number; noReading: number; maintenance: number };
  agbot: { total: number; critical: number; low: number; offline: number; stale: number; signal: number };
  total: number;
}> {
  try {
    // Get tank alerts breakdown
    const tankAlertsQuery = supabase
      .from('tank_alerts')
      .select('alert_type')
      .is('acknowledged_at', null)
      .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString());

    // Get agbot alerts breakdown  
    const agbotAlertsQuery = supabase
      .from('agbot_alerts')
      .select('alert_type')
      .is('acknowledged_at', null)
      .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString());

    const [tankAlertsResult, agbotAlertsResult] = await Promise.all([
      tankAlertsQuery,
      agbotAlertsQuery
    ]);

    // Count tank alerts by type
    const tankAlerts = tankAlertsResult.data || [];
    const tankBreakdown = {
      total: tankAlerts.length,
      critical: tankAlerts.filter(a => a.alert_type === 'critical_fuel').length,
      low: tankAlerts.filter(a => a.alert_type === 'low_fuel').length,
      noReading: tankAlerts.filter(a => a.alert_type === 'no_reading').length,
      maintenance: tankAlerts.filter(a => a.alert_type === 'maintenance').length
    };

    // Count agbot alerts by type
    const agbotAlerts = agbotAlertsResult.data || [];
    const agbotBreakdown = {
      total: agbotAlerts.length,
      critical: agbotAlerts.filter(a => a.alert_type === 'critical_fuel').length,
      low: agbotAlerts.filter(a => a.alert_type === 'low_fuel').length,
      offline: agbotAlerts.filter(a => a.alert_type === 'device_offline').length,
      stale: agbotAlerts.filter(a => a.alert_type === 'data_stale').length,
      signal: agbotAlerts.filter(a => a.alert_type === 'signal_issue').length
    };

    return {
      tank: tankBreakdown,
      agbot: agbotBreakdown,
      total: tankBreakdown.total + agbotBreakdown.total
    };

  } catch (error) {
    console.error('Exception getting alerts breakdown:', error);
    return {
      tank: { total: 0, critical: 0, low: 0, noReading: 0, maintenance: 0 },
      agbot: { total: 0, critical: 0, low: 0, offline: 0, stale: 0, signal: 0 },
      total: 0
    };
  }
}