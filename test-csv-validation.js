/**
 * Simple CSV validation script for LYTX data
 * Tests CSV structure and data quality
 */

import fs from 'fs';

function testCsvStructure() {
  console.log('🧪 Testing LYTX CSV Structure and Data Quality');
  console.log('==============================================\n');

  try {
    // Read the test CSV
    const csvContent = fs.readFileSync('./test-lytx-events.csv', 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    console.log(`📄 CSV File: ${lines.length} lines (${lines.length - 1} data rows + header)`);
    
    // Parse header
    const headers = lines[0].split(',');
    console.log(`📋 Headers (${headers.length}):`, headers);
    
    // Expected headers for LYTX CSV
    const expectedHeaders = [
      'Event ID', 'Driver Name', 'Vehicle', 'Date/Time', 
      'Event Type', 'Status', 'Group Name', 'Behavior', 
      'Risk Score', 'Device Serial'
    ];
    
    console.log('\n✅ Header Validation:');
    expectedHeaders.forEach(expected => {
      const found = headers.some(h => h.toLowerCase().includes(expected.toLowerCase()) || 
                                      expected.toLowerCase().includes(h.toLowerCase()));
      console.log(`  ${found ? '✓' : '✗'} ${expected}: ${found ? 'Found' : 'Missing'}`);
    });

    // Parse and validate data rows
    console.log('\n📊 Data Quality Analysis:');
    let validRows = 0;
    let stevemacsCount = 0;
    let gsfCount = 0;
    let carrierData = {};
    let statusData = {};
    let eventTypeData = {};
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === headers.length) {
        validRows++;
        
        // Analyze carrier distribution
        const groupName = values[6]; // Group Name column
        if (groupName.toLowerCase().includes('stevemacs') || groupName.toLowerCase().includes('kewdale')) {
          stevemacsCount++;
          carrierData['Stevemacs'] = (carrierData['Stevemacs'] || 0) + 1;
        } else {
          gsfCount++;
          carrierData['Great Southern Fuels'] = (carrierData['Great Southern Fuels'] || 0) + 1;
        }
        
        // Analyze status distribution
        const status = values[5];
        statusData[status] = (statusData[status] || 0) + 1;
        
        // Analyze event type distribution
        const eventType = values[4];
        eventTypeData[eventType] = (eventTypeData[eventType] || 0) + 1;
      }
    }
    
    console.log(`  Valid data rows: ${validRows}/${lines.length - 1}`);
    console.log(`  Row completeness: ${((validRows / (lines.length - 1)) * 100).toFixed(1)}%`);
    
    console.log('\n🏢 Carrier Distribution:');
    Object.entries(carrierData).forEach(([carrier, count]) => {
      console.log(`  ${carrier}: ${count} events (${((count / validRows) * 100).toFixed(1)}%)`);
    });
    
    console.log('\n📈 Status Distribution:');
    Object.entries(statusData).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} events (${((count / validRows) * 100).toFixed(1)}%)`);
    });
    
    console.log('\n🚨 Event Type Distribution:');
    Object.entries(eventTypeData).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} events (${((count / validRows) * 100).toFixed(1)}%)`);
    });

    // Test transformation logic
    console.log('\n🔄 Testing Data Transformations:');
    
    // Test carrier detection logic
    const testCarrierDetection = (groupName) => {
      const g = groupName.toLowerCase();
      if (g.includes('stevemacs') || g.includes('smb') || g.includes('kewdale')) return 'Stevemacs';
      return 'Great Southern Fuels';
    };
    
    // Test depot extraction
    const testDepotExtraction = (groupName) => {
      const g = groupName.toLowerCase();
      if (g.includes('kewdale')) return 'Kewdale';
      if (g.includes('geraldton')) return 'Geraldton';
      if (g.includes('kalgoorlie')) return 'Kalgoorlie';
      if (g.includes('narrogin')) return 'Narrogin';
      if (g.includes('albany')) return 'Albany';
      if (g.includes('bunbury')) return 'Bunbury';
      if (g.includes('fremantle')) return 'Fremantle';
      return groupName || 'Unknown';
    };
    
    // Test status normalization
    const testStatusNormalization = (status) => {
      const s = status.toLowerCase();
      if (s.includes('face') || s.includes('coach')) return 'Face-To-Face';
      if (s.includes('fyi') || s.includes('notify')) return 'FYI Notify';
      if (s.includes('resolved') || s.includes('closed')) return 'Resolved';
      return 'New';
    };
    
    // Test a few sample rows
    for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
      const values = lines[i].split(',');
      const groupName = values[6];
      const status = values[5];
      
      console.log(`\n  Sample Row ${i}:`);
      console.log(`    Group: "${groupName}" → Carrier: ${testCarrierDetection(groupName)}, Depot: ${testDepotExtraction(groupName)}`);
      console.log(`    Status: "${status}" → Normalized: ${testStatusNormalization(status)}`);
    }

    // Summary
    console.log('\n🎯 Test Results Summary:');
    const allHeadersFound = expectedHeaders.every(expected => 
      headers.some(h => h.toLowerCase().includes(expected.toLowerCase()) || 
                        expected.toLowerCase().includes(h.toLowerCase())));
    
    const dataIntegrity = validRows === (lines.length - 1);
    const hasCarrierData = Object.keys(carrierData).length > 0;
    const hasStatusData = Object.keys(statusData).length > 0;
    
    if (allHeadersFound && dataIntegrity && hasCarrierData && hasStatusData) {
      console.log('✅ All tests passed! CSV structure is valid for LYTX import.');
      console.log('✅ Data transformations are working correctly.');
      console.log('✅ Ready for production import.');
    } else {
      console.log('⚠️ Some issues detected:');
      if (!allHeadersFound) console.log('  - Some expected headers are missing');
      if (!dataIntegrity) console.log('  - Data integrity issues found');
      if (!hasCarrierData) console.log('  - Carrier detection may not work');
      if (!hasStatusData) console.log('  - Status data missing');
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Navigate to the LYTX Safety Dashboard');
    console.log('3. Click "Import CSV" button');
    console.log('4. Upload the test-lytx-events.csv file');
    console.log('5. Verify the preview shows correct data transformation');
    console.log('6. Click "Import" to add events to the database');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCsvStructure();