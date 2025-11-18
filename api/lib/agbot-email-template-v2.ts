/**
 * AgBot Enhanced Email Template V2 - Great Southern Fuels Branding
 * Supports daily, weekly, and monthly report frequencies
 * Includes consumption analytics, trends, and charts
 */

import type { TankConsumptionData, FleetSummary } from './agbot-email-analytics.js';
import {
  generateSparklineUrl,
  generate7DayTrendChartUrl,
  generateWeeklyPatternChartUrl,
  generateFleetComparisonChartUrl,
  generateAsciiSparkline,
  getTrendEmoji,
} from './agbot-chart-generator.js';

// Brand Colors - Great Southern Fuels
const BRAND_GREEN = '#2d7a2e';
const BRAND_GREEN_LIGHT = '#4a9d4c';
const BRAND_GREEN_DARK = '#1f5620';
const TEXT_DARK = '#1f2937';
const TEXT_GRAY = '#6b7280';
const TEXT_LIGHT = '#9ca3af';
const BG_GRAY = '#f9fafb';
const BORDER_GRAY = '#e5e7eb';
const RED = '#dc2626';
const AMBER = '#d97706';
const GREEN_STATUS = '#059669';

export interface AgBotLocationV2 {
  location_id: string;
  address1: string;
  latest_calibrated_fill_percentage: number;
  asset_profile_water_capacity: number | null;
  asset_daily_consumption: number | null;
  asset_days_remaining: number | null;
  device_online: boolean;
  latest_telemetry: string;
  device_serial_number?: string | null;
  asset_reported_litres?: number | null;
  asset_refill_capacity_litres?: number | null;
  device_battery_voltage?: number | null;
  asset_profile_commodity?: string | null;
}

export interface AgBotEmailDataV2 {
  customerName: string;
  contactName?: string;
  locations: AgBotLocationV2[];
  reportDate: string;
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  unsubscribeUrl?: string;

  // Enhanced analytics data
  tanksAnalytics?: TankConsumptionData[];
  fleetSummary?: FleetSummary;
  logoUrl?: string; // URL to hosted logo image
}

export interface AgBotEmailResult {
  html: string;
  text: string;
}

/**
 * Format timestamp for display
 */
function formatLastSeen(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) return 'Less than 1 hour ago';
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString();
}

/**
 * Generate report title based on frequency
 */
function getReportTitle(frequency: 'daily' | 'weekly' | 'monthly'): string {
  switch (frequency) {
    case 'daily':
      return 'Daily Fuel Report';
    case 'weekly':
      return 'Weekly Fuel Report';
    case 'monthly':
      return 'Monthly Fuel Report';
  }
}

/**
 * Generate both HTML and plain text versions of the AgBot email
 */
export function generateAgBotEmailV2(data: AgBotEmailDataV2): AgBotEmailResult {
  const html = generateAgBotEmailHtmlV2(data);
  const text = generateAgBotEmailTextV2(data);

  return { html, text };
}

/**
 * Generate HTML version of enhanced email
 */
