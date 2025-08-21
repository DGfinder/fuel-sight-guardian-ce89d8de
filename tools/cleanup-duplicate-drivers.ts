/*
  Clean Up Duplicate Driver Records
  - Identifies duplicate drivers (same name + fleet)
  - Consolidates to keep the oldest/best record
  - Updates foreign key references
  - Removes duplicates
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  fleet: string;
  status: string;
  created_at: string;
  employee_id?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun');
  
  // Setup Supabase client
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Analyzing duplicate driver records...');
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}\n`);

  // Get all drivers
  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, fleet, status, created_at, employee_id')
    .order('created_at', { ascending: true });

  if (!allDrivers) {
    throw new Error('Failed to load drivers');
  }

  console.log(`Total driver records: ${allDrivers.length}`);

  // Group drivers by name + fleet
  const driverGroups = new Map<string, Driver[]>();
  
  allDrivers.forEach(driver => {
    const key = `${driver.first_name} ${driver.last_name} (${driver.fleet})`;
    if (!driverGroups.has(key)) {
      driverGroups.set(key, []);
    }
    driverGroups.get(key)!.push(driver);
  });

  // Find duplicates
  const duplicateGroups = Array.from(driverGroups.entries())
    .filter(([key, drivers]) => drivers.length > 1);

  console.log(`Unique drivers: ${driverGroups.size}`);
  console.log(`Groups with duplicates: ${duplicateGroups.length}`);
  console.log(`Total duplicate records to remove: ${allDrivers.length - driverGroups.size}\n`);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  // Show duplicate analysis
  console.log('🔍 Duplicate groups analysis:');
  duplicateGroups.slice(0, 5).forEach(([key, drivers]) => {
    console.log(`\n${key} (${drivers.length} records):`);
    drivers.forEach((driver, index) => {
      console.log(`  ${index + 1}. ID: ${driver.id.substring(0, 8)}... Status: ${driver.status} Created: ${driver.created_at.substring(0, 10)} EmpID: ${driver.employee_id || 'null'}`);
    });
  });

  if (duplicateGroups.length > 5) {
    console.log(`\n... and ${duplicateGroups.length - 5} more duplicate groups`);
  }

  if (dryRun) {
    console.log('\n🧪 DRY RUN - No changes will be made');
    console.log('\nRecommendation: Run without --dry-run to perform cleanup');
    return;
  }

  console.log('\n🧹 Starting cleanup process...');

  let recordsDeleted = 0;
  let groupsProcessed = 0;

  for (const [key, drivers] of duplicateGroups) {
    // Choose the "best" record to keep (prioritize: oldest, then Active status)
    const sortedDrivers = drivers.sort((a, b) => {
      // First priority: Active status
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (b.status === 'Active' && a.status !== 'Active') return 1;
      
      // Second priority: Oldest created date
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keepDriver = sortedDrivers[0];
    const deleteDrivers = sortedDrivers.slice(1);

    console.log(`\n📝 Processing: ${key}`);
    console.log(`   Keeping: ${keepDriver.id.substring(0, 8)}... (${keepDriver.status}, ${keepDriver.created_at.substring(0, 10)})`);
    console.log(`   Deleting: ${deleteDrivers.length} records`);

    // Check for foreign key references
    for (const deleteDriver of deleteDrivers) {
      // Check LYTX associations
      const { count: lytxCount } = await supabase
        .from('lytx_safety_events')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', deleteDriver.id);

      if (lytxCount && lytxCount > 0) {
        console.log(`   ⚠️  Moving ${lytxCount} LYTX associations from ${deleteDriver.id.substring(0, 8)}... to ${keepDriver.id.substring(0, 8)}...`);
        
        // Update LYTX events to point to the kept driver
        const { error: updateError } = await supabase
          .from('lytx_safety_events')
          .update({ driver_id: keepDriver.id })
          .eq('driver_id', deleteDriver.id);

        if (updateError) {
          console.error(`   ❌ Failed to update LYTX associations: ${updateError.message}`);
          continue;
        }
      }

      // Delete the duplicate driver
      const { error: deleteError } = await supabase
        .from('drivers')
        .delete()
        .eq('id', deleteDriver.id);

      if (deleteError) {
        console.error(`   ❌ Failed to delete driver ${deleteDriver.id}: ${deleteError.message}`);
      } else {
        recordsDeleted++;
        console.log(`   ✅ Deleted: ${deleteDriver.id.substring(0, 8)}...`);
      }
    }

    groupsProcessed++;
  }

  console.log('\n📊 Cleanup Summary:');
  console.log(`✅ Groups processed: ${groupsProcessed}`);
  console.log(`🗑️  Records deleted: ${recordsDeleted}`);

  // Final verification
  const { count: finalCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });

  console.log(`📈 Final driver count: ${finalCount}`);
  console.log(`📉 Records reduced by: ${allDrivers.length - (finalCount || 0)}`);

  console.log('\n✅ Duplicate cleanup completed!');
}

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});