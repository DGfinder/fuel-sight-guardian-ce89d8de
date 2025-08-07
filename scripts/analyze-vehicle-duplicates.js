#!/usr/bin/env node

/**
 * Vehicle Duplicate Analysis Script
 * 
 * Analyzes the current vehicles table for potential duplicates based on 
 * registration normalization and fuzzy matching
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  deduplicateVehicles, 
  normalizeRegistration, 
  calculateSimilarity 
} from '../utils/registrationNormalizer.js';

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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Vehicle Duplicate Analysis Script');
console.log('🔗 Supabase URL:', supabaseUrl);
console.log('');

/**
 * Analyze vehicle duplicates in the database
 */
async function analyzeVehicleDuplicates() {
  try {
    console.log('📊 Fetching all vehicles from database...');
    
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('registration');
    
    if (error) {
      throw new Error(`Failed to fetch vehicles: ${error.message}`);
    }
    
    console.log(`📋 Found ${vehicles.length} vehicles in database`);
    console.log('');
    
    // Analyze for duplicates using fuzzy matching
    console.log('🔍 Analyzing for potential duplicates...');
    const analysis = deduplicateVehicles(vehicles, 'registration', 0.85);
    
    console.log('📊 Deduplication Analysis Results:');
    console.log(`   Original vehicles: ${analysis.stats.original}`);
    console.log(`   Unique vehicles: ${analysis.stats.unique}`);
    console.log(`   Potential duplicates: ${analysis.stats.duplicates}`);
    console.log(`   Deduplication rate: ${analysis.stats.deduplicationRate}`);
    console.log('');
    
    // Show duplicate pairs
    if (analysis.duplicates.length > 0) {
      console.log('🔄 Potential Duplicate Pairs:');
      analysis.duplicates.forEach((duplicate, index) => {
        console.log(`   ${index + 1}. "${duplicate.originalRegistration}" → "${duplicate.canonicalRegistration}"`);
        console.log(`      Similarity: ${(duplicate.similarity * 100).toFixed(1)}%`);
        console.log(`      Fleet: ${duplicate.fleet} → ${vehicles.find(v => v.registration === duplicate.canonicalRegistration)?.fleet}`);
        console.log('');
      });
    }
    
    // Analyze normalization patterns
    console.log('📈 Registration Normalization Analysis:');
    const normalizationMap = new Map();
    
    vehicles.forEach(vehicle => {
      const original = vehicle.registration;
      const normalized = normalizeRegistration(original);
      
      if (!normalizationMap.has(normalized)) {
        normalizationMap.set(normalized, []);
      }
      normalizationMap.get(normalized).push(original);
    });
    
    const multipleVariants = Array.from(normalizationMap.entries())
      .filter(([normalized, variants]) => variants.length > 1);
      
    console.log(`   Registrations with multiple variants: ${multipleVariants.length}`);
    
    if (multipleVariants.length > 0) {
      console.log('   Examples:');
      multipleVariants.slice(0, 10).forEach(([normalized, variants]) => {
        console.log(`   ${normalized}: ${variants.join(', ')}`);
      });
      if (multipleVariants.length > 10) {
        console.log(`   ...and ${multipleVariants.length - 10} more`);
      }
    }
    console.log('');
    
    // Analyze Guardian event coverage
    console.log('🚛 Analyzing Guardian event vehicle coverage...');
    let unknownGuardianVehicles = [];
    
    const { data: guardianEvents, error: guardianError } = await supabase
      .from('guardian_events')
      .select('vehicle_registration, fleet')
      .order('vehicle_registration');
    
    if (guardianError) {
      console.warn(`⚠️  Could not fetch Guardian events: ${guardianError.message}`);
    } else {
      const uniqueGuardianVehicles = [...new Set(guardianEvents.map(e => e.vehicle_registration))];
      console.log(`   Unique vehicles in Guardian events: ${uniqueGuardianVehicles.length}`);
      
      // Check which Guardian vehicles are not in fleet master
      const fleetRegistrations = new Set(vehicles.map(v => normalizeRegistration(v.registration)));
      unknownGuardianVehicles = uniqueGuardianVehicles.filter(reg => {
        const normalized = normalizeRegistration(reg);
        return !fleetRegistrations.has(normalized);
      });
      
      console.log(`   Guardian vehicles NOT in fleet master: ${unknownGuardianVehicles.length}`);
      
      if (unknownGuardianVehicles.length > 0) {
        console.log('   Unknown Guardian vehicles:');
        unknownGuardianVehicles.slice(0, 10).forEach(reg => {
          console.log(`      ${reg}`);
        });
        if (unknownGuardianVehicles.length > 10) {
          console.log(`      ...and ${unknownGuardianVehicles.length - 10} more`);
        }
      }
    }
    
    console.log('');
    
    // Summary and recommendations
    console.log('💡 Analysis Summary & Recommendations:');
    console.log('');
    
    if (analysis.duplicates.length > 0) {
      console.log(`✨ Deduplication could reduce vehicle count from ${vehicles.length} to ${analysis.stats.unique}`);
      console.log(`   This would save ${analysis.duplicates.length} duplicate records`);
      console.log('');
    }
    
    if (multipleVariants.length > 0) {
      console.log(`🔧 ${multipleVariants.length} registration(s) have formatting variants that should be standardized`);
      console.log('');
    }
    
    if (guardianEvents && unknownGuardianVehicles && unknownGuardianVehicles.length > 0) {
      console.log(`📝 ${unknownGuardianVehicles.length} Guardian event vehicles are not in the fleet master`);
      console.log('   These may be:');
      console.log('   - Vehicles with different registration formats');
      console.log('   - External/contractor vehicles');
      console.log('   - Data entry errors');
      console.log('   - Vehicles not included in the CSV');
      console.log('');
    }
    
    const expectedReduction = vehicles.length - analysis.stats.unique;
    if (expectedReduction > 0) {
      console.log(`🎯 Expected final vehicle count after cleanup: ~${analysis.stats.unique} (reduction of ${expectedReduction})`);
      
      if (analysis.stats.unique <= 150) {
        console.log('✅ This aligns much better with the expected ~147 vehicles from the CSV!');
      } else {
        console.log(`ℹ️  Still higher than expected 147, may need manual review of ${analysis.stats.unique - 147} vehicles`);
      }
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run the analysis
analyzeVehicleDuplicates();