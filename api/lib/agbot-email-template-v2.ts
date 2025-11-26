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

// Brand Colors - Great Southern Fuels (Premium Corporate Palette)
const BRAND_GREEN = '#2d7a2e';
const BRAND_GREEN_LIGHT = '#3d8b3e';
const BRAND_GREEN_DARK = '#1f5620';
const BRAND_GREEN_SOFT = '#e8f5e9'; // Subtle green tint for backgrounds

// Premium Typography Colors
const TEXT_DARK = '#1a1a2e';       // Deeper, more refined dark
const TEXT_SECONDARY = '#4a5568';  // Softer secondary text
const TEXT_MUTED = '#718096';      // Muted for tertiary info
const TEXT_LIGHT = '#a0aec0';      // Light accents

// Premium Background & Border
const BG_WHITE = '#ffffff';
const BG_SUBTLE = '#f8fafc';       // Very subtle gray
const BG_LIGHT = '#f1f5f9';        // Light section backgrounds
const BORDER_LIGHT = '#e2e8f0';    // Refined borders
const BORDER_SUBTLE = '#edf2f7';   // Very subtle dividers

// Status Colors (refined)
const RED = '#dc2626';
const RED_SOFT = '#fef2f2';
const AMBER = '#d97706';
const AMBER_SOFT = '#fffbeb';
const GREEN_STATUS = '#059669';
const GREEN_STATUS_SOFT = '#ecfdf5';

// Shadows
const SHADOW_SM = '0 1px 2px rgba(0,0,0,0.04)';
const SHADOW_MD = '0 2px 8px rgba(0,0,0,0.06)';
const SHADOW_LG = '0 4px 12px rgba(0,0,0,0.08)';

// Fuel Level Box Colors (Blue theme to differentiate from green usage)
const FUEL_BOX_BG = '#e8f4fd';       // Subtle blue tint
const FUEL_BOX_HEADER = '#2563eb';   // Blue-600
const FUEL_BOX_VALUE = '#1e40af';    // Blue-800

export interface AgBotLocationV2 {
  location_id: string;
  asset_id?: string | null; // Asset UUID for querying readings history
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

