#!/usr/bin/env node

/**
 * Guardian Data Cleanup Runner
 * 
 * Executes the Guardian data cleanup SQL script to remove all existing Guardian data
 * Usage: node scripts/run-guardian-cleanup.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Please set it in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧹 Guardian Data Cleanup Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Execute cleanup operations step by step
 */
async function runCleanup() {
  try {
    console.log('📊 Checking current Guardian data status...');
    
    // Check current data before cleanup
    const { data: currentStats, error: statsError } = await supabase
      .from('guardian_events')
      .select('detection_time, fleet, vehicle_registration')
      .order('detection_time', { ascending: false });
    
    if (statsError && !statsError.message.includes('does not exist')) {
      console.warn(`⚠️  Could not fetch current stats: ${statsError.message}`);
    } else if (currentStats) {
      console.log(`📈 Current Guardian events: ${currentStats.length.toLocaleString()}`);
      
      // Show date distribution
      const monthGroups = {};
      currentStats.forEach(event => {
        const month = new Date(event.detection_time).toISOString().substring(0, 7); // YYYY-MM
        monthGroups[month] = (monthGroups[month] || 0) + 1;
      });
      
      console.log('📅 Current monthly distribution:');
      Object.entries(monthGroups)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 6)
        .forEach(([month, count]) => {
          console.log(`   ${month}: ${count.toLocaleString()} events`);
        });
      
      const fleets = [...new Set(currentStats.map(e => e.fleet))];
      console.log(`🚚 Fleets: ${fleets.join(', ')}`);
      console.log('');
    }
    
    console.log('🗑️  Clearing all Guardian events data...');
    
    // Clear Guardian events
    const { error: deleteError } = await supabase
      .from('guardian_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records (impossible UUID)
    
    if (deleteError) {
      throw new Error(`Failed to clear guardian_events: ${deleteError.message}`);
    }
    
    console.log('✅ Guardian events cleared');
    
    // Clear related import batches
    console.log('🗑️  Clearing Guardian import batches...');
    
    const { error: batchError } = await supabase
      .from('data_import_batches')
      .delete()
      .or('source_type.eq.guardian_events,batch_reference.like.guardian_%,file_name.ilike.%guardian%');
    
    if (batchError) {
      console.warn(`⚠️  Could not clear import batches: ${batchError.message}`);
    } else {
      console.log('✅ Import batches cleared');
    }
    
    // Verify cleanup
    console.log('🔍 Verifying cleanup...');
    
    const { count: remainingEvents, error: countError } = await supabase
      .from('guardian_events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.warn(`⚠️  Could not verify cleanup: ${countError.message}`);
    } else {
      console.log(`📊 Remaining Guardian events: ${remainingEvents || 0}`);
    }
    
    const { count: remainingBatches, error: batchCountError } = await supabase
      .from('data_import_batches')
      .select('*', { count: 'exact', head: true })
      .or('source_type.eq.guardian_events,batch_reference.like.guardian_%');
    
    if (batchCountError) {
      console.warn(`⚠️  Could not verify batch cleanup: ${batchCountError.message}`);
    } else {
      console.log(`📦 Remaining Guardian import batches: ${remainingBatches || 0}`);
    }
    
    console.log('');
    console.log('🎉 Guardian data cleanup completed successfully!');
    console.log('');
    console.log('✨ Guardian events table is now empty and ready for fresh import');
    console.log('📋 Next steps:');
    console.log('   1. Fix date parsing in import script');
    console.log('   2. Run import with corrected Guardian CSV data');
    console.log('   3. Verify data integrity post-import');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
runCleanup();