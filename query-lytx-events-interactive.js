#!/usr/bin/env node

/**
 * Interactive LYTX Events Query Tool
 * 
 * This script provides an interactive command-line interface to query
 * and analyze LYTX safety events data with various filtering options.
 * 
 * Usage: node query-lytx-events-interactive.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '.env') });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function displayMenu() {
  console.clear();
  console.log('🔍 LYTX Events Interactive Query Tool');
  console.log('====================================');
  console.log('');
  console.log('1. Search by driver name');
  console.log('2. Search by date range');
  console.log('3. Search by event type');
  console.log('4. Search by carrier/fleet');
  console.log('5. Show unassociated events');
  console.log('6. Show events by driver ID');
  console.log('7. Show database statistics');
  console.log('8. Run custom SQL query');
  console.log('9. Wayne Bowron specific search');
  console.log('0. Exit');
  console.log('');
}

async function searchByDriverName() {
  console.log('🔍 Search by Driver Name');
  console.log('========================');
  
  const driverName = await askQuestion('Enter driver name (supports wildcards with %): ');
  const days = await askQuestion('Enter number of days to look back (default 30): ');
  
  const daysBack = parseInt(days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  console.log(`\nSearching for "${driverName}" in the last ${daysBack} days...\n`);
  
  try {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select(`
        event_id,
        driver_name,
        employee_id,
        driver_id,
        event_datetime,
        event_type,
        trigger,
        score,
        carrier,
        depot,
        driver_association_confidence
      `)
      .ilike('driver_name', driverName.includes('%') ? driverName : `%${driverName}%`)
      .gte('event_datetime', startDate.toISOString())
      .order('event_datetime', { ascending: false });

    if (error) {
      console.error('❌ Query failed:', error.message);
      return;
    }

    console.log(`✅ Found ${events.length} events:\n`);
    
    events.forEach((event, index) => {
      console.log(`${index + 1}. Event ${event.event_id}`);
      console.log(`   Driver: "${event.driver_name}"`);
      console.log(`   Date: ${event.event_datetime}`);
      console.log(`   Type: ${event.event_type} - ${event.trigger}`);
      console.log(`   Score: ${event.score}`);
      console.log(`   Carrier: ${event.carrier}, Depot: ${event.depot}`);
      console.log(`   Driver ID: ${event.driver_id || 'Not assigned'}`);
      if (event.driver_association_confidence) {
        console.log(`   Confidence: ${event.driver_association_confidence}`);
      }
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function searchByDateRange() {
  console.log('📅 Search by Date Range');
  console.log('======================');
  
  const startDate = await askQuestion('Enter start date (YYYY-MM-DD): ');
  const endDate = await askQuestion('Enter end date (YYYY-MM-DD): ');
  const limit = await askQuestion('Enter result limit (default 50): ');
  
  const resultLimit = parseInt(limit) || 50;
  
  console.log(`\nSearching events between ${startDate} and ${endDate}...\n`);
  
  try {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select(`
        event_id,
        driver_name,
        event_datetime,
        event_type,
        trigger,
        score,
        carrier
      `)
      .gte('event_datetime', startDate)
      .lte('event_datetime', endDate + 'T23:59:59')
      .order('event_datetime', { ascending: false })
      .limit(resultLimit);

    if (error) {
      console.error('❌ Query failed:', error.message);
      return;
    }

    console.log(`✅ Found ${events.length} events (limited to ${resultLimit}):\n`);
    
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.driver_name} - ${event.event_type}`);
      console.log(`   Date: ${event.event_datetime}`);
      console.log(`   Trigger: ${event.trigger} (Score: ${event.score})`);
      console.log(`   Carrier: ${event.carrier}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function showUnassociatedEvents() {
  console.log('❓ Unassociated Events');
  console.log('=====================');
  
  const days = await askQuestion('Enter number of days to look back (default 7): ');
  const limit = await askQuestion('Enter result limit (default 20): ');
  
  const daysBack = parseInt(days) || 7;
  const resultLimit = parseInt(limit) || 20;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  try {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select(`
        event_id,
        driver_name,
        employee_id,
        event_datetime,
        event_type,
        trigger,
        score,
        carrier,
        depot
      `)
      .is('driver_id', null)
      .gte('event_datetime', startDate.toISOString())
      .order('event_datetime', { ascending: false })
      .limit(resultLimit);

    if (error) {
      console.error('❌ Query failed:', error.message);
      return;
    }

    console.log(`\n✅ Found ${events.length} unassociated events:\n`);
    
    events.forEach((event, index) => {
      console.log(`${index + 1}. Event ${event.event_id}`);
      console.log(`   Driver: "${event.driver_name}"`);
      console.log(`   Employee ID: ${event.employee_id || 'N/A'}`);
      console.log(`   Date: ${event.event_datetime}`);
      console.log(`   Type: ${event.event_type} - ${event.trigger}`);
      console.log(`   Score: ${event.score}`);
      console.log(`   Location: ${event.carrier}, ${event.depot}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function showDatabaseStats() {
  console.log('📊 Database Statistics');
  console.log('=====================');
  
  try {
    // Total events
    const { count: totalCount } = await supabase
      .from('lytx_safety_events')
      .select('*', { count: 'exact', head: true });

    // Events with drivers
    const { count: withDrivers } = await supabase
      .from('lytx_safety_events')
      .select('*', { count: 'exact', head: true })
      .not('driver_id', 'is', null);

    // Events in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: recentCount } = await supabase
      .from('lytx_safety_events')
      .select('*', { count: 'exact', head: true })
      .gte('event_datetime', thirtyDaysAgo.toISOString());

    // Carrier breakdown
    const { data: carrierStats } = await supabase
      .from('lytx_safety_events')
      .select('carrier')
      .limit(10000);

    const carrierCounts = {};
    if (carrierStats) {
      carrierStats.forEach(event => {
        carrierCounts[event.carrier] = (carrierCounts[event.carrier] || 0) + 1;
      });
    }

    console.log(`\n📈 Statistics:`);
    console.log(`Total LYTX events: ${totalCount || 'Unknown'}`);
    console.log(`Events with driver associations: ${withDrivers || 'Unknown'}`);
    console.log(`Events in last 30 days: ${recentCount || 'Unknown'}`);
    
    if (totalCount && withDrivers) {
      const associationRate = Math.round((withDrivers / totalCount) * 100 * 100) / 100;
      console.log(`Association rate: ${associationRate}%`);
    }
    
    console.log(`\n🏢 Carrier breakdown:`);
    Object.entries(carrierCounts).forEach(([carrier, count]) => {
      console.log(`   ${carrier}: ${count} events`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function wayneBowronSearch() {
  console.log('👤 Wayne Bowron Specific Search');
  console.log('==============================');
  
  const days = await askQuestion('Enter number of days to look back (default 180): ');
  const daysBack = parseInt(days) || 180;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  console.log(`\nSearching for Wayne Bowron events in the last ${daysBack} days...\n`);
  
  // Multiple name variations for Wayne Bowron
  const nameVariations = [
    '%wayne%bowron%',
    '%bowron%wayne%',
    'wayne bowron',
    'bowron wayne',
    'w%bowron',
    'wayne b%'
  ];

  let allEvents = [];
  
  for (const namePattern of nameVariations) {
    try {
      const { data: events, error } = await supabase
        .from('lytx_safety_events')
        .select(`
          event_id,
          driver_name,
          employee_id,
          driver_id,
          event_datetime,
          event_type,
          trigger,
          score,
          carrier,
          depot,
          driver_association_confidence,
          driver_association_method
        `)
        .ilike('driver_name', namePattern)
        .gte('event_datetime', startDate.toISOString())
        .order('event_datetime', { ascending: false });

      if (!error && events && events.length > 0) {
        console.log(`Found ${events.length} events with pattern "${namePattern}"`);
        // Avoid duplicates
        events.forEach(event => {
          if (!allEvents.find(e => e.event_id === event.event_id)) {
            allEvents.push(event);
          }
        });
      }

    } catch (err) {
      console.log(`Error with pattern "${namePattern}":`, err.message);
    }
  }

  console.log(`\n✅ Total unique events found: ${allEvents.length}\n`);

  if (allEvents.length > 0) {
    allEvents.forEach((event, index) => {
      console.log(`${index + 1}. Event ${event.event_id}`);
      console.log(`   Driver Name: "${event.driver_name}"`);
      console.log(`   Employee ID: ${event.employee_id || 'N/A'}`);
      console.log(`   Driver ID: ${event.driver_id || 'Not assigned'}`);
      console.log(`   Date: ${event.event_datetime}`);
      console.log(`   Type: ${event.event_type} - ${event.trigger}`);
      console.log(`   Score: ${event.score}`);
      console.log(`   Location: ${event.carrier}, ${event.depot}`);
      if (event.driver_association_confidence) {
        console.log(`   Association: ${event.driver_association_method} (${event.driver_association_confidence})`);
      }
      console.log('');
    });

    // Summary
    const associated = allEvents.filter(e => e.driver_id);
    const unassociated = allEvents.filter(e => !e.driver_id);
    
    console.log('📊 Summary:');
    console.log(`   Associated with driver: ${associated.length}`);
    console.log(`   Unassociated: ${unassociated.length}`);
    
  } else {
    console.log('❌ No events found for Wayne Bowron');
    console.log('\nPossible reasons:');
    console.log('• Name spelled differently in LYTX system');
    console.log('• No safety events in the specified time period');
    console.log('• Data not imported for this driver');
  }
}

async function runCustomQuery() {
  console.log('🔧 Custom SQL Query');
  console.log('==================');
  console.log('Note: This uses Supabase client, not direct SQL');
  console.log('Available operations: select, count, basic filtering');
  console.log('');
  
  console.log('Example queries:');
  console.log('1. Count events by carrier');
  console.log('2. Recent high-score events');
  console.log('3. Driver association summary');
  console.log('');
  
  const choice = await askQuestion('Select example (1-3) or press Enter to skip: ');
  
  try {
    switch (choice) {
      case '1':
        const { data: carrierData } = await supabase
          .from('lytx_safety_events')
          .select('carrier, event_id')
          .limit(5000);
        
        const carrierCounts = {};
        carrierData?.forEach(event => {
          carrierCounts[event.carrier] = (carrierCounts[event.carrier] || 0) + 1;
        });
        
        console.log('\n📊 Events by Carrier:');
        Object.entries(carrierCounts).forEach(([carrier, count]) => {
          console.log(`   ${carrier}: ${count} events`);
        });
        break;
        
      case '2':
        const { data: highScoreEvents } = await supabase
          .from('lytx_safety_events')
          .select('event_id, driver_name, event_datetime, trigger, score')
          .gte('score', 80)
          .order('event_datetime', { ascending: false })
          .limit(10);
        
        console.log('\n🚨 Recent High-Score Events (>= 80):');
        highScoreEvents?.forEach(event => {
          console.log(`   ${event.driver_name}: ${event.trigger} (${event.score}) - ${event.event_datetime}`);
        });
        break;
        
      case '3':
        const { count: totalEvents } = await supabase
          .from('lytx_safety_events')
          .select('*', { count: 'exact', head: true });
          
        const { count: associatedEvents } = await supabase
          .from('lytx_safety_events')
          .select('*', { count: 'exact', head: true })
          .not('driver_id', 'is', null);
        
        console.log('\n📈 Driver Association Summary:');
        console.log(`   Total events: ${totalEvents}`);
        console.log(`   Associated: ${associatedEvents}`);
        console.log(`   Unassociated: ${totalEvents - associatedEvents}`);
        if (totalEvents > 0) {
          const rate = Math.round((associatedEvents / totalEvents) * 100 * 100) / 100;
          console.log(`   Association rate: ${rate}%`);
        }
        break;
        
      default:
        console.log('No query selected');
    }
    
  } catch (err) {
    console.error('❌ Query failed:', err.message);
  }
}

async function main() {
  console.log('🔗 Connected to Supabase at:', supabaseUrl);
  console.log('');

  while (true) {
    await displayMenu();
    
    const choice = await askQuestion('Select an option (0-9): ');
    
    console.clear();
    
    switch (choice) {
      case '1':
        await searchByDriverName();
        break;
      case '2':
        await searchByDateRange();
        break;
      case '3':
        // Add event type search
        console.log('🚨 Search by Event Type - Not implemented yet');
        break;
      case '4':
        // Add carrier search
        console.log('🏢 Search by Carrier - Not implemented yet');
        break;
      case '5':
        await showUnassociatedEvents();
        break;
      case '6':
        // Add driver ID search
        console.log('👤 Search by Driver ID - Not implemented yet');
        break;
      case '7':
        await showDatabaseStats();
        break;
      case '8':
        await runCustomQuery();
        break;
      case '9':
        await wayneBowronSearch();
        break;
      case '0':
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid option');
    }
    
    await askQuestion('\nPress Enter to continue...');
  }
}

main().catch(err => {
  console.error('❌ Application error:', err.message);
  rl.close();
  process.exit(1);
});