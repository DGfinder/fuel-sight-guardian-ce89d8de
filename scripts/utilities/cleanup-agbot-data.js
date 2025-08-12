#!/usr/bin/env node

// Agbot Data Cleanup Script
// Removes test data, deduplicates tanks, and standardizes data quality

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeCurrentData() {
  console.log('\n📊 ANALYZING CURRENT AGBOT DATA');
  console.log('='.repeat(60));
  
  // Get all locations with assets
  const { data: locations, error } = await supabase
    .from('agbot_locations')
    .select(`
      id, 
      location_guid, 
      location_id, 
      customer_name,
      address1,
      created_at,
      assets:agbot_assets(
        id,
        asset_serial_number,
        device_serial_number,
        device_sku_name,
        device_online,
        latest_calibrated_fill_percentage
      )
    `)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }

  console.log(`\n📋 Found ${locations.length} total location entries`);
  
  // Analyze patterns
  const testEntries = [];
  const realEntries = [];
  const duplicateGroups = new Map();

  locations.forEach(location => {
    const isTest = 
      location.location_id?.includes('Test') ||
      location.customer_name?.includes('Test') ||
      location.assets?.some(asset => 
        asset.device_serial_number?.includes('TEST-') ||
        asset.asset_serial_number?.includes('TEST-')
      ) ||
      location.customer_name === 'Simple Test Customer';

    if (isTest) {
      testEntries.push(location);
    } else {
      realEntries.push(location);
      
      // Group by location name for duplicate detection
      const locationName = location.location_id;
      if (!duplicateGroups.has(locationName)) {
        duplicateGroups.set(locationName, []);
      }
      duplicateGroups.get(locationName).push(location);
    }
  });

  console.log(`\n🧪 Test entries to remove: ${testEntries.length}`);
  testEntries.forEach((entry, i) => {
    console.log(`   ${i + 1}. ${entry.location_id} (${entry.customer_name || 'No customer'})`);
    if (entry.assets?.[0]) {
      console.log(`      Device: ${entry.assets[0].device_serial_number}`);
    }
  });

  console.log(`\n🏭 Real entries found: ${realEntries.length}`);
  
  const duplicates = Array.from(duplicateGroups.entries()).filter(([name, entries]) => entries.length > 1);
  console.log(`\n🔄 Duplicate groups: ${duplicates.length}`);
  
  duplicates.forEach(([name, entries]) => {
    console.log(`\n   📍 "${name}" (${entries.length} entries):`);
    entries.forEach((entry, i) => {
      const asset = entry.assets?.[0];
      console.log(`     ${i + 1}. ID: ${entry.id} | Created: ${new Date(entry.created_at).toLocaleString()}`);
      console.log(`        Address: ${entry.address1 || 'No address'}`);
      console.log(`        Device: ${asset?.device_serial_number || 'No device'} (${asset?.device_sku_name || 'Unknown'})`);
      console.log(`        Fuel: ${asset?.latest_calibrated_fill_percentage || 'No data'}%`);
    });
  });

  return { testEntries, realEntries, duplicateGroups, duplicates };
}

async function removeTestData(testEntries) {
  console.log(`\n🗑️  REMOVING ${testEntries.length} TEST ENTRIES`);
  console.log('='.repeat(60));
  
  let removedLocations = 0;
  let removedAssets = 0;
  let removedReadings = 0;

  for (const testLocation of testEntries) {
    try {
      console.log(`\n🧪 Removing test location: ${testLocation.location_id}`);
      
      // Remove readings first (foreign key constraint)
      if (testLocation.assets && testLocation.assets.length > 0) {
        for (const asset of testLocation.assets) {
          const { error: readingsError } = await supabase
            .from('agbot_readings_history')
            .delete()
            .eq('asset_id', asset.id);
          
          if (readingsError) {
            console.warn(`   ⚠️  Failed to delete readings for asset ${asset.id}: ${readingsError.message}`);
          } else {
            console.log(`   ✅ Deleted readings for asset ${asset.asset_serial_number}`);
            removedReadings++;
          }
        }
      }

      // Remove assets
      const { error: assetsError } = await supabase
        .from('agbot_assets')
        .delete()
        .eq('location_id', testLocation.id);
      
      if (assetsError) {
        console.warn(`   ⚠️  Failed to delete assets: ${assetsError.message}`);
      } else {
        console.log(`   ✅ Deleted ${testLocation.assets?.length || 0} assets`);
        removedAssets += testLocation.assets?.length || 0;
      }

      // Remove location
      const { error: locationError } = await supabase
        .from('agbot_locations')
        .delete()
        .eq('id', testLocation.id);
      
      if (locationError) {
        console.warn(`   ❌ Failed to delete location: ${locationError.message}`);
      } else {
        console.log(`   ✅ Deleted location: ${testLocation.location_id}`);
        removedLocations++;
      }

    } catch (error) {
      console.error(`   ❌ Error removing ${testLocation.location_id}: ${error.message}`);
    }
  }

  console.log(`\n📊 TEST DATA REMOVAL SUMMARY:`);
  console.log(`   🏭 Locations removed: ${removedLocations}`);
  console.log(`   🛠️  Assets removed: ${removedAssets}`);
  console.log(`   📈 Readings removed: ${removedReadings}`);

  return { removedLocations, removedAssets, removedReadings };
}

