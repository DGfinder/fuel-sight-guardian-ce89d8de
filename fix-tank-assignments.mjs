/**
 * Fix Tank Assignments
 * Properly assign tanks to contacts using customer_contact_tanks junction table
 *
 * PROBLEM:
 * - "Indosolutions" tank appears under both "Great Southern Fuel Supplies" and "Indusolutions" customers
 * - This causes duplicate entries in emails
 *
 * SOLUTION:
 * Use customer_contact_tanks junction table to explicitly assign tanks to contacts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=' .repeat(80));
console.log('FIX TANK ASSIGNMENTS');
console.log('='.repeat(80));

// Step 1: Get all contacts
console.log('\nStep 1: Fetching contacts...');
const { data: contacts, error: contactsError } = await supabase
  .from('customer_contacts')
  .select('*')
  .order('customer_name', { ascending: true });

if (contactsError) {
  console.error('❌ Error fetching contacts:', contactsError);
  process.exit(1);
}

console.log(`✅ Found ${contacts.length} contacts:`);
contacts.forEach(c => {
  console.log(`  - ${c.customer_name} (${c.contact_email})`);
});

// Step 2: Get all tanks
console.log('\nStep 2: Fetching tanks...');
const { data: tanks, error: tanksError } = await supabase
  .from('ta_agbot_locations')
  .select('id, name, customer_name, is_disabled')
  .eq('is_disabled', false)
  .order('customer_name, name', { ascending: true });

if (tanksError) {
  console.error('❌ Error fetching tanks:', tanksError);
  process.exit(1);
}

console.log(`✅ Found ${tanks.length} tanks`);

// Step 3: Build assignment rules
console.log('\nStep 3: Building assignment rules...');

const assignments = [];

// Rule 1: Indusolutions contact gets only the Indusolutions tank (customer = "Indusolutions")
const indusolutionsContact = contacts.find(c => c.customer_name === 'Indusolutions');
const indusolutionsTank = tanks.find(t => t.customer_name === 'Indusolutions');

if (indusolutionsContact && indusolutionsTank) {
  assignments.push({
    contact_id: indusolutionsContact.id,
    contact_name: indusolutionsContact.customer_name,
    tank_id: indusolutionsTank.id,
    tank_name: indusolutionsTank.name,
  });
  console.log(`✅ Indusolutions → "${indusolutionsTank.name}"`);
}

// Rule 2: Great Southern Fuel Supplies gets all their tanks (including the one named "Indosolutions")
const gsfContact = contacts.find(c => c.customer_name === 'Great Southern Fuel Supplies');
const gsfTanks = tanks.filter(t => t.customer_name === 'Great Southern Fuel Supplies');

if (gsfContact && gsfTanks.length > 0) {
  gsfTanks.forEach(tank => {
    assignments.push({
      contact_id: gsfContact.id,
      contact_name: gsfContact.customer_name,
      tank_id: tank.id,
      tank_name: tank.name,
    });
  });
  console.log(`✅ Great Southern Fuel Supplies → ${gsfTanks.length} tanks`);
}

// Rule 3: Wonder Mine Site contact
const wonderContact = contacts.find(c => c.customer_name === 'Wonder Mine Site');
const wonderTanks = tanks.filter(t => t.name.toLowerCase().includes('wonder'));

if (wonderContact && wonderTanks.length > 0) {
  wonderTanks.forEach(tank => {
    assignments.push({
      contact_id: wonderContact.id,
      contact_name: wonderContact.customer_name,
      tank_id: tank.id,
      tank_name: tank.name,
    });
  });
  console.log(`✅ Wonder Mine Site → ${wonderTanks.length} tanks`);
}

console.log(`\n📊 Total assignments to create: ${assignments.length}`);

// Step 4: Clear existing assignments
console.log('\nStep 4: Clearing existing assignments...');
const { error: deleteError } = await supabase
  .from('customer_contact_tanks')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

if (deleteError) {
  console.error('❌ Error clearing assignments:', deleteError);
  process.exit(1);
}

console.log('✅ Existing assignments cleared');

// Step 5: Insert new assignments
console.log('\nStep 5: Inserting new assignments...');

let inserted = 0;
let failed = 0;

for (const assignment of assignments) {
  const { error } = await supabase
    .from('customer_contact_tanks')
    .insert({
      customer_contact_id: assignment.contact_id,
      agbot_location_id: assignment.tank_id,
      notes: `Auto-assigned by fix-tank-assignments.mjs on ${new Date().toISOString()}`,
    });

  if (error) {
    console.error(`❌ Failed to assign "${assignment.tank_name}" to ${assignment.contact_name}:`, error.message);
    failed++;
  } else {
    inserted++;
  }
}

console.log(`\n✅ Inserted ${inserted} assignments`);
if (failed > 0) {
  console.log(`⚠️  Failed: ${failed} assignments`);
}

// Step 6: Verify assignments
console.log('\nStep 6: Verifying assignments...');

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
  if (assignedTanks && assignedTanks.length > 0) {
    assignedTanks.forEach(at => {
      console.log(`  ✅ ${at.ta_agbot_locations.name}`);
    });
  } else {
    console.log(`  ⚠️  No tanks assigned (will fall back to customer_name query)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ TANK ASSIGNMENTS FIXED');
console.log('='.repeat(80));
console.log('\nNEXT STEPS:');
console.log('1. The email system will now use explicit tank assignments');
console.log('2. Each contact will only see their assigned tanks');
console.log('3. No more duplicate Indosolutions entries!');
console.log('4. Test by sending a test email to each contact');
