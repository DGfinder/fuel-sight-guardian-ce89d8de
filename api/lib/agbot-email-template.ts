/**
 * AgBot Daily Report Email Template - Plain HTML
 * Generates email HTML without React/JSX for serverless compatibility
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
}

export interface AgBotEmailData {
  customerName: string;
  contactName?: string;
  locations: AgBotLocation[];
  reportDate: string;
}

export function generateAgBotEmailHtml(data: AgBotEmailData): string {
  const { customerName, contactName, locations, reportDate } = data;

  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter(l => l.device_online).length;
  const lowFuelTanks = locations.filter(l => l.latest_calibrated_fill_percentage < 30).length;
  const criticalTanks = locations.filter(
    l => l.latest_calibrated_fill_percentage < 15 || (l.asset_days_remaining !== null && l.asset_days_remaining <= 3)
  ).length;
  const avgFuelLevel = locations.length > 0
    ? Math.round(locations.reduce((sum, l) => sum + (l.latest_calibrated_fill_percentage || 0), 0) / locations.length)
    : 0;

  // Sort locations by fuel level (lowest first)
  const sortedLocations = [...locations].sort((a, b) =>
    a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage
  );

  // Generate tank cards HTML
  const tankCardsHtml = sortedLocations.length === 0
    ? '<p style="color: #4b5563; font-size: 15px; line-height: 24px; margin: 0 0 10px 0;">No AgBot locations found for your account.</p>'
    : sortedLocations.map(location => {
        const isCritical = location.latest_calibrated_fill_percentage < 15 ||
                          (location.asset_days_remaining !== null && location.asset_days_remaining <= 3);
        const isLow = location.latest_calibrated_fill_percentage < 30 && !isCritical;
        const fuelColor = isCritical ? '#dc2626' : isLow ? '#d97706' : '#059669';
        const statusEmoji = isCritical ? '🚨 ' : isLow ? '⚠️ ' : '';
        const onlineStatus = location.device_online ? '🟢 Online' : '🔴 Offline';
        const capacity = location.asset_profile_water_capacity
          ? `${(location.asset_profile_water_capacity / 1000).toFixed(0)}k L capacity`
          : 'Capacity unknown';
        const daysRemainingText = location.asset_days_remaining !== null && location.asset_days_remaining >= 0
          ? `${Math.round(location.asset_days_remaining)} days left`
          : 'Usage data unavailable';
        const consumptionHtml = location.asset_daily_consumption && location.asset_daily_consumption > 0
          ? `<p style="font-size: 12px; color: #6b7280; margin: 10px 0 0 0; font-style: italic;">Daily usage: ${Math.round(location.asset_daily_consumption)} L/day</p>`
          : '';

        return `
          <div style="padding: 15px; margin-bottom: 12px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 70%;">
                  <p style="font-size: 16px; font-weight: bold; color: #1f2937; margin: 0 0 5px 0;">
                    ${statusEmoji}${location.address1 || location.location_id}
                  </p>
                  <p style="font-size: 13px; color: #6b7280; margin: 0;">
                    ${onlineStatus} • ${capacity}
                  </p>
                </td>
                <td style="width: 30%; text-align: right;">
                  <p style="font-size: 24px; font-weight: bold; color: ${fuelColor}; margin: 0; line-height: 1;">
                    ${location.latest_calibrated_fill_percentage?.toFixed(0) || 0}%
                  </p>
                  <p style="font-size: 12px; color: #6b7280; margin: 3px 0 0 0;">
                    ${daysRemainingText}
                  </p>
                </td>
              </tr>
            </table>
            ${consumptionHtml}
          </div>
        `;
      }).join('');

  // Generate critical alert section if needed
  const alertSectionHtml = criticalTanks > 0 ? `
    <div style="padding: 15px 40px; background-color: #fef2f2; border-left: 4px solid #dc2626; margin: 20px 40px;">
      <h3 style="color: #dc2626; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
        ⚠️ Immediate Attention Required
      </h3>
      <p style="color: #991b1b; font-size: 14px; line-height: 20px; margin: 0;">
        You have <strong>${criticalTanks}</strong> tank(s) in critical condition that need immediate refilling to avoid running out of fuel.
      </p>
    </div>
  ` : '';

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
            <a href="#" style="color: #0ea5e9; text-decoration: underline;">Manage email preferences</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `.trim();
}
