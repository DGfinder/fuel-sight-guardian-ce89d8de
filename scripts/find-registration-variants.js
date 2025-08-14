#!/usr/bin/env node

/**
 * Find Registration Variants
 * 
 * Searches for different formatting variants of a vehicle registration
 * across both the vehicles database and trip history to identify potential duplicates.
 * 
 * Usage: node scripts/find-registration-variants.js [registration]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Normalize registration for comparison (from existing utility)
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  return registration.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Generate possible registration variants
 */
function generateRegistrationVariants(baseReg) {
  const normalized = normalizeRegistration(baseReg);
  if (!normalized) return [];
  
  const variants = new Set();
  
  // Add the original
  variants.add(baseReg);
  variants.add(normalized);
  
  // Add common formatting variants
  if (normalized.length >= 4) {
    // Try different spacing patterns
    for (let i = 1; i < normalized.length; i++) {
      const spaced = normalized.slice(0, i) + ' ' + normalized.slice(i);
      variants.add(spaced);
      
      // Also try with hyphen
      const hyphenated = normalized.slice(0, i) + '-' + normalized.slice(i);
      variants.add(hyphenated);
    }
    
    // Common patterns for Australian plates (3+3, 4+3, etc.)
    if (normalized.length === 6) {
      variants.add(normalized.slice(0, 3) + ' ' + normalized.slice(3));
      variants.add(normalized.slice(0, 3) + '-' + normalized.slice(3));
      variants.add(normalized.slice(0, 4) + ' ' + normalized.slice(4));
      variants.add(normalized.slice(0, 4) + '-' + normalized.slice(4));
    }
    
    if (normalized.length === 7) {
      variants.add(normalized.slice(0, 4) + ' ' + normalized.slice(4));
      variants.add(normalized.slice(0, 4) + '-' + normalized.slice(4));
      variants.add(normalized.slice(0, 3) + ' ' + normalized.slice(3));
      variants.add(normalized.slice(0, 3) + '-' + normalized.slice(3));
    }
  }
  
  // Add lowercase variants
  Array.from(variants).forEach(variant => {
    variants.add(variant.toLowerCase());
    variants.add(variant.charAt(0).toUpperCase() + variant.slice(1).toLowerCase());
  });
  
  return Array.from(variants);
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const norm1 = normalizeRegistration(str1);
  const norm2 = normalizeRegistration(str2);
  
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;
  
  const matrix = [];
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (norm2.charAt(i - 1) === norm1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - matrix[len2][len1]) / maxLen) * 100;
  return Math.round(similarity);
}

/**
 * Search vehicles database for registration variants
 */
async function searchVehiclesDatabase(targetRegistration) {
  console.log('🔍 Searching vehicles database...');
  
  try {
    // Get all vehicles for comparison
    const { data: allVehicles, error } = await supabase
      .from('vehicles')
      .select('id, registration, fleet, depot, status, created_at, guardian_unit, lytx_device');
    
    if (error) throw error;
    
    const targetNormalized = normalizeRegistration(targetRegistration);
    const variants = generateRegistrationVariants(targetRegistration);
    const matches = [];
    
    // Find exact variants
    allVehicles.forEach(vehicle => {
      const vehicleNormalized = normalizeRegistration(vehicle.registration);
      
      // Check for exact normalized match
      if (vehicleNormalized === targetNormalized) {
        matches.push({
          ...vehicle,
          matchType: 'exact_normalized',
          similarity: 100,
          originalSearch: targetRegistration
        });
      }
      // Check for variant match
      else if (variants.some(variant => normalizeRegistration(variant) === vehicleNormalized)) {
        const similarity = calculateSimilarity(targetRegistration, vehicle.registration);
        matches.push({
          ...vehicle,
          matchType: 'variant',
          similarity,
          originalSearch: targetRegistration
        });
      }
      // Check for high similarity
      else {
        const similarity = calculateSimilarity(targetRegistration, vehicle.registration);
        if (similarity >= 70) {
          matches.push({
            ...vehicle,
            matchType: 'similar',
            similarity,
            originalSearch: targetRegistration
          });
        }
      }
    });
    
    return matches.sort((a, b) => b.similarity - a.similarity);
    
  } catch (error) {
    console.error(`❌ Error searching vehicles: ${error.message}`);
    return [];
  }
}

