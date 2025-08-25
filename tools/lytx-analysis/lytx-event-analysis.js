#!/usr/bin/env node
/**
 * LYTX Event Analysis Tool
 * Professional tool for analyzing LYTX safety events across multiple drivers and time periods
 * 
 * Usage:
 *   node tools/lytx-analysis/lytx-event-analysis.js --driver-name "John Smith" --days 180
 *   node tools/lytx-analysis/lytx-event-analysis.js --fleet "Great Southern Fuels" --days 90
 *   node tools/lytx-analysis/lytx-event-analysis.js --summary --days 30
 *   node tools/lytx-analysis/lytx-event-analysis.js --help
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
const fleet = getArg('fleet');
const depot = getArg('depot');
const days = parseInt(getArg('days')) || 30;
const summary = args.includes('--summary');
const help = args.includes('--help');

if (help) {
  console.log(`
🛡️ LYTX Event Analysis Tool

DESCRIPTION:
  Analyzes LYTX safety events across drivers, fleets, and time periods.
  Provides comprehensive event breakdowns and performance insights.

USAGE:
  node tools/lytx-analysis/lytx-event-analysis.js [OPTIONS]

OPTIONS:
  --driver-name "First Last"   Analyze specific driver by name
  --driver-id "uuid"          Analyze specific driver by ID
  --fleet "Fleet Name"        Analyze entire fleet
  --depot "Depot Name"        Analyze specific depot
  --days N                    Number of days to analyze (default: 30)
  --summary                   Show fleet-wide summary only
  --help                      Show this help message

EXAMPLES:
  # Analyze specific driver over 180 days
  node tools/lytx-analysis/lytx-event-analysis.js --driver-name "John Smith" --days 180
  
  # Analyze entire fleet for last 90 days
  node tools/lytx-analysis/lytx-event-analysis.js --fleet "Great Southern Fuels" --days 90
  
  # Fleet summary for last 30 days
  node tools/lytx-analysis/lytx-event-analysis.js --summary --days 30
  
  # Depot analysis
  node tools/lytx-analysis/lytx-event-analysis.js --depot "Perth" --days 60
`);
  process.exit(0);
}

console.log('🛡️ LYTX Event Analysis Tool');
console.log(`📅 Analyzing events from ${days} days ago to today...`);

async function analyzeLytxEvents() {
  try {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const dateString = dateThreshold.toISOString();

    let eventQuery = supabase
      .from('lytx_safety_events')
      .select('event_id, driver_name, driver_id, event_datetime, trigger, score, status, fleet, depot, vehicle_registration')
      .gte('event_datetime', dateString)
      .order('event_datetime', { ascending: false });

    // Apply filters based on command line arguments
    if (driverId) {
      eventQuery = eventQuery.eq('driver_id', driverId);
    } else if (driverName) {
      eventQuery = eventQuery.ilike('driver_name', `%${driverName}%`);
    }
    
    if (fleet) {
      eventQuery = eventQuery.ilike('carrier', `%${fleet}%`);
    }
    
    if (depot) {
      eventQuery = eventQuery.ilike('depot', `%${depot}%`);
    }

    const { data: events, error } = await eventQuery;

    if (error) {
      console.error('❌ Error fetching LYTX events:', error);
      return;
    }

    console.log(`✅ Found ${events.length} LYTX events`);

    if (events.length === 0) {
      console.log('📭 No events found matching the criteria');
      return;
    }

    // Perform analysis
    await performEventAnalysis(events, days);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function performEventAnalysis(events, days) {
  console.log('\n📊 EVENT ANALYSIS RESULTS');
  
  // Basic statistics
  console.log('\n📈 Overview:');
  console.log(`   • Total events: ${events.length}`);
  console.log(`   • Time period: ${days} days`);
  console.log(`   • Average per day: ${(events.length / days).toFixed(2)}`);
  
  const uniqueDrivers = new Set(events.map(e => e.driver_name)).size;
  console.log(`   • Unique drivers: ${uniqueDrivers}`);
  if (uniqueDrivers > 0) {
    console.log(`   • Events per driver: ${(events.length / uniqueDrivers).toFixed(2)}`);
  }

  // Events by trigger type
  console.log('\n🎯 Events by Trigger Type:');
  const triggerCounts = events.reduce((acc, event) => {
    const trigger = event.trigger || 'Unknown';
    acc[trigger] = (acc[trigger] || 0) + 1;
    return acc;
  }, {});
  
  const sortedTriggers = Object.entries(triggerCounts).sort(([,a], [,b]) => b - a);
  sortedTriggers.forEach(([trigger, count]) => {
    const percentage = ((count / events.length) * 100).toFixed(1);
    console.log(`   • ${trigger}: ${count} events (${percentage}%)`);
  });

  // Events by status
  console.log('\n📋 Events by Status:');
  const statusCounts = events.reduce((acc, event) => {
    const status = event.status || 'Pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(statusCounts).sort(([,a], [,b]) => b - a).forEach(([status, count]) => {
    const percentage = ((count / events.length) * 100).toFixed(1);
    console.log(`   • ${status}: ${count} events (${percentage}%)`);
  });

  // Score distribution
  console.log('\n⚖️ Score Distribution:');
  const scores = events.map(e => e.score || 0).filter(s => s > 0);
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highRisk = scores.filter(s => s >= 7).length;
    const mediumRisk = scores.filter(s => s >= 3 && s < 7).length;
    const lowRisk = scores.filter(s => s < 3).length;
    
    console.log(`   • Average score: ${avgScore.toFixed(2)}`);
    console.log(`   • High risk (≥7): ${highRisk} events (${((highRisk / scores.length) * 100).toFixed(1)}%)`);
    console.log(`   • Medium risk (3-6): ${mediumRisk} events (${((mediumRisk / scores.length) * 100).toFixed(1)}%)`);
    console.log(`   • Low risk (<3): ${lowRisk} events (${((lowRisk / scores.length) * 100).toFixed(1)}%)`);
  }

  // Top drivers by event count
  if (!driverId && !driverName && uniqueDrivers > 1) {
    console.log('\n👥 Top Drivers by Event Count:');
    const driverCounts = events.reduce((acc, event) => {
      const driver = event.driver_name || 'Unknown';
      acc[driver] = (acc[driver] || 0) + 1;
      return acc;
    }, {});
    
    const sortedDrivers = Object.entries(driverCounts).sort(([,a], [,b]) => b - a).slice(0, 10);
    sortedDrivers.forEach(([driver, count]) => {
      const percentage = ((count / events.length) * 100).toFixed(1);
      console.log(`   • ${driver}: ${count} events (${percentage}%)`);
    });
  }

  // Fleet/Depot breakdown
  if (!fleet && !depot) {
    const fleetCounts = events.reduce((acc, event) => {
      const fleet = event.fleet || event.carrier || 'Unknown';
      acc[fleet] = (acc[fleet] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(fleetCounts).length > 1) {
      console.log('\n🚛 Events by Fleet:');
      Object.entries(fleetCounts).sort(([,a], [,b]) => b - a).forEach(([fleet, count]) => {
        const percentage = ((count / events.length) * 100).toFixed(1);
        console.log(`   • ${fleet}: ${count} events (${percentage}%)`);
      });
    }

    const depotCounts = events.reduce((acc, event) => {
      const depot = event.depot || 'Unknown';
      acc[depot] = (acc[depot] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(depotCounts).length > 1) {
      console.log('\n📍 Events by Depot:');
      Object.entries(depotCounts).sort(([,a], [,b]) => b - a).forEach(([depot, count]) => {
        const percentage = ((count / events.length) * 100).toFixed(1);
        console.log(`   • ${depot}: ${count} events (${percentage}%)`);
      });
    }
  }

  // Time distribution
  console.log('\n📅 Events by Month:');
  const monthCounts = events.reduce((acc, event) => {
    const month = event.event_datetime.substring(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(monthCounts).sort().forEach(([month, count]) => {
    const percentage = ((count / events.length) * 100).toFixed(1);
    console.log(`   • ${month}: ${count} events (${percentage}%)`);
  });

  // Recent events sample (if analyzing specific driver)
  if (driverId || driverName) {
    console.log('\n📝 Recent Events (Last 5):');
    events.slice(0, 5).forEach(event => {
      const date = event.event_datetime.split('T')[0];
      const trigger = event.trigger || 'Unknown';
      const score = event.score || 0;
      const status = event.status || 'Pending';
      console.log(`   • ${date} - ${trigger} (Score: ${score}, Status: ${status})`);
    });
  }

  // Summary recommendations
  console.log('\n🎯 INSIGHTS:');
  const coachableEvents = events.filter(e => !e.status || e.status !== 'Face-To-Face').length;
  if (coachableEvents > 0) {
    console.log(`   ⚠️ ${coachableEvents} events need coaching attention`);
  }
  
  const highScoreEvents = events.filter(e => (e.score || 0) >= 7).length;
  if (highScoreEvents > 0) {
    console.log(`   🚨 ${highScoreEvents} high-risk events require immediate action`);
  }
  
  if (uniqueDrivers > 1) {
    const topTrigger = sortedTriggers[0];
    if (topTrigger) {
      console.log(`   📊 Most common issue: ${topTrigger[0]} (${topTrigger[1]} events)`);
    }
  }
}

analyzeLytxEvents();