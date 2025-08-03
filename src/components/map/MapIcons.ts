import L from 'leaflet';
import { semanticColors } from '@/lib/design-tokens';
import { getFuelStatus } from '@/components/ui/fuel-status';

// Create manual tank icons (existing functionality)
const createTankIcon = (color: string) => {
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">' +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="#ffffff" stroke-width="2"/>' +
      '<circle cx="12" cy="9" r="3" fill="#ffffff"/>' +
      '</svg>'
    ),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

// Create agbot device icons with cellular tower design
const createAgbotIcon = (color: string, isOnline: boolean = true) => {
  const signalBars = isOnline 
    ? '<rect x="8" y="12" width="2" height="3" fill="#ffffff"/>' +
      '<rect x="10.5" y="10" width="2" height="5" fill="#ffffff"/>' +
      '<rect x="13" y="8" width="2" height="7" fill="#ffffff"/>' +
      '<rect x="15.5" y="6" width="2" height="9" fill="#ffffff"/>'
    : '<path d="M8 12 L17 6 M8 6 L17 12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>';
  
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">' +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="#ffffff" stroke-width="2"/>' +
      '<g transform="translate(1, 1)">' +
      signalBars +
      '</g>' +
      '</svg>'
    ),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

// Manual tank icons (existing)
export const TANK_ICONS = {
  critical: createTankIcon(semanticColors.tankCritical),
  low: createTankIcon(semanticColors.tankLow),
  normal: createTankIcon(semanticColors.tankNormal),
  default: createTankIcon(semanticColors.tankUnknown),
};

// Agbot device icons
export const AGBOT_ICONS = {
  critical: createAgbotIcon(semanticColors.agbotCritical, true),
  low: createAgbotIcon(semanticColors.agbotLow, true),
  normal: createAgbotIcon(semanticColors.agbotNormal, true),
  offline: createAgbotIcon(semanticColors.agbotOffline, false),
  default: createAgbotIcon(semanticColors.agbotOffline, false),
};

// Helper function to get appropriate icon for manual tanks
export const getIconForTank = (tank: { current_level_percent?: number | null }) => {
  const status = getFuelStatus(tank.current_level_percent);
  switch (status) {
    case 'critical': return TANK_ICONS.critical;
    case 'low': return TANK_ICONS.low;
    case 'normal': return TANK_ICONS.normal;
    default: return TANK_ICONS.default;
  }
};

// Helper function to get appropriate icon for agbot devices
export const getIconForAgbot = (agbot: { 
  current_level_percent?: number | null;
  device_online?: boolean;
}) => {
  // If device is offline, show offline icon regardless of fuel level
  if (!agbot.device_online) {
    return AGBOT_ICONS.offline;
  }

  // Use percentage thresholds appropriate for agbot monitoring
  const percentage = agbot.current_level_percent;
  if (percentage === null || percentage === undefined) {
    return AGBOT_ICONS.default;
  }

  if (percentage <= 20) {
    return AGBOT_ICONS.critical;
  } else if (percentage <= 50) {
    return AGBOT_ICONS.low;
  } else {
    return AGBOT_ICONS.normal;
  }
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