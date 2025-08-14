#!/usr/bin/env node

/**
 * MtData Trip History Import Script
 * 
 * Imports trip history data from MtData CSV extracts into the fleet management system.
 * Correlates trips with vehicles, drivers, and calculates route analytics.
 * 
 * Usage: node scripts/import-mtdata-trips.js [csv-file-path]
 * 
 * CSV Format Expected:
 * GroupName,DriverName,VehicleID,Rego,UnitSerialNumber,TripNo,StartTime,StartLocation,
 * StartLatitude,StartLongitude,EndTime,EndLocation,EndLatitude,EndLongitude,TravelTime,
 * IdlingTime,IdlingPeriods,Kms,Odometer
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Parse date/time from MtData format "07/07/2025 04:45"
 */
function parseDateTime(dateTimeStr) {
  if (!dateTimeStr || dateTimeStr.trim() === '') return null;
  
  // Skip invalid values
  if (dateTimeStr.includes('on-trip') || dateTimeStr.length < 8) {
    return null;
  }
  
  try {
    // MtData format: "dd/mm/yyyy hh:mm"
    const [datePart, timePart] = dateTimeStr.split(' ');
    if (!datePart || !timePart) return null;
    
    const [day, month, year] = datePart.split('/');
    const [hour, minute] = timePart.split(':');
    
    // Validate components exist
    if (!day || !month || !year || !hour || !minute) return null;
    
    const date = new Date(year, month - 1, day, hour, minute);
    
    // Validate the date
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

/**
 * Parse decimal time to hours (TravelTime is in decimal days)
 */
function parseDecimalTimeToHours(decimalTime) {
  if (!decimalTime || decimalTime === '') return 0;
  const decimal = parseFloat(decimalTime);
  return isNaN(decimal) ? 0 : decimal * 24; // Convert decimal days to hours
}

/**
 * Parse coordinate values
 */
function parseCoordinate(coordStr) {
  if (!coordStr || coordStr.trim() === '') return null;
  const coord = parseFloat(coordStr);
  return isNaN(coord) ? null : coord;
}

/**
 * Normalize registration number for matching
 */
function normalizeRegistration(registration) {
  if (!registration) return null;
  return registration.replace(/\s+/g, '').toUpperCase();
}

/**
 * Generate external trip ID for uniqueness
 */
function generateTripExternalId(vehicleId, tripNo, startTime) {
  const startDate = new Date(startTime).toISOString().split('T')[0];
  return `${vehicleId}_${tripNo}_${startDate}`;
}

/**
 * Calculate data checksum for duplicate detection
 */
function calculateChecksum(tripData) {
  const key = `${tripData.mtdata_vehicle_id}_${tripData.trip_number}_${tripData.start_time}_${tripData.distance_km}`;
  return Buffer.from(key).toString('base64');
}

/**
 * Parse CSV content
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`📊 Processing ${dataLines.length} trip records...`);
  
  const trips = [];
  const errors = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    try {
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
      
      // Map CSV fields to trip object
      const [
        groupName, driverName, vehicleId, rego, unitSerialNumber,
        tripNo, startTime, startLocation, startLatitude, startLongitude,
        endTime, endLocation, endLatitude, endLongitude, travelTime,
        idlingTime, idlingPeriods, kms, odometer
      ] = cleanFields;
      
      const registration = normalizeRegistration(rego);
      if (!registration) {
        errors.push(`Row ${i + 2}: No valid registration`);
        continue;
      }
      
      const startTimeISO = parseDateTime(startTime);
      const endTimeISO = parseDateTime(endTime);
      
      if (!startTimeISO || !endTimeISO) {
        errors.push(`Row ${i + 2}: Invalid start or end time for ${registration}`);
        continue;
      }
      
      const travelTimeHours = parseDecimalTimeToHours(travelTime);
      const idlingTimeHours = parseDecimalTimeToHours(idlingTime);
      const distanceKm = parseFloat(kms) || 0;
      const tripNumber = parseInt(tripNo) || 0;
      
      if (distanceKm <= 0) {
        errors.push(`Row ${i + 2}: Invalid distance for ${registration}`);
        continue;
      }
      
      const trip = {
        // Trip identification
        trip_external_id: generateTripExternalId(vehicleId, tripNumber, startTimeISO),
        trip_number: tripNumber,
        
        // Vehicle and driver
        vehicle_registration: registration,
        mtdata_vehicle_id: vehicleId,
        unit_serial_number: unitSerialNumber || null,
        group_name: groupName,
        driver_name: driverName && driverName.trim() !== '' ? driverName.trim() : null,
        
        // Timing
        start_time: startTimeISO,
        end_time: endTimeISO,
        travel_time_hours: travelTimeHours,
        
        // Locations
        start_location: startLocation || null,
        start_latitude: parseCoordinate(startLatitude),
        start_longitude: parseCoordinate(startLongitude),
        end_location: endLocation || null,
        end_latitude: parseCoordinate(endLatitude),
        end_longitude: parseCoordinate(endLongitude),
        
        // Metrics
        distance_km: distanceKm,
        odometer_reading: parseFloat(odometer) || null,
        idling_time_hours: idlingTimeHours,
        idling_periods: parseInt(idlingPeriods) || 0,
        
        // Checksums and metadata
        data_checksum: null, // Will be calculated after vehicle correlation
        data_source: 'MtData'
      };
      
      trip.data_checksum = calculateChecksum(trip);
      trips.push(trip);
      
    } catch (error) {
      errors.push(`Row ${i + 2}: Parse error - ${error.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️ Parse errors encountered:`)
    errors.forEach(error => console.log(`  - ${error}`));
  }
  
  return trips;
}

/**
 * Correlate trips with existing vehicles and drivers
 */
async function correlateTripsWithDatabase(trips) {
  console.log(`🔗 Correlating ${trips.length} trips with database...`);
  
  // Get all vehicles for correlation
  const { data: vehicles, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, registration, guardian_unit, lytx_device');
  
  if (vehicleError) {
    throw new Error(`Failed to fetch vehicles: ${vehicleError.message}`);
  }
  
  // Create lookup maps
  const vehicleByRego = new Map();
  const vehicleBySerial = new Map();
  
  vehicles.forEach(vehicle => {
    vehicleByRego.set(vehicle.registration, vehicle);
    if (vehicle.guardian_unit) {
      vehicleBySerial.set(vehicle.guardian_unit, vehicle);
    }
    if (vehicle.lytx_device) {
      vehicleBySerial.set(vehicle.lytx_device, vehicle);
    }
  });
  
  // Get drivers for name correlation
  const { data: drivers, error: driverError } = await supabase
    .from('drivers')
    .select('id, first_name, last_name')
    .eq('status', 'Active');
  
  if (driverError) {
    console.warn(`⚠️ Could not fetch drivers: ${driverError.message}`);
  }
  
  const correlatedTrips = [];
  const correlationStats = {
    vehicleMatched: 0,
    vehicleUnmatched: 0,
    driverMatched: 0,
    driverUnmatched: 0
  };
  
  for (const trip of trips) {
    // Try to match vehicle by registration first
    let vehicle = vehicleByRego.get(trip.vehicle_registration);
    
    // If no match by registration, try by unit serial number
    if (!vehicle && trip.unit_serial_number) {
      vehicle = vehicleBySerial.get(trip.unit_serial_number);
    }
    
    if (vehicle) {
      trip.vehicle_id = vehicle.id;
      correlationStats.vehicleMatched++;
    } else {
      correlationStats.vehicleUnmatched++;
      console.warn(`⚠️ No vehicle found for registration: ${trip.vehicle_registration}`);
    }
    
    // Try to match driver by name
    if (trip.driver_name && drivers) {
      const matchedDriver = drivers.find(driver => {
        const fullName = `${driver.first_name} ${driver.last_name}`;
        return fullName.toLowerCase() === trip.driver_name.toLowerCase() ||
               driver.first_name.toLowerCase() === trip.driver_name.toLowerCase() ||
               driver.last_name.toLowerCase() === trip.driver_name.toLowerCase();
      });
      
      if (matchedDriver) {
        trip.driver_id = matchedDriver.id;
        correlationStats.driverMatched++;
      } else {
        correlationStats.driverUnmatched++;
      }
    }
    
    correlatedTrips.push(trip);
  }
  
  console.log(`\n📋 Correlation Results:`);
  console.log(`  - Vehicles matched: ${correlationStats.vehicleMatched}`);
  console.log(`  - Vehicles unmatched: ${correlationStats.vehicleUnmatched}`);
  console.log(`  - Drivers matched: ${correlationStats.driverMatched}`);
  console.log(`  - Drivers unmatched: ${correlationStats.driverUnmatched}`);
  
  return correlatedTrips;
}

/**
 * Insert trips into database with duplicate checking
 */
async function insertTrips(trips, uploadBatchId) {
  console.log(`🚀 Inserting ${trips.length} trips...`);
  
  const results = {
    inserted: 0,
    updated: 0,
    duplicates: 0,
    errors: []
  };
  
  for (const trip of trips) {
    try {
      // Check for existing trip by external ID or checksum
      const { data: existingTrip, error: fetchError } = await supabase
        .from('mtdata_trip_history')
        .select('id')
        .or(`trip_external_id.eq.${trip.trip_external_id},data_checksum.eq.${trip.data_checksum}`)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }
      
      if (existingTrip) {
        results.duplicates++;
        continue;
      }
      
      // Insert new trip
      const { error: insertError } = await supabase
        .from('mtdata_trip_history')
        .insert({
          ...trip,
          upload_batch_id: uploadBatchId,
          processed_at: new Date().toISOString()
        });
      
      if (insertError) throw insertError;
      
      results.inserted++;
      
      if (results.inserted % 100 === 0) {
        console.log(`  ✅ Inserted ${results.inserted} trips...`);
      }
      
    } catch (error) {
      const errorMsg = `Failed to process trip ${trip.trip_external_id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
  
  return results;
}

/**
 * Generate trip analytics after import
 */
async function generateTripAnalytics(uploadBatchId) {
  console.log('📊 Generating trip analytics...');
  
  try {
    // Get date range of imported trips
    const { data: dateRange, error: dateError } = await supabase
      .from('mtdata_trip_history')
      .select('start_time')
      .eq('upload_batch_id', uploadBatchId)
      .order('start_time', { ascending: true });
    
    if (dateError) throw dateError;
    
    if (dateRange.length === 0) {
      console.log('No trips found for analytics generation');
      return;
    }
    
    const startDate = new Date(dateRange[0].start_time).toISOString().split('T')[0];
    const endDate = new Date(dateRange[dateRange.length - 1].start_time).toISOString().split('T')[0];
    
    console.log(`  📅 Analyzing trips from ${startDate} to ${endDate}`);
    
    // Generate daily analytics using SQL aggregation
    const { error: analyticsError } = await supabase.rpc('generate_trip_analytics_for_date_range', {
      start_date: startDate,
      end_date: endDate
    });
    
    if (analyticsError) {
      console.warn(`⚠️ Analytics generation failed: ${analyticsError.message}`);
    } else {
      console.log('  ✅ Trip analytics generated successfully');
    }
    
  } catch (error) {
    console.warn(`⚠️ Analytics generation failed: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  const csvFilePath = process.argv[2] || './Extract_210986_Trip+History+Extract (1).csv';
  
  console.log('🚛 MtData Trip History Import Tool');
  console.log('==================================\\n');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    console.log('\\nUsage: node scripts/import-mtdata-trips.js [csv-file-path]');
    process.exit(1);
  }
  
  try {
    // Try to create upload batch record (optional - may not exist yet)
    let uploadBatchId = null;
    try {
      const { data: uploadBatch, error: batchError } = await supabase
        .from('upload_batches')
        .insert({
          filename: path.basename(csvFilePath),
          upload_type: 'mtdata_trip_history',
          upload_status: 'processing'
        })
        .select()
        .single();
      
      if (!batchError) {
        uploadBatchId = uploadBatch?.id;
        console.log(`📦 Created upload batch: ${uploadBatchId}`);
      }
    } catch (batchError) {
      console.warn(`⚠️ Upload batch tracking not available (table may not exist)`);
    }
    
    // Read and parse CSV
    console.log(`📂 Reading CSV file: ${csvFilePath}`);
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const trips = parseCSV(csvContent);
    
    if (trips.length === 0) {
      console.error('❌ No valid trips found in CSV file');
      process.exit(1);
    }
    
    console.log(`\\n📋 Parsed trip data:`);
    console.log(`  - Total trips: ${trips.length}`);
    console.log(`  - Date range: ${trips[0]?.start_time?.split('T')[0]} to ${trips[trips.length-1]?.start_time?.split('T')[0]}`);
    
    // Count unique vehicles and drivers
    const uniqueVehicles = new Set(trips.map(t => t.vehicle_registration)).size;
    const uniqueDrivers = new Set(trips.filter(t => t.driver_name).map(t => t.driver_name)).size;
    console.log(`  - Unique vehicles: ${uniqueVehicles}`);
    console.log(`  - Unique drivers: ${uniqueDrivers}`);
    
    // Correlate with database
    const correlatedTrips = await correlateTripsWithDatabase(trips);
    
    // Auto-proceed with import
    console.log('\\n🚀 Proceeding with import...');
    
    // Perform the import
    const results = await insertTrips(correlatedTrips, uploadBatchId);
    
    // Update upload batch status
    if (uploadBatchId) {
      await supabase
        .from('upload_batches')
        .update({
          record_count: results.inserted,
          duplicate_count: results.duplicates,
          error_count: results.errors.length,
          upload_status: results.errors.length > 0 ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
          processing_notes: `Processed ${trips.length} trips, inserted ${results.inserted}, ${results.duplicates} duplicates, ${results.errors.length} errors`
        })
        .eq('id', uploadBatchId);
    }
    
    // Display results
    console.log('\\n📊 Import Results:');
    console.log(`  - Inserted: ${results.inserted} trips`);
    console.log(`  - Duplicates skipped: ${results.duplicates} trips`);
    console.log(`  - Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\\n❌ Errors encountered:');
      results.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more errors`);
      }
    }
    
    // Generate analytics if we inserted any trips
    if (results.inserted > 0) {
      await generateTripAnalytics(uploadBatchId);
    }
    
    console.log('\\n🎉 MtData trip history import completed!');
    
  } catch (error) {
    console.error(`💥 Import failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  parseDateTime,
  parseDecimalTimeToHours,
  parseCoordinate,
  normalizeRegistration,
  generateTripExternalId,
  calculateChecksum,
  parseCSV,
  correlateTripsWithDatabase,
  insertTrips,
  generateTripAnalytics
};