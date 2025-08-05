#!/usr/bin/env npx tsx

/**
 * SIMPLE CAPTIVE PAYMENTS VERIFICATION
 * 
 * Basic check of captive payments system status without RLS dependencies
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorLog(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName: string): Promise<{ exists: boolean; count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return { exists: false, count: 0, error: error.message };
    }
    
    return { exists: true, count: count || 0 };
  } catch (err: any) {
    return { exists: false, count: 0, error: err.message };
  }
}

async function main() {
  colorLog('cyan', '🔍 SIMPLE CAPTIVE PAYMENTS VERIFICATION');
  console.log('');
  
  const tables = [
    'captive_payment_records',
    'captive_deliveries',
    'captive_monthly_analytics',
    'captive_customer_analytics', 
    'captive_terminal_analytics',
    'secure_captive_deliveries',
    'secure_captive_monthly_analytics',
    'secure_captive_customer_analytics',
    'secure_captive_terminal_analytics'
  ];
  
  const results: { [key: string]: { exists: boolean; count: number; error?: string } } = {};
  
  for (const table of tables) {
    colorLog('blue', `📊 Checking ${table}...`);
    const result = await checkTable(table);
    results[table] = result;
    
    if (result.exists) {
      colorLog('green', `✅ ${table}: ${result.count.toLocaleString()} records`);
    } else {
      colorLog('red', `❌ ${table}: ${result.error}`);
    }
  }
  
  console.log('');
  colorLog('cyan', '📋 SUMMARY');
  console.log('='.repeat(50));
  
  const baseTablesExist = results['captive_payment_records']?.exists && results['captive_deliveries']?.exists;
  const analyticsViewsExist = results['captive_monthly_analytics']?.exists;
  const secureViewsExist = Object.keys(results)
    .filter(key => key.startsWith('secure_'))
    .every(key => results[key].exists);
  
  if (baseTablesExist) {
    colorLog('green', '✅ Base tables exist and have data');
    colorLog('green', `   Records: ${results['captive_payment_records'].count.toLocaleString()}`);
    colorLog('green', `   Deliveries: ${results['captive_deliveries'].count.toLocaleString()}`);
  } else {
    colorLog('red', '❌ Base tables missing or empty');
  }
  
  if (analyticsViewsExist) {
    colorLog('green', '✅ Analytics views exist');
  } else {
    colorLog('red', '❌ Analytics views missing');
  }
  
  if (secureViewsExist) {
    colorLog('green', '✅ All secure views exist and accessible');
  } else {
    colorLog('red', '❌ Some secure views are missing');
    colorLog('yellow', '   This is the cause of the 404 errors in the frontend');
  }
  
  console.log('');
  
  if (!secureViewsExist) {
    colorLog('cyan', '🔧 RECOMMENDED ACTIONS:');
    colorLog('yellow', '1. Create missing secure views by running:');
    colorLog('blue', '   - Copy contents of database/create-secure-views-simple.sql');
    colorLog('blue', '   - Execute in Supabase SQL Editor');
    colorLog('yellow', '2. Or run the automated fix:');
    colorLog('blue', '   - Set SUPABASE_SERVICE_ROLE_KEY environment variable');
    colorLog('blue', '   - Run: npx tsx tools/fix-production-views.ts');
  } else {
    colorLog('green', '🎉 ALL SYSTEMS OPERATIONAL!');
    colorLog('green', 'The captive payments dashboard should be working correctly.');
  }
  
  console.log('');
  
  // Exit with appropriate code
  process.exit(secureViewsExist ? 0 : 1);
}

main().catch(console.error);