/**
 * Admin Validation Schemas
 * Zod schemas for Fuel Management admin forms
 */

import { z } from 'zod';

// Tank Group Schema
export const tankGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
});

export type TankGroupInput = z.infer<typeof tankGroupSchema>;

// Fuel Tank Schema
export const fuelTankSchema = z.object({
  location: z
    .string()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters'),
  group_id: z
    .string()
    .uuid('Please select a valid group'),
  subgroup: z
    .string()
    .max(100, 'Subgroup must be less than 100 characters')
    .optional()
    .nullable(),
  product_type: z.enum(['Diesel', 'ULP', 'ULP98', 'ADF'], {
    required_error: 'Please select a product type',
  }),
  safe_level: z
    .number({ required_error: 'Safe level is required' })
    .positive('Safe level must be positive'),
  min_level: z
    .number({ required_error: 'Minimum level is required' })
    .min(0, 'Minimum level cannot be negative'),
  status: z
    .enum(['active', 'archived', 'decommissioned'])
    .default('active'),
}).refine(
  (data) => data.min_level < data.safe_level,
  {
    message: 'Minimum level must be less than safe level',
    path: ['min_level'],
  }
);

export type FuelTankInput = z.infer<typeof fuelTankSchema>;

// Dip Reading Edit Schema
export const dipReadingSchema = z.object({
  value: z
    .number({ required_error: 'Value is required' })
    .positive('Value must be positive')
    .max(1000000, 'Value exceeds maximum'),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable(),
});

export type DipReadingInput = z.infer<typeof dipReadingSchema>;

// Deletion reason schema (for soft delete)
export const deletionReasonSchema = z.object({
  reason: z
    .string()
    .min(1, 'Please provide a reason for deletion')
    .max(500, 'Reason must be less than 500 characters'),
});

export type DeletionReasonInput = z.infer<typeof deletionReasonSchema>;

// CSV Import Row Schemas
export const tankCsvRowSchema = z.object({
  location: z.string().min(1),
  group_name: z.string().min(1),
  subgroup: z.string().optional(),
  product_type: z.enum(['Diesel', 'ULP', 'ULP98', 'ADF']),
  safe_level: z.coerce.number().positive(),
  min_level: z.coerce.number().min(0),
  status: z.enum(['active', 'archived', 'decommissioned']).optional().default('active'),
});

export type TankCsvRow = z.infer<typeof tankCsvRowSchema>;

export const dipCsvRowSchema = z.object({
  tank_location: z.string().min(1),
  value: z.coerce.number().positive(),
  recorded_by: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(), // Will be parsed as date
});

export type DipCsvRow = z.infer<typeof dipCsvRowSchema>;

// Bulk update schemas
export const bulkTankUpdateSchema = z.object({
  group_id: z.string().uuid().optional(),
  status: z.enum(['active', 'archived', 'decommissioned']).optional(),
  subgroup: z.string().max(100).optional(),
});

export type BulkTankUpdate = z.infer<typeof bulkTankUpdateSchema>;
