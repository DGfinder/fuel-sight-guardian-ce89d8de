/**
 * Hazard Reporting Types
 * Types for customer-reported access issues and safety hazards at tank locations
 */

export type HazardCategory = 'access' | 'safety';
export type HazardStatus = 'pending_review' | 'acknowledged' | 'resolved' | 'dismissed';
export type HazardSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AccessHazardType =
  | 'locked_gate'
  | 'road_damage'
  | 'blocked_path'
  | 'overgrown_vegetation'
  | 'flooding'
  | 'other_access';

export type SafetyHazardType =
  | 'fuel_spill'
  | 'fuel_leak'
  | 'damaged_equipment'
  | 'power_lines'
  | 'flooding'
  | 'structural_damage'
  | 'fire_risk'
  | 'other_safety';

export type HazardType = AccessHazardType | SafetyHazardType;

export interface HazardReport {
  id: string;
  tank_id: string | null;
  customer_account_id: string;
  hazard_category: HazardCategory;
  hazard_type: HazardType;
  severity: HazardSeverity;
  description: string;
  photo_url: string | null;
  location_description: string | null;
  status: HazardStatus;
  reported_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledged_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  dismissed_by: string | null;
  dismissed_at: string | null;
  dismissal_reason: string | null;
  dispatch_notified_at: string | null;
  notification_error: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from view
  tank_name?: string;
  tank_address?: string;
}

export interface CreateHazardReportInput {
  tank_id?: string | null;
  hazard_category: HazardCategory;
  hazard_type: HazardType;
  severity: HazardSeverity;
  description: string;
  photo?: File;
  location_description?: string | null;
}

// Labels for UI display
export const ACCESS_HAZARD_TYPES: { value: AccessHazardType; label: string; description: string }[] = [
  { value: 'locked_gate', label: 'Locked Gate', description: 'Gate is locked or access code has changed' },
  { value: 'road_damage', label: 'Road Damage', description: 'Potholes, washouts, or road surface damage' },
  { value: 'blocked_path', label: 'Blocked Path', description: 'Driveway or access road is blocked' },
  { value: 'overgrown_vegetation', label: 'Overgrown Vegetation', description: 'Trees or bushes blocking access' },
  { value: 'flooding', label: 'Flooding', description: 'Water pooling or flooding on access route' },
  { value: 'other_access', label: 'Other Access Issue', description: 'Other issue preventing truck access' },
];

export const SAFETY_HAZARD_TYPES: { value: SafetyHazardType; label: string; description: string }[] = [
  { value: 'fuel_spill', label: 'Fuel Spill', description: 'Fuel has spilled on the ground' },
  { value: 'fuel_leak', label: 'Fuel Leak', description: 'Tank or equipment is leaking fuel' },
  { value: 'damaged_equipment', label: 'Damaged Equipment', description: 'Tank or related equipment is damaged' },
  { value: 'power_lines', label: 'Power Lines', description: 'Electrical hazard or downed power lines' },
  { value: 'flooding', label: 'Flooding', description: 'Standing water around tank area' },
  { value: 'structural_damage', label: 'Structural Damage', description: 'Damage to tank stand or containment' },
  { value: 'fire_risk', label: 'Fire Risk', description: 'Potential fire hazard at location' },
  { value: 'other_safety', label: 'Other Safety Hazard', description: 'Other safety concern at the site' },
];

export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  // Access hazards
  locked_gate: 'Locked Gate',
  road_damage: 'Road Damage',
  blocked_path: 'Blocked Path',
  overgrown_vegetation: 'Overgrown Vegetation',
  flooding: 'Flooding',
  other_access: 'Other Access Issue',
  // Safety hazards
  fuel_spill: 'Fuel Spill',
  fuel_leak: 'Fuel Leak',
  damaged_equipment: 'Damaged Equipment',
  power_lines: 'Power Lines',
  structural_damage: 'Structural Damage',
  fire_risk: 'Fire Risk',
  other_safety: 'Other Safety Hazard',
};

export const SEVERITY_CONFIG: Record<HazardSeverity, { label: string; description: string; color: string; bgColor: string }> = {
  low: {
    label: 'Low',
    description: 'Minor issue - truck can still access safely',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  medium: {
    label: 'Medium',
    description: 'Requires attention before next delivery',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  high: {
    label: 'High',
    description: 'Urgent - delivery may not be possible',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  critical: {
    label: 'Critical',
    description: 'Immediate danger - do not send truck',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

export const STATUS_CONFIG: Record<HazardStatus, { label: string; color: string; bgColor: string }> = {
  pending_review: {
    label: 'Pending Review',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  acknowledged: {
    label: 'Acknowledged',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
  },
};
