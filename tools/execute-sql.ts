#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}); 

async function executeSql(sql: string) {
  try {
    console.log('🔧 Executing SQL...');
    console.log('📝 SQL:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ SQL execution error:', error);
      return false;
    }
    
    console.log('✅ SQL executed successfully');
    if (data) {
      console.log('📊 Result:', data);
    }
    return true;
    
  } catch (err) {
    console.error('❌ Execution failed:', err);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx execute-sql.ts "SQL_STATEMENT" or npx tsx execute-sql.ts --file filename.sql');
    process.exit(1);
  }
  
  let sql: string;
  
  if (args[0] === '--file') {
    if (args.length < 2) {
      console.error('Please provide a filename after --file');
      process.exit(1);
    }
    try {
      sql = readFileSync(args[1], 'utf8');
    } catch (err) {
      console.error('❌ Could not read file:', err);
      process.exit(1);
    }
  } else {
    sql = args[0];
  }
  
  // Split SQL into individual statements
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (statement.length === 0) continue;
    
    console.log(`\n--- Statement ${i + 1}/${statements.length} ---`);
    const success = await executeSql(statement);
    
    if (!success) {
      console.error(`❌ Failed to execute statement ${i + 1}`);
      process.exit(1);
    }
  }
  
  console.log('\n✅ All statements executed successfully');
}

main().catch(console.error);