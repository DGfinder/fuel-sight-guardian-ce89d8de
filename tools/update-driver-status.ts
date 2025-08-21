/*
  Update Driver Status Based on Activity
  - Mark drivers as inactive if no LYTX activity in last 6 months
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
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

  console.log('Updating driver status based on activity...');
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}\n`);

  // Get all active drivers
  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, fleet, status')
    .eq('status', 'Active');

  console.log(`Total active drivers: ${allDrivers?.length}`);

  // Check LYTX activity in last 6 months
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentLytxEvents } = await supabase
    .from('lytx_safety_events')
    .select('driver_name')
    .gte('event_datetime', sixMonthsAgo);

  // Get unique driver names from recent LYTX events
  const recentDriverNames = new Set(recentLytxEvents?.map(e => e.driver_name.toLowerCase().trim()) || []);
  
  console.log(`Drivers with LYTX activity in last 6 months: ${recentDriverNames.size}`);

  // Identify drivers to mark as inactive
  const driversToUpdate = allDrivers?.filter(driver => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase().trim();
    return !recentDriverNames.has(fullName);
  }) || [];

  console.log(`\nDrivers to mark as INACTIVE (${driversToUpdate.length}):`);
  
  if (dryRun) {
    console.log('DRY RUN - No changes will be made');
    driversToUpdate.slice(0, 10).forEach(driver => {
      console.log(`  ${driver.first_name} ${driver.last_name} (${driver.fleet})`);
    });
    if (driversToUpdate.length > 10) {
      console.log(`  ... and ${driversToUpdate.length - 10} more`);
    }
    return;
  }

  // Update drivers to inactive status
  let updated = 0;
  let failed = 0;

  for (const driver of driversToUpdate) {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ 
          status: 'Inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', driver.id);

      if (error) {
        console.error(`❌ Failed to update ${driver.first_name} ${driver.last_name}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${driver.first_name} ${driver.last_name} → Inactive`);
        updated++;
      }
    } catch (err) {
      console.error(`❌ Error updating ${driver.first_name} ${driver.last_name}: ${err}`);
      failed++;
    }
  }

  console.log(`\n📊 Update Summary:`);
  console.log(`✅ Updated to Inactive: ${updated}`);
  console.log(`❌ Failed updates: ${failed}`);

  // Final verification
  const { count: activeCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active');

  const { count: inactiveCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Inactive');

  console.log(`\n🎯 Final Status:`);
  console.log(`Active drivers: ${activeCount}`);
  console.log(`Inactive drivers: ${inactiveCount}`);
  console.log(`Total drivers: ${(activeCount || 0) + (inactiveCount || 0)}`);
}

main().catch((err) => {
  console.error('Update failed:', err.message);
  process.exit(1);
});