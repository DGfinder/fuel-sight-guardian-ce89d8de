/**
 * Customer Portal Validation Schemas
 * Zod schemas for customer-facing form validation
 */

import { z } from 'zod';

/**
 * Hazard Report Form Schema
 * Validates customer-submitted hazard reports
 */
export const hazardReportSchema = z.object({
  tank_id: z.string().uuid().nullable().optional(),
  hazard_category: z.enum(['access', 'safety'], {
    required_error: 'Please select a hazard category',
  }),
  hazard_type: z.string().min(1, 'Please select a hazard type'),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    required_error: 'Please select a severity level',
  }),
  description: z
    .string()
    .min(10, 'Please provide more details (at least 10 characters)')
    .max(2000, 'Description is too long (max 2000 characters)'),
  location_description: z
    .string()
    .max(500, 'Location notes are too long (max 500 characters)')
    .optional()
    .nullable(),
});

export type HazardReportFormData = z.infer<typeof hazardReportSchema>;
