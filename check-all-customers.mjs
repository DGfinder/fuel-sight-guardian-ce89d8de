import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking all customer data...\n');

// Get unique customer names from ta_agbot_locations
const { data: locations } = await supabase
  .from('ta_agbot_locations')
  .select('customer_name, name')
  .order('customer_name', { ascending: true });

console.log('=== ALL AGBOT LOCATIONS ===');
console.log(`Found ${locations?.length || 0} locations`);

if (locations) {
  // Group by customer
  const customerGroups = {};
  locations.forEach(l => {
    const customer = l.customer_name || 'Unknown';
    if (!customerGroups[customer]) {
      customerGroups[customer] = [];
    }
    customerGroups[customer].push(l.name);
  });

  Object.entries(customerGroups).forEach(([customer, tanks]) => {
    console.log(`\n${customer} (${tanks.length} tanks):`);
    tanks.forEach(tank => console.log(`  - ${tank}`));
  });

  // Check for duplicate tank names
  const tankNames = {};
  locations.forEach(l => {
    if (!tankNames[l.name]) tankNames[l.name] = [];
    tankNames[l.name].push(l.customer_name);
  });

  console.log('\n=== DUPLICATE TANK NAMES ===');
  Object.entries(tankNames).forEach(([tank, customers]) => {
    if (customers.length > 1) {
      console.log(`⚠️  "${tank}" appears under ${customers.length} customers:`);
      customers.forEach(c => console.log(`    - ${c}`));
    }
  });
}

// Check customer_contacts
const { data: contacts } = await supabase
  .from('customer_contacts')
  .select('*')
  .order('customer_name', { ascending: true });

console.log('\n=== ALL CUSTOMER CONTACTS ===');
console.log(`Found ${contacts?.length || 0} contacts`);
if (contacts) {
  contacts.forEach(c => {
    console.log(`  - ${c.customer_name} | ${c.contact_email} | Enabled: ${c.enabled}`);
  });
}
