/**
 * Tank Utilities - Safe operations for tank data
 *
 * Provides centralized, null-safe functions for working with customer tanks.
 * Handles all tank types (AgBot, SmartFill, Manual/Dip) consistently.
 */

import type { CustomerTank, TankSourceType } from '@/hooks/useCustomerAuth';

// Tank category based on telemetry capability
export type TankCategory = 'telemetry' | 'manual' | 'unknown';

// DB urgency status (matches ta_tank_full_status and customer_tanks_unified)
export type DbUrgencyStatus = 'critical' | 'urgent' | 'warning' | 'ok' | null;

/**
 * Default location when no tank coordinates available (Perth, WA region)
 */
export const DEFAULT_LOCATION = {
  lat: -32.035,
  lng: 116.009,
  name: 'Perth Region',
  isFallback: true,
};

/**
 * Safely get the primary tank from a list
 * Prioritizes critical tanks (< 20% fuel), falls back to first tank
 * Returns null if no tanks available
 */
export function getPrimaryTank(tanks: CustomerTank[] | null | undefined): CustomerTank | null {
  if (!tanks || tanks.length === 0) {
    return null;
  }

  // Prioritize tanks with critical fuel levels
  const criticalTank = tanks.find(
    t => (t.latest_calibrated_fill_percentage ?? 100) < 20
  );

  return criticalTank ?? tanks[0] ?? null;
}

/**
 * Safely get the first tank from a list
 * Returns null if no tanks available
 */
export function getFirstTank(tanks: CustomerTank[] | null | undefined): CustomerTank | null {
  if (!tanks || tanks.length === 0) {
    return null;
  }
  return tanks[0] ?? null;
}

/**
 * Get tank category based on source type
 * - 'telemetry': AgBot or SmartFill (has device status, consumption data)
 * - 'manual': Dip or Manual (no device, manual readings)
 * - 'unknown': Source type not set or unrecognized
 */
export function getTankCategory(tank: CustomerTank | null | undefined): TankCategory {
  if (!tank) return 'unknown';

  const sourceType = tank.source_type;

  switch (sourceType) {
    case 'agbot':
    case 'smartfill':
      return 'telemetry';
    case 'dip':
    case 'manual':
      return 'manual';
    default:
      return 'unknown';
  }
}

/**
 * Check if tank has telemetry (AgBot or SmartFill)
 */
export function hasTelemetry(tank: CustomerTank | null | undefined): boolean {
  return getTankCategory(tank) === 'telemetry';
}

/**
 * Check if tank is manual entry (Dip or Manual)
 */
export function isManualTank(tank: CustomerTank | null | undefined): boolean {
  return getTankCategory(tank) === 'manual';
}

/**
 * Check if tank has valid coordinates
 */
export function hasValidCoords(tank: CustomerTank | null | undefined): tank is CustomerTank & { lat: number; lng: number } {
  return Boolean(
    tank &&
    typeof tank.lat === 'number' &&
    typeof tank.lng === 'number' &&
    !isNaN(tank.lat) &&
    !isNaN(tank.lng)
  );
}

/**
 * Check if tank has consumption data
 * Manual tanks may not have this until enough readings are recorded
 */
export function hasConsumptionData(tank: CustomerTank | null | undefined): boolean {
  return Boolean(
    tank &&
    tank.asset_daily_consumption != null &&
    tank.asset_daily_consumption > 0
  );
}

/**
 * Check if tank has days remaining prediction
 */
export function hasDaysRemaining(tank: CustomerTank | null | undefined): boolean {
  return Boolean(
    tank &&
    tank.asset_days_remaining != null &&
    tank.asset_days_remaining > 0
  );
}

/**
 * Get safe fill percentage (defaults to 0 if not available)
 */
export function getFillPercentage(tank: CustomerTank | null | undefined): number {
  return tank?.latest_calibrated_fill_percentage ?? 0;
}

/**
 * Get safe days remaining (defaults to null if not available)
 */
export function getDaysRemaining(tank: CustomerTank | null | undefined): number | null {
  return tank?.asset_days_remaining ?? null;
}

