/**
 * AgBot Daily Report Email Template
 * Sends a summary of all AgBot tank statuses to customers
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column
} from '@react-email/components';
import * as React from 'react';

export interface AgBotLocation {
  location_id: string;
  address1: string;
  latest_calibrated_fill_percentage: number;
  asset_profile_water_capacity: number;
  asset_daily_consumption: number;
  asset_days_remaining: number;
  device_online: boolean;
  latest_telemetry: string;
}

export interface AgBotDailyReportProps {
  customerName: string;
  contactName?: string;
  locations: AgBotLocation[];
  reportDate: string;
}

export const AgBotDailyReport = ({
  customerName = 'Customer',
  contactName,
  locations = [],
  reportDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}: AgBotDailyReportProps) => {
  // Calculate summary statistics
  const totalTanks = locations.length;
  const onlineTanks = locations.filter((l) => l.device_online).length;
  const lowFuelTanks = locations.filter(
    (l) => l.latest_calibrated_fill_percentage < 30
  ).length;
  const criticalTanks = locations.filter(
    (l) => l.latest_calibrated_fill_percentage < 15 || l.asset_days_remaining <= 3
  ).length;
  const avgFuelLevel =
    locations.length > 0
      ? Math.round(
          locations.reduce((sum, l) => sum + (l.latest_calibrated_fill_percentage || 0), 0) /
            locations.length
        )
      : 0;

  return (
    <Html>
      <Head />
      <Preview>Daily AgBot Report - {reportDate}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>AgBot Daily Report</Heading>
            <Text style={dateText}>{reportDate}</Text>
          </Section>

          {/* Greeting */}
          <Section style={section}>
            <Text style={text}>
              Hello {contactName || customerName},
            </Text>
            <Text style={text}>
              Here's your daily summary of all AgBot-monitored fuel tanks for{' '}
              <strong>{customerName}</strong>.
            </Text>
          </Section>

          {/* Summary Stats */}
          <Section style={statsSection}>
            <Heading as="h2" style={h2}>
              Summary Overview
            </Heading>
            <Row style={statsRow}>
              <Column style={statCard}>
                <Text style={statNumber}>{totalTanks}</Text>
                <Text style={statLabel}>Total Tanks</Text>
              </Column>
              <Column style={statCard}>
                <Text style={statNumber}>{avgFuelLevel}%</Text>
                <Text style={statLabel}>Avg Fuel Level</Text>
              </Column>
              <Column style={statCard}>
                <Text style={statNumber}>{onlineTanks}</Text>
                <Text style={statLabel}>Online</Text>
              </Column>
            </Row>
            <Row style={statsRow}>
              <Column style={statCard}>
                <Text style={{ ...statNumber, color: '#d97706' }}>{lowFuelTanks}</Text>
                <Text style={statLabel}>Low Fuel (&lt;30%)</Text>
              </Column>
              <Column style={statCard}>
                <Text style={{ ...statNumber, color: '#dc2626' }}>{criticalTanks}</Text>
                <Text style={statLabel}>Critical</Text>
              </Column>
            </Row>
          </Section>

          {/* Tank Details */}
          <Section style={section}>
            <Heading as="h2" style={h2}>
              Tank Status Details
            </Heading>
            {locations.length === 0 ? (
              <Text style={text}>No AgBot locations found for your account.</Text>
            ) : (
              locations
                .sort((a, b) => a.latest_calibrated_fill_percentage - b.latest_calibrated_fill_percentage)
                .map((location, index) => {
                  const isCritical =
                    location.latest_calibrated_fill_percentage < 15 ||
                    location.asset_days_remaining <= 3;
                  const isLow = location.latest_calibrated_fill_percentage < 30 && !isCritical;

                  return (
                    <div key={index} style={tankCard}>
                      <Row>
                        <Column style={{ width: '70%' }}>
                          <Text style={tankName}>
                            {isCritical && '🚨 '}
                            {isLow && '⚠️ '}
                            {location.address1 || location.location_id}
                          </Text>
                          <Text style={tankStatus}>
                            {location.device_online ? '🟢 Online' : '🔴 Offline'}
                            {' • '}
                            {location.asset_profile_water_capacity
                              ? `${(location.asset_profile_water_capacity / 1000).toFixed(0)}k L capacity`
                              : 'Capacity unknown'}
                          </Text>
                        </Column>
                        <Column style={{ width: '30%', textAlign: 'right' as const }}>
                          <Text
                            style={{
                              ...fuelLevel,
                              color: isCritical ? '#dc2626' : isLow ? '#d97706' : '#059669'
                            }}
                          >
                            {location.latest_calibrated_fill_percentage?.toFixed(0) || 0}%
                          </Text>
                          <Text style={daysRemaining}>
                            {location.asset_days_remaining !== null &&
                            location.asset_days_remaining >= 0
                              ? `${Math.round(location.asset_days_remaining)} days left`
                              : 'Usage data unavailable'}
                          </Text>
                        </Column>
                      </Row>
                      {location.asset_daily_consumption > 0 && (
                        <Text style={consumption}>
                          Daily usage: {Math.round(location.asset_daily_consumption)} L/day
                        </Text>
                      )}
                    </div>
                  );
                })
            )}
          </Section>

          {/* Alerts Section (if any critical tanks) */}
          {criticalTanks > 0 && (
            <Section style={alertSection}>
              <Heading as="h3" style={h3}>
                ⚠️ Immediate Attention Required
              </Heading>
              <Text style={alertText}>
                You have <strong>{criticalTanks}</strong> tank(s) in critical condition that need
                immediate refilling to avoid running out of fuel.
              </Text>
            </Section>
          )}

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated daily report from your AgBot Fuel Monitoring System.
            </Text>
            <Text style={footerText}>
              For support, contact Great Southern Fuel Supplies at{' '}
              <a href="mailto:support@greatsouthernfuel.com.au" style={link}>
                support@greatsouthernfuel.com.au
              </a>
            </Text>
            <Text style={footerText}>
              <a href="#" style={link}>
                Manage email preferences
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default AgBotDailyReport;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px'
};

