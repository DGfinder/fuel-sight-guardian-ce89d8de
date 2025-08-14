#!/usr/bin/env node

/**
 * Simple test for parsing functions without database dependencies
 */

import fs from 'fs';

// Copy the parsing functions here to avoid Supabase dependency
function parseDeviceSerial(deviceStr) {
  if (!deviceStr || deviceStr.trim() === '') return null;
  
  // Extract serial number before the parentheses
  const match = deviceStr.match(/^([A-Z0-9]+)\s*\(/);
  if (match) {
    return match[1].trim();
  }
  
  // If no parentheses, return the whole string cleaned up
  return deviceStr.trim();
}

function mapGroupToFleet(group) {
  const groupMapping = {
    'Kewdale': 'Stevemacs',
    'GSF': 'Great Southern Fuels',
    'Stevemacs': 'Stevemacs'
  };
  
  return groupMapping[group] || 'Stevemacs'; // Default to Stevemacs
}

function mapStatus(csvStatus) {
  const statusMapping = {
    'In Service': 'Active',
    'Out Of Service': 'Out of Service',
    'Active': 'Active',
    'Maintenance': 'Maintenance'
  };
  
  return statusMapping[csvStatus] || 'Available'; // Default to Available
}

function normalizeRegistration(registration) {
  if (!registration) return null;
  
  // Remove spaces, convert to uppercase
  return registration.replace(/\s+/g, '').toUpperCase();
}

function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`📊 Processing ${dataLines.length} vehicle records...`);
  
  const vehicles = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle quoted fields)
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim()); // Add the last field
    
    // Clean up quoted fields
    const cleanFields = fields.map(field => {
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.slice(1, -1);
      }
      return field;
    });
    
    // Map CSV fields to vehicle object
    const [
      vehicleReg, group, driver, device, lastCheckIn, status, 
      vin, year, make, model, licensePlateState, licensePlate, 
      vehicleType, seatBeltType
    ] = cleanFields;
    
    const registration = normalizeRegistration(vehicleReg);
    if (!registration) {
      console.warn(`⚠️ Skipping row ${i + 2}: No valid registration`);
      continue;
    }
    
    const lytxDevice = parseDeviceSerial(device);
    if (!lytxDevice) {
      console.warn(`⚠️ Row ${i + 2}: No LYTX device for ${registration}`);
    }
    
    const vehicle = {
      registration,
      fleet: mapGroupToFleet(group),
      depot: 'Kewdale', // All vehicles in this CSV are from Kewdale
      status: mapStatus(status),
      lytx_device: lytxDevice,
      make: make && make !== '' ? make : null,
      model: model && model !== '' ? model : null,
      year: year && !isNaN(parseInt(year)) ? parseInt(year) : null,
      vin: vin && vin !== '' ? vin : null,
      // Additional tracking fields
      last_lytx_checkin: lastCheckIn && lastCheckIn !== '' ? new Date(lastCheckIn).toISOString() : null,
      vehicle_type: vehicleType && vehicleType !== '' ? vehicleType : null,
      current_driver: driver && driver.trim() !== '' ? driver.trim() : null
    };
    
    vehicles.push(vehicle);
  }
  
  return vehicles;
}

// Test data from the actual CSV
const testDeviceSerials = [
  'SF80118888 (SF64)',
  'QM40024916 (SF400)', 
  'SF80072459 (SF64)',
  'MV00152349 (SF300)',
  'QM40999885 (SF400)',
  '', // Empty device
  'QM40025663 (SF400)'
];

const testRegistrations = [
  '1BMU188',
  '1CCL 525',
  '1CKR 093',
  '1CKR091', // No spaces
  '1GCE-176', // With dash
  'Triquad',
  'Triquad2'
];

const testStatuses = [
  'In Service',
  'Out Of Service',
  'Active',
  'Maintenance'
];

const testGroups = [
  'Kewdale',
  'GSF',
  'Stevemacs'
];

console.log('🧪 Testing LYTX Vehicle Data Parsing Functions');
console.log('==============================================\n');

// Test device serial parsing
console.log('📱 Testing Device Serial Parsing:');
testDeviceSerials.forEach(serial => {
  const parsed = parseDeviceSerial(serial);
  console.log(`  "${serial}" → "${parsed}"`);
});

console.log('\n🏢 Testing Group to Fleet Mapping:');
testGroups.forEach(group => {
  const fleet = mapGroupToFleet(group);
  console.log(`  "${group}" → "${fleet}"`);
});

