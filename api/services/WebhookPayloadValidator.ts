/**
 * Webhook Payload Validator
 * Validates incoming webhook payloads from Gasbot before processing
 *
 * Responsibilities:
 * - Validate payload structure (object vs array)
 * - Validate required fields
 * - Check field types and formats
 * - Return detailed validation errors
 *
 * NOTE: Gasbot can send either a single object OR an array of objects
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: unknown;
}

export interface GasbotWebhookPayload {
  // Location fields
  LocationId?: string;
  LocationGuid?: string;
  LocationAddress?: string;
  LocationLat?: number | string;
  LocationLng?: number | string;
  LocationCalibratedFillLevel?: number | string;
  LocationDailyConsumption?: number | string;
  LocationDaysRemaining?: number | string;
  LocationInstallationStatus?: number;
  LocationDisabledStatus?: boolean;
  LocationLastCalibratedTelemetryTimestamp?: string | number;
  LocationLastCalibratedTelemetryEpoch?: number;

  // Asset/Tank fields
  AssetGuid?: string;
  AssetSerialNumber?: string;
  AssetProfileName?: string;
  AssetProfileGuid?: string;
  AssetProfileCommodity?: string;
  AssetProfileWaterCapacity?: number | string;
  AssetProfileMaxDepth?: number | string;
  AssetReportedLitres?: number | string;
  AssetCalibratedFillLevel?: number | string;
  AssetRawFillLevel?: number | string;
  AssetRefillCapacityLitres?: number | string;
  AssetLastCalibratedTelemetryTimestamp?: string | number;

  // Device fields
  DeviceSerialNumber?: string;
  DeviceOnline?: boolean;
  DeviceBatteryVoltage?: number | string;
  DeviceTemperature?: number | string;
  DeviceSignalStrength?: number | string;

  // Customer fields
  TenancyName?: string;
  CustomerGuid?: string;
}

export class WebhookPayloadValidator {
  /**
   * Validates webhook payload structure and required fields
   */
  validatePayload(payload: unknown): ValidationResult {
    const result: ValidationResult = {
      valid: false,
      errors: [],
      warnings: [],
      data: payload,
    };

    // Check if payload exists
    if (!payload) {
      result.errors.push('Payload is null or undefined');
      return result;
    }

    // Check if payload is object or array
    if (typeof payload !== 'object') {
      result.errors.push(`Payload must be object or array, got ${typeof payload}`);
      return result;
    }

    // Normalize to array for validation
    const records = Array.isArray(payload) ? payload : [payload];

    if (records.length === 0) {
      result.errors.push('Payload array is empty');
      return result;
    }

    // Validate each record
    let validRecords = 0;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordErrors = this.validateRecord(record, i);

      if (recordErrors.errors.length > 0) {
        result.errors.push(...recordErrors.errors);
      }

      if (recordErrors.warnings.length > 0) {
        result.warnings.push(...recordErrors.warnings);
      }

      if (recordErrors.errors.length === 0) {
        validRecords++;
      }
    }

    // Payload is valid if at least one record is valid
    result.valid = validRecords > 0;

    if (result.valid && result.errors.length > 0) {
      result.warnings.push(`${validRecords}/${records.length} records valid, continuing with valid records`);
    }

    return result;
  }

  /**
   * Validates a single webhook record
   */
  private validateRecord(record: any, index: number): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const prefix = `Record ${index}:`;

    // Check if record is an object
    if (!record || typeof record !== 'object') {
      result.errors.push(`${prefix} Must be an object, got ${typeof record}`);
      result.valid = false;
      return result;
    }

    // Validate location fields
    const locationErrors = this.validateLocationFields(record, prefix);
    result.errors.push(...locationErrors.errors);
    result.warnings.push(...locationErrors.warnings);

    // Validate asset fields
    const assetErrors = this.validateAssetFields(record, prefix);
    result.errors.push(...assetErrors.errors);
    result.warnings.push(...assetErrors.warnings);

    // Validate device fields
    const deviceErrors = this.validateDeviceFields(record, prefix);
    result.errors.push(...deviceErrors.errors);
    result.warnings.push(...deviceErrors.warnings);

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validates location-related fields
   */
  private validateLocationFields(data: any, prefix: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // LocationId is REQUIRED (primary identifier)
    if (!data.LocationId && !data.LocationGuid) {
      result.errors.push(`${prefix} Missing required field: LocationId or LocationGuid`);
    }

    // Validate LocationId type
    if (data.LocationId && typeof data.LocationId !== 'string') {
      result.errors.push(`${prefix} LocationId must be string, got ${typeof data.LocationId}`);
    }

    // Validate coordinates if provided
    if (data.LocationLat !== undefined && data.LocationLat !== null) {
      const lat = parseFloat(data.LocationLat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        result.warnings.push(`${prefix} Invalid LocationLat: ${data.LocationLat}`);
      }
    }

    if (data.LocationLng !== undefined && data.LocationLng !== null) {
      const lng = parseFloat(data.LocationLng);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        result.warnings.push(`${prefix} Invalid LocationLng: ${data.LocationLng}`);
      }
    }

    // Validate fill level percentage
    if (data.LocationCalibratedFillLevel !== undefined && data.LocationCalibratedFillLevel !== null) {
      const fillLevel = parseFloat(data.LocationCalibratedFillLevel);
      if (isNaN(fillLevel)) {
        result.warnings.push(`${prefix} Invalid LocationCalibratedFillLevel: ${data.LocationCalibratedFillLevel}`);
      } else if (fillLevel < 0 || fillLevel > 100) {
        result.warnings.push(`${prefix} LocationCalibratedFillLevel out of range (0-100): ${fillLevel}`);
      }
    }

    return result;
  }

  /**
   * Validates asset-related fields
   */
  private validateAssetFields(data: any, prefix: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // AssetSerialNumber or DeviceSerialNumber is REQUIRED
    if (!data.AssetSerialNumber && !data.DeviceSerialNumber && !data.AssetGuid) {
      result.errors.push(`${prefix} Missing required field: AssetSerialNumber, DeviceSerialNumber, or AssetGuid`);
    }

    // Validate capacity
    if (data.AssetProfileWaterCapacity !== undefined && data.AssetProfileWaterCapacity !== null) {
      const capacity = parseFloat(data.AssetProfileWaterCapacity);
      if (isNaN(capacity)) {
        result.warnings.push(`${prefix} Invalid AssetProfileWaterCapacity: ${data.AssetProfileWaterCapacity}`);
      } else if (capacity <= 0) {
        result.warnings.push(`${prefix} AssetProfileWaterCapacity must be positive: ${capacity}`);
      } else if (capacity > 1000000) {
        result.warnings.push(`${prefix} AssetProfileWaterCapacity suspiciously large: ${capacity}L`);
      }
    }

    // Validate reported liters
    if (data.AssetReportedLitres !== undefined && data.AssetReportedLitres !== null) {
      const liters = parseFloat(data.AssetReportedLitres);
      if (isNaN(liters)) {
        result.warnings.push(`${prefix} Invalid AssetReportedLitres: ${data.AssetReportedLitres}`);
      } else if (liters < 0) {
        result.warnings.push(`${prefix} AssetReportedLitres is negative: ${liters}`);
      }
    }

    // Validate fill level percentage
    if (data.AssetCalibratedFillLevel !== undefined && data.AssetCalibratedFillLevel !== null) {
      const fillLevel = parseFloat(data.AssetCalibratedFillLevel);
      if (isNaN(fillLevel)) {
        result.warnings.push(`${prefix} Invalid AssetCalibratedFillLevel: ${data.AssetCalibratedFillLevel}`);
      } else if (fillLevel < 0 || fillLevel > 100) {
        result.warnings.push(`${prefix} AssetCalibratedFillLevel out of range (0-100): ${fillLevel}`);
      }
    }

    return result;
  }

  /**
   * Validates device-related fields
   */
  private validateDeviceFields(data: any, prefix: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate battery voltage
    if (data.DeviceBatteryVoltage !== undefined && data.DeviceBatteryVoltage !== null) {
      const voltage = parseFloat(data.DeviceBatteryVoltage);
      if (isNaN(voltage)) {
        result.warnings.push(`${prefix} Invalid DeviceBatteryVoltage: ${data.DeviceBatteryVoltage}`);
      } else if (voltage < 0 || voltage > 20) {
        result.warnings.push(`${prefix} DeviceBatteryVoltage out of expected range (0-20V): ${voltage}V`);
      }
    }

    // Validate temperature
    if (data.DeviceTemperature !== undefined && data.DeviceTemperature !== null) {
      const temp = parseFloat(data.DeviceTemperature);
      if (isNaN(temp)) {
        result.warnings.push(`${prefix} Invalid DeviceTemperature: ${data.DeviceTemperature}`);
      } else if (temp < -50 || temp > 100) {
        result.warnings.push(`${prefix} DeviceTemperature out of expected range (-50-100°C): ${temp}°C`);
      }
    }

    // Validate signal strength
    if (data.DeviceSignalStrength !== undefined && data.DeviceSignalStrength !== null) {
      const signal = parseFloat(data.DeviceSignalStrength);
      if (isNaN(signal)) {
        result.warnings.push(`${prefix} Invalid DeviceSignalStrength: ${data.DeviceSignalStrength}`);
      } else if (signal < -150 || signal > 0) {
        result.warnings.push(`${prefix} DeviceSignalStrength out of expected range (-150-0 dBm): ${signal}`);
      }
    }

    // Validate DeviceOnline type
    if (data.DeviceOnline !== undefined && typeof data.DeviceOnline !== 'boolean' && data.DeviceOnline !== 1 && data.DeviceOnline !== 0) {
      result.warnings.push(`${prefix} DeviceOnline should be boolean or 0/1, got ${data.DeviceOnline}`);
    }

    return result;
  }

  /**
   * Quick check if payload has minimum required fields
   */
  hasRequiredFields(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as any;

    // Must have location identifier
    const hasLocation = data.LocationId || data.LocationGuid;

    // Must have asset identifier
    const hasAsset = data.AssetSerialNumber || data.DeviceSerialNumber || data.AssetGuid;

    return !!(hasLocation && hasAsset);
  }
}