export function generateAgBotEmailHtmlV2(data: AgBotEmailDataV2): string {
  const {
    customerName,
    contactName,
    locations,
    reportDate,
    reportFrequency,
    unsubscribeUrl,
    tanksAnalytics,
    fleetSummary,
    logoUrl,
  } = data;

  const reportTitle = getReportTitle(reportFrequency);
  const showCharts = reportFrequency === 'weekly' || reportFrequency === 'monthly';

  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter((l) => l.device_online).length;
  const lowFuelTanks = locations.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
  const criticalTanks = locations.filter(
    (l) =>
      l.latest_calibrated_fill_percentage < 15 ||
      (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
  ).length;

  // Fleet consumption summary
  const consumption24h = fleetSummary?.total_consumption_24h || 0;
  const consumption7d = fleetSummary?.total_consumption_7d || 0;
  const consumption30d = fleetSummary?.total_consumption_30d;

  // Refills needed in next 3 days
  const refillsNeeded = locations.filter(
    (l) => l.asset_days_remaining !== null && l.asset_days_remaining <= 3
  ).length;

  // Sort locations by priority (critical first, then low fuel, then by percentage)
  const sortedLocations = [...locations].sort((a, b) => {
    const aCritical =
      a.latest_calibrated_fill_percentage < 15 ||
      (a.asset_days_remaining !== null && a.asset_days_remaining <= 3);
    const bCritical =
      b.latest_calibrated_fill_percentage < 15 ||
      (b.asset_days_remaining !== null && b.asset_days_remaining <= 3);

    if (aCritical && !bCritical) return -1;
    if (!aCritical && bCritical) return 1;

    return a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage;
  });

  // Logo section
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Great Southern Fuels" style="height: 60px; margin-bottom: 10px;" />`
    : `<div style="background-color: ${BRAND_GREEN}; border-radius: 30px; padding: 8px 20px; display: inline-block;">
         <p style="color: white; font-size: 16px; font-weight: bold; margin: 0; letter-spacing: 0.5px;">GREAT SOUTHERN FUELS</p>
         <p style="color: white; font-size: 11px; margin: 0; text-align: center;">1800 GSFUELS</p>
       </div>`;

  // Generate tank cards HTML
  const tankCardsHtml =
    sortedLocations.length === 0
      ? '<p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">No fuel tanks found for your account.</p>'
      : sortedLocations
          .map((location) => {
            const isCritical =
              location.latest_calibrated_fill_percentage < 15 ||
              (location.asset_days_remaining !== null && location.asset_days_remaining <= 3);
            const isLow = location.latest_calibrated_fill_percentage < 30 && !isCritical;
            const fuelColor = isCritical ? RED : isLow ? AMBER : GREEN_STATUS;

            // Get analytics data for this tank
            const analytics = tanksAnalytics?.find((a) => a.location_id === location.location_id);

            // Online status
            const onlineStatus = location.device_online
              ? '🟢 Online'
              : `🔴 Offline (${formatLastSeen(location.latest_telemetry)})`;

            // Capacity display - HIGHLIGHTED
            const capacityLitres = location.asset_profile_water_capacity || 0;
            const currentLitres =
              location.asset_reported_litres ||
              (location.latest_calibrated_fill_percentage / 100) * capacityLitres;

            const capacityText = capacityLitres
              ? `<strong>${formatNumber(currentLitres)} L</strong> of <strong>${(capacityLitres / 1000).toFixed(0)}k L</strong>`
              : `${formatNumber(currentLitres)} L remaining`;

            // 24hr consumption - HIGHLIGHTED
            const consumption24hHtml = analytics
              ? `<div style="background: #f0fdf4; border-left: 3px solid ${BRAND_GREEN}; padding: 8px 12px; margin: 10px 0; border-radius: 4px;">
                   <p style="font-size: 11px; color: ${TEXT_GRAY}; margin: 0 0 3px 0; text-transform: uppercase; letter-spacing: 0.5px;">24-Hour Usage</p>
                   <p style="font-size: 18px; font-weight: bold; color: ${BRAND_GREEN}; margin: 0;">
                     ${formatNumber(analytics.consumption_24h_litres)} L
                     <span style="font-size: 13px; font-weight: normal; color: ${TEXT_GRAY};">
                       ${analytics.trend_indicator} (${analytics.consumption_24h_pct.toFixed(1)}%)
                     </span>
                   </p>
                 </div>`
              : '';

            // Weekly data (for weekly/monthly reports)
            const weeklyDataHtml =
              analytics && showCharts
                ? `<p style="font-size: 12px; color: ${TEXT_GRAY}; margin: 5px 0;">
                     7-day usage: ${formatNumber(analytics.consumption_7d_litres)} L (${analytics.consumption_7d_pct.toFixed(1)}%)
                   </p>
                   <img src="${generateSparklineUrl(analytics.sparkline_7d, BRAND_GREEN)}" alt="7-day trend" style="margin: 5px 0;" />`
                : analytics
                ? `<p style="font-size: 12px; color: ${TEXT_GRAY}; margin: 5px 0; font-style: italic;">
                     Avg daily: ~${formatNumber(analytics.daily_avg_consumption_litres)} L/day
                   </p>`
                : '';

            // Days remaining with refill date
            let daysRemainingText = '';
            if (analytics?.days_remaining !== null && analytics?.days_remaining !== undefined) {
              const days = Math.round(analytics.days_remaining);
              if (days === 0) {
                daysRemainingText = '⚠️ Running low';
              } else if (days === 1) {
                daysRemainingText = '~1 day left';
              } else if (days > 365) {
                daysRemainingText = 'Plenty of fuel';
              } else {
                daysRemainingText = `~${days} days left`;
                if (analytics.estimated_refill_date) {
                  const refillDate = new Date(analytics.estimated_refill_date);
                  daysRemainingText += ` (refill ~${refillDate.toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })})`;
                }
              }
            } else {
              daysRemainingText = 'Usage data pending';
            }

            // Refill capacity
            const refillHtml =
              location.asset_refill_capacity_litres && location.asset_refill_capacity_litres > 0
                ? `<p style="font-size: 12px; color: ${TEXT_GRAY}; margin: 5px 0;">
                     Refill needed: ~${formatNumber(location.asset_refill_capacity_litres)} L
                   </p>`
                : '';

            // Battery warning
            const batteryHtml =
              location.device_battery_voltage && location.device_battery_voltage < 3.5
                ? `<p style="font-size: 11px; color: ${AMBER}; margin: 5px 0; background: #fef3c7; padding: 4px 8px; border-radius: 3px; display: inline-block;">
                     ⚠️ Low battery: ${location.device_battery_voltage.toFixed(1)}V
                   </p>`
                : '';

            // Fuel type
            const fuelType = location.asset_profile_commodity || '';
            const fuelTypeHtml = fuelType ? `<span style="color: ${TEXT_LIGHT};"> • ${fuelType}</span>` : '';

            return `
              <div style="padding: 15px; margin-bottom: 12px; background-color: white; border-radius: 6px; border: 1px solid ${BORDER_GRAY}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width: 60%;">
                      <p style="font-size: 17px; font-weight: bold; color: ${TEXT_DARK}; margin: 0 0 5px 0;">
                        ${location.address1 || location.location_id}
                      </p>
                      <p style="font-size: 13px; color: ${TEXT_GRAY}; margin: 0 0 3px 0;">
                        ${onlineStatus}${fuelTypeHtml}
                      </p>
                      <p style="font-size: 14px; color: ${TEXT_DARK}; margin: 3px 0;">
                        ${capacityText}
                      </p>
                    </td>
                    <td style="width: 40%; text-align: right; vertical-align: top;">
                      <p style="font-size: 32px; font-weight: bold; color: ${fuelColor}; margin: 0; line-height: 1;">
                        ${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}%
                      </p>
                      <p style="font-size: 12px; color: ${TEXT_GRAY}; margin: 3px 0 0 0;">
                        ${daysRemainingText}
                      </p>
                    </td>
                  </tr>
                </table>
                ${consumption24hHtml}
                ${weeklyDataHtml}
                ${refillHtml}
                ${batteryHtml}
                <p style="font-size: 11px; color: ${TEXT_LIGHT}; margin: 8px 0 0 0;">
                  Updated ${formatLastSeen(location.latest_telemetry)}
                </p>
              </div>
            `;
          })
          .join('');

  // Fleet analytics section (for weekly/monthly)
  const fleetAnalyticsHtml =
    showCharts && tanksAnalytics && tanksAnalytics.length > 0
      ? `
        <div style="padding: 20px 40px; background-color: ${BG_GRAY};">
          <h2 style="color: ${TEXT_DARK}; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">
            📊 Fleet Analytics
          </h2>

          ${
            fleetSummary
              ? `
          <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid ${BORDER_GRAY}; margin-bottom: 15px;">
            <p style="font-size: 14px; color: ${TEXT_GRAY}; margin: 0 0 10px 0;">
              Fleet consumption trend: ${getTrendEmoji(fleetSummary.fleet_trend)} <strong>${
                  fleetSummary.fleet_trend
                }</strong>
            </p>
            <p style="font-size: 14px; color: ${TEXT_GRAY}; margin: 0;">
              Highest consumer: <strong>${fleetSummary.most_consumed_tank}</strong> (${formatNumber(
                  fleetSummary.most_consumed_amount
                )} L in 24h)
            </p>
          </div>
          `
              : ''
          }

          <div style="text-align: center; margin-top: 15px;">
            <img src="${generateFleetComparisonChartUrl(tanksAnalytics)}" alt="Fleet Comparison" style="max-width: 100%; height: auto; border-radius: 6px;" />
          </div>
        </div>
      `
      : '';

  // Critical alert section
  const alertSectionHtml =
    criticalTanks > 0
      ? `
    <div style="padding: 15px 40px; background-color: #fef2f2; border-left: 4px solid ${RED}; margin: 20px 40px;">
      <h3 style="color: ${RED}; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
        ⚠️ Action Required - Low Fuel Alert
      </h3>
      <p style="color: #991b1b; font-size: 14px; line-height: 20px; margin: 0;">
        You have <strong>${criticalTanks}</strong> tank${
        criticalTanks > 1 ? 's' : ''
      } at critical levels. Please arrange refilling soon to avoid running out.
      </p>
    </div>
  `
      : '';

  // Unsubscribe link
  const preferencesLink = unsubscribeUrl || '#';
  const preferencesText =
    unsubscribeUrl && unsubscribeUrl !== '#'
      ? 'Manage email preferences or unsubscribe'
      : 'Email preferences';

  // Generate complete HTML email
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${reportTitle} - ${reportDate}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0; max-width: 600px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_DARK} 100%); padding: 30px 40px; text-align: center;">
          ${logoHtml}
          <h1 style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 10px 0 5px 0;">
            ${reportTitle}
          </h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
            ${reportDate}
          </p>
        </div>

        <!-- Greeting -->
        <div style="padding: 20px 40px;">
          <p style="color: ${TEXT_GRAY}; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">
            Hello ${contactName || customerName},
          </p>
          <p style="color: ${TEXT_GRAY}; font-size: 15px; line-height: 24px; margin: 0;">
            Here's your ${reportFrequency} fuel monitoring report for <strong>${customerName}</strong>.
          </p>
        </div>

        <!-- Executive Summary -->
        <div style="padding: 20px 40px; background-color: ${BG_GRAY};">
          <h2 style="color: ${TEXT_DARK}; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">
            📈 Summary at a Glance
          </h2>

          <!-- Primary Metrics Row -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
            <tr>
              <td style="width: 32%; text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 28px; font-weight: bold; color: ${BRAND_GREEN}; margin: 0; line-height: 1;">${formatNumber(
    consumption24h
  )}</p>
                <p style="font-size: 11px; color: ${TEXT_GRAY}; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">24h Usage (L)</p>
              </td>
              <td width="2%"></td>
              <td style="width: 32%; text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 28px; font-weight: bold; color: ${BRAND_GREEN}; margin: 0; line-height: 1;">${totalTanks}</p>
                <p style="font-size: 11px; color: ${TEXT_GRAY}; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Tanks</p>
              </td>
              <td width="2%"></td>
              <td style="width: 32%; text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 28px; font-weight: bold; color: ${
                  refillsNeeded > 0 ? RED : BRAND_GREEN
                }; margin: 0; line-height: 1;">${refillsNeeded}</p>
                <p style="font-size: 11px; color: ${TEXT_GRAY}; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Refills Needed</p>
              </td>
            </tr>
          </table>

          <!-- Secondary Metrics Row -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 24%; text-align: center; padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 24px; font-weight: bold; color: ${BRAND_GREEN}; margin: 0;">${onlineTanks}</p>
                <p style="font-size: 10px; color: ${TEXT_GRAY}; margin: 3px 0 0 0; text-transform: uppercase;">Online</p>
              </td>
              <td width="1%"></td>
              <td style="width: 24%; text-align: center; padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 24px; font-weight: bold; color: ${
                  lowFuelTanks > 0 ? AMBER : BRAND_GREEN
                }; margin: 0;">${lowFuelTanks}</p>
                <p style="font-size: 10px; color: ${TEXT_GRAY}; margin: 3px 0 0 0; text-transform: uppercase;">Low Fuel</p>
              </td>
              <td width="1%"></td>
              <td style="width: 24%; text-align: center; padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 24px; font-weight: bold; color: ${
                  criticalTanks > 0 ? RED : BRAND_GREEN
                }; margin: 0;">${criticalTanks}</p>
                <p style="font-size: 10px; color: ${TEXT_GRAY}; margin: 3px 0 0 0; text-transform: uppercase;">Critical</p>
              </td>
              <td width="1%"></td>
              <td style="width: 24%; text-align: center; padding: 12px; background-color: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_GRAY};">
                <p style="font-size: 24px; font-weight: bold; color: ${BRAND_GREEN}; margin: 0;">${formatNumber(
    consumption7d
  )}</p>
                <p style="font-size: 10px; color: ${TEXT_GRAY}; margin: 3px 0 0 0; text-transform: uppercase;">7d Usage (L)</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Tank Details -->
        <div style="padding: 20px 40px;">
          <h2 style="color: ${TEXT_DARK}; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">
            🛢️ Tank Status Details
          </h2>
          ${tankCardsHtml}
        </div>

        <!-- Fleet Analytics (weekly/monthly only) -->
        ${fleetAnalyticsHtml}

        <!-- Alerts Section -->
        ${alertSectionHtml}

        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid ${BORDER_GRAY}; margin: 20px 0;">
        <div style="padding: 0 40px 30px; text-align: center;">
          <p style="color: ${TEXT_LIGHT}; font-size: 12px; line-height: 18px; margin: 5px 0;">
            This is an automated ${reportFrequency} report from your Fuel Monitoring System.
          </p>
          <p style="color: ${TEXT_LIGHT}; font-size: 12px; line-height: 18px; margin: 5px 0;">
            Powered by <strong style="color: ${BRAND_GREEN};">Great Southern Fuels</strong>
          </p>
          <p style="color: ${TEXT_LIGHT}; font-size: 12px; line-height: 18px; margin: 5px 0;">
            For support, contact us at
            <a href="mailto:support@greatsouthernfuel.com.au" style="color: ${BRAND_GREEN}; text-decoration: underline;">support@greatsouthernfuel.com.au</a>
          </p>
          <p style="color: ${TEXT_LIGHT}; font-size: 12px; line-height: 18px; margin: 5px 0;">
            <a href="${preferencesLink}" style="color: ${BRAND_GREEN}; text-decoration: underline;">${preferencesText}</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `.trim();
}

/**
 * Generate plain text version of enhanced email
 */
export function generateAgBotEmailTextV2(data: AgBotEmailDataV2): string {
  const {
    customerName,
    contactName,
    locations,
    reportDate,
    reportFrequency,
    unsubscribeUrl,
    tanksAnalytics,
    fleetSummary,
  } = data;

  const reportTitle = getReportTitle(reportFrequency).toUpperCase();

  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter((l) => l.device_online).length;
  const lowFuelTanks = locations.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
  const criticalTanks = locations.filter(
    (l) =>
      l.latest_calibrated_fill_percentage < 15 ||
      (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
  ).length;

  const consumption24h = fleetSummary?.total_consumption_24h || 0;
  const consumption7d = fleetSummary?.total_consumption_7d || 0;

  const refillsNeeded = locations.filter(
    (l) => l.asset_days_remaining !== null && l.asset_days_remaining <= 3
  ).length;

  // Sort locations
  const sortedLocations = [...locations].sort((a, b) => {
    const aCritical =
      a.latest_calibrated_fill_percentage < 15 ||
      (a.asset_days_remaining !== null && a.asset_days_remaining <= 3);
    const bCritical =
      b.latest_calibrated_fill_percentage < 15 ||
      (b.asset_days_remaining !== null && b.asset_days_remaining <= 3);

    if (aCritical && !bCritical) return -1;
    if (!aCritical && bCritical) return 1;

    return a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage;
  });

  // Generate tank details text
  const tankDetailsText =
    sortedLocations.length === 0
      ? 'No fuel tanks found for your account.'
      : sortedLocations
          .map((location, index) => {
            const isCritical =
              location.latest_calibrated_fill_percentage < 15 ||
              (location.asset_days_remaining !== null && location.asset_days_remaining <= 3);

            const analytics = tanksAnalytics?.find((a) => a.location_id === location.location_id);

            const status = location.device_online
              ? 'Online'
              : `Offline (${formatLastSeen(location.latest_telemetry)})`;

            const capacityLitres = location.asset_profile_water_capacity || 0;
            const currentLitres =
              location.asset_reported_litres ||
              (location.latest_calibrated_fill_percentage / 100) * capacityLitres;

            const capacity = capacityLitres
              ? `${formatNumber(currentLitres)} L of ${(capacityLitres / 1000).toFixed(0)}k L`
              : `${formatNumber(currentLitres)} L remaining`;

            const daysText =
              analytics?.days_remaining !== null && analytics?.days_remaining !== undefined
                ? `~${Math.round(analytics.days_remaining)} days left`
                : 'Usage data pending';

            const consumption24hText = analytics
              ? `\n     24h usage: ${formatNumber(analytics.consumption_24h_litres)} L ${analytics.trend_indicator} (${analytics.consumption_24h_pct.toFixed(1)}%)`
              : '';

            const sparkline = analytics ? `\n     7d trend: ${generateAsciiSparkline(analytics.sparkline_7d)}` : '';

            const urgency = isCritical ? ' [CRITICAL]' : '';

            return `
