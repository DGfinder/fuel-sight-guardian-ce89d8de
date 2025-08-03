#!/usr/bin/env node

/**
 * Debug script to test Athara API directly and inspect the full response
 * Run with: npx tsx src/debug/test-athara-api.ts
 */

import 'dotenv/config';

const ATHARA_API_KEY = process.env.VITE_ATHARA_API_KEY || '9PAUTYO9U7VZTXD40T62VNB7KJOZQZ10C8M1';
const ATHARA_BASE_URL = process.env.VITE_ATHARA_BASE_URL || 'https://api.athara.com';

console.log('='.repeat(60));
console.log('ATHARA API DEBUG SCRIPT');
console.log('='.repeat(60));
console.log(`API Key: ${ATHARA_API_KEY.substring(0, 10)}...${ATHARA_API_KEY.substring(ATHARA_API_KEY.length - 4)}`);
console.log(`Base URL: ${ATHARA_BASE_URL}`);
console.log('='.repeat(60));

async function testAtharaAPI() {
  try {
    console.log('\n📡 Testing Athara API connection...\n');
    
    // Test basic connectivity
    const startTime = Date.now();
    const response = await fetch(`${ATHARA_BASE_URL}/locations`, {
      headers: {
        'Authorization': `Bearer ${ATHARA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`\n✅ API Response received!\n`);
    
    // Analyze the response
    console.log('📊 Response Analysis:');
    console.log('-'.repeat(40));
    console.log(`Total Locations: ${data.length}`);
    
    let totalAssets = 0;
    let locationsWithAssets = 0;
    const assetCounts: Record<string, number> = {};
    
    // Detailed location analysis
    console.log('\n📍 Location Details:');
    console.log('-'.repeat(60));
    
    data.forEach((location: any, index: number) => {
      const assetCount = location.assets?.length || 0;
      totalAssets += assetCount;
      if (assetCount > 0) locationsWithAssets++;
      
      console.log(`\n[${index + 1}] ${location.customerName} - ${location.locationId}`);
      console.log(`    Address: ${location.address1}, ${location.state} ${location.postcode}`);
      console.log(`    Status: ${location.locationStatusLabel} (${location.locationStatus})`);
      console.log(`    Fill %: ${location.latestCalibratedFillPercentage}%`);
      console.log(`    Assets: ${assetCount}`);
      
      if (location.assets && location.assets.length > 0) {
        console.log(`    Asset Details:`);
        location.assets.forEach((asset: any, assetIndex: number) => {
          console.log(`      [${assetIndex + 1}] ${asset.deviceSerialNumber}`);
          console.log(`         - Model: ${asset.deviceSKUName}`);
          console.log(`         - Online: ${asset.deviceOnline ? '✅' : '❌'}`);
          console.log(`         - Fill %: ${asset.latestCalibratedFillPercentage}%`);
          console.log(`         - Last Update: ${asset.latestTelemetryEventTimestamp}`);
        });
      }
      
      assetCounts[location.customerName] = assetCount;
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary Statistics:');
    console.log('-'.repeat(40));
    console.log(`Total Locations: ${data.length}`);
    console.log(`Locations with Assets: ${locationsWithAssets}`);
    console.log(`Total Assets/Tanks: ${totalAssets}`);
    console.log(`Average Assets per Location: ${(totalAssets / data.length).toFixed(2)}`);
    
    console.log('\n🏢 Assets by Customer:');
    Object.entries(assetCounts).forEach(([customer, count]) => {
      console.log(`  ${customer}: ${count} tanks`);
    });
    
    // Check for potential pagination
    console.log('\n🔍 Pagination Check:');
    console.log('-'.repeat(40));
    
    // Try common pagination parameters
    const paginationTests = [
      { params: '?page=2', desc: 'Page 2' },
      { params: '?limit=100', desc: 'Limit 100' },
      { params: '?offset=10', desc: 'Offset 10' },
      { params: '?per_page=50', desc: 'Per Page 50' }
    ];
    
    for (const test of paginationTests) {
      try {
        const testResponse = await fetch(`${ATHARA_BASE_URL}/locations${test.params}`, {
          headers: {
            'Authorization': `Bearer ${ATHARA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log(`${test.desc}: ${testData.length} results (Status: ${testResponse.status})`);
        } else {
          console.log(`${test.desc}: Failed (Status: ${testResponse.status})`);
        }
      } catch (error) {
        console.log(`${test.desc}: Error - ${error.message}`);
      }
    }
    
    // Save raw response for analysis
    const fs = await import('fs');
    const debugOutput = {
      timestamp: new Date().toISOString(),
      apiUrl: ATHARA_BASE_URL,
      responseStatus: response.status,
      responseTime: responseTime,
      totalLocations: data.length,
      totalAssets: totalAssets,
      locationsWithAssets: locationsWithAssets,
      assetCounts: assetCounts,
      rawData: data
    };
    
    const outputPath = './athara-api-debug.json';
    await fs.promises.writeFile(outputPath, JSON.stringify(debugOutput, null, 2));
    console.log(`\n💾 Full response saved to: ${outputPath}`);
    
    // Check for specific issues
    console.log('\n⚠️  Potential Issues:');
    console.log('-'.repeat(40));
    
    // Check for duplicate GUIDs
    const locationGuids = new Set();
    const assetGuids = new Set();
    let duplicateLocationGuids = 0;
    let duplicateAssetGuids = 0;
    
    data.forEach((location: any) => {
      if (locationGuids.has(location.locationGuid)) {
        duplicateLocationGuids++;
        console.log(`❌ Duplicate location GUID: ${location.locationGuid}`);
      }
      locationGuids.add(location.locationGuid);
      
      location.assets?.forEach((asset: any) => {
        if (assetGuids.has(asset.assetGuid)) {
          duplicateAssetGuids++;
          console.log(`❌ Duplicate asset GUID: ${asset.assetGuid}`);
        }
        assetGuids.add(asset.assetGuid);
      });
    });
    
    if (duplicateLocationGuids === 0 && duplicateAssetGuids === 0) {
      console.log('✅ No duplicate GUIDs found');
    }
    
    // Check for missing coordinates
    const missingCoords = data.filter((loc: any) => !loc.lat || !loc.lng);
    if (missingCoords.length > 0) {
      console.log(`⚠️  ${missingCoords.length} locations missing coordinates`);
    }
    
    // Check for offline devices
    const offlineDevices = data.reduce((count: number, loc: any) => {
      return count + (loc.assets?.filter((a: any) => !a.deviceOnline).length || 0);
    }, 0);
    if (offlineDevices > 0) {
      console.log(`⚠️  ${offlineDevices} devices are offline`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug script completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
  }
}

// Run the test
testAtharaAPI().catch(console.error);