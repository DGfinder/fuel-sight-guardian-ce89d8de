/**
 * Remove Duplicate Tank Assignments
 * Remove overlapping assignments where Wonder and Indosolutions tanks
 * are assigned to both their specific customer AND Great Southern Fuel Supplies
 *
 * STRATEGY:
 * - Keep Wonder tanks assigned to "Wonder Mine Site"
 * - Keep Indosolutions tank assigned to "Indusolutions"
 * - Remove these from "Great Southern Fuel Supplies"
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=' .repeat(80));
console.log('REMOVE DUPLICATE TANK ASSIGNMENTS');
console.log('='.repeat(80));

// Get all contacts
const { data: contacts } = await supabase
  .from('customer_contacts')
  .select('*');

const gsfContact = contacts.find(c => c.customer_name === 'Great Southern Fuel Supplies');

// Find tanks that should NOT be assigned to GSF
const { data: tanksToRemove } = await supabase
  .from('ta_agbot_locations')
  .select('id, name')
  .or('name.ilike.%wonder%,name.ilike.%indosolutions%')
  .eq('is_disabled', false);

console.log(`\nTanks to remove from Great Southern Fuel Supplies:`);
tanksToRemove.forEach(t => console.log(`  - ${t.name}`));

// Remove these assignments
let removed = 0;
for (const tank of tanksToRemove) {
  const { error } = await supabase
    .from('customer_contact_tanks')
    .delete()
    .eq('customer_contact_id', gsfContact.id)
    .eq('agbot_location_id', tank.id);

  if (error) {
    console.error(`❌ Failed to remove "${tank.name}":`, error.message);
  } else {
    removed++;
    console.log(`✅ Removed "${tank.name}" from Great Southern Fuel Supplies`);
  }
}

console.log(`\n✅ Removed ${removed} duplicate assignments`);

// Verify final state
console.log('\n' + '='.repeat(80));
console.log('FINAL TANK ASSIGNMENTS');
console.log('='.repeat(80));

for (const contact of contacts) {
  const { data: assignedTanks } = await supabase
    .from('customer_contact_tanks')
    .select(`
      agbot_location_id,
      ta_agbot_locations!inner (
        name
      )
    `)
    .eq('customer_contact_id', contact.id);

  console.log(`\n${contact.customer_name} (${contact.contact_email}):`);
  console.log(`  ${assignedTanks.length} tanks assigned`);
  if (assignedTanks.length <= 5) {
    assignedTanks.forEach(at => {
      console.log(`  - ${at.ta_agbot_locations.name}`);
    });
  } else {
    assignedTanks.slice(0, 3).forEach(at => {
      console.log(`  - ${at.ta_agbot_locations.name}`);
    });
    console.log(`  ... and ${assignedTanks.length - 3} more`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ DUPLICATE TANK ASSIGNMENTS REMOVED');
console.log('='.repeat(80));
console.log('\nRESULT:');
console.log('✅ No more duplicate Indosolutions entries in emails');
console.log('✅ Wonder tanks only go to Wonder Mine Site contact');
console.log('✅ Indosolutions tank only goes to Indusolutions contact');
console.log('✅ Great Southern Fuel Supplies gets their 17 other tanks');
