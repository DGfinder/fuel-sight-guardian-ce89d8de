#!/usr/bin/env node

/**
 * Guardian Import Validation Script
 * 
 * Validates Guardian data after import to check for data quality issues
 * Usage: node scripts/validate-guardian-import.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Guardian Import Validation Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Run comprehensive validation checks on Guardian data
 */
async function validateImport() {
  try {
    console.log('📊 Fetching Guardian events data...');
    
    const { data: events, error } = await supabase
      .from('guardian_events')
      .select('*')
      .order('detection_time', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch Guardian events: ${error.message}`);
    }
    
    if (!events || events.length === 0) {
      console.log('⚠️  No Guardian events found in database');
      return;
    }
    
    console.log(`📈 Total Guardian events: ${events.length.toLocaleString()}`);
    console.log('');
    
    // 1. Date Range Analysis
    console.log('📅 Date Range Analysis:');
    const dates = events.map(e => new Date(e.detection_time));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    console.log(`   Earliest event: ${minDate.toISOString().substring(0, 10)} (${minDate.toLocaleDateString()})`);
    console.log(`   Latest event: ${maxDate.toISOString().substring(0, 10)} (${maxDate.toLocaleDateString()})`);
    
    // Check for future dates
    const today = new Date();
    const futureEvents = events.filter(e => new Date(e.detection_time) > today);
    if (futureEvents.length > 0) {
      console.log(`   ⚠️  ${futureEvents.length} future events found!`);
      futureEvents.slice(0, 5).forEach(event => {
        console.log(`      ${event.external_event_id}: ${event.detection_time}`);
      });
    } else {
      console.log(`   ✅ No future events detected`);
    }
    console.log('');
    
    // 2. Monthly Distribution Analysis
    console.log('📅 Monthly Distribution Analysis:');
    const monthlyGroups = {};
    events.forEach(event => {
      const month = new Date(event.detection_time).toISOString().substring(0, 7); // YYYY-MM
      monthlyGroups[month] = (monthlyGroups[month] || 0) + 1;
    });
    
    const monthlyData = Object.entries(monthlyGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
    
    console.log('   Month        Events    Change');
    console.log('   ─────────────────────────────');
    
    let previousCount = 0;
    let suspiciousMonths = [];
    
    monthlyData.forEach(({ month, count }, index) => {
      const change = index > 0 ? count - previousCount : 0;
      const changePercent = previousCount > 0 ? (change / previousCount * 100).toFixed(1) : 0;
      const changeIndicator = change > 0 ? '↗' : change < 0 ? '↘' : '→';
      
      // Flag months with unusual spikes (>300% increase)
      const isSpike = Math.abs(changePercent) > 300 && previousCount > 0;
      if (isSpike) {
        suspiciousMonths.push({ month, count, changePercent });
      }
      
      const monthName = new Date(month + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' });
      console.log(`   ${monthName.padEnd(12)} ${count.toString().padStart(6)} ${changeIndicator} ${changePercent > 0 ? '+' : ''}${changePercent}%${isSpike ? ' ⚠️' : ''}`);
      
      previousCount = count;
    });
    
    if (suspiciousMonths.length > 0) {
      console.log(`   ⚠️  ${suspiciousMonths.length} months with suspicious data spikes detected:`);
      suspiciousMonths.forEach(({ month, count, changePercent }) => {
        console.log(`      ${month}: ${count} events (+${changePercent}%)`);
      });
    } else {
      console.log('   ✅ No suspicious data spikes detected');
    }
    console.log('');
    
    // 3. Fleet Distribution
    console.log('🚚 Fleet Distribution Analysis:');
    const fleetGroups = {};
    events.forEach(event => {
      const fleet = event.fleet || 'Unknown';
      fleetGroups[fleet] = (fleetGroups[fleet] || 0) + 1;
    });
    
    Object.entries(fleetGroups).forEach(([fleet, count]) => {
      const percentage = (count / events.length * 100).toFixed(1);
      console.log(`   ${fleet}: ${count.toLocaleString()} events (${percentage}%)`);
    });
    console.log('');
    
    // 4. Event Type Analysis
    console.log('🎯 Event Type Analysis:');
    const eventTypeGroups = {};
    events.forEach(event => {
      const eventType = event.event_type || 'Unknown';
      eventTypeGroups[eventType] = (eventTypeGroups[eventType] || 0) + 1;
    });
    
    const sortedEventTypes = Object.entries(eventTypeGroups)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedEventTypes.forEach(([eventType, count]) => {
      const percentage = (count / events.length * 100).toFixed(1);
      console.log(`   ${eventType}: ${count.toLocaleString()} events (${percentage}%)`);
    });
    console.log('');
    
    // 5. Data Quality Checks
    console.log('🔍 Data Quality Checks:');
    
    // Check for missing required fields
    const missingVehicle = events.filter(e => !e.vehicle_registration).length;
    const missingEventType = events.filter(e => !e.event_type).length;
    const missingFleet = events.filter(e => !e.fleet).length;
    
    console.log(`   Missing vehicle registration: ${missingVehicle} events`);
    console.log(`   Missing event type: ${missingEventType} events`);
    console.log(`   Missing fleet: ${missingFleet} events`);
    
    // Check for duplicate external event IDs
    const externalIds = events.map(e => e.external_event_id);
    const uniqueIds = new Set(externalIds);
    const duplicateIds = externalIds.length - uniqueIds.size;
    
    console.log(`   Duplicate external event IDs: ${duplicateIds}`);
    
    // Check severity distribution
    const severityGroups = {};
    events.forEach(event => {
      const severity = event.severity || 'Unknown';
      severityGroups[severity] = (severityGroups[severity] || 0) + 1;
    });
    
    console.log('   Severity distribution:');
    Object.entries(severityGroups).forEach(([severity, count]) => {
      const percentage = (count / events.length * 100).toFixed(1);
      console.log(`     ${severity}: ${count.toLocaleString()} events (${percentage}%)`);
    });
    console.log('');
    
    // 6. Summary and Recommendations
    console.log('📋 Validation Summary:');
    const issues = [];
    
    if (futureEvents.length > 0) issues.push(`${futureEvents.length} future events`);
    if (suspiciousMonths.length > 0) issues.push(`${suspiciousMonths.length} months with data spikes`);
    if (missingVehicle > 0) issues.push(`${missingVehicle} missing vehicle registrations`);
    if (missingEventType > 0) issues.push(`${missingEventType} missing event types`);
    if (duplicateIds > 0) issues.push(`${duplicateIds} duplicate event IDs`);
    
    if (issues.length === 0) {
      console.log('   ✅ All validation checks passed!');
      console.log('   ✅ Guardian data appears to be high quality and ready for use');
    } else {
      console.log(`   ⚠️  ${issues.length} data quality issues detected:`);
      issues.forEach(issue => console.log(`      • ${issue}`));
      console.log('');
      console.log('   💡 Recommendations:');
      if (futureEvents.length > 0) {
        console.log('      • Review and correct future dates in source data');
      }
      if (suspiciousMonths.length > 0) {
        console.log('      • Investigate data spikes for date parsing errors');
      }
      if (missingVehicle > 0 || missingEventType > 0) {
        console.log('      • Check source CSV for missing required fields');
      }
      if (duplicateIds > 0) {
        console.log('      • Remove duplicate records to maintain data integrity');
      }
    }
    
    console.log('');
    console.log('🎉 Guardian import validation completed!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run the validation
validateImport();