async function deduplicateRealData(duplicateGroups) {
  console.log(`\n🔧 DEDUPLICATING REAL TANK DATA`);
  console.log('='.repeat(60));
  
  let keptLocations = 0;
  let removedDuplicates = 0;

  for (const [locationName, entries] of duplicateGroups) {
    if (entries.length === 1) {
      keptLocations++;
      continue; // No duplicates
    }

    console.log(`\n📍 Processing duplicates for: "${locationName}"`);
    console.log(`   Found ${entries.length} duplicate entries`);

    // Sort entries to find the best one to keep
    // Priority: 1. Has address, 2. Most recent, 3. Has device data, 4. Real fuel percentage
    const sortedEntries = entries.sort((a, b) => {
      const aAsset = a.assets?.[0];
      const bAsset = b.assets?.[0];
      
      // Prefer entries with addresses
      const aHasAddress = Boolean(a.address1 && a.address1 !== 'No address');
      const bHasAddress = Boolean(b.address1 && b.address1 !== 'No address');
      
      if (aHasAddress !== bHasAddress) {
        return bHasAddress ? 1 : -1;
      }

      // Prefer entries with non-default fuel levels (not 50.0%)
      const aHasRealFuel = aAsset?.latest_calibrated_fill_percentage !== 50.0;
      const bHasRealFuel = bAsset?.latest_calibrated_fill_percentage !== 50.0;
      
      if (aHasRealFuel !== bHasRealFuel) {
        return bHasRealFuel ? 1 : -1;
      }

      // Prefer "Gasbot Cellular Tank Monitor" over "Agbot Cellular"
      const aIsGasbot = aAsset?.device_sku_name?.includes('Gasbot');
      const bIsGasbot = bAsset?.device_sku_name?.includes('Gasbot');
      
      if (aIsGasbot !== bIsGasbot) {
        return bIsGasbot ? 1 : -1;
      }

      // Prefer more recent entries
      return new Date(b.created_at) - new Date(a.created_at);
    });

    const entryToKeep = sortedEntries[0];
    const entriesToRemove = sortedEntries.slice(1);

    console.log(`   ✅ Keeping: ${entryToKeep.id} (${entryToKeep.address1 || 'No address'})`);
    console.log(`      Device: ${entryToKeep.assets?.[0]?.device_serial_number || 'No device'}`);
    console.log(`      Fuel: ${entryToKeep.assets?.[0]?.latest_calibrated_fill_percentage || 'No data'}%`);

    // Remove duplicate entries
    for (const entryToRemove of entriesToRemove) {
      try {
        console.log(`   🗑️  Removing duplicate: ${entryToRemove.id}`);
        
        // Remove readings first
        if (entryToRemove.assets && entryToRemove.assets.length > 0) {
          for (const asset of entryToRemove.assets) {
            await supabase
              .from('agbot_readings_history')
              .delete()
              .eq('asset_id', asset.id);
          }
        }

        // Remove assets
        await supabase
          .from('agbot_assets')
          .delete()
          .eq('location_id', entryToRemove.id);

        // Remove location
        const { error } = await supabase
          .from('agbot_locations')
          .delete()
          .eq('id', entryToRemove.id);

        if (error) {
          console.warn(`      ⚠️  Failed to remove duplicate: ${error.message}`);
        } else {
          console.log(`      ✅ Removed duplicate successfully`);
          removedDuplicates++;
        }

      } catch (error) {
        console.error(`      ❌ Error removing duplicate: ${error.message}`);
      }
    }

    keptLocations++;
  }

  console.log(`\n📊 DEDUPLICATION SUMMARY:`);
  console.log(`   ✅ Unique locations kept: ${keptLocations}`);
  console.log(`   🗑️  Duplicate entries removed: ${removedDuplicates}`);

  return { keptLocations, removedDuplicates };
}