/**
 * Search trip history for registration variants
 */
async function searchTripHistory(targetRegistration) {
  console.log('🔍 Searching trip history database...');
  
  try {
    // Get distinct vehicle registrations from trip history
    const { data: tripVehicles, error } = await supabase
      .from('mtdata_trip_history')
      .select('vehicle_registration, vehicle_id, group_name')
      .order('vehicle_registration');
    
    if (error) throw error;
    
    // Group by registration to get unique entries
    const vehicleMap = new Map();
    tripVehicles.forEach(trip => {
      const reg = trip.vehicle_registration;
      if (!vehicleMap.has(reg)) {
        vehicleMap.set(reg, {
          registration: reg,
          vehicle_id: trip.vehicle_id,
          group_name: trip.group_name,
          trip_count: 0
        });
      }
      vehicleMap.get(reg).trip_count++;
    });
    
    const uniqueVehicles = Array.from(vehicleMap.values());
    const targetNormalized = normalizeRegistration(targetRegistration);
    const variants = generateRegistrationVariants(targetRegistration);
    const matches = [];
    
    uniqueVehicles.forEach(vehicle => {
      const vehicleNormalized = normalizeRegistration(vehicle.registration);
      
      // Check for exact normalized match
      if (vehicleNormalized === targetNormalized) {
        matches.push({
          ...vehicle,
          matchType: 'exact_normalized',
          similarity: 100,
          originalSearch: targetRegistration
        });
      }
      // Check for variant match
      else if (variants.some(variant => normalizeRegistration(variant) === vehicleNormalized)) {
        const similarity = calculateSimilarity(targetRegistration, vehicle.registration);
        matches.push({
          ...vehicle,
          matchType: 'variant',
          similarity,
          originalSearch: targetRegistration
        });
      }
      // Check for high similarity
      else {
        const similarity = calculateSimilarity(targetRegistration, vehicle.registration);
        if (similarity >= 70) {
          matches.push({
            ...vehicle,
            matchType: 'similar',
            similarity,
            originalSearch: targetRegistration
          });
        }
      }
    });
    
    return matches.sort((a, b) => b.similarity - a.similarity);
    
  } catch (error) {
    console.error(`❌ Error searching trip history: ${error.message}`);
    return [];
  }
}

/**
 * Check for cross-references between databases
 */
async function checkCrossReferences(vehicleMatches, tripMatches) {
  console.log('🔗 Checking cross-references...');
  
  const crossRefs = [];
  
  // For each vehicle match, see if it has trips
  for (const vehicle of vehicleMatches) {
    const tripMatch = tripMatches.find(trip => 
      normalizeRegistration(trip.registration) === normalizeRegistration(vehicle.registration)
    );
    
    if (tripMatch) {
      crossRefs.push({
        registration: vehicle.registration,
        inVehicleDb: true,
        inTripHistory: true,
        vehicleId: vehicle.id,
        tripVehicleId: tripMatch.vehicle_id,
        fleet: vehicle.fleet,
        depot: vehicle.depot,
        groupName: tripMatch.group_name,
        tripCount: tripMatch.trip_count,
        linkedCorrectly: vehicle.id === tripMatch.vehicle_id
      });
    } else {
      crossRefs.push({
        registration: vehicle.registration,
        inVehicleDb: true,
        inTripHistory: false,
        vehicleId: vehicle.id,
        fleet: vehicle.fleet,
        depot: vehicle.depot
      });
    }
  }
  
  // For each trip match not already covered
  for (const trip of tripMatches) {
    const alreadyCovered = crossRefs.find(ref => 
      normalizeRegistration(ref.registration) === normalizeRegistration(trip.registration)
    );
    
    if (!alreadyCovered) {
      crossRefs.push({
        registration: trip.registration,
        inVehicleDb: false,
        inTripHistory: true,
        tripVehicleId: trip.vehicle_id,
        groupName: trip.group_name,
        tripCount: trip.trip_count
      });
    }
  }
  
  return crossRefs;
}