/**
 * Get safe daily consumption (defaults to null if not available)
 */
export function getDailyConsumption(tank: CustomerTank | null | undefined): number | null {
  const consumption = tank?.asset_daily_consumption;
  return consumption != null && consumption > 0 ? consumption : null;
}

/**
 * Get tank capacity in liters (defaults to null if not available)
 */
export function getCapacity(tank: CustomerTank | null | undefined): number | null {
  return tank?.asset_profile_water_capacity ?? null;
}

/**
 * Get current fuel level in liters
 */
export function getCurrentLevelLiters(tank: CustomerTank | null | undefined): number | null {
  // Direct value if available
  if (tank?.asset_current_level_liters != null) {
    return tank.asset_current_level_liters;
  }

  // Calculate from percentage and capacity
  const fillPercent = tank?.latest_calibrated_fill_percentage;
  const capacity = tank?.asset_profile_water_capacity;

  if (fillPercent != null && capacity != null) {
    return (fillPercent / 100) * capacity;
  }

  return null;
}

/**
 * Get the database urgency status
 * Returns the pre-calculated urgency from the database (order_urgency field)
 *
 * Thresholds (set in database):
 * - critical: fill ≤ 10% OR days_remaining ≤ 3
 * - urgent: fill ≤ 20% OR days_remaining ≤ 5
 * - warning: fill ≤ 30% OR days_remaining ≤ 7
 * - ok: fill > 30% AND days_remaining > 7
 */
export function getDbUrgency(tank: CustomerTank | null | undefined): DbUrgencyStatus {
  return tank?.order_urgency ?? null;
}

/**
 * Check if any tanks in array have telemetry
 */
export function anyHaveTelemetry(tanks: CustomerTank[] | null | undefined): boolean {
  if (!tanks || tanks.length === 0) return false;
  return tanks.some(t => hasTelemetry(t));
}

/**
 * Get first tank with valid coordinates
 * Useful for weather location fallback
 */
export function getFirstTankWithCoords(tanks: CustomerTank[] | null | undefined): CustomerTank | null {
  if (!tanks || tanks.length === 0) return null;
  return tanks.find(hasValidCoords) ?? null;
}

/**
 * Get weather location from tanks
 * Returns coordinates from first tank with valid coords, or default location
 */
export function getWeatherLocation(tanks: CustomerTank[] | null | undefined): {
  lat: number;
  lng: number;
  name: string;
  isFallback: boolean;
} {
  const tankWithCoords = getFirstTankWithCoords(tanks);

  if (tankWithCoords && hasValidCoords(tankWithCoords)) {
    return {
      lat: tankWithCoords.lat,
      lng: tankWithCoords.lng,
      name: tankWithCoords.location_id || tankWithCoords.address1 || 'Tank Location',
      isFallback: false,
    };
  }

  return DEFAULT_LOCATION;
}

/**
 * Sort tanks by urgency (most urgent first)
 * Uses database urgency status (critical > urgent > warning > ok)
 */
export function sortByUrgency(tanks: CustomerTank[]): CustomerTank[] {
  const urgencyOrder: Record<string, number> = {
    critical: 0,
    urgent: 1,
    warning: 2,
    soon: 2, // 'soon' maps to same priority as 'warning'
    ok: 3,
  };

  return [...tanks].sort((a, b) => {
    const aOrder = urgencyOrder[a.order_urgency ?? 'ok'] ?? 4;
    const bOrder = urgencyOrder[b.order_urgency ?? 'ok'] ?? 4;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // Secondary sort by fill percentage (lower first)
    const aFill = a.latest_calibrated_fill_percentage ?? 100;
    const bFill = b.latest_calibrated_fill_percentage ?? 100;
    return aFill - bFill;
  });
}

/**
 * Calculate fleet summary from tanks
 */
