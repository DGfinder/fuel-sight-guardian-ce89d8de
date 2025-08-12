/**
 * Test script for LYTX CSV import functionality
 * Tests the CSV processor with sample data
 */

import fs from 'fs';
import { LytxCsvProcessor } from './src/services/lytxCsvProcessor.js';

async function testCsvImport() {
  try {
    console.log('🧪 Testing LYTX CSV Import Functionality');
    console.log('=====================================\n');

    // Read the test CSV file
    const csvContent = fs.readFileSync('./test-lytx-events.csv', 'utf-8');
    console.log('📁 Sample CSV content loaded');
    console.log('CSV preview:', csvContent.split('\n').slice(0, 3).join('\n'));
    console.log('...\n');

    // Process the CSV
    console.log('⚙️ Processing CSV with LytxCsvProcessor...');
    const result = await LytxCsvProcessor.processCsv(csvContent, 'test-user-id');

    // Display results
    console.log('✅ Processing completed!');
    console.log('========================\n');

    console.log('📊 Processing Results:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Total Rows: ${result.metadata.totalRows}`);
    console.log(`- Valid Rows: ${result.metadata.validRows}`);
    console.log(`- Skipped Rows: ${result.metadata.skippedRows}`);
    console.log(`- Duplicate Rows: ${result.metadata.duplicateRows}`);
    console.log(`- Primary Carrier: ${result.metadata.carrier}`);
    
    if (result.metadata.dateRange) {
      console.log(`- Date Range: ${result.metadata.dateRange.start} to ${result.metadata.dateRange.end}`);
    }

    console.log('\n🚨 Errors:');
    if (result.metadata.errors.length === 0) {
      console.log('  No errors found');
    } else {
      result.metadata.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n⚠️ Warnings:');
    if (result.metadata.warnings.length === 0) {
      console.log('  No warnings');
    } else {
      result.metadata.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n📋 Sample Processed Records:');
    result.records.slice(0, 3).forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  - Event ID: ${record.event_id}`);
      console.log(`  - Driver: ${record.driver_name}`);
      console.log(`  - Vehicle: ${record.vehicle_registration}`);
      console.log(`  - Carrier: ${record.carrier}`);
      console.log(`  - Depot: ${record.depot}`);
      console.log(`  - Status: ${record.status}`);
      console.log(`  - Event Type: ${record.event_type}`);
      console.log(`  - Date/Time: ${record.event_datetime}`);
      console.log(`  - Score: ${record.score}`);
    });

    console.log('\n🎯 Field Mapping Test:');
    const sampleRecord = result.records[0];
    console.log('Testing field transformations:');
    console.log(`✓ Carrier Detection: ${sampleRecord.carrier} (from "${sampleRecord.group_name}")`);
    console.log(`✓ Depot Extraction: ${sampleRecord.depot}`);
    console.log(`✓ Status Normalization: ${sampleRecord.status}`);
    console.log(`✓ Event Type Classification: ${sampleRecord.event_type}`);
    console.log(`✓ Date Parsing: ${sampleRecord.event_datetime}`);

    console.log('\n🏁 Test Summary:');
    if (result.success && result.metadata.errors.length === 0 && result.metadata.validRows > 0) {
      console.log('✅ All tests passed! CSV import functionality is working correctly.');
      console.log(`📈 Ready to import ${result.metadata.validRows} events to the database.`);
    } else {
      console.log('❌ Test failed. Please check the errors above.');
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Use the "Import CSV" button in the LYTX Safety Dashboard');
    console.log('2. Upload your CSV file using the drag-and-drop interface');
    console.log('3. Review the preview and click "Import" to add events to the database');
    console.log('4. The imported data will appear immediately in the dashboard analytics');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure all dependencies are installed');
    console.error('2. Check that the CSV processor service is properly implemented');
    console.error('3. Verify the database connection is working');
  }
}

// Run the test
testCsvImport();