const header = {
  backgroundColor: '#0ea5e9',
  padding: '30px 40px',
  textAlign: 'center' as const
};

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 10px 0'
};

const h2 = {
  color: '#1f2937',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 15px 0'
};

const h3 = {
  color: '#dc2626',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 10px 0'
};

const dateText = {
  color: '#e0f2fe',
  fontSize: '14px',
  margin: '0'
};

const section = {
  padding: '20px 40px'
};

const text = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 10px 0'
};

const statsSection = {
  padding: '20px 40px',
  backgroundColor: '#f9fafb'
};

const statsRow = {
  marginBottom: '10px'
};

const statCard = {
  textAlign: 'center' as const,
  padding: '15px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 5px',
  border: '1px solid #e5e7eb'
};

const statNumber = {
  fontSize: '32px',
  fontWeight: 'bold',
  color: '#0ea5e9',
  margin: '0',
  lineHeight: '1'
};

const statLabel = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '5px 0 0 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
};

const tankCard = {
  padding: '15px',
  marginBottom: '12px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  border: '1px solid #e5e7eb'
};

const tankName = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 5px 0'
};

const tankStatus = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0'
};

const fuelLevel = {
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1'
};

const daysRemaining = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '3px 0 0 0'
};

const consumption = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '10px 0 0 0',
  fontStyle: 'italic' as const
};

const alertSection = {
  padding: '15px 40px',
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #dc2626',
  margin: '20px 40px'
};

const alertText = {
  color: '#991b1b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0'
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0'
};

const footer = {
  padding: '0 40px 30px',
  textAlign: 'center' as const
};

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '5px 0'
};

const link = {
  color: '#0ea5e9',
  textDecoration: 'underline'
};
