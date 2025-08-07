#!/usr/bin/env node

/**
 * Compare CSV vs Database Vehicle Records
 * 
 * Identifies vehicles in database that aren't in the original CSV
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { normalizeRegistration } from '../utils/registrationNormalizer.js';

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

const csvPath = path.join(__dirname, '../Inputdata_southern Fuel (3)(Master).csv');

console.log('📊 CSV vs Database Comparison');
console.log('');

/**
 * Load and normalize CSV registrations
 */
function loadCsvRegistrations() {
  console.log('📄 Loading CSV registrations...');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  const csvRegistrations = new Set();
  const csvDetails = new Map();
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const [registration, fleet, depot] = lines[i].split(',');
    if (registration) {
      const normalized = normalizeRegistration(registration);
      csvRegistrations.add(normalized);
      
      // Store the first occurrence details
      if (!csvDetails.has(normalized)) {
        csvDetails.set(normalized, {
          original: registration,
          fleet: fleet?.trim(),
          depot: depot?.trim(),
          line: i + 1
        });
      }
    }
  }
  
  console.log(`   Found ${csvRegistrations.size} unique vehicles in CSV`);
  return { csvRegistrations, csvDetails };
}

/**
 * Load database vehicles
 */
async function loadDatabaseVehicles() {
  console.log('💾 Loading database vehicles...');
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('registration');
  
  if (error) {
    throw new Error(`Failed to fetch vehicles: ${error.message}`);
  }
  
  const dbRegistrations = new Set();
  const dbDetails = new Map();
  
  vehicles.forEach(vehicle => {
    const normalized = normalizeRegistration(vehicle.registration);
    dbRegistrations.add(normalized);
    dbDetails.set(normalized, vehicle);
  });
  
  console.log(`   Found ${vehicles.length} vehicles in database`);
  return { dbRegistrations, dbDetails, vehicles };
}

/**
 * Compare CSV and database
 */
async function compareVehicles() {
  try {
    const { csvRegistrations, csvDetails } = loadCsvRegistrations();
    const { dbRegistrations, dbDetails, vehicles } = await loadDatabaseVehicles();
    
    console.log('');
    console.log('🔍 Comparison Results:');
    console.log(`   CSV unique vehicles: ${csvRegistrations.size}`);
    console.log(`   Database vehicles: ${vehicles.length}`);
    console.log('');
    
    // Find vehicles in database but not in CSV
    const notInCsv = [];
    for (const normalized of dbRegistrations) {
      if (!csvRegistrations.has(normalized)) {
        notInCsv.push({
          normalized,
          db: dbDetails.get(normalized)
        });
      }
    }
    
    // Find vehicles in CSV but not in database
    const notInDb = [];
    for (const normalized of csvRegistrations) {
      if (!dbRegistrations.has(normalized)) {
        notInDb.push({
          normalized,
          csv: csvDetails.get(normalized)
        });
      }
    }
    
    console.log(`🔍 Vehicles in DATABASE but NOT in CSV: ${notInCsv.length}`);
    if (notInCsv.length > 0) {
      console.log('   These may be vehicles added elsewhere or import errors:');
      notInCsv.slice(0, 20).forEach(vehicle => {
        const db = vehicle.db;
        console.log(`      "${db.registration}" - ${db.fleet} - ${db.depot}`);
      });
      
      if (notInCsv.length > 20) {
        console.log(`      ...and ${notInCsv.length - 20} more`);
      }
      
      // Analyze fleet distribution of extra vehicles
      const extraFleetCounts = notInCsv.reduce((acc, v) => {
        acc[v.db.fleet] = (acc[v.db.fleet] || 0) + 1;
        return acc;
      }, {});
      
      console.log('');
      console.log('   Fleet distribution of extra vehicles:');
      Object.entries(extraFleetCounts).forEach(([fleet, count]) => {
        console.log(`      ${fleet}: ${count} vehicles`);
      });
    }
    
    console.log('');
    console.log(`🔍 Vehicles in CSV but NOT in DATABASE: ${notInDb.length}`);
    if (notInDb.length > 0) {
      console.log('   These should have been imported:');
      notInDb.slice(0, 10).forEach(vehicle => {
        const csv = vehicle.csv;
        console.log(`      "${csv.original}" - ${csv.fleet} - ${csv.depot} (line ${csv.line})`);
      });
      
      if (notInDb.length > 10) {
        console.log(`      ...and ${notInDb.length - 10} more`);
      }
    }
    
    // Show correctly matched vehicles
    const matched = [];
    for (const normalized of csvRegistrations) {
      if (dbRegistrations.has(normalized)) {
        matched.push(normalized);
      }
    }
    
    console.log('');
    console.log(`✅ Correctly matched vehicles: ${matched.length}`);
    console.log('');
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Expected vehicles (unique from CSV): ${csvRegistrations.size}`);
    console.log(`   Current database vehicles: ${vehicles.length}`);
    console.log(`   Correctly imported: ${matched.length}`);
    console.log(`   Extra in database: ${notInCsv.length}`);
    console.log(`   Missing from database: ${notInDb.length}`);
    console.log('');
    
    if (notInCsv.length > 0) {
      console.log('💡 Recommendations:');
      console.log(`   • Review the ${notInCsv.length} extra vehicles in the database`);
      console.log('   • Determine if they are legitimate additions or import errors');
      console.log('   • Consider removing them to match the CSV if they are duplicates/errors');
      
      if (notInCsv.length === (vehicles.length - csvRegistrations.size)) {
        console.log('   • The math suggests all extra vehicles are additions beyond the CSV');
        console.log('   • This could indicate the CSV was incomplete or vehicles were added separately');
      }
    }
    
    if (notInDb.length > 0) {
      console.log(`   • Re-import the ${notInDb.length} missing vehicles from the CSV`);
    }
    
    return {
      csvCount: csvRegistrations.size,
      dbCount: vehicles.length,
      matched: matched.length,
      extraInDb: notInCsv.length,
      missingFromDb: notInDb.length,
      extraVehicles: notInCsv
    };
    
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
    process.exit(1);
  }
}

// Run the comparison
compareVehicles();