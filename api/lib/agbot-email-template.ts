/**
 * AgBot Daily Report Email Template - Plain HTML
 * Generates email HTML without React/JSX for serverless compatibility
 * Includes plain text version for better deliverability
 */

export interface AgBotLocation {
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

export interface AgBotEmailData {
  customerName: string;
  contactName?: string;
  locations: AgBotLocation[];
  reportDate: string;
  unsubscribeUrl?: string;
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
 * Generate both HTML and plain text versions of the AgBot email
 */
export function generateAgBotEmail(data: AgBotEmailData): AgBotEmailResult {
  const html = generateAgBotEmailHtml(data);
  const text = generateAgBotEmailText(data);

  return { html, text };
}

/**
 * Generate HTML version of email
 */
export function generateAgBotEmailHtml(data: AgBotEmailData): string {
  const { customerName, contactName, locations, reportDate, unsubscribeUrl } = data;

  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter((l) => l.device_online).length;
  const lowFuelTanks = locations.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
  const criticalTanks = locations.filter(
    (l) =>
      l.latest_calibrated_fill_percentage < 15 ||
      (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
  ).length;
  const avgFuelLevel =
    locations.length > 0
      ? Math.round(
          locations.reduce((sum, l) => sum + (l.latest_calibrated_fill_percentage || 0), 0) /
            locations.length
        )
      : 0;

  // Sort locations by fuel level (lowest first)
  const sortedLocations = [...locations].sort(
    (a, b) => a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage
  );

  // Generate tank cards HTML
  const tankCardsHtml =
    sortedLocations.length === 0
      ? '<p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">No AgBot locations found for your account.</p>'
      : sortedLocations
          .map((location) => {
            const isCritical =
              location.latest_calibrated_fill_percentage < 15 ||
              (location.asset_days_remaining !== null && location.asset_days_remaining <= 3);
            const isLow = location.latest_calibrated_fill_percentage < 30 && !isCritical;
            const fuelColor = isCritical ? '#dc2626' : isLow ? '#d97706' : '#059669';

            // Online status with last seen
            const onlineStatus = location.device_online
              ? '🟢 Online'
              : `🔴 Offline (${formatLastSeen(location.latest_telemetry)})`;

            // Capacity and litres display
            let capacityText = '';
            if (location.asset_profile_water_capacity) {
              const capacityLitres = location.asset_profile_water_capacity;
              const currentLitres =
                location.asset_reported_litres ||
                (location.latest_calibrated_fill_percentage / 100) * capacityLitres;
              capacityText = `${Math.round(currentLitres).toLocaleString()} L of ${(
                capacityLitres / 1000
              ).toFixed(0)}k L`;
            } else if (location.asset_reported_litres) {
              capacityText = `${Math.round(location.asset_reported_litres).toLocaleString()} L remaining`;
            } else {
              capacityText = 'Capacity pending';
            }

            // Fuel type
            const fuelType = location.asset_profile_commodity || '';
            const fuelTypeHtml = fuelType
              ? `<span style="color: #9ca3af;"> • ${fuelType}</span>`
              : '';

            // Days remaining with better messaging
            let daysRemainingText = '';
            if (location.asset_days_remaining !== null && location.asset_days_remaining >= 0) {
              const days = Math.round(location.asset_days_remaining);
              if (days === 0) {
                daysRemainingText = 'Running low';
              } else if (days === 1) {
                daysRemainingText = '~1 day left';
              } else if (days > 365) {
                daysRemainingText = 'Plenty of fuel';
              } else {
                daysRemainingText = `~${days} days left`;
              }
            } else if (location.asset_daily_consumption && location.asset_daily_consumption > 0) {
              daysRemainingText = 'Calculating forecast...';
            } else {
              daysRemainingText = 'Usage data pending';
            }

            // Consumption display
            const consumptionHtml =
              location.asset_daily_consumption && location.asset_daily_consumption > 0
                ? `<p style="font-size: 12px; color: #6b7280; margin: 10px 0 0 0; font-style: italic;">Daily usage: ~${Math.round(
                    location.asset_daily_consumption
                  ).toLocaleString()} L/day</p>`
                : '';

            // Refill capacity
            const refillHtml =
              location.asset_refill_capacity_litres && location.asset_refill_capacity_litres > 0
                ? `<p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">Needs ~${Math.round(
                    location.asset_refill_capacity_litres
                  ).toLocaleString()} L to refill</p>`
                : '';

            // Battery warning
            const batteryHtml =
              location.device_battery_voltage && location.device_battery_voltage < 3.5
                ? `<p style="font-size: 11px; color: #d97706; margin: 5px 0 0 0; background: #fef3c7; padding: 4px 8px; border-radius: 3px; display: inline-block;">⚠️ Low battery: ${location.device_battery_voltage.toFixed(
                    1
                  )}V</p>`
                : '';

            // Data freshness
            const lastUpdate = formatLastSeen(location.latest_telemetry);
            const freshnessHtml = `<p style="font-size: 11px; color: #9ca3af; margin: 5px 0 0 0;">Updated ${lastUpdate}</p>`;

            return `
          <div style="padding: 15px; margin-bottom: 12px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 65%;">
                  <p style="font-size: 16px; font-weight: bold; color: #1f2937; margin: 0 0 5px 0;">
                    ${location.address1 || location.location_id}
                  </p>
                  <p style="font-size: 13px; color: #6b7280; margin: 0;">
                    ${onlineStatus}${fuelTypeHtml}
                  </p>
                  <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">
                    ${capacityText}
                  </p>
                </td>
                <td style="width: 35%; text-align: right; vertical-align: top;">
                  <p style="font-size: 28px; font-weight: bold; color: ${fuelColor}; margin: 0; line-height: 1;">
                    ${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}%
                  </p>
                  <p style="font-size: 12px; color: #6b7280; margin: 3px 0 0 0;">
                    ${daysRemainingText}
                  </p>
                </td>
              </tr>
            </table>
            ${consumptionHtml}
            ${refillHtml}
            ${batteryHtml}
            ${freshnessHtml}
          </div>
        `;
          })
          .join('');

  // Generate critical alert section if needed (reduced urgency tone)
  const alertSectionHtml = criticalTanks > 0 ? `
    <div style="padding: 15px 40px; background-color: #fef2f2; border-left: 4px solid #dc2626; margin: 20px 40px;">
      <h3 style="color: #dc2626; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
        Action Required - Low Fuel Alert
      </h3>
      <p style="color: #991b1b; font-size: 14px; line-height: 20px; margin: 0;">
        You have <strong>${criticalTanks}</strong> tank${
    criticalTanks > 1 ? 's' : ''
  } at critical levels. Please arrange refilling soon to avoid running out.
      </p>
    </div>
  ` : '';

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
      <title>AgBot Daily Report - ${reportDate}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0; max-width: 600px;">

        <!-- Header -->
        <div style="background-color: #0ea5e9; padding: 30px 40px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0 0 10px 0;">
            AgBot Daily Report
          </h1>
          <p style="color: #e0f2fe; font-size: 14px; margin: 0;">
            ${reportDate}
          </p>
        </div>

        <!-- Greeting -->
        <div style="padding: 20px 40px;">
          <p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">
            Hello ${contactName || customerName},
          </p>
          <p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">
            Here's your daily summary of all AgBot-monitored fuel tanks for <strong>${customerName}</strong>.
          </p>
        </div>

        <!-- Summary Stats -->
        <div style="padding: 20px 40px; background-color: #f9fafb;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">
            Summary Overview
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
            <tr>
              <td style="text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; margin: 0 5px; border: 1px solid #e5e7eb;">
                <p style="font-size: 32px; font-weight: bold; color: #0ea5e9; margin: 0; line-height: 1;">${totalTanks}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Tanks</p>
              </td>
              <td width="5%"></td>
              <td style="text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; margin: 0 5px; border: 1px solid #e5e7eb;">
                <p style="font-size: 32px; font-weight: bold; color: #0ea5e9; margin: 0; line-height: 1;">${avgFuelLevel}%</p>
                <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Avg Fuel Level</p>
              </td>
              <td width="5%"></td>
              <td style="text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; margin: 0 5px; border: 1px solid #e5e7eb;">
                <p style="font-size: 32px; font-weight: bold; color: #0ea5e9; margin: 0; line-height: 1;">${onlineTanks}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Online</p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
            <tr>
              <td width="48%" style="text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; margin: 0 5px; border: 1px solid #e5e7eb;">
                <p style="font-size: 32px; font-weight: bold; color: #d97706; margin: 0; line-height: 1;">${lowFuelTanks}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Low Fuel (&lt;30%)</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="text-align: center; padding: 15px; background-color: #ffffff; border-radius: 8px; margin: 0 5px; border: 1px solid #e5e7eb;">
                <p style="font-size: 32px; font-weight: bold; color: #dc2626; margin: 0; line-height: 1;">${criticalTanks}</p>
                <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Critical</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Tank Details -->
        <div style="padding: 20px 40px;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0 0 15px 0;">
            Tank Status Details
          </h2>
          ${tankCardsHtml}
        </div>

        <!-- Alerts Section -->
        ${alertSectionHtml}

        <!-- Footer -->
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <div style="padding: 0 40px 30px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; line-height: 18px; margin: 5px 0;">
            This is an automated daily report from your AgBot Fuel Monitoring System.
          </p>
          <p style="color: #9ca3af; font-size: 12px; line-height: 18px; margin: 5px 0;">
            For support, contact Great Southern Fuel Supplies at
            <a href="mailto:support@greatsouthernfuel.com.au" style="color: #0ea5e9; text-decoration: underline;">support@greatsouthernfuel.com.au</a>
          </p>
          <p style="color: #9ca3af; font-size: 12px; line-height: 18px; margin: 5px 0;">
            <a href="${preferencesLink}" style="color: #0ea5e9; text-decoration: underline;">${preferencesText}</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `.trim();
}

/**
 * Generate plain text version of email
 */
export function generateAgBotEmailText(data: AgBotEmailData): string {
  const { customerName, contactName, locations, reportDate, unsubscribeUrl } = data;

  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter((l) => l.device_online).length;
  const lowFuelTanks = locations.filter((l) => l.latest_calibrated_fill_percentage < 30).length;
  const criticalTanks = locations.filter(
    (l) =>
      l.latest_calibrated_fill_percentage < 15 ||
      (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
  ).length;
  const avgFuelLevel =
    locations.length > 0
      ? Math.round(
          locations.reduce((sum, l) => sum + (l.latest_calibrated_fill_percentage || 0), 0) /
            locations.length
        )
      : 0;

  // Sort locations by fuel level (lowest first)
  const sortedLocations = [...locations].sort(
    (a, b) => a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage
  );

  // Generate tank details text
  const tankDetailsText =
    sortedLocations.length === 0
      ? 'No AgBot locations found for your account.'
      : sortedLocations
          .map((location, index) => {
            const isCritical =
              location.latest_calibrated_fill_percentage < 15 ||
              (location.asset_days_remaining !== null && location.asset_days_remaining <= 3);

            const status = location.device_online
              ? 'Online'
              : `Offline (${formatLastSeen(location.latest_telemetry)})`;

            let capacity = '';
            if (location.asset_profile_water_capacity) {
              const capacityLitres = location.asset_profile_water_capacity;
              const currentLitres =
                location.asset_reported_litres ||
                (location.latest_calibrated_fill_percentage / 100) * capacityLitres;
              capacity = `${Math.round(currentLitres).toLocaleString()} L of ${(
                capacityLitres / 1000
              ).toFixed(0)}k L`;
            } else if (location.asset_reported_litres) {
              capacity = `${Math.round(location.asset_reported_litres).toLocaleString()} L remaining`;
            } else {
              capacity = 'Capacity pending';
            }

            const daysText =
              location.asset_days_remaining !== null && location.asset_days_remaining >= 0
                ? `~${Math.round(location.asset_days_remaining)} days left`
                : 'Usage data pending';

            const consumptionText =
              location.asset_daily_consumption && location.asset_daily_consumption > 0
                ? `\n     Daily usage: ~${Math.round(location.asset_daily_consumption).toLocaleString()} L/day`
                : '';

            const urgency = isCritical ? ' [CRITICAL]' : '';

            return `
${index + 1}. ${location.address1 || location.location_id}${urgency}
   Fuel Level: ${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}% (${daysText})
   Status: ${status}
   Capacity: ${capacity}${consumptionText}
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

  // Unsubscribe text
  const unsubscribeText = unsubscribeUrl
    ? `\nTo manage your email preferences or unsubscribe, visit:\n${unsubscribeUrl}`
    : '';

  // Generate complete plain text email
  return `
========================================
AGBOT DAILY REPORT
${reportDate}
========================================

Hello ${contactName || customerName},

Here's your daily summary of all AgBot-monitored fuel tanks for ${customerName}.

----------------------------------------
SUMMARY OVERVIEW
----------------------------------------
Total Tanks:     ${totalTanks}
Average Level:   ${avgFuelLevel}%
Online:          ${onlineTanks}
Low Fuel (<30%): ${lowFuelTanks}
Critical:        ${criticalTanks}

----------------------------------------
TANK STATUS DETAILS
----------------------------------------
${tankDetailsText}
${alertText}
----------------------------------------

This is an automated daily report from your AgBot Fuel Monitoring System.

For support, contact Great Southern Fuel Supplies at:
support@greatsouthernfuel.com.au
${unsubscribeText}

========================================
  `.trim();
}