/**
 * Generate detailed report
 */
function generateReport(targetRegistration, vehicleMatches, tripMatches, crossRefs) {
  console.log('\n📋 REGISTRATION VARIANT ANALYSIS REPORT');
  console.log('==========================================\n');
  
  console.log(`🎯 Target Registration: ${targetRegistration}`);
  console.log(`🔧 Normalized Form: ${normalizeRegistration(targetRegistration)}`);
  
  const variants = generateRegistrationVariants(targetRegistration);
  console.log(`📝 Generated Variants (${variants.length}):`);
  variants.slice(0, 10).forEach(variant => console.log(`  - "${variant}"`));
  if (variants.length > 10) {
    console.log(`  ... and ${variants.length - 10} more variants`);
  }
  
  console.log(`\n🏢 VEHICLES DATABASE MATCHES (${vehicleMatches.length})`);
  console.log('════════════════════════════════════════');
  
  if (vehicleMatches.length === 0) {
    console.log('  No matches found in vehicles database');
  } else {
    vehicleMatches.forEach((match, index) => {
      console.log(`\n  ${index + 1}. Registration: "${match.registration}"`);
      console.log(`     Match Type: ${match.matchType}`);
      console.log(`     Similarity: ${match.similarity}%`);
      console.log(`     Fleet: ${match.fleet} - ${match.depot}`);
      console.log(`     Status: ${match.status}`);
      console.log(`     Created: ${new Date(match.created_at).toLocaleString()}`);
      console.log(`     Vehicle ID: ${match.id}`);
      if (match.guardian_unit) console.log(`     Guardian: ${match.guardian_unit}`);
      if (match.lytx_device) console.log(`     LYTX: ${match.lytx_device}`);
    });
  }
  
  console.log(`\n🚛 TRIP HISTORY MATCHES (${tripMatches.length})`);
  console.log('═══════════════════════════════════════');
  
  if (tripMatches.length === 0) {
    console.log('  No matches found in trip history');
  } else {
    tripMatches.forEach((match, index) => {
      console.log(`\n  ${index + 1}. Registration: "${match.registration}"`);
      console.log(`     Match Type: ${match.matchType}`);
      console.log(`     Similarity: ${match.similarity}%`);
      console.log(`     Group: ${match.group_name}`);
      console.log(`     Trip Count: ${match.trip_count}`);
      console.log(`     Linked Vehicle ID: ${match.vehicle_id || 'Not linked'}`);
    });
  }
  
  console.log(`\n🔗 CROSS-REFERENCE ANALYSIS (${crossRefs.length})`);
  console.log('═══════════════════════════════════════');
  
  if (crossRefs.length === 0) {
    console.log('  No cross-references found');
  } else {
    crossRefs.forEach((ref, index) => {
      console.log(`\n  ${index + 1}. Registration: "${ref.registration}"`);
      console.log(`     In Vehicle DB: ${ref.inVehicleDb ? '✅' : '❌'}`);
      console.log(`     In Trip History: ${ref.inTripHistory ? '✅' : '❌'}`);
      
      if (ref.inVehicleDb && ref.inTripHistory) {
        console.log(`     Linked Correctly: ${ref.linkedCorrectly ? '✅' : '❌'}`);
        if (!ref.linkedCorrectly) {
          console.log(`     ⚠️ Vehicle ID mismatch: DB=${ref.vehicleId}, Trips=${ref.tripVehicleId}`);
        }
      }
      
      if (ref.fleet) console.log(`     Fleet: ${ref.fleet} - ${ref.depot}`);
      if (ref.groupName) console.log(`     Group: ${ref.groupName}`);
      if (ref.tripCount) console.log(`     Trips: ${ref.tripCount}`);
    });
  }
  
  // Analysis summary
  console.log('\n🔍 DUPLICATE ANALYSIS');
  console.log('═════════════════════');
  
  const exactMatches = [...vehicleMatches, ...tripMatches].filter(m => m.similarity === 100);
  const highSimilarity = [...vehicleMatches, ...tripMatches].filter(m => m.similarity >= 85 && m.similarity < 100);
  
  if (exactMatches.length > 1) {
    console.log(`🚨 POTENTIAL DUPLICATES DETECTED: ${exactMatches.length} exact matches found`);
    exactMatches.forEach(match => {
      console.log(`  - "${match.registration}" (${match.matchType})`);
    });
  } else if (exactMatches.length === 1) {
    console.log(`✅ Single exact match found: "${exactMatches[0].registration}"`);
  } else {
    console.log(`❌ No exact matches found for "${targetRegistration}"`);
  }
  
  if (highSimilarity.length > 0) {
    console.log(`\n⚠️ HIGH SIMILARITY MATCHES (${highSimilarity.length}):`);
    highSimilarity.forEach(match => {
      console.log(`  - "${match.registration}" (${match.similarity}% similar)`);
    });
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('══════════════════');
  
  if (exactMatches.length > 1) {
    console.log('  🚨 IMMEDIATE ACTION REQUIRED:');
    console.log('    - Review duplicate vehicle records');
    console.log('    - Consolidate duplicate entries');
    console.log('    - Update trip history links');
    console.log('    - Check for data consistency issues');
  } else if (crossRefs.some(ref => ref.inVehicleDb && ref.inTripHistory && !ref.linkedCorrectly)) {
    console.log('  ⚠️ LINKING ISSUES DETECTED:');
    console.log('    - Some vehicles exist but trips are not properly linked');
    console.log('    - Run trip correlation update');
  } else if (exactMatches.length === 1) {
    console.log('  ✅ Registration appears to be unique and properly managed');
  } else {
    console.log('  ❓ Registration not found in system - may be new or misspelled');
  }
  
  return {
    exactMatches: exactMatches.length,
    highSimilarity: highSimilarity.length,
    potentialDuplicates: exactMatches.length > 1,
    linkingIssues: crossRefs.some(ref => ref.inVehicleDb && ref.inTripHistory && !ref.linkedCorrectly)
  };
}

/**
 * Main execution function
 */
async function main() {
  const targetRegistration = process.argv[2] || '1GCE176';
  
  console.log('🔍 Registration Variant Search Tool');
  console.log('===================================\n');
  console.log(`Searching for variants of: "${targetRegistration}"`);
  
  try {
    // Search both databases
    const [vehicleMatches, tripMatches] = await Promise.all([
      searchVehiclesDatabase(targetRegistration),
      searchTripHistory(targetRegistration)
    ]);
    
    // Check cross-references
    const crossRefs = await checkCrossReferences(vehicleMatches, tripMatches);
    
    // Generate comprehensive report
    const analysis = generateReport(targetRegistration, vehicleMatches, tripMatches, crossRefs);
    
    // Exit codes for automation
    if (analysis.potentialDuplicates) {
      console.log('\n🚨 Exiting with code 2 (duplicates detected)');
      process.exit(2);
    } else if (analysis.linkingIssues) {
      console.log('\n⚠️ Exiting with code 1 (linking issues)');
      process.exit(1);
    } else {
      console.log('\n✅ Exiting with code 0 (no issues)');
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`💥 Search failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  normalizeRegistration,
  generateRegistrationVariants,
  calculateSimilarity,
  searchVehiclesDatabase,
  searchTripHistory,
  checkCrossReferences,
  generateReport
};