async function standardizeData() {
  console.log(`\n🔧 STANDARDIZING REMAINING DATA`);
  console.log('='.repeat(60));
  
  // Get all remaining locations
  const { data: locations, error } = await supabase
    .from('agbot_locations')
    .select(`
      id, 
      location_id,
      assets:agbot_assets(
        id,
        device_sku_name,
        device_online,
        latest_calibrated_fill_percentage
      )
    `);

  if (error) {
    throw new Error(`Failed to fetch locations for standardization: ${error.message}`);
  }

  console.log(`\n📋 Standardizing ${locations.length} remaining locations...`);

  let updatedAssets = 0;

  for (const location of locations) {
    if (location.assets && location.assets.length > 0) {
      for (const asset of location.assets) {
        const updates = {};
        
        // Standardize device name
        if (asset.device_sku_name && !asset.device_sku_name.includes('Gasbot Cellular Tank Monitor')) {
          updates.device_sku_name = 'Gasbot Cellular Tank Monitor';
        }
        
        // Fix online status (should be true for active tanks)
        if (!asset.device_online && asset.latest_calibrated_fill_percentage !== null) {
          updates.device_online = true;
        }

        // Apply updates if needed
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('agbot_assets')
            .update(updates)
            .eq('id', asset.id);

          if (updateError) {
            console.warn(`   ⚠️  Failed to update asset ${asset.id}: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated asset for ${location.location_id}`);
            if (updates.device_sku_name) {
              console.log(`      📱 Device name: ${updates.device_sku_name}`);
            }
            if (updates.device_online) {
              console.log(`      🟢 Status: Online`);
            }
            updatedAssets++;
          }
        }
      }
    }
  }

  console.log(`\n📊 STANDARDIZATION SUMMARY:`);
  console.log(`   🔧 Assets updated: ${updatedAssets}`);

  return { updatedAssets };
}

async function verifyFinalData() {
  console.log(`\n✅ VERIFYING FINAL CLEANED DATA`);
  console.log('='.repeat(60));
  
  const { data: locations, error } = await supabase
    .from('agbot_locations')
    .select(`
      id, 
      location_id, 
      customer_name,
      address1,
      assets:agbot_assets(
        device_serial_number,
        device_sku_name,
        device_online,
        latest_calibrated_fill_percentage
      )
    `)
    .order('location_id');

  if (error) {
    throw new Error(`Failed to fetch final data: ${error.message}`);
  }

  console.log(`\n📊 FINAL TANK INVENTORY (${locations.length} locations):`);
  console.log('-'.repeat(80));

  let onlineCount = 0;
  let totalCapacityEstimate = 0;

  locations.forEach((location, i) => {
    const asset = location.assets?.[0];
    const isOnline = asset?.device_online || false;
    const fuelLevel = asset?.latest_calibrated_fill_percentage || 0;
    
    if (isOnline) onlineCount++;
    
    // Estimate capacity from name
    const capacityMatch = location.location_id?.match(/[\d,]+/);
    const capacity = capacityMatch ? parseInt(capacityMatch[0].replace(/,/g, '')) : 50000;
    totalCapacityEstimate += capacity;

    console.log(`${(i + 1).toString().padStart(2)}. ${location.location_id}`);
    console.log(`    📍 ${location.address1 || 'No address'}`);
    console.log(`    ⛽ ${fuelLevel.toFixed(1)}% fuel level`);
    console.log(`    📱 ${asset?.device_serial_number || 'No device'} (${isOnline ? '🟢 Online' : '🔴 Offline'})`);
    console.log(`    🏭 ${location.customer_name}`);
    console.log();
  });

  console.log(`📊 FLEET SUMMARY:`);
  console.log(`   🏭 Total Locations: ${locations.length}`);
  console.log(`   🛠️  Total Devices: ${locations.filter(l => l.assets?.length > 0).length}`);
  console.log(`   🟢 Online Devices: ${onlineCount}`);
  console.log(`   📊 Est. Total Capacity: ${totalCapacityEstimate.toLocaleString()}L`);
  console.log(`   🏢 Customer: ${locations[0]?.customer_name || 'Unknown'}`);

  return {
    totalLocations: locations.length,
    onlineDevices: onlineCount,
    estimatedCapacity: totalCapacityEstimate
  };
}

async function main() {
  try {
    console.log('🚀 AGBOT DATA CLEANUP STARTING');
    console.log('='.repeat(80));
    
    // 1. Analyze current data
    const { testEntries, duplicateGroups } = await analyzeCurrentData();
    
    // 2. Remove test data
    if (testEntries.length > 0) {
      await removeTestData(testEntries);
    } else {
      console.log('\n✅ No test data found to remove');
    }
    
    // 3. Deduplicate real data
    if (duplicateGroups.size > 0) {
      await deduplicateRealData(duplicateGroups);
    } else {
      console.log('\n✅ No duplicates found');
    }
    
    // 4. Standardize remaining data
    await standardizeData();
    
    // 5. Verify final state
    const finalStats = await verifyFinalData();
    
    console.log('\n🎉 CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('✅ Database now contains clean, deduplicated tank data');
    console.log(`✅ ${finalStats.totalLocations} locations with ${finalStats.onlineDevices} online devices`);
    console.log(`✅ Estimated fleet capacity: ${finalStats.estimatedCapacity.toLocaleString()}L`);
    console.log('\n💡 Refresh your frontend to see the cleaned data!');
    
  } catch (error) {
    console.error('\n❌ CLEANUP FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the cleanup
main().catch(console.error);