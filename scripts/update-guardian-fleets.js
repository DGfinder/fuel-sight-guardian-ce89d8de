#!/usr/bin/env node

/**
 * Update Guardian Events Fleet Assignment Script
 * 
 * Updates existing Guardian events with correct fleet assignments from vehicles table
 * Usage: node scripts/update-guardian-fleets.js
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

console.log('🔧 Guardian Fleet Assignment Update Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Update Guardian events fleet assignments
 */
async function updateGuardianFleets() {
  try {
    console.log('📊 Analyzing current Guardian events...');
    
    // Get all Guardian events with their current fleet assignments
    const { data: guardianEvents, error: eventsError } = await supabase
      .from('guardian_events')
      .select('id, vehicle_registration, fleet');
      
    if (eventsError) {
      throw new Error(`Failed to fetch Guardian events: ${eventsError.message}`);
    }
    
    console.log(`📋 Found ${guardianEvents.length.toLocaleString()} Guardian events`);
    
    // Get current fleet distribution
    const fleetCounts = guardianEvents.reduce((acc, event) => {
      acc[event.fleet] = (acc[event.fleet] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Current fleet distribution:');
    Object.entries(fleetCounts).forEach(([fleet, count]) => {
      console.log(`   ${fleet}: ${count} events`);
    });
    
    // Get all vehicles with their fleet assignments
    console.log('🚛 Loading vehicle fleet assignments...');
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('registration, fleet');
      
    if (vehiclesError) {
      throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
    }
    
    console.log(`🚚 Found ${vehicles.length.toLocaleString()} vehicles in fleet master`);
    
    // Create vehicle lookup map
    const vehicleFleetMap = new Map();
    vehicles.forEach(vehicle => {
      vehicleFleetMap.set(vehicle.registration.toUpperCase(), vehicle.fleet);
    });
    
    console.log('🔍 Analyzing fleet assignment corrections needed...');
    
    // Analyze which events need correction
    const correctionsNeeded = [];
    const unknownVehicles = new Set();
    
    guardianEvents.forEach(event => {
      const vehicleKey = event.vehicle_registration.trim().replace(/\s+/g, '').toUpperCase();
      const correctFleet = vehicleFleetMap.get(vehicleKey);
      
      if (correctFleet) {
        if (event.fleet !== correctFleet) {
          correctionsNeeded.push({
            id: event.id,
            vehicle: event.vehicle_registration,
            currentFleet: event.fleet,
            correctFleet: correctFleet
          });
        }
      } else {
        unknownVehicles.add(event.vehicle_registration);
      }
    });
    
    console.log(`✏️  Fleet corrections needed: ${correctionsNeeded.length.toLocaleString()}`);
    console.log(`❓ Unknown vehicles (not in fleet master): ${unknownVehicles.size}`);
    
    if (unknownVehicles.size > 0) {
      console.log('🔍 Unknown vehicles:');
      Array.from(unknownVehicles).slice(0, 10).forEach(vehicle => {
        console.log(`   ${vehicle}`);
      });
      if (unknownVehicles.size > 10) {
        console.log(`   ...and ${unknownVehicles.size - 10} more`);
      }
    }
    
    if (correctionsNeeded.length === 0) {
      console.log('✅ All Guardian events already have correct fleet assignments!');
      return;
    }
    
    // Show correction summary by fleet
    const correctionsByFleet = correctionsNeeded.reduce((acc, correction) => {
      const key = `${correction.currentFleet} → ${correction.correctFleet}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Fleet corrections by type:');
    Object.entries(correctionsByFleet).forEach(([change, count]) => {
      console.log(`   ${change}: ${count} events`);
    });
    
    // Prompt for confirmation (in real script, you might want user input)
    console.log('');
    console.log('🚀 Starting fleet assignment corrections...');
    
    // Update in batches
    const batchSize = 100;
    let updatedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < correctionsNeeded.length; i += batchSize) {
      const batchCorrections = correctionsNeeded.slice(i, i + batchSize);
      
      console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(correctionsNeeded.length / batchSize)} (${batchCorrections.length} records)...`);
      
      try {
        // Group corrections by target fleet for efficient batch updates
        const stevemacsUpdates = batchCorrections.filter(c => c.correctFleet === 'Stevemacs');
        const gsfUpdates = batchCorrections.filter(c => c.correctFleet === 'Great Southern Fuels');
        
        let batchSuccessCount = 0;
        let batchFailCount = 0;
        
        // Update Stevemacs events
        if (stevemacsUpdates.length > 0) {
          const { error: stevemacsError } = await supabase
            .from('guardian_events')
            .update({ fleet: 'Stevemacs' })
            .in('id', stevemacsUpdates.map(u => u.id));
            
          if (stevemacsError) {
            console.error(`   ❌ Stevemacs update failed: ${stevemacsError.message}`);
            batchFailCount += stevemacsUpdates.length;
          } else {
            batchSuccessCount += stevemacsUpdates.length;
          }
        }
        
        // Update GSF events  
        if (gsfUpdates.length > 0) {
          const { error: gsfError } = await supabase
            .from('guardian_events')
            .update({ fleet: 'Great Southern Fuels' })
            .in('id', gsfUpdates.map(u => u.id));
            
          if (gsfError) {
            console.error(`   ❌ GSF update failed: ${gsfError.message}`);
            batchFailCount += gsfUpdates.length;
          } else {
            batchSuccessCount += gsfUpdates.length;
          }
        }
        
        updatedCount += batchSuccessCount;
        failedCount += batchFailCount;
        
        console.log(`   ✅ Batch completed: ${batchSuccessCount} success, ${batchFailCount} failed`);
        
      } catch (error) {
        console.error(`   ❌ Batch processing error: ${error.message}`);
        failedCount += batchCorrections.length;
      }
    }
    
    console.log('');
    console.log('🎉 Fleet assignment update completed!');
    console.log(`✅ Successfully updated: ${updatedCount.toLocaleString()} events`);
    console.log(`❌ Failed: ${failedCount.toLocaleString()} events`);
    
    if (updatedCount > 0) {
      console.log('');
      console.log('📊 Verifying final fleet distribution...');
      
      // Get updated fleet distribution
      const { data: updatedEvents, error: finalError } = await supabase
        .from('guardian_events')
        .select('fleet');
        
      if (!finalError && updatedEvents) {
        const finalFleetCounts = updatedEvents.reduce((acc, event) => {
          acc[event.fleet] = (acc[event.fleet] || 0) + 1;
          return acc;
        }, {});
        
        console.log('📈 Updated fleet distribution:');
        Object.entries(finalFleetCounts).forEach(([fleet, count]) => {
          console.log(`   ${fleet}: ${count} events`);
        });
      }
      
      console.log('');
      console.log('🔍 Guardian Dashboard now shows accurate fleet-specific data!');
      console.log('   • Visit: http://localhost:5173/data-centre/guardian');
      console.log('   • Fleet-specific views will be available after adding sub-routes');
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  }
}

// Run the update
updateGuardianFleets();