    // Handle future timestamps (timezone issues) - treat as just now
    if (diffMs < 0) {
      return 'Just now';
    }

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
 * Get color for comparison percentage (red = more usage, green = less)
 */
function getComparisonColor(pct: number): string {
  if (pct > 5) return RED;           // Using more fuel (warning)
  if (pct < -5) return GREEN_STATUS; // Using less fuel (good)
  return TEXT_MUTED;                  // Stable
}

/**
 * Get background color for comparison badge
 */
function getComparisonBgColor(pct: number): string {
  if (pct > 5) return RED_SOFT;     // Light red
  if (pct < -5) return GREEN_STATUS_SOFT; // Light green
  return BG_SUBTLE;                 // Light gray
}

/**
 * Get border color for comparison badge
 */
function getComparisonBorderColor(pct: number): string {
  if (pct > 5) return '#fecaca';   // Red border
  if (pct < -5) return '#bbf7d0';  // Green border
  return BORDER_LIGHT;              // Gray border
}

/**
 * Format comparison percentage with sign
 */
function formatComparison(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
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

  // Total current fuel level across all tanks
  const totalCurrentLitres = locations.reduce(
    (sum, l) => sum + (l.asset_reported_litres || 0),
    0
  );

  // Average fill percentage
  const avgFillPct = totalTanks > 0
    ? locations.reduce((sum, l) => sum + l.latest_calibrated_fill_percentage, 0) / totalTanks
    : 0;

  // Total refill capacity available
  const totalRefillCapacity = locations.reduce(
    (sum, l) => sum + (l.asset_refill_capacity_litres || 0),
    0
  );

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

  // Logo section - Premium styling
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Great Southern Fuels" style="height: 56px; margin-bottom: 8px; filter: brightness(1.05);" />`
    : `<div style="display: inline-block; margin-bottom: 8px;">
         <p style="color: white; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 1.5px; text-transform: uppercase;">Great Southern Fuels</p>
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

            // Capacity display values
            const capacityLitres = location.asset_profile_water_capacity || 0;
            const currentLitres =
              location.asset_reported_litres ||
              (location.latest_calibrated_fill_percentage / 100) * capacityLitres;

            // Check if we have meaningful analytics data
            const hasValidAnalytics = analytics &&
              (analytics.consumption_24h_litres > 0 || analytics.consumption_7d_litres > 0);

            // 24hr consumption with comparison badges - Premium styling (only show if we have data)
            const consumption24hHtml = hasValidAnalytics
              ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background-color: ${BRAND_GREEN_SOFT}; border-radius: 8px; overflow: hidden;">
                   <tr>
                     <td style="padding: 16px;">
                       <!-- Header -->
                       <p style="font-size: 11px; color: ${BRAND_GREEN}; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">
                         24-Hour Usage
                       </p>

                       <!-- Value -->
                       <p style="font-size: 22px; font-weight: 700; color: ${BRAND_GREEN_DARK}; margin: 0 0 12px 0; line-height: 1;">
                         ${formatNumber(analytics.consumption_24h_litres)} L
                         <span style="font-size: 13px; font-weight: 400; color: ${TEXT_MUTED};">
                           (${analytics.consumption_24h_pct.toFixed(1)}%)
                         </span>
                       </p>

                       <!-- Comparison Badges -->
                       <table width="100%" cellpadding="0" cellspacing="0">
                         <tr>
                           <td style="width: 48%; padding: 8px 12px; background: ${BG_WHITE}; border-radius: 6px;">
                             <p style="font-size: 10px; color: ${TEXT_MUTED}; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.4px;">vs Yesterday</p>
                             <p style="font-size: 15px; font-weight: 600; color: ${getComparisonColor(analytics.vs_yesterday_pct)}; margin: 0;">
                               ${formatComparison(analytics.vs_yesterday_pct)}
                             </p>
                           </td>
                           <td width="4%"></td>
                           <td style="width: 48%; padding: 8px 12px; background: ${BG_WHITE}; border-radius: 6px;">
                             <p style="font-size: 10px; color: ${TEXT_MUTED}; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.4px;">vs 7-Day Avg</p>
                             <p style="font-size: 15px; font-weight: 600; color: ${getComparisonColor(analytics.vs_7d_avg_pct)}; margin: 0;">
                               ${formatComparison(analytics.vs_7d_avg_pct)}
                             </p>
                           </td>
                         </tr>
                       </table>
                     </td>
                   </tr>
                 </table>`
              : '';

            // Weekly data (for weekly/monthly reports) - only show if we have valid data
            const weeklyDataHtml =
              hasValidAnalytics && showCharts
                ? `<p style="font-size: 12px; color: ${TEXT_SECONDARY}; margin: 5px 0;">
                     7-day usage: ${formatNumber(analytics.consumption_7d_litres)} L (${analytics.consumption_7d_pct.toFixed(1)}%)
                   </p>
                   <img src="${generateSparklineUrl(analytics.sparkline_7d, BRAND_GREEN)}" alt="7-day trend" style="margin: 5px 0;" />`
                : hasValidAnalytics
                ? `<p style="font-size: 12px; color: ${TEXT_SECONDARY}; margin: 5px 0; font-style: italic;">
                     Avg daily: ~${formatNumber(analytics.daily_avg_consumption_litres)} L/day
                   </p>`
                : '';

            // Days remaining with refill date
            let daysRemainingText = '';
            // Use asset_days_remaining from location if analytics days_remaining not available
            const daysRemaining = analytics?.days_remaining ?? location.asset_days_remaining;
            if (daysRemaining !== null && daysRemaining !== undefined) {
              const days = Math.round(daysRemaining);
              if (days === 0) {
                daysRemainingText = '⚠️ Running low';
              } else if (days === 1) {
                daysRemainingText = '~1 day left';
              } else if (days > 365) {
                daysRemainingText = 'Plenty of fuel';
              } else {
                daysRemainingText = `~${days} days left`;
                if (analytics?.estimated_refill_date) {
                  const refillDate = new Date(analytics.estimated_refill_date);
                  daysRemainingText += ` (refill ~${refillDate.toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                  })})`;
                }
              }
            } else {
              // Only show "pending" if we don't have consumption data either
              daysRemainingText = hasValidAnalytics ? '' : '';
            }

            // Refill capacity
            const refillHtml =
              location.asset_refill_capacity_litres && location.asset_refill_capacity_litres > 0
                ? `<p style="font-size: 12px; color: ${TEXT_SECONDARY}; margin: 5px 0;">
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

            // Fill percentage for display
            const fillPct = location.latest_calibrated_fill_percentage || 0;

            return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px; background-color: ${BG_WHITE}; border-radius: 10px; border: 1px solid ${BORDER_LIGHT}; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <!-- Tank Header -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 65%; vertical-align: top;">
                          <p style="font-size: 16px; font-weight: 600; color: ${TEXT_DARK}; margin: 0 0 4px 0; line-height: 1.3;">
                            ${location.address1 || location.location_id}
                          </p>
                          <p style="font-size: 12px; color: ${TEXT_MUTED}; margin: 0;">
                            ${location.device_online ? `<span style="color: ${GREEN_STATUS};">●</span> Online` : `<span style="color: ${TEXT_LIGHT};">●</span> Offline`}${fuelType ? ` · ${fuelType}` : ''}
                          </p>
                        </td>
                        <td style="width: 35%; text-align: right; vertical-align: top;">
                          <p style="font-size: 32px; font-weight: 700; color: ${fuelColor}; margin: 0; line-height: 1;">
                            ${fillPct.toFixed(0)}%
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Current Fuel Level Highlight Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background-color: ${FUEL_BOX_BG}; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 16px;">
                          <!-- Header -->
                          <p style="font-size: 11px; color: ${FUEL_BOX_HEADER}; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">
                            Current Fuel Level
                          </p>

                          <!-- Main Value -->
                          <p style="font-size: 22px; font-weight: 700; color: ${FUEL_BOX_VALUE}; margin: 0 0 4px 0; line-height: 1;">
                            ${formatNumber(currentLitres)} L
                          </p>

                          <!-- Capacity Subtext -->
                          <p style="font-size: 13px; color: ${TEXT_MUTED}; margin: 0 0 12px 0;">
                            of ${formatNumber(capacityLitres)} L capacity
                          </p>

                          <!-- Fuel Bar inside box -->
                          <div style="background-color: rgba(255,255,255,0.7); height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 8px;">
                            <div style="background-color: ${fuelColor}; height: 100%; width: ${Math.min(100, fillPct)}%; border-radius: 5px;"></div>
                          </div>

                          <!-- Fill percentage badge -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <span style="display: inline-block; background-color: ${BG_WHITE}; color: ${fuelColor}; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
                                  ${fillPct.toFixed(0)}% Full
                                </span>
                              </td>
                              <td style="text-align: right;">
                                ${daysRemainingText ? `<span style="font-size: 12px; color: ${TEXT_SECONDARY};">${daysRemainingText}</span>` : ''}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Analytics Section (if available) -->
                    ${consumption24hHtml}
                    ${weeklyDataHtml}
                    ${refillHtml}
                    ${batteryHtml}

                    <!-- Footer -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${BORDER_SUBTLE};">
                      <tr>
                        <td>
                          <p style="font-size: 11px; color: ${TEXT_LIGHT}; margin: 0;">
                            Updated ${formatLastSeen(location.latest_telemetry)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            `;
          })
          .join('');

  // Fleet analytics section (for weekly/monthly) - Premium styling
  const fleetAnalyticsHtml =
    showCharts && tanksAnalytics && tanksAnalytics.length > 0
      ? `
        <tr>
          <td style="padding: 0 40px 28px;">
            <!-- Section Header -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
              <tr>
                <td>
                  <p style="color: ${TEXT_DARK}; font-size: 13px; font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 0.8px;">
                    Fleet Analytics
                  </p>
                </td>
              </tr>
            </table>

            ${
              fleetSummary
                ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_LIGHT}; border-radius: 8px; margin-bottom: 16px;">
              <tr>
                <td style="padding: 16px;">
                  <p style="font-size: 13px; color: ${TEXT_SECONDARY}; margin: 0 0 8px 0;">
                    Fleet trend: <span style="color: ${TEXT_DARK}; font-weight: 600;">${getTrendEmoji(fleetSummary.fleet_trend)} ${fleetSummary.fleet_trend}</span>
                  </p>
                  <p style="font-size: 13px; color: ${TEXT_SECONDARY}; margin: 0;">
                    Top consumer: <span style="color: ${TEXT_DARK}; font-weight: 600;">${fleetSummary.most_consumed_tank}</span> · ${formatNumber(fleetSummary.most_consumed_amount)} L/24h
                  </p>
                </td>
              </tr>
            </table>
            `
                : ''
            }

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <img src="${generateFleetComparisonChartUrl(tanksAnalytics)}" alt="Fleet Comparison" style="max-width: 100%; height: auto; border-radius: 8px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : '';

  // Critical alert section - Premium styling
  const alertSectionHtml =
    criticalTanks > 0
      ? `
        <tr>
          <td style="padding: 0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${RED_SOFT}; border-radius: 8px; border-left: 4px solid ${RED};">
              <tr>
                <td style="padding: 16px 20px;">
                  <p style="color: ${RED}; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">
                    Action Required
                  </p>
                  <p style="color: #7f1d1d; font-size: 13px; line-height: 1.5; margin: 0;">
                    ${criticalTanks} tank${criticalTanks > 1 ? 's' : ''} at critical level${criticalTanks > 1 ? 's' : ''}. Please arrange refilling soon.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : '';

  // Unsubscribe link
  const preferencesLink = unsubscribeUrl || '#';
  const preferencesText =
    unsubscribeUrl && unsubscribeUrl !== '#'
      ? 'Manage email preferences or unsubscribe'
      : 'Email preferences';

  // Check if we have valid fleet consumption data
  const hasFleetData = consumption24h > 0 || consumption7d > 0;

  // Generate complete HTML email - Premium Corporate Design
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${reportTitle} - ${reportDate}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BG_SUBTLE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

      <!-- Email Container -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_SUBTLE};">
        <tr>
          <td align="center" style="padding: 24px 16px;">

            <!-- Main Content Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${BG_WHITE}; border-radius: 12px; overflow: hidden; box-shadow: ${SHADOW_LG};">

              <!-- Premium Header (solid color for Outlook compatibility) -->
              <tr>
                <td style="background-color: ${BRAND_GREEN}; padding: 32px 40px; text-align: center;">
                  ${logoHtml}
                  <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 16px 0 8px 0; letter-spacing: 0.3px;">
                    ${reportTitle}
                  </h1>
                  <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; font-weight: 400;">
                    ${reportDate}
                  </p>
                </td>
              </tr>

              <!-- Greeting Section -->
              <tr>
                <td style="padding: 28px 40px 20px;">
                  <p style="color: ${TEXT_DARK}; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0; font-weight: 500;">
                    Dear ${contactName || customerName},
                  </p>
                  <p style="color: ${TEXT_SECONDARY}; font-size: 14px; line-height: 1.6; margin: 0;">
                    Here's your ${reportFrequency} fuel monitoring summary for <strong style="color: ${TEXT_DARK};">${customerName}</strong>.
                  </p>
                </td>
              </tr>

              <!-- Executive Summary Section -->
              <tr>
                <td style="padding: 0 40px 28px;">

                  <!-- Section Header -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                    <tr>
                      <td>
                        <p style="color: ${TEXT_DARK}; font-size: 13px; font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 0.8px;">
                          Summary
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Metrics Grid - unified dark colors for professionalism -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_LIGHT}; border-radius: 10px; overflow: hidden;">
                    <tr>
                      <!-- Primary Metric - Current Fuel Level -->
                      <td style="width: 50%; padding: 20px; border-right: 1px solid ${BORDER_SUBTLE}; border-bottom: 1px solid ${BORDER_SUBTLE};">
                        <p style="font-size: 11px; color: ${TEXT_MUTED}; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Current Level</p>
                        <p style="font-size: 28px; font-weight: 700; color: ${TEXT_DARK}; margin: 0; line-height: 1;">
                          ${formatNumber(totalCurrentLitres)}
                          <span style="font-size: 14px; font-weight: 500; color: ${TEXT_MUTED};">L</span>
                        </p>
                        <p style="font-size: 12px; color: ${TEXT_MUTED}; margin: 4px 0 0 0;">
                          ${avgFillPct.toFixed(0)}% avg across ${totalTanks} tank${totalTanks !== 1 ? 's' : ''}
                        </p>
                      </td>
                      <!-- 24h Usage -->
                      <td style="width: 50%; padding: 20px; border-bottom: 1px solid ${BORDER_SUBTLE};">
                        <p style="font-size: 11px; color: ${TEXT_MUTED}; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">24h Usage</p>
                        <p style="font-size: 24px; font-weight: 600; color: ${hasFleetData ? TEXT_DARK : TEXT_MUTED}; margin: 0; line-height: 1;">
                          ${hasFleetData ? formatNumber(consumption24h) : '—'}
                          <span style="font-size: 14px; font-weight: 500; color: ${TEXT_MUTED};">${hasFleetData ? 'L' : ''}</span>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <!-- Online Status -->
                      <td style="width: 50%; padding: 16px 20px; border-right: 1px solid ${BORDER_SUBTLE};">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td>
                              <p style="font-size: 11px; color: ${TEXT_MUTED}; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Status</p>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <span style="display: inline-block; background-color: ${GREEN_STATUS_SOFT}; color: ${GREEN_STATUS}; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-right: 6px;">
                                ${onlineTanks} Online
                              </span>
                              ${lowFuelTanks > 0 ? `<span style="display: inline-block; background-color: ${AMBER_SOFT}; color: ${AMBER}; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-right: 6px;">${lowFuelTanks} Low</span>` : ''}
                              ${criticalTanks > 0 ? `<span style="display: inline-block; background-color: ${RED_SOFT}; color: ${RED}; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">${criticalTanks} Critical</span>` : ''}
                            </td>
                          </tr>
                        </table>
                      </td>
                      <!-- Refill Available -->
                      <td style="width: 50%; padding: 16px 20px;">
                        <p style="font-size: 11px; color: ${TEXT_MUTED}; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Refill Available</p>
                        <p style="font-size: 20px; font-weight: 600; color: ${TEXT_DARK}; margin: 0; line-height: 1;">
                          ${formatNumber(totalRefillCapacity)}
                          <span style="font-size: 12px; font-weight: 400; color: ${TEXT_MUTED};">L</span>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Tank Details Section -->
              <tr>
                <td style="padding: 0 40px 28px;">

                  <!-- Section Header -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                    <tr>
                      <td>
                        <p style="color: ${TEXT_DARK}; font-size: 13px; font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 0.8px;">
                          Tank Details
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Tank Cards -->
                  ${tankCardsHtml}
                </td>
              </tr>

              <!-- Fleet Analytics (weekly/monthly only) -->
              ${fleetAnalyticsHtml}

              <!-- Alerts Section -->
              ${alertSectionHtml}

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px 32px; border-top: 1px solid ${BORDER_SUBTLE};">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <p style="color: ${TEXT_MUTED}; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0;">
                          Automated ${reportFrequency} report from your Fuel Monitoring System
                        </p>
                        <p style="color: ${TEXT_DARK}; font-size: 13px; font-weight: 600; margin: 0 0 8px 0;">
                          Powered by Great Southern Fuels
                        </p>
                        <p style="margin: 0;">
                          <a href="mailto:support@greatsouthernfuel.com.au" style="color: ${BRAND_GREEN}; font-size: 12px; text-decoration: none;">support@greatsouthernfuel.com.au</a>
                          <span style="color: ${TEXT_LIGHT}; margin: 0 8px;">|</span>
                          <a href="${preferencesLink}" style="color: ${TEXT_MUTED}; font-size: 12px; text-decoration: none;">${preferencesText}</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
            <!-- End Main Content Card -->

          </td>
        </tr>
      </table>
      <!-- End Email Container -->

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

  // Total current fuel level across all tanks
  const totalCurrentLitres = locations.reduce(
    (sum, l) => sum + (l.asset_reported_litres || 0),
    0
  );

  // Average fill percentage
  const avgFillPct = totalTanks > 0
    ? locations.reduce((sum, l) => sum + l.latest_calibrated_fill_percentage, 0) / totalTanks
    : 0;

  // Total refill capacity available
  const totalRefillCapacity = locations.reduce(
    (sum, l) => sum + (l.asset_refill_capacity_litres || 0),
    0
  );

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
              ? `\n     24h usage: ${formatNumber(analytics.consumption_24h_litres)} L ${analytics.trend_indicator} (${analytics.consumption_24h_pct.toFixed(1)}%)
       vs Yesterday: ${formatComparison(analytics.vs_yesterday_pct)}
       vs 7-Day Avg: ${formatComparison(analytics.vs_7d_avg_pct)}`
              : '';

            const sparkline = analytics ? `\n     7d trend: ${generateAsciiSparkline(analytics.sparkline_7d)}` : '';

            const urgency = isCritical ? ' [CRITICAL]' : '';

            return `
${index + 1}. ${location.address1 || location.location_id}${urgency}
   ┌─ CURRENT FUEL LEVEL ─────────────────────
   │  ${formatNumber(currentLitres)} L (${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}% full)
   │  of ${formatNumber(capacityLitres)} L capacity
   │  ${daysText}
   └──────────────────────────────────────────
   Status: ${status}${consumption24hText}${sparkline}
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

Dear ${contactName || customerName},

Please find your ${reportFrequency} fuel monitoring report for ${customerName} below.

----------------------------------------
SUMMARY AT A GLANCE
----------------------------------------
Current Level:   ${formatNumber(totalCurrentLitres)} L (${avgFillPct.toFixed(0)}% avg)
24h Fuel Usage:  ${formatNumber(consumption24h)} L
Refill Available: ${formatNumber(totalRefillCapacity)} L
Total Tanks:     ${totalTanks} (${onlineTanks} online)
Low Fuel (<30%): ${lowFuelTanks}
Critical:        ${criticalTanks}

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
