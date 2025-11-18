/**
 * AgBot Report Generator - Master report generation with analytics
 * Generates daily, weekly, and monthly fuel reports with enhanced data
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase.js';
import type { AgBotLocationV2, AgBotEmailDataV2, AgBotEmailResult } from './agbot-email-template-v2.js';
import { generateAgBotEmailV2 } from './agbot-email-template-v2.js';
import {
  getTankConsumptionAnalytics,
  getFleetSummaryAnalytics,
  type TankConsumptionData,
  type FleetSummary,
} from './agbot-email-analytics.js';

export interface ReportGenerationOptions {
  customerName: string;
  contactName?: string;
  contactEmail: string;
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  unsubscribeToken?: string;
  logoUrl?: string;
}

/**
 * Generate a complete fuel report with analytics
 */
export async function generateFuelReport(
  supabase: SupabaseClient<Database>,
  locations: AgBotLocationV2[],
  options: ReportGenerationOptions
): Promise<AgBotEmailResult> {
  const { customerName, contactName, reportFrequency, unsubscribeToken, logoUrl } = options;

  // Generate analytics data for all tanks in parallel
  const tanksAnalyticsPromises = locations.map((location) =>
    getTankConsumptionAnalytics(supabase, location)
  );

  const tanksAnalytics = await Promise.all(tanksAnalyticsPromises);

  // Calculate fleet summary
  const fleetSummary = await getFleetSummaryAnalytics(tanksAnalytics);

  // Format report date
  const reportDate = formatReportDate(new Date(), reportFrequency);

  // Generate unsubscribe URL
  const unsubscribeUrl = unsubscribeToken
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/email-preferences?token=${unsubscribeToken}`
    : undefined;

  // Build email data
  const emailData: AgBotEmailDataV2 = {
    customerName,
    contactName,
    locations,
    reportDate,
    reportFrequency,
    unsubscribeUrl,
    tanksAnalytics,
    fleetSummary,
    logoUrl,
  };

  // Generate email
  return generateAgBotEmailV2(emailData);
}

/**
 * Generate a daily fuel report
 */
export async function generateDailyReport(
  supabase: SupabaseClient<Database>,
  locations: AgBotLocationV2[],
  options: Omit<ReportGenerationOptions, 'reportFrequency'>
): Promise<AgBotEmailResult> {
  return generateFuelReport(supabase, locations, {
    ...options,
    reportFrequency: 'daily',
  });
}

/**
 * Generate a weekly fuel report
 */
export async function generateWeeklyReport(
  supabase: SupabaseClient<Database>,
  locations: AgBotLocationV2[],
  options: Omit<ReportGenerationOptions, 'reportFrequency'>
): Promise<AgBotEmailResult> {
  return generateFuelReport(supabase, locations, {
    ...options,
    reportFrequency: 'weekly',
  });
}

/**
 * Generate a monthly fuel report
 */
export async function generateMonthlyReport(
  supabase: SupabaseClient<Database>,
  locations: AgBotLocationV2[],
  options: Omit<ReportGenerationOptions, 'reportFrequency'>
): Promise<AgBotEmailResult> {
  return generateFuelReport(supabase, locations, {
    ...options,
    reportFrequency: 'monthly',
  });
}

/**
 * Format report date based on frequency
 */
function formatReportDate(date: Date, frequency: 'daily' | 'weekly' | 'monthly'): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  switch (frequency) {
    case 'daily':
      options.weekday = 'long';
      return date.toLocaleDateString('en-AU', options);

    case 'weekly': {
      // Show week range (Monday to Sunday)
      const monday = new Date(date);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      monday.setDate(diff);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      return `Week of ${monday.toLocaleDateString('en-AU', {
        month: 'short',
        day: 'numeric',
      })} - ${sunday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    case 'monthly':
      return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }
}

/**
 * Determine if a report should be sent based on frequency
 */
export function shouldSendReport(
  frequency: 'daily' | 'weekly' | 'monthly',
  currentDate: Date = new Date()
): boolean {
  switch (frequency) {
    case 'daily':
      return true; // Always send daily reports

    case 'weekly': {
      // Send on Mondays
      const day = currentDate.getDay();
      return day === 1;
    }

    case 'monthly': {
      // Send on the 1st of each month
      const dayOfMonth = currentDate.getDate();
      return dayOfMonth === 1;
    }
  }
}

/**
 * Get report frequency display name
 */
export function getFrequencyDisplayName(frequency: 'daily' | 'weekly' | 'monthly'): string {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}
