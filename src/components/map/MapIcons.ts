import L from 'leaflet';
import { semanticColors } from '@/lib/design-tokens';
import { getFuelStatus } from '@/components/ui/fuel-status';

// Icon sizes based on urgency (2025 best practice: larger = more urgent)
type IconSize = 'sm' | 'md' | 'lg';
const ICON_SIZES: Record<IconSize, { width: number; height: number }> = {
  sm: { width: 24, height: 36 },   // Normal
  md: { width: 30, height: 45 },   // Warning/Urgent
  lg: { width: 36, height: 54 },   // Critical
};

// Create manual tank icons with size variation
const createTankIcon = (color: string, size: IconSize = 'sm') => {
  const { width, height } = ICON_SIZES[size];
  const viewBoxWidth = 24;
  const viewBoxHeight = 36;

  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${width}" height="${height}">` +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="#ffffff" stroke-width="2"/>' +
      '<circle cx="12" cy="9" r="3" fill="#ffffff"/>' +
      '</svg>'
    ),
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
};

// Create agbot device icons with cellular tower design and size variation
const createAgbotIcon = (color: string, isOnline: boolean = true, size: IconSize = 'sm') => {
  const { width, height } = ICON_SIZES[size];
  const viewBoxWidth = 24;
  const viewBoxHeight = 36;

  const signalBars = isOnline
    ? '<rect x="8" y="12" width="2" height="3" fill="#ffffff"/>' +
      '<rect x="10.5" y="10" width="2" height="5" fill="#ffffff"/>' +
      '<rect x="13" y="8" width="2" height="7" fill="#ffffff"/>' +
      '<rect x="15.5" y="6" width="2" height="9" fill="#ffffff"/>'
    : '<path d="M8 12 L17 6 M8 6 L17 12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>';

  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${width}" height="${height}">` +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="#ffffff" stroke-width="2"/>' +
      '<g transform="translate(1, 1)">' +
      signalBars +
      '</g>' +
      '</svg>'
    ),
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
};

// Manual tank icons with size variations (larger = more urgent)
export const TANK_ICONS = {
  // Standard sizes
  critical: createTankIcon(semanticColors.tankCritical, 'lg'),
  low: createTankIcon(semanticColors.tankLow, 'md'),
  normal: createTankIcon(semanticColors.tankNormal, 'sm'),
  default: createTankIcon(semanticColors.tankUnknown, 'sm'),
};

// Agbot device icons with size variations
export const AGBOT_ICONS = {
  critical: createAgbotIcon(semanticColors.agbotCritical, true, 'lg'),
  low: createAgbotIcon(semanticColors.agbotLow, true, 'md'),
  normal: createAgbotIcon(semanticColors.agbotNormal, true, 'sm'),
  offline: createAgbotIcon(semanticColors.agbotOffline, false, 'sm'),
  default: createAgbotIcon(semanticColors.agbotOffline, false, 'sm'),
};

// Helper function to get appropriate icon for manual tanks
// Now with size variation: critical tanks are larger for visual prominence
export const getIconForTank = (tank: {
  current_level_percent?: number | null;
  urgency_status?: string;
  days_to_min_level?: number | null;
}) => {
  const status = getFuelStatus(tank.current_level_percent);
  const urgency = tank.urgency_status;
  const daysRemaining = tank.days_to_min_level;

  // Check for critical urgency or extremely low days remaining
  if (urgency === 'critical' || status === 'critical' || (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 3)) {
    return TANK_ICONS.critical;
  }

  // Check for urgent/low status
  if (urgency === 'urgent' || urgency === 'warning' || status === 'low' || (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 7)) {
    return TANK_ICONS.low;
  }

  if (status === 'normal') {
    return TANK_ICONS.normal;
  }

  return TANK_ICONS.default;
};

// Helper function to get appropriate icon for agbot devices
// Now with size variation: critical devices are larger for visual prominence
export const getIconForAgbot = (agbot: {
  current_level_percent?: number | null;
  device_online?: boolean;
  urgency_status?: string;
  days_to_min?: number | null;
}) => {
  // If device is offline, show offline icon regardless of fuel level
  if (!agbot.device_online) {
    return AGBOT_ICONS.offline;
  }

  const percentage = agbot.current_level_percent;
  const urgency = agbot.urgency_status;
  const daysRemaining = agbot.days_to_min;

  if (percentage === null || percentage === undefined) {
    return AGBOT_ICONS.default;
  }

  // Critical: <= 20% or urgency status critical or days <= 3
  if (percentage <= 20 || urgency === 'critical' || (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 3)) {
    return AGBOT_ICONS.critical;
  }

  // Low/Warning: <= 50% or urgency status urgent/warning or days <= 7
  if (percentage <= 50 || urgency === 'urgent' || urgency === 'warning' || (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 7)) {
    return AGBOT_ICONS.low;
  }

  return AGBOT_ICONS.normal;
};

// Helper function to get fuel status for agbot devices
export const getAgbotFuelStatus = (percentage: number | null | undefined): string => {
  if (percentage === null || percentage === undefined) {
    return 'unknown';
  }
  
  if (percentage <= 20) {
    return 'critical';
  } else if (percentage <= 50) {
    return 'low';
  } else {
    return 'normal';
  }
};

// Helper function to get agbot status text
export const getAgbotStatusText = (percentage: number | null | undefined, isOnline: boolean): string => {
  if (!isOnline) {
    return 'Offline';
  }
  
  if (percentage === null || percentage === undefined) {
    return 'No Data';
  }
  
  if (percentage <= 20) {
    return 'Critical';
  } else if (percentage <= 50) {
    return 'Low';
  } else {
    return 'Good';
  }
};