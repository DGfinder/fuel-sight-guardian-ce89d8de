#!/usr/bin/env node

// Final Agbot Data Cleanup - Remove remaining subtle duplicates

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalCleanup() {
  console.log('\n🔧 FINAL AGBOT CLEANUP - REMOVING SUBTLE DUPLICATES');
  console.log('='.repeat(70));
  
  // Get all current locations
  const { data: locations, error } = await supabase
    .from('agbot_locations')
    .select(`
      id, 
      location_id, 
      address1,
      assets:agbot_assets(
        id,
        device_serial_number,
        latest_calibrated_fill_percentage
      )
    `)
    .order('created_at');

  if (error) {
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }

  console.log(`\n📋 Current locations: ${locations.length}`);

  // Manual cleanup of specific duplicates identified
  const cleanupActions = [
    {
      reason: 'Remove duplicate O\'Meehan Farms (no address)',
      keep: locations.find(l => l.location_id?.includes('O\'Meehan') && l.address1?.includes('O\'Meehan')),
      remove: locations.filter(l => l.location_id?.includes('O\'Meehan') && (!l.address1 || !l.address1.includes('O\'Meehan')))
    },
    {
      reason: 'Remove Corrigin Tank 3 without proper address',
      keep: locations.find(l => l.location_id === 'Corrigin Diesel Tank 3 54,400ltrs' && l.address1?.includes('Corrigin')),
      remove: locations.filter(l => 
        l.location_id === 'Corrigin Tank 3 Diesel 54,400ltrs' || 
        (l.location_id?.includes('Corrigin') && l.location_id?.includes('Tank 3') && !l.address1?.includes('Corrigin'))
      )
    },
    {
      reason: 'Remove mystery 0000100837 entry',
      keep: null,
      remove: locations.filter(l => l.location_id === '0000100837' || l.location_id?.startsWith('0000100837'))
    }
  ];

  let totalRemoved = 0;

  for (const action of cleanupActions) {
    if (action.remove && action.remove.length > 0) {
      console.log(`\n🗑️  ${action.reason}`);
      
      for (const locationToRemove of action.remove) {
        if (!locationToRemove) continue;
        
        try {
          console.log(`   Removing: ${locationToRemove.location_id} (${locationToRemove.id})`);
          
          // Remove readings first
          if (locationToRemove.assets && locationToRemove.assets.length > 0) {
            for (const asset of locationToRemove.assets) {
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
            .eq('location_id', locationToRemove.id);

          // Remove location
          const { error: deleteError } = await supabase
            .from('agbot_locations')
            .delete()
            .eq('id', locationToRemove.id);

          if (deleteError) {
            console.warn(`   ⚠️  Failed to remove: ${deleteError.message}`);
          } else {
            console.log(`   ✅ Removed successfully`);
            totalRemoved++;
          }

        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    }
  }

  console.log(`\n📊 FINAL CLEANUP SUMMARY:`);
  console.log(`   🗑️  Additional entries removed: ${totalRemoved}`);

  // Verify final state
  const { data: finalLocations } = await supabase
    .from('agbot_locations')
    .select(`
      id, 
      location_id, 
      address1,
      assets:agbot_assets(device_serial_number, latest_calibrated_fill_percentage)
    `)
    .order('location_id');

  console.log(`\n✅ FINAL VERIFICATION - ${finalLocations?.length || 0} LOCATIONS:`);
  console.log('-'.repeat(70));

  finalLocations?.forEach((location, i) => {
    const asset = location.assets?.[0];
    const fuelLevel = asset?.latest_calibrated_fill_percentage || 0;
    
    console.log(`${(i + 1).toString().padStart(2)}. ${location.location_id}`);
    console.log(`    📍 ${location.address1 || 'No address'}`);
    console.log(`    ⛽ ${fuelLevel}% | 📱 ${asset?.device_serial_number || 'No device'}`);
    console.log();
  });

  const expectedTanks = [
    'O\'Meehan Farms Tank A 65,500ltrs',
    'Mick Water Tank', 
    'Mick Harders Tank',
    'Lawsons Jerry South 53,000',
    'Lake Grace Diesel 110',
    'Katanning Depot Diesel',
    'Jacup Diesel 53,000',
    'Corrigin Tank 4 Diesel 54,400ltrs',
    'Corrigin Diesel Tank 3 54,400ltrs',
    'Bruce Rock Diesel'
  ];

  console.log(`🎯 TARGET: ${expectedTanks.length} tanks | ACTUAL: ${finalLocations?.length || 0} tanks`);
  
  if ((finalLocations?.length || 0) === expectedTanks.length) {
    console.log('✅ PERFECT! We have exactly 10 clean tank entries.');
  } else {
    console.log(`⚠️  Still need to remove ${(finalLocations?.length || 0) - expectedTanks.length} more entries.`);
  }

  return finalLocations;
}

async function main() {
  try {
    console.log('🔧 FINAL AGBOT DATA CLEANUP');
    console.log('='.repeat(50));
    
    const result = await finalCleanup();
    
    console.log('\n🎉 FINAL CLEANUP COMPLETE!');
    console.log(`✅ ${result?.length || 0} tanks remain in the database`);
    console.log('\n💡 Refresh your frontend to see the clean data!');
    
  } catch (error) {
    console.error('\n❌ FINAL CLEANUP FAILED:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);