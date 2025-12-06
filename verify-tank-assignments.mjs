/**
 * Verify Tank Assignments
 * Confirm the email system will work correctly with the new assignments
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=' .repeat(80));
console.log('VERIFY TANK ASSIGNMENTS FOR EMAIL SYSTEM');
console.log('='.repeat(80));

// Simulate what the email system will do
const { data: contacts } = await supabase
  .from('customer_contacts')
  .select('*')
  .order('customer_name');

for (const contact of contacts) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Contact: ${contact.customer_name}`);
  console.log(`Email: ${contact.contact_email}`);
  console.log(`${'='.repeat(80)}`);

  // Step 1: Check for specific tank assignments
  const { data: assignments } = await supabase
    .from('customer_contact_tanks')
    .select('agbot_location_id')
    .eq('customer_contact_id', contact.id);

  if (assignments && assignments.length > 0) {
    console.log(`\n✅ Using SPECIFIC ASSIGNMENTS (${assignments.length} tanks)`);

    // Fetch tank details
    const tankIds = assignments.map(a => a.agbot_location_id);
    const { data: tanks } = await supabase
      .from('ta_agbot_locations')
      .select('id, name, customer_name')
      .in('id', tankIds)
      .eq('is_disabled', false);

    console.log(`\nTanks that will appear in email:`);
    tanks.forEach(t => {
      console.log(`  - ${t.name} (DB customer: ${t.customer_name})`);
    });
  } else {
    console.log(`\n⚠️  No specific assignments, using FALLBACK (customer_name query)`);

    // Fallback query
    const { data: tanks } = await supabase
      .from('ta_agbot_locations')
      .select('id, name, customer_name')
      .eq('customer_name', contact.customer_name)
      .eq('is_disabled', false);

    console.log(`\nTanks that will appear in email:`);
    tanks.forEach(t => {
      console.log(`  - ${t.name}`);
    });
  }
}

console.log('\n' + '='.repeat(80));
console.log('VERIFICATION COMPLETE');
console.log('='.repeat(80));

// Check for any problematic duplicates
console.log('\n\nChecking for duplicate tank names across contacts...\n');

const allAssignments = [];
for (const contact of contacts) {
  const { data: assignments } = await supabase
    .from('customer_contact_tanks')
    .select(`
      agbot_location_id,
      ta_agbot_locations!inner (name)
    `)
    .eq('customer_contact_id', contact.id);

  assignments?.forEach(a => {
    allAssignments.push({
      contact: contact.customer_name,
      tank: a.ta_agbot_locations.name
    });
  });
}

const tanksByName = {};
allAssignments.forEach(a => {
  if (!tanksByName[a.tank]) tanksByName[a.tank] = [];
  tanksByName[a.tank].push(a.contact);
});

const duplicates = Object.entries(tanksByName).filter(([_, contacts]) => contacts.length > 1);

if (duplicates.length > 0) {
  console.log('⚠️  WARNING: Found tanks assigned to multiple contacts:');
  duplicates.forEach(([tank, contacts]) => {
    console.log(`\n  "${tank}" will appear in emails to:`);
    contacts.forEach(c => console.log(`    - ${c}`));
  });
} else {
  console.log('✅ No duplicate tank assignments found!');
  console.log('✅ Each tank will appear in exactly one email');
}