export function calculateFleetSummary(tanks: CustomerTank[] | null | undefined): {
  totalTanks: number;
  criticalCount: number;
  urgentCount: number;
  warningCount: number;
  okCount: number;
  onlineCount: number;
  hasTelemetry: boolean;
  hasConsumptionData: boolean;
  totalCapacity: number;
  currentFuel: number;
  fillPercentage: number;
  dailyConsumption: number | null;
  daysToRun: number | null;
} {
  if (!tanks || tanks.length === 0) {
    return {
      totalTanks: 0,
      criticalCount: 0,
      urgentCount: 0,
      warningCount: 0,
      okCount: 0,
      onlineCount: 0,
      hasTelemetry: false,
      hasConsumptionData: false,
      totalCapacity: 0,
      currentFuel: 0,
      fillPercentage: 0,
      dailyConsumption: null,
      daysToRun: null,
    };
  }

  let criticalCount = 0;
  let urgentCount = 0;
  let warningCount = 0;
  let okCount = 0;
  let onlineCount = 0;
  let totalCapacity = 0;
  let currentFuel = 0;
  let totalConsumption = 0;
  let tanksWithConsumption = 0;

  for (const tank of tanks) {
    // Count by urgency
    switch (tank.order_urgency) {
      case 'critical': criticalCount++; break;
      case 'urgent': urgentCount++; break;
      case 'warning':
      case 'soon': warningCount++; break;
      default: okCount++;
    }

    // Count online devices (only for telemetry tanks)
    if (hasTelemetry(tank) && tank.device_online) {
      onlineCount++;
    }

    // Sum capacity and current fuel
    const capacity = tank.asset_profile_water_capacity ?? 0;
    const fillPct = tank.latest_calibrated_fill_percentage ?? 0;
    totalCapacity += capacity;
    currentFuel += (fillPct / 100) * capacity;

    // Sum consumption (only for tanks with data)
    if (tank.asset_daily_consumption != null && tank.asset_daily_consumption > 0) {
      totalConsumption += tank.asset_daily_consumption;
      tanksWithConsumption++;
    }
  }

  const fleetHasTelemetry = anyHaveTelemetry(tanks);
  const fleetHasConsumptionData = tanksWithConsumption > 0;
  const fillPercentage = totalCapacity > 0 ? (currentFuel / totalCapacity) * 100 : 0;
  const dailyConsumption = fleetHasConsumptionData ? totalConsumption : null;
  const daysToRun = dailyConsumption && dailyConsumption > 0 ? currentFuel / dailyConsumption : null;

  return {
    totalTanks: tanks.length,
    criticalCount,
    urgentCount,
    warningCount,
    okCount,
    onlineCount,
    hasTelemetry: fleetHasTelemetry,
    hasConsumptionData: fleetHasConsumptionData,
    totalCapacity,
    currentFuel,
    fillPercentage,
    dailyConsumption,
    daysToRun,
  };
}

/**
 * Get display name for tank source type
 */
export function getSourceTypeLabel(sourceType: TankSourceType | null | undefined): string {
  switch (sourceType) {
    case 'agbot': return 'AgBot';
    case 'smartfill': return 'SmartFill';
    case 'dip':
    case 'manual': return 'Manual';
    default: return 'Unknown';
  }
}

/**
 * Validate tank data completeness for features
 * Returns which features can be shown for this tank
 */
export function getTankFeatureAvailability(tank: CustomerTank | null | undefined): {
  canShowFillLevel: boolean;
  canShowDaysRemaining: boolean;
  canShowConsumption: boolean;
  canShowDeviceStatus: boolean;
  canShowWeather: boolean;
  canShowIntelligence: boolean;
} {
  if (!tank) {
    return {
      canShowFillLevel: false,
      canShowDaysRemaining: false,
      canShowConsumption: false,
      canShowDeviceStatus: false,
      canShowWeather: false,
      canShowIntelligence: false,
    };
  }

  return {
    canShowFillLevel: tank.latest_calibrated_fill_percentage != null,
    canShowDaysRemaining: hasDaysRemaining(tank),
    canShowConsumption: hasConsumptionData(tank),
    canShowDeviceStatus: hasTelemetry(tank),
    canShowWeather: hasValidCoords(tank),
    canShowIntelligence: hasValidCoords(tank) && (hasConsumptionData(tank) || tank.latest_calibrated_fill_percentage != null),
  };
}
