import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.log('❌ VITE_SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGuardianEvents() {
  console.log('🔍 Checking guardian_events table...');
  
  try {
    // Check table existence and count
    const { count, error: countError } = await supabase
      .from('guardian_events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error checking guardian_events:', countError.message);
      return;
    }
    
    console.log(`📊 guardian_events table exists with ${count} records`);
    
    if (count > 0) {
      // Get sample records
      const { data: sample, error: sampleError } = await supabase
        .from('guardian_events')
        .select('*')
        .limit(3);
        
      if (sampleError) {
        console.log('❌ Error fetching sample:', sampleError.message);
      } else {
        console.log('📋 Sample records:');
        console.log(JSON.stringify(sample, null, 2));
      }
      
      // Get fleet breakdown
      const { data: allRecords, error: fleetError } = await supabase
        .from('guardian_events')
        .select('fleet');
      
      if (!fleetError && allRecords) {
        const fleets = {};
        allRecords.forEach(record => {
          fleets[record.fleet] = (fleets[record.fleet] || 0) + 1;
        });
        console.log('🏢 Fleet breakdown:', fleets);
      }
    } else {
      console.log('📝 Table is empty - need to import Guardian events data');
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

checkGuardianEvents().then(() => process.exit(0));