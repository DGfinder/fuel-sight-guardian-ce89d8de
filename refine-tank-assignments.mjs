/**
 * Refine Tank Assignments
 * Remove overlapping assignments where multiple contacts have the same tank
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking for overlapping tank assignments...\n');

// Get all assignments
const { data: assignments } = await supabase
  .from('customer_contact_tanks')
  .select(`
    id,
    customer_contact_id,
    agbot_location_id,
    customer_contacts!inner (
      customer_name
    ),
    ta_agbot_locations!inner (
      name
    )
  `);

// Group by tank
const tankGroups = {};
assignments.forEach(a => {
  const tankId = a.agbot_location_id;
  const tankName = a.ta_agbot_locations.name;
  if (!tankGroups[tankId]) {
    tankGroups[tankId] = {
      name: tankName,
      assignments: []
    };
  }
  tankGroups[tankId].assignments.push({
    id: a.id,
    customer: a.customer_contacts.customer_name
  });
});

// Find duplicates
console.log('=== OVERLAPPING ASSIGNMENTS ===\n');
const duplicates = [];
Object.entries(tankGroups).forEach(([tankId, data]) => {
  if (data.assignments.length > 1) {
    console.log(`⚠️  "${data.name}" is assigned to ${data.assignments.length} contacts:`);
    data.assignments.forEach(a => {
      console.log(`   - ${a.customer}`);
    });
    duplicates.push({ tankId, ...data });
  }
});

if (duplicates.length === 0) {
  console.log('✅ No overlapping assignments found!');
  process.exit(0);
}

console.log('\n=== RESOLUTION STRATEGY ===\n');

// Ask for confirmation before making changes
console.log('The following tanks have multiple assignments:');
duplicates.forEach(d => {
  console.log(`\n"${d.name}":`);
  d.assignments.forEach(a => {
    console.log(`  - ${a.customer}`);
  });

  // Suggest resolution
  if (d.name.toLowerCase().includes('indosolutions')) {
    console.log('  → KEEP: Indusolutions (more specific customer)');
    console.log('  → REMOVE: Great Southern Fuel Supplies');
  } else if (d.name.toLowerCase().includes('wonder')) {
    console.log('  → KEEP: Wonder Mine Site (more specific customer)');
    console.log('  → REMOVE: Great Southern Fuel Supplies');
  }
});

console.log('\n⚠️  This is information only. Please review the assignments.');
console.log('To remove duplicates, manually update the customer_contact_tanks table.');
