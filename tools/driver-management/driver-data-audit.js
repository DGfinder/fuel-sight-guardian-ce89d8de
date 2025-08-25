#!/usr/bin/env node
/**
 * Driver Data Audit Tool
 * Professional tool for auditing driver data across multiple systems
 * 
 * Usage:
 *   node tools/driver-management/driver-data-audit.js --driver-name "John Smith"
 *   node tools/driver-management/driver-data-audit.js --driver-id "uuid-here"
 *   node tools/driver-management/driver-data-audit.js --help
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.findIndex(arg => arg === `--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const driverName = getArg('driver-name');
const driverId = getArg('driver-id');
const days = parseInt(getArg('days')) || 180;
const help = args.includes('--help');

if (help || (!driverName && !driverId)) {
  console.log(`
🔍 Driver Data Audit Tool

USAGE:
  node tools/driver-management/driver-data-audit.js [OPTIONS]

OPTIONS:
  --driver-name "First Last"    Search by driver name
  --driver-id "uuid"           Search by specific driver ID
  --days N                     Number of days to audit (default: 180)
  --help                       Show this help message

EXAMPLES:
  node tools/driver-management/driver-data-audit.js --driver-name "John Smith"
  node tools/driver-management/driver-data-audit.js --driver-id "123e4567-e89b-12d3-a456-426614174000" --days 90
`);
  process.exit(0);
}

console.log('🔍 Driver Data Audit Tool');
console.log(`📅 Auditing data from ${days} days ago to today...`);

async function auditDriverData() {
  try {
    let targetDrivers = [];

    // Step 1: Find target driver(s)
    if (driverId) {
      console.log(`\n🆔 Searching by driver ID: ${driverId}`);
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId);

      if (error) {
        console.error('❌ Error searching by ID:', error);
        return;
      }
      targetDrivers = data || [];
    } else if (driverName) {
      console.log(`\n👤 Searching by driver name: "${driverName}"`);
      const nameParts = driverName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%`);

      if (error) {
        console.error('❌ Error searching by name:', error);
        return;
      }
      targetDrivers = data || [];
    }

    if (targetDrivers.length === 0) {
      console.log('❌ No drivers found matching the criteria');
      return;
    }

    console.log(`✅ Found ${targetDrivers.length} driver(s):`);
    targetDrivers.forEach(driver => {
      console.log(`   • ${driver.first_name} ${driver.last_name} (${driver.fleet}, ${driver.depot}) - ID: ${driver.id}`);
    });

    // Step 2: Audit each driver
    for (const driver of targetDrivers) {
      await auditSingleDriver(driver, days);
    }

  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  }
}

async function auditSingleDriver(driver, days) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  const dateString = dateThreshold.toISOString();

  console.log(`\n📊 AUDITING: ${driver.first_name} ${driver.last_name}`);
  console.log(`🆔 Driver ID: ${driver.id}`);
  console.log(`🏢 Fleet: ${driver.fleet} | Depot: ${driver.depot}`);

  // Check LYTX events
  const { data: lytxEvents, error: lytxError } = await supabase
    .from('lytx_safety_events')
    .select('event_id, driver_name, event_datetime, trigger, score, status')
    .eq('driver_id', driver.id)
    .gte('event_datetime', dateString)
    .order('event_datetime', { ascending: false });

  if (lytxError) {
    console.error('❌ LYTX events error:', lytxError);
  } else {
    console.log(`🛡️ LYTX Events (last ${days} days): ${lytxEvents.length}`);
    
    if (lytxEvents.length > 0) {
      const eventsByMonth = {};
      lytxEvents.forEach(event => {
        const month = event.event_datetime.substring(0, 7);
        eventsByMonth[month] = (eventsByMonth[month] || 0) + 1;
      });
      
      console.log('   📈 Events by month:');
      Object.entries(eventsByMonth).forEach(([month, count]) => {
        console.log(`   • ${month}: ${count} events`);
      });

      const triggers = lytxEvents.map(e => e.trigger).filter(Boolean);
      const triggerCounts = triggers.reduce((acc, trigger) => {
        acc[trigger] = (acc[trigger] || 0) + 1;
        return acc;
      }, {});
      
      const topTrigger = Object.entries(triggerCounts).sort(([,a], [,b]) => b - a)[0];
      if (topTrigger) {
        console.log(`   🎯 Most common event: ${topTrigger[0]} (${topTrigger[1]} occurrences)`);
      }
    }
  }

  // Check trips (if MtData available)
  const { data: tripData, error: tripError } = await supabase
    .from('mtdata_trip_history')
    .select('start_time, distance_km, travel_time_hours')
    .eq('driver_id', driver.id)
    .gte('start_time', dateString);

  if (!tripError && tripData) {
    const totalKm = tripData.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
    const totalHours = tripData.reduce((sum, trip) => sum + (trip.travel_time_hours || 0), 0);
    
    console.log(`🚚 Trip Data (last ${days} days): ${tripData.length} trips`);
    console.log(`   📏 Total distance: ${Math.round(totalKm).toLocaleString()} km`);
    console.log(`   ⏱️ Total hours: ${Math.round(totalHours * 10) / 10} hours`);
    
    if (lytxEvents && lytxEvents.length > 0 && totalKm > 0) {
      const eventsPerKm = (lytxEvents.length / totalKm) * 1000;
      console.log(`   📊 Events per 1,000km: ${eventsPerKm.toFixed(2)}`);
    }
  }

  // Summary for this driver
  console.log(`\n📋 SUMMARY for ${driver.first_name} ${driver.last_name}:`);
  console.log(`   👤 Driver record: FOUND`);
  console.log(`   🛡️ LYTX events (${days}d): ${lytxEvents?.length || 0}`);
  console.log(`   🚚 Trip records (${days}d): ${tripData?.length || 0}`);
  console.log(`   📅 Data coverage: ${days} days`);
}

auditDriverData();