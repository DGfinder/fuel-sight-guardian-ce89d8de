/**
 * Centralized validation schemas for the Fuel Sight Guardian application
 * 
 * This file contains all Zod validation schemas used throughout the application
 * to ensure consistent validation rules and improve maintainability.
 */

import { z } from 'zod';
import { getPerthToday, getPerthTomorrow } from '@/utils/timezone';

// Common validation patterns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TEXT_REGEX = /^[a-zA-Z0-9\s\-_.,!?']*$/;
const DECIMAL_NUMBER_REGEX = /^\d+(\.\d{1,2})?$/;

// Base field validators
export const validators = {
  uuid: (message = "Invalid ID format") => 
    z.string().regex(UUID_REGEX, message),
  
  positiveNumber: (max = 1000000) => 
    z.number()
      .positive("Must be a positive number")
      .max(max, `Value cannot exceed ${max.toLocaleString()}`)
      .int("Must be a whole number"),
  
  decimalString: (message = "Invalid number format") =>
    z.string()
      .min(1, "Value is required")
      .regex(DECIMAL_NUMBER_REGEX, message),
  
  safeText: (maxLength = 500) =>
    z.string()
      .max(maxLength, `Text must be less than ${maxLength} characters`)
      .regex(SAFE_TEXT_REGEX, "Contains invalid characters"),
  
  dateWithinRange: (message = "Date must be within the last year and not in the future") =>
    z.date().refine((date) => {
      // Use Perth timezone for date validation
      const perthToday = new Date(getPerthToday());
      const oneYearAgo = new Date(perthToday.getFullYear() - 1, perthToday.getMonth(), perthToday.getDate());
      const perthTomorrow = new Date(getPerthTomorrow());
      return date >= oneYearAgo && date <= perthTomorrow;
    }, message),
};

// Business logic validators
export const businessRules = {
  fuelLevel: (value: string) => {
    const num = parseFloat(value);
    return num > 0 && num <= 1000000;
  },
  
  isValidTankCapacity: (level: number, capacity: number) => {
    return level <= capacity;
  },
  
  isReasonableFuelLevel: (level: number) => {
    // Basic sanity check for fuel levels
    return level >= 0 && level <= 1000000;
  },

  isWithinSafeFillLevel: (dipValue: number, safeFillLevel: number) => {
    return dipValue <= safeFillLevel;
  },

  validateDipReading: (dipValue: number, safeFillLevel: number) => {
    if (dipValue < 0) return { valid: false, error: "Dip value cannot be negative" };
    if (dipValue > 1000000) return { valid: false, error: "Dip value exceeds maximum limit (1,000,000 L)" };
    if (dipValue > safeFillLevel) return { valid: false, error: `Dip value (${dipValue.toLocaleString()} L) exceeds safe fill level (${safeFillLevel.toLocaleString()} L)` };
    return { valid: true };
  },
};

// Form validation schemas
export const schemas = {
  // Fuel dip form (main form)
  fuelDip: z.object({
    group: validators.uuid("Invalid group ID format").min(1, "Select a depot group"),
    subgroup: z.string()
      .max(100, "Subgroup name too long")
      .regex(/^[a-zA-Z0-9\s\-_]*$/, "Invalid characters in subgroup")
      .optional(),
    tank: validators.uuid("Invalid tank ID format").min(1, "Select a tank"),
    date: z.string()
      .datetime("Invalid date format")
      .refine((date) => {
        const dipDate = new Date(date);
        // Use Perth timezone for date validation
        const perthToday = new Date(getPerthToday());
        const oneYearAgo = new Date(perthToday.getFullYear() - 1, perthToday.getMonth(), perthToday.getDate());
        const perthTomorrow = new Date(getPerthTomorrow());
        return dipDate >= oneYearAgo && dipDate <= perthTomorrow;
      }, "Date must be within the last year and not in the future (Perth timezone)"),
    dip: validators.positiveNumber().refine((value) => value >= 0, "Fuel level cannot be negative"),
    notes: validators.safeText().optional(),
  }),

  // Add dip modal
  addDip: z.object({
    groupId: validators.uuid("Invalid group ID format").min(1, "Please select a depot group"),
    tankId: validators.uuid("Invalid tank ID format").min(1, "Please select a tank"),
    dipValue: validators.decimalString("Invalid number format")
      .refine((val) => businessRules.fuelLevel(val), "Dip value must be between 0 and 1,000,000"),
    dipDate: validators.dateWithinRange(),
  }),

  // Edit dip modal
  editDip: z.object({
    dipValue: validators.decimalString("Invalid number format")
      .refine((val) => businessRules.fuelLevel(val), "Dip value must be between 0 and 1,000,000"),
  }),

  // User settings/preferences
  userPreferences: z.object({
    email_alerts: z.boolean(),
    sms_alerts: z.boolean(),
    push_alerts: z.boolean(),
    alert_frequency: z.enum(['immediate', 'hourly', 'daily']),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }),

  // Tank alert acknowledgment
  alertAcknowledgment: z.object({
    alertId: validators.uuid("Invalid alert ID"),
    notes: validators.safeText(250).optional(),
  }),
};

// Type exports for use in components
export type FuelDipFormData = z.infer<typeof schemas.fuelDip>;
export type AddDipFormData = z.infer<typeof schemas.addDip>;
export type EditDipFormData = z.infer<typeof schemas.editDip>;
export type UserPreferencesData = z.infer<typeof schemas.userPreferences>;
export type AlertAcknowledgmentData = z.infer<typeof schemas.alertAcknowledgment>;

// Validation helpers
export const validateAndFormat = {
  /**
   * Parse and validate form data, returning formatted result or error
   */
  parseForm: <T>(schema: z.ZodSchema<T>, data: unknown) => {
    try {
      return { success: true, data: schema.parse(data) };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          error: error.errors.map(err => err.message).join(', ') 
        };
      }
      return { success: false, error: 'Validation failed' };
    }
  },

  /**
   * Format validation errors for user display
   */
  formatErrors: (error: z.ZodError) => {
    return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
  },

  /**
   * Check if date is same day (YYYY-MM-DD format)
   */
  isSameDay: (date1: string, date2: string) => {
    const d1 = date1.split('T')[0]; // Get date part only
    const d2 = date2.split('T')[0];
    return d1 === d2;
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDateOnly: (date: Date | string) => {
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  },
};

export default schemas;