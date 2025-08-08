#!/usr/bin/env node

/**
 * Detection Time Parsing Test Script
 * 
 * Tests the parseDateTime function specifically for Guardian CSV detection_time format
 * Usage: node scripts/test-detection-time-parsing.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the parseDateTime function from the import script
import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env') });

/**
 * Parse date time from Guardian format with robust format detection
 * (Copy of the function from import-guardian-csv.js for testing)
 */
function parseDateTime(dateTime, recordIndex = null) {
  const originalDateTime = dateTime;
  
  try {
    // Handle ISO format with T (e.g., 2024-03-31T10:30:00 or 2024-03-31T10:30:00.000Z)
    if (dateTime.includes('T') && dateTime.length >= 19) {
      const parsed = new Date(dateTime);
      if (!isNaN(parsed.getTime())) {
        const result = parsed.toISOString();
        console.log(`📅 Parsed ISO format: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
        return result;
      }
    }
    
    // Handle date-only formats (no time component)
    const dateOnlyMatch = dateTime.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) || 
                          dateTime.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    
    if (dateOnlyMatch) {
      let day, month, year;
      
      // Determine if it's YYYY-MM-DD or DD/MM/YYYY format
      if (parseInt(dateOnlyMatch[1]) > 31) {
        // First part > 31, must be YYYY-MM-DD format
        year = parseInt(dateOnlyMatch[1]);
        month = parseInt(dateOnlyMatch[2]);
        day = parseInt(dateOnlyMatch[3]);
        console.log(`📅 Detected YYYY-MM-DD format: ${originalDateTime}`);
      } else if (parseInt(dateOnlyMatch[3]) > 31 || parseInt(dateOnlyMatch[3]) > 2000) {
        // Third part > 31 or > 2000, must be DD/MM/YYYY format
        day = parseInt(dateOnlyMatch[1]);
        month = parseInt(dateOnlyMatch[2]);
        year = parseInt(dateOnlyMatch[3]);
        console.log(`📅 Detected DD/MM/YYYY format: ${originalDateTime}`);
      } else {
        // Ambiguous case - need to make educated guess
        // Check if month value makes sense (1-12)
        if (parseInt(dateOnlyMatch[2]) <= 12) {
          // Could be either format, but prefer DD/MM/YYYY for Guardian data (Australian)
          day = parseInt(dateOnlyMatch[1]);
          month = parseInt(dateOnlyMatch[2]);
          year = parseInt(dateOnlyMatch[3]);
          console.log(`📅 Ambiguous date, assuming DD/MM/YYYY: ${originalDateTime}`);
        } else {
          // Second part > 12, must be MM/DD/YYYY format (but unlikely for Guardian)
          month = parseInt(dateOnlyMatch[1]);
          day = parseInt(dateOnlyMatch[2]);
          year = parseInt(dateOnlyMatch[3]);
          console.log(`📅 Detected MM/DD/YYYY format: ${originalDateTime}`);
        }
      }
      
      // Validate date components
      if (year < 2020 || year > 2030) {
        throw new Error(`Invalid year: ${year} (expected 2020-2030)`);
      }
      if (month < 1 || month > 12) {
        throw new Error(`Invalid month: ${month} (expected 1-12)`);
      }
      if (day < 1 || day > 31) {
        throw new Error(`Invalid day: ${day} (expected 1-31)`);
      }
      
      const parsed = new Date(year, month - 1, day);
      
      // Validate the date actually exists (e.g., not Feb 31)
      if (parsed.getFullYear() !== year || parsed.getMonth() !== (month - 1) || parsed.getDate() !== day) {
        throw new Error(`Invalid date: ${day}/${month}/${year} does not exist`);
      }
      
      // Check for future dates (data integrity check)
      const today = new Date();
      if (parsed > today) {
        console.warn(`⚠️  Future date detected: ${originalDateTime} → ${parsed.toISOString()}, rejecting record${recordIndex ? ` (row ${recordIndex})` : ''}`);
        throw new Error(`Future date not allowed: ${originalDateTime}`);
      }
      
      const result = parsed.toISOString();
      console.log(`📅 Successfully parsed: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
      return result;
    }
    
    // Try default JavaScript parsing as last resort (for complex formats)
    const parsed = new Date(dateTime);
    if (!isNaN(parsed.getTime())) {
      // Still check for future dates
      const today = new Date();
      if (parsed > today) {
        console.warn(`⚠️  Future date from JS parsing: ${originalDateTime}, rejecting record${recordIndex ? ` (row ${recordIndex})` : ''}`);
        throw new Error(`Future date not allowed: ${originalDateTime}`);
      }
      
      const result = parsed.toISOString();
      console.log(`📅 JS parsed: ${originalDateTime} → ${result}${recordIndex ? ` (row ${recordIndex})` : ''}`);
      return result;
    }
    
    throw new Error('No valid date format detected');
  } catch (error) {
    console.error(`❌ Date parsing failed for "${originalDateTime}": ${error.message}${recordIndex ? ` (row ${recordIndex})` : ''}`);
    throw error; // Reject the record - don't use fallback dates
  }
}

console.log('🧪 Detection Time Parsing Test Script');
console.log('📅 Testing Guardian CSV detection_time format (YYYY/MM/DD)');
console.log('');

/**
 * Test sample detection_time values from the Guardian CSV
 */
function testSampleDetectionTimes() {
  console.log('='.repeat(60));
  console.log('Phase 1: Testing Sample Detection Time Values');
  console.log('='.repeat(60));
  
  // Sample detection_time values from the CSV
  const sampleDates = [
    '2024/03/31', // March 31, 2024
    '2024/04/01', // April 1, 2024  
    '2024/04/02', // April 2, 2024
    '2024/03/30', // March 30, 2024 (if present)
    '2024/04/03'  // April 3, 2024 (if present)
  ];
  
  const results = [];
  
  sampleDates.forEach((dateStr, index) => {
    console.log(`\nTesting date ${index + 1}: "${dateStr}"`);
    console.log('-'.repeat(40));
    
    try {
      const parsedDate = parseDateTime(dateStr, index + 1);
      const parsed = new Date(parsedDate);
      const monthName = parsed.toLocaleDateString('en-US', { month: 'long' });
      const day = parsed.getDate();
      const year = parsed.getFullYear();
      
      results.push({
        input: dateStr,
        output: parsedDate,
        humanReadable: `${monthName} ${day}, ${year}`,
        success: true,
        isCorrectMonth: (dateStr.includes('03') && monthName === 'March') || 
                       (dateStr.includes('04') && monthName === 'April')
      });
      
      console.log(`✅ SUCCESS: ${dateStr} → ${monthName} ${day}, ${year}`);
      
    } catch (error) {
      results.push({
        input: dateStr,
        error: error.message,
        success: false,
        isCorrectMonth: false
      });
      
      console.log(`❌ FAILED: ${dateStr} → ${error.message}`);
    }
  });
  
  return results;
}

/**
 * Test with actual CSV data
 */
async function testWithCSVData() {
  console.log('\n' + '='.repeat(60));
  console.log('Phase 2: Testing with Actual CSV Data');
  console.log('='.repeat(60));
  
  const csvPath = path.join(__dirname, '../Inputdata_southern Fuel (3)(Distraction Total Figure).csv');
  
  try {
    if (!fs.existsSync(csvPath)) {
      console.log('⚠️  CSV file not found, skipping CSV data test');
      return [];
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      console.log('⚠️  CSV file appears empty, skipping CSV data test');
      return [];
    }
    
    // Parse header to find detection_time column
    const headers = lines[0].split(',');
    const detectionTimeIndex = headers.findIndex(h => h.trim() === 'detection_time');
    
    if (detectionTimeIndex === -1) {
      console.log('⚠️  detection_time column not found in CSV');
      return [];
    }
    
    console.log(`📊 Found detection_time in column ${detectionTimeIndex + 1}`);
    console.log(`📈 Testing first 10 records from CSV...`);
    console.log('');
    
    const results = [];
    
    // Test first 10 data rows
    for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
      const values = lines[i].split(',');
      const detectionTime = values[detectionTimeIndex]?.trim();
      
      if (!detectionTime) {
        console.log(`Row ${i}: No detection_time value, skipping`);
        continue;
      }
      
      console.log(`\nTesting Row ${i}: detection_time = "${detectionTime}"`);
      console.log('-'.repeat(50));
      
      try {
        const parsedDate = parseDateTime(detectionTime, i);
        const parsed = new Date(parsedDate);
        const monthName = parsed.toLocaleDateString('en-US', { month: 'long' });
        const day = parsed.getDate();
        const year = parsed.getFullYear();
        
        results.push({
          row: i,
          input: detectionTime,
          output: parsedDate,
          humanReadable: `${monthName} ${day}, ${year}`,
          success: true,
          month: monthName,
          isCorrectYear: year === 2024
        });
        
        console.log(`✅ Row ${i}: ${detectionTime} → ${monthName} ${day}, ${year}`);
        
      } catch (error) {
        results.push({
          row: i,
          input: detectionTime,
          error: error.message,
          success: false
        });
        
        console.log(`❌ Row ${i}: ${detectionTime} → ${error.message}`);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error reading CSV: ${error.message}`);
    return [];
  }
}

/**
 * Generate summary report
 */
function generateSummaryReport(sampleResults, csvResults) {
  console.log('\n' + '='.repeat(60));
  console.log('PARSING TEST SUMMARY REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📋 Sample Date Tests:');
  console.log('   Input Format: YYYY/MM/DD');
  
  const sampleSuccesses = sampleResults.filter(r => r.success);
  const sampleCorrectMonths = sampleResults.filter(r => r.isCorrectMonth);
  
  console.log(`   ✅ Successful parses: ${sampleSuccesses.length}/${sampleResults.length}`);
  console.log(`   ✅ Correct months: ${sampleCorrectMonths.length}/${sampleResults.length}`);
  
  if (sampleSuccesses.length > 0) {
    console.log('\n   Parsed Results:');
    sampleSuccesses.forEach(result => {
      console.log(`      ${result.input} → ${result.humanReadable}`);
    });
  }
  
  if (csvResults.length > 0) {
    console.log('\n📋 CSV Data Tests:');
    const csvSuccesses = csvResults.filter(r => r.success);
    const csv2024 = csvResults.filter(r => r.isCorrectYear);
    
    console.log(`   ✅ Successful parses: ${csvSuccesses.length}/${csvResults.length}`);
    console.log(`   ✅ Correct year (2024): ${csv2024.length}/${csvResults.length}`);
    
    // Show month distribution
    const monthCounts = {};
    csvSuccesses.forEach(result => {
      monthCounts[result.month] = (monthCounts[result.month] || 0) + 1;
    });
    
    if (Object.keys(monthCounts).length > 0) {
      console.log('\n   Month Distribution:');
      Object.entries(monthCounts).forEach(([month, count]) => {
        console.log(`      ${month}: ${count} events`);
      });
    }
  }
  
  // Overall assessment
  console.log('\n🎯 Assessment:');
  const allTests = [...sampleResults, ...csvResults];
  const allSuccesses = allTests.filter(r => r.success);
  const successRate = (allSuccesses.length / allTests.length * 100).toFixed(1);
  
  console.log(`   Success Rate: ${successRate}% (${allSuccesses.length}/${allTests.length})`);
  
  if (successRate === '100.0') {
    console.log('   ✅ ALL TESTS PASSED - Date parsing is working correctly!');
    console.log('   ✅ Ready for Guardian CSV import');
  } else if (successRate >= '90.0') {
    console.log('   ⚠️  Most tests passed, review any failures before import');
  } else {
    console.log('   ❌ Multiple test failures - fix parsing logic before import');
  }
  
  // Check for August dates (this would indicate the bug)
  const augustDates = allSuccesses.filter(r => r.humanReadable?.includes('August') || r.month === 'August');
  if (augustDates.length > 0) {
    console.log('   🚨 WARNING: Found August dates - this indicates parsing bug!');
    augustDates.forEach(result => {
      console.log(`      ${result.input} incorrectly parsed as August`);
    });
  } else {
    console.log('   ✅ No incorrect August dates detected');
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    const sampleResults = testSampleDetectionTimes();
    const csvResults = await testWithCSVData();
    
    generateSummaryReport(sampleResults, csvResults);
    
    console.log('\n🎉 Detection time parsing test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runAllTests();