console.log('\n🔄 Testing Status Mapping:');
testStatuses.forEach(status => {
  const mapped = mapStatus(status);
  console.log(`  "${status}" → "${mapped}"`);
});

console.log('\n🚗 Testing Registration Normalization:');
testRegistrations.forEach(reg => {
  const normalized = normalizeRegistration(reg);
  console.log(`  "${reg}" → "${normalized}"`);
});

// Test CSV parsing with actual file
console.log('\n📄 Testing CSV Parsing:');
const csvPath = './2025-08-14_Vehicles_Lytx.csv';

if (fs.existsSync(csvPath)) {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const vehicles = parseCSV(csvContent);
    
    console.log(`  ✅ Successfully parsed ${vehicles.length} vehicles`);
    
    // Show first few examples
    console.log('\n📋 Sample parsed vehicles:');
    vehicles.slice(0, 5).forEach((vehicle, index) => {
      console.log(`  ${index + 1}. ${vehicle.registration}`);
      console.log(`     Fleet: ${vehicle.fleet}`);
      console.log(`     Status: ${vehicle.status}`);
      console.log(`     LYTX Device: ${vehicle.lytx_device || 'none'}`);
      console.log(`     Make/Model: ${vehicle.make || 'unknown'} ${vehicle.model || ''}`);
      console.log('');
    });
    
    // Statistics
    const withLytx = vehicles.filter(v => v.lytx_device).length;
    const fleetCounts = vehicles.reduce((acc, v) => {
      acc[v.fleet] = (acc[v.fleet] || 0) + 1;
      return acc;
    }, {});
    const statusCounts = vehicles.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Statistics:');
    console.log(`  Total vehicles: ${vehicles.length}`);
    console.log(`  With LYTX devices: ${withLytx} (${Math.round(withLytx/vehicles.length*100)}%)`);
    console.log('  Fleet distribution:', fleetCounts);
    console.log('  Status distribution:', statusCounts);
    
    // Check for potential issues
    console.log('\n🔍 Potential Issues:');
    
    // Duplicate registrations
    const regCounts = vehicles.reduce((acc, v) => {
      acc[v.registration] = (acc[v.registration] || 0) + 1;
      return acc;
    }, {});
    const duplicateRegs = Object.entries(regCounts).filter(([reg, count]) => count > 1);
    
    if (duplicateRegs.length > 0) {
      console.log('  ⚠️ Duplicate registrations found:');
      duplicateRegs.forEach(([reg, count]) => {
        console.log(`    ${reg}: appears ${count} times`);
      });
    } else {
      console.log('  ✅ No duplicate registrations');
    }
    
    // Missing LYTX devices
    const missingLytx = vehicles.filter(v => !v.lytx_device);
    if (missingLytx.length > 0) {
      console.log(`  ⚠️ ${missingLytx.length} vehicles without LYTX devices:`);
      missingLytx.slice(0, 3).forEach(v => {
        console.log(`    ${v.registration} (${v.status})`);
      });
      if (missingLytx.length > 3) {
        console.log(`    ... and ${missingLytx.length - 3} more`);
      }
    } else {
      console.log('  ✅ All vehicles have LYTX devices');
    }
    
    // Duplicate LYTX devices
    const deviceCounts = vehicles.reduce((acc, v) => {
      if (v.lytx_device) {
        acc[v.lytx_device] = (acc[v.lytx_device] || 0) + 1;
      }
      return acc;
    }, {});
    const duplicateDevices = Object.entries(deviceCounts).filter(([device, count]) => count > 1);
    
    if (duplicateDevices.length > 0) {
      console.log('  ⚠️ Duplicate LYTX device assignments:');
      duplicateDevices.forEach(([device, count]) => {
        console.log(`    ${device}: assigned to ${count} vehicles`);
      });
    } else {
      console.log('  ✅ No duplicate LYTX device assignments');
    }
    
  } catch (error) {
    console.error(`  ❌ CSV parsing failed: ${error.message}`);
  }
} else {
  console.log(`  ⚠️ CSV file not found: ${csvPath}`);
  console.log('  Skipping CSV parsing test');
}

console.log('\n🎉 Parsing tests completed!');
console.log('\nIf everything looks good, run the import with:');
console.log('node scripts/import-lytx-vehicles.js ./2025-08-14_Vehicles_Lytx.csv');