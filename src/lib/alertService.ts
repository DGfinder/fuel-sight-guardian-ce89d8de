/**
 * Alert Service for Tank Management
 * 
 * Generates and manages alerts for fuel tanks based on operational conditions.
 * Provides non-annoying alert generation with deduplication and auto-resolution.
 */

import { supabase } from './supabase';
import type { Tank } from '@/types/fuel';

export type AlertType = 'low_fuel' | 'critical_fuel' | 'no_reading' | 'maintenance';

interface AlertCondition {
  type: AlertType;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

interface ExistingAlert {
  id: string;
  tank_id: string;
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
      priority: 'high'
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
      priority: 'medium'
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
      priority: 'medium'
    };
  }
  
  const lastDipDate = new Date(tank.last_dip_ts);
  const daysSinceReading = (Date.now() - lastDipDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Alert if no reading in 7+ days
  if (daysSinceReading >= 7) {
    return {
      type: 'no_reading',
      message: `No dip reading for ${tank.location} in ${Math.round(daysSinceReading)} days`,
      priority: 'medium'
    };
  }
  
  return null;
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
 * Get existing alerts for tanks (within last 24 hours to avoid spam)
 */
async function getExistingAlerts(tankIds: string[]): Promise<ExistingAlert[]> {
  if (tankIds.length === 0) return [];
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('tank_alerts')
    .select('id, tank_id, alert_type, created_at, acknowledged_at, snoozed_until')
    .in('tank_id', tankIds)
    .gte('created_at', twentyFourHoursAgo);
  
  if (error) {
    console.error('Error fetching existing alerts:', error);
    return [];
  }
  
  return data as ExistingAlert[];
}

/**
 * Check if alert already exists (same tank + type + within 24 hours)
 */
function alertExists(tankId: string, alertType: AlertType, existingAlerts: ExistingAlert[]): boolean {
  return existingAlerts.some(alert => 
    alert.tank_id === tankId && 
    alert.alert_type === alertType &&
    !alert.acknowledged_at && // Not acknowledged
    (!alert.snoozed_until || new Date(alert.snoozed_until) < new Date()) // Not snoozed
  );
}

/**
 * Create new alert in database
 */
async function createAlert(tankId: string, condition: AlertCondition): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tank_alerts')
      .insert({
        tank_id: tankId,
        alert_type: condition.type,
        message: condition.message,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating alert:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception creating alert:', error);
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
      } else {
        console.log(`Auto-resolved ${alertsToResolve.length} alerts`);
      }
    } catch (error) {
      console.error('Exception auto-resolving alerts:', error);
    }
  }
}

/**
 * Main alert generation function
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
    const existingAlerts = await getExistingAlerts(tankIds);
    
    // Auto-resolve alerts where conditions no longer apply
    await autoResolveAlerts(tanks, existingAlerts);
    
    let generatedCount = 0;
    
    // Check each tank for alert conditions
    for (const tank of tanks) {
      const conditions = getTankAlertConditions(tank);
      
      for (const condition of conditions) {
        // Skip if alert already exists
        if (alertExists(tank.id, condition.type, existingAlerts)) {
          continue;
        }
        
        // Create new alert
        const success = await createAlert(tank.id, condition);
        if (success) {
          generatedCount++;
        }
      }
    }
    
    if (generatedCount > 0) {
      console.log(`Generated ${generatedCount} new alerts`);
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
 * Get active alerts count for display in UI
 */
export async function getActiveAlertsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tank_alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null)
      .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString());
    
    if (error) {
      console.error('Error getting active alerts count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Exception getting active alerts count:', error);
    return 0;
  }
}