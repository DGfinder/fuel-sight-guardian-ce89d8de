/**
 * Report Generator Service
 * Business logic for generating fuel reports
 * Orchestrates template generation and analytics
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tank } from '../repositories/TankRepository.js';
import type { EmailConfig } from './EmailService.js';
import { generateFuelReport } from '../lib/agbot-report-generator.js';
import { generateAgBotEmail } from '../lib/agbot-email-template.js';

export interface GenerateReportOptions {
  tanks: Tank[];
  frequency: 'daily' | 'weekly' | 'monthly';
  customerName: string;
  contactName?: string;
  contactEmail: string;
  unsubscribeToken: string;
  config: EmailConfig;
  isTest?: boolean;
  useEnhancedTemplate?: boolean;
}

export interface GeneratedReport {
  html: string;
  text: string;
  subject: string;
  analytics?: {
    totalTanks: number;
    onlineTanks: number;
    lowFuelCount: number;
    criticalCount: number;
    averageLevel: number;
  };
}

export class ReportGeneratorService {
  constructor(private db: SupabaseClient) {}

  /**
   * Generate a complete email report
   */
  async generate(options: GenerateReportOptions): Promise<GeneratedReport> {
    const {
      tanks,
      frequency,
      customerName,
      contactName,
      contactEmail,
      unsubscribeToken,
      config,
      isTest = false,
      useEnhancedTemplate = true,
    } = options;

    console.log(`[ReportGenerator] Generating ${frequency} report for ${customerName}`);
    console.log(`[ReportGenerator] Using ${useEnhancedTemplate ? 'enhanced' : 'legacy'} template`);
    console.log(`[ReportGenerator] Tanks count: ${tanks.length}`);

    // Transform tank data for template
    const emailData = this.transformTankData(tanks);

    // Calculate analytics
    const analytics = this.calculateAnalytics(emailData);

    // Build unsubscribe URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://fuel-sight-guardian-ce89d8de.vercel.app';
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(
      unsubscribeToken
    )}`;

    let html: string;
    let text: string;
    let subject: string;

    if (useEnhancedTemplate) {
      // Use enhanced template with analytics
      const reportDate = new Date().toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const frequencyLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);

      const result = await generateFuelReport(
        this.db,
        emailData,
        {
          customerName,
          contactName,
          contactEmail,
          reportFrequency: frequency,
          unsubscribeToken,
          logoUrl: config.logo_url,
        }
      );

      html = result.html;
      text = result.text;
      subject = `${isTest ? 'PREVIEW - ' : ''}${frequencyLabel} Fuel Report - ${customerName} - ${reportDate}`;
    } else {
      // Use legacy template
      const reportDate = new Date().toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const result = generateAgBotEmail({
        customerName,
        contactName,
        locations: emailData,
        reportDate: `${reportDate}${isTest ? ' (PREVIEW)' : ''}`,
        unsubscribeUrl,
      });

      html = result.html;
      text = result.text;
      subject = `${isTest ? 'PREVIEW - ' : ''}Daily AgBot Report - ${customerName} - ${reportDate}`;
    }

    console.log(`[ReportGenerator] Report generated - HTML: ${html.length} chars, Text: ${text.length} chars`);

    return {
      html,
      text,
      subject,
      analytics,
    };
  }

  /**
   * Transform tank data from database format to email template format
   */
  private transformTankData(tanks: Tank[]): any[] {
    return tanks.map(loc => {
      const asset = Array.isArray(loc.ta_agbot_assets) && loc.ta_agbot_assets.length > 0
        ? loc.ta_agbot_assets[0]
        : null;

      return {
        location_id: loc.name || 'Unknown',
        asset_id: asset?.id || null,
        address1: loc.address || 'Unknown Location',
        latest_calibrated_fill_percentage: loc.calibrated_fill_level || 0,
        latest_telemetry: loc.last_telemetry_at,
        device_online: asset?.is_online || false,
        asset_profile_water_capacity: asset?.capacity_liters || null,
        asset_daily_consumption: asset?.daily_consumption_liters || null,
        asset_days_remaining: asset?.days_remaining || null,
        device_serial_number: asset?.device_serial || null,
        asset_reported_litres: asset?.current_level_liters || null,
        asset_refill_capacity_litres: asset?.ullage_liters || null,
        device_battery_voltage: asset?.battery_voltage || null,
        asset_profile_commodity: asset?.commodity || null,
      };
    });
  }

  /**
   * Calculate analytics from tank data
   */
  private calculateAnalytics(emailData: any[]): {
    totalTanks: number;
    onlineTanks: number;
    lowFuelCount: number;
    criticalCount: number;
    averageLevel: number;
  } {
    const totalTanks = emailData.length;
    const onlineTanks = emailData.filter(t => t.device_online).length;

    // Count low and critical fuel alerts
    const lowFuelCount = emailData.filter(
      t => t.latest_calibrated_fill_percentage < 30 && t.latest_calibrated_fill_percentage >= 15
    ).length;

    const criticalCount = emailData.filter(
      t => t.latest_calibrated_fill_percentage < 15
    ).length;

    // Calculate average level
    const totalLevel = emailData.reduce(
      (sum, t) => sum + (t.latest_calibrated_fill_percentage || 0),
      0
    );
    const averageLevel = totalTanks > 0 ? Math.round(totalLevel / totalTanks) : 0;

    return {
      totalTanks,
      onlineTanks,
      lowFuelCount,
      criticalCount,
      averageLevel,
    };
  }
}