${index + 1}. ${location.address1 || location.location_id}${urgency}
   Fuel Level: ${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}% (${daysText})
   Status: ${status}
   Capacity: ${capacity}${consumption24hText}${sparkline}
   Updated: ${formatLastSeen(location.latest_telemetry)}`;
          })
          .join('\n');

  // Generate alert section
  const alertText =
    criticalTanks > 0
      ? `\n*** ACTION REQUIRED ***\nYou have ${criticalTanks} tank${
          criticalTanks > 1 ? 's' : ''
        } at critical levels.\nPlease arrange refilling soon to avoid running out.\n`
      : '';

  // Fleet analytics text
  const fleetAnalyticsText =
    fleetSummary && (reportFrequency === 'weekly' || reportFrequency === 'monthly')
      ? `\n----------------------------------------
FLEET ANALYTICS
----------------------------------------
Trend: ${fleetSummary.fleet_trend}
Highest consumer: ${fleetSummary.most_consumed_tank} (${formatNumber(fleetSummary.most_consumed_amount)} L/24h)
Average efficiency: ${fleetSummary.efficiency_avg}/100
`
      : '';

  // Unsubscribe text
  const unsubscribeText = unsubscribeUrl
    ? `\nTo manage your email preferences or unsubscribe, visit:\n${unsubscribeUrl}`
    : '';

  // Generate complete plain text email
  return `
========================================
GREAT SOUTHERN FUELS
${reportTitle}
${reportDate}
========================================

Hello ${contactName || customerName},

Here's your ${reportFrequency} fuel monitoring report for ${customerName}.

----------------------------------------
SUMMARY AT A GLANCE
----------------------------------------
24h Fuel Usage:  ${formatNumber(consumption24h)} L
7d Fuel Usage:   ${formatNumber(consumption7d)} L
Total Tanks:     ${totalTanks}
Online:          ${onlineTanks}
Low Fuel (<30%): ${lowFuelTanks}
Critical:        ${criticalTanks}
Refills Needed:  ${refillsNeeded} (next 3 days)

----------------------------------------
TANK STATUS DETAILS
----------------------------------------
${tankDetailsText}
${alertText}${fleetAnalyticsText}
----------------------------------------

This is an automated ${reportFrequency} report from your Fuel Monitoring System.
Powered by Great Southern Fuels

For support, contact us at:
support@greatsouthernfuel.com.au
${unsubscribeText}

========================================
  `.trim();
}
