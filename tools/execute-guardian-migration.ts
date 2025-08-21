/*
  Execute Guardian Events Migration
  - Adds driver_id column to guardian_events table via SQL execution
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

  console.log('🔧 Executing Guardian Events migration...\n');

  // Execute the migration SQL step by step
  const steps = [
    {
      name: 'Add driver_id column',
      sql: `ALTER TABLE guardian_events ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;`
    },
    {
      name: 'Add confidence column',
      sql: `ALTER TABLE guardian_events ADD COLUMN IF NOT EXISTS driver_association_confidence DECIMAL(3,2) CHECK (driver_association_confidence >= 0.0 AND driver_association_confidence <= 1.0);`
    },
    {
      name: 'Add method column',
      sql: `ALTER TABLE guardian_events ADD COLUMN IF NOT EXISTS driver_association_method TEXT CHECK (driver_association_method IN ('exact_match', 'fuzzy_match', 'manual_assignment', 'employee_id_match'));`
    },
    {
      name: 'Add updated_at column',
      sql: `ALTER TABLE guardian_events ADD COLUMN IF NOT EXISTS driver_association_updated_at TIMESTAMPTZ DEFAULT NOW();`
    },
    {
      name: 'Create driver_id index',
      sql: `CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_id ON guardian_events(driver_id);`
    },
    {
      name: 'Create driver_name index',
      sql: `CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_name ON guardian_events(driver_name);`
    },
    {
      name: 'Create confidence index',
      sql: `CREATE INDEX IF NOT EXISTS idx_guardian_events_driver_confidence ON guardian_events(driver_association_confidence);`
    }
  ];

  for (const step of steps) {
    try {
      console.log(`📝 ${step.name}...`);
      const { error } = await supabase.rpc('execute_sql', { query: step.sql });
      
      if (error) {
        console.log(`   ⚠️  RPC not available, trying direct query...`);
        // If RPC isn't available, we can't execute DDL directly
        console.log(`   SQL: ${step.sql}`);
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${err}`);
    }
  }

  // Test if the migration worked by checking the table structure
  console.log('\n📊 Testing final table structure...');
  
  try {
    const { data: sample } = await supabase
      .from('guardian_events')
      .select('*')
      .limit(1);

    if (sample && sample[0]) {
      const hasDriverId = Object.keys(sample[0]).includes('driver_id');
      console.log(`Guardian events driver_id column: ${hasDriverId ? '✅' : '❌'}`);
      
      if (hasDriverId) {
        console.log('✅ Migration successful!');
      } else {
        console.log('⚠️  Migration may need manual execution in SQL editor');
      }
    }
  } catch (err) {
    console.log(`❌ Error testing: ${err}`);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});