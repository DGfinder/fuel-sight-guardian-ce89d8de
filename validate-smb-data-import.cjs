// Safe SMB Captive Payment Data Import Validator
// This script safely validates and compares the new SMB data file before import

const fs = require('fs');
const path = require('path');

const CURRENT_FILE = 'Inputdata_southern Fuel (3)(Carrier - SMB).csv';
const NEW_FILE = 'Inputdata_southern Fuel (3)(Carrier - SMB) (1).csv';
const BACKUP_FILE = `backup_${Date.now()}_${CURRENT_FILE}`;

// Parse a CSV line, handling quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Parse date in multiple formats
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const cleaned = dateStr.trim();
  
  // Handle M/D/YYYY format (like 9/1/2023)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const [month, day, year] = cleaned.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Handle D/M/YY format (like 29/05/25)
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('/').map(Number);
    const fullYear = year >= 20 ? 2000 + year : 2000 + year;
    return new Date(fullYear, month - 1, day);
  }
  
  // Handle DD.MM.YYYY format (like 21.05.2025)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('.').map(Number);
    return new Date(year, month - 1, day);
  }
  
  console.warn(`Unknown date format: ${cleaned}`);
  return null;
}

// Parse volume, handling commas and quotes
function parseVolume(volumeStr) {
  if (!volumeStr || volumeStr.trim() === '') return 0;
  const cleaned = volumeStr.replace(/[",]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

// Read and parse CSV file
function readCSVFile(filename) {
  console.log(`📖 Reading ${filename}...`);
  
  if (!fs.existsSync(filename)) {
    throw new Error(`File not found: ${filename}`);
  }
  
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  console.log(`   Total lines: ${lines.length}`);
  
  // Skip header line
  const dataLines = lines.slice(1);
  const records = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const fields = parseCSVLine(line);
    
    if (fields.length >= 6 && fields[0] && fields[0] !== 'Date') {
      const date = parseDate(fields[0]);
      const billOfLading = fields[1];
      const location = fields[2];
      const customer = fields[3];
      const product = fields[4];
      const volume = parseVolume(fields[5]);
      
      if (date && billOfLading && location && customer && product) {
        records.push({
          date: date,
          dateStr: fields[0],
          billOfLading,
          location,
          customer,
          product,
          volume,
          lineNumber: i + 2 // +2 because we skipped header and arrays are 0-indexed
        });
      }
    }
  }
  
  console.log(`   Valid records: ${records.length}`);
  return records;
}

// Analyze data coverage and quality
function analyzeData(records, filename) {
  console.log(`\n📊 Analyzing ${filename}:`);
  
  if (records.length === 0) {
    console.log('   ❌ No valid records found');
    return {
      totalRecords: 0,
      dateRange: null,
      uniqueCustomers: 0,
      totalVolume: 0
    };
  }
  
  // Sort by date
  records.sort((a, b) => a.date - b.date);
  
  const startDate = records[0].date;
  const endDate = records[records.length - 1].date;
  const uniqueCustomers = new Set(records.map(r => r.customer)).size;
  const totalVolume = records.reduce((sum, r) => sum + r.volume, 0);
  const uniqueBOLs = new Set(records.map(r => r.billOfLading)).size;
  
  console.log(`   📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`   📦 Total Records: ${records.length}`);
  console.log(`   📋 Unique BOLs: ${uniqueBOLs}`);
  console.log(`   🏢 Unique Customers: ${uniqueCustomers}`);
  console.log(`   ⛽ Total Volume: ${(totalVolume / 1000000).toFixed(2)} ML`);
  
  // Check for required date coverage (Sept 1, 2023 to June 30, 2025)
  const requiredStart = new Date(2023, 8, 1); // September 1, 2023
  const requiredEnd = new Date(2025, 5, 30);   // June 30, 2025
  
  const coversStart = startDate <= requiredStart;
  const coversEnd = endDate >= requiredEnd;
  
  console.log(`   ✅ Covers Sept 1, 2023: ${coversStart ? 'YES' : 'NO'}`);
  console.log(`   ✅ Covers June 30, 2025: ${coversEnd ? 'YES' : 'NO'}`);
  
  return {
    totalRecords: records.length,
    dateRange: { start: startDate, end: endDate },
    uniqueCustomers,
    totalVolume,
    uniqueBOLs,
    coversRequiredRange: coversStart && coversEnd,
    records
  };
}

// Compare two datasets
function compareDatasets(currentData, newData) {
  console.log(`\n🔍 Comparing Datasets:`);
  
  const currentRecordCount = currentData.totalRecords;
  const newRecordCount = newData.totalRecords;
  const recordDiff = newRecordCount - currentRecordCount;
  
  console.log(`   📊 Record Count:`);
  console.log(`      Current: ${currentRecordCount}`);
  console.log(`      New: ${newRecordCount}`);
  console.log(`      Difference: ${recordDiff > 0 ? '+' : ''}${recordDiff}`);
  
  const currentVolume = currentData.totalVolume / 1000000;
  const newVolume = newData.totalVolume / 1000000;
  const volumeDiff = newVolume - currentVolume;
  
  console.log(`   ⛽ Total Volume:`);
  console.log(`      Current: ${currentVolume.toFixed(2)} ML`);
  console.log(`      New: ${newVolume.toFixed(2)} ML`);
  console.log(`      Difference: ${volumeDiff > 0 ? '+' : ''}${volumeDiff.toFixed(2)} ML`);
  
  // Check for data overlap/conflicts
  if (currentData.records && newData.records) {
    const currentBOLs = new Set(currentData.records.map(r => r.billOfLading));
    const newBOLs = new Set(newData.records.map(r => r.billOfLading));
    
    const commonBOLs = [...currentBOLs].filter(bol => newBOLs.has(bol));
    const newUniqueBOLs = [...newBOLs].filter(bol => !currentBOLs.has(bol));
    
    console.log(`   🔗 BOL Overlap:`);
    console.log(`      Common BOLs: ${commonBOLs.length}`);
    console.log(`      New Unique BOLs: ${newUniqueBOLs.length}`);
  }
  
  return {
    recordDiff,
    volumeDiff,
    recommendReplace: newRecordCount > currentRecordCount && newData.coversRequiredRange
  };
}

// Main validation function
async function validateSMBImport() {
  console.log('🔍 SMB Captive Payment Data Import Validation\n');
  
  try {
    // Check if files exist
    if (!fs.existsSync(CURRENT_FILE)) {
      console.log(`❌ Current file not found: ${CURRENT_FILE}`);
      return;
    }
    
    if (!fs.existsSync(NEW_FILE)) {
      console.log(`❌ New file not found: ${NEW_FILE}`);
      return;
    }
    
    // Read and analyze both files
    const currentRecords = readCSVFile(CURRENT_FILE);
    const newRecords = readCSVFile(NEW_FILE);
    
    const currentData = analyzeData(currentRecords, 'CURRENT');
    const newData = analyzeData(newRecords, 'NEW');
    
    const comparison = compareDatasets(currentData, newData);
    
    // Generate recommendations
    console.log(`\n📋 RECOMMENDATIONS:`);
    
    if (!newData.coversRequiredRange) {
      console.log(`   ❌ NEW FILE DOES NOT COVER REQUIRED DATE RANGE`);
      console.log(`   ❌ DO NOT PROCEED WITH IMPORT`);
      return;
    }
    
    if (comparison.recordDiff <= 0) {
      console.log(`   ⚠️  New file has same or fewer records than current`);
      console.log(`   ⚠️  Manual review recommended before import`);
    }
    
    if (comparison.recommendReplace) {
      console.log(`   ✅ SAFE TO PROCEED WITH IMPORT`);
      console.log(`   ✅ New file has more data and covers required range`);
      
      console.log(`\n🔧 RECOMMENDED IMPORT STEPS:`);
      console.log(`   1. Create backup: cp "${CURRENT_FILE}" "${BACKUP_FILE}"`);
      console.log(`   2. Replace file: cp "${NEW_FILE}" "${CURRENT_FILE}"`);
      console.log(`   3. Clear cache and restart application`);
      console.log(`   4. Test captive payments dashboard`);
      console.log(`   5. Verify data ranges: Sept 1, 2023 - June 30, 2025`);
    } else {
      console.log(`   ⚠️  MANUAL REVIEW REQUIRED`);
      console.log(`   ⚠️  Compare files manually before proceeding`);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Run validation
validateSMBImport().catch(console.error);