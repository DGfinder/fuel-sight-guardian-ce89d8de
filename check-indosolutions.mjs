import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking for Indosolutions data...\n');

// Check customer_contacts
const { data: contacts } = await supabase
  .from('customer_contacts')
  .select('*')
  .ilike('customer_name', '%indosolutions%');

console.log('=== CUSTOMER CONTACTS ===');
console.log(`Found ${contacts?.length || 0} contacts`);
if (contacts) {
  contacts.forEach(c => {
    console.log(`  - ${c.customer_name} | ${c.contact_email} | ${c.contact_name || 'N/A'}`);
  });
}

// Check ta_agbot_locations
const { data: locations } = await supabase
  .from('ta_agbot_locations')
  .select('*')
  .ilike('customer_name', '%indosolutions%');

console.log('\n=== AGBOT LOCATIONS ===');
console.log(`Found ${locations?.length || 0} locations`);
if (locations) {
  locations.forEach(l => {
    console.log(`  - ${l.name} | Customer: ${l.customer_name}`);
  });

  // Check for exact duplicates by name
  const nameGroups = {};
  locations.forEach(l => {
    if (!nameGroups[l.name]) nameGroups[l.name] = [];
    nameGroups[l.name].push(l);
  });

  console.log('\n=== DUPLICATE CHECK ===');
  Object.entries(nameGroups).forEach(([name, locs]) => {
    if (locs.length > 1) {
      console.log(`⚠️  DUPLICATE: "${name}" appears ${locs.length} times`);
      locs.forEach(l => console.log(`    - ID: ${l.id}, Customer: ${l.customer_name}`));
    }
  });
}
