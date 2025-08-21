/*
  Analyze Driver Activity
  - Check LYTX activity to identify inactive drivers
*/

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

async function main() {
  // Setup Supabase client
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') || '';
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Analyzing driver activity for inactive status determination...\n');

  // Get all drivers
  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, fleet')
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

  // Check which drivers have no recent activity
  const inactiveDrivers = allDrivers?.filter(driver => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase().trim();
    return !recentDriverNames.has(fullName);
  }) || [];

  console.log(`\nDrivers with NO LYTX activity in last 6 months (${inactiveDrivers.length}):`);
  inactiveDrivers.slice(0, 20).forEach(driver => {
    console.log(`  ${driver.first_name} ${driver.last_name} (${driver.fleet})`);
  });
  
  if (inactiveDrivers.length > 20) {
    console.log(`  ... and ${inactiveDrivers.length - 20} more`);
  }

  // Also check 3 month activity for comparison
  const threeMonthsAgo = new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recent3MonthEvents } = await supabase
    .from('lytx_safety_events')
    .select('driver_name')
    .gte('event_datetime', threeMonthsAgo);

  const recent3MonthNames = new Set(recent3MonthEvents?.map(e => e.driver_name.toLowerCase().trim()) || []);
  
  const inactive3Months = allDrivers?.filter(driver => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase().trim();
    return !recent3MonthNames.has(fullName);
  }) || [];

  console.log(`\nDrivers with NO LYTX activity in last 3 months (${inactive3Months.length})`);

  // Summary
  console.log('\n📊 Activity Summary:');
  console.log(`- Total drivers: ${allDrivers?.length}`);
  console.log(`- Active in last 3 months: ${allDrivers?.length - inactive3Months.length}`);
  console.log(`- Active in last 6 months: ${allDrivers?.length - inactiveDrivers.length}`);
  console.log(`- Inactive (6+ months): ${inactiveDrivers.length}`);

  console.log('\n💡 Recommendation:');
  console.log(`Mark ${inactiveDrivers.length} drivers as 'Inactive' (no LYTX activity in 6+ months)`);

  return {
    totalDrivers: allDrivers?.length || 0,
    activeDrivers: (allDrivers?.length || 0) - inactiveDrivers.length,
    inactiveDrivers: inactiveDrivers.length,
    inactiveDriversList: inactiveDrivers
  };
}

main().catch((err) => {
  console.error('Analysis failed:', err.message);
  process.exit(1);
});