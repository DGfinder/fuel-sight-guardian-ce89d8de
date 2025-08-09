#!/usr/bin/env node

// Comprehensive Webhook Test for All 10 Real Athara Tanks
// This converts the real CSV data to webhook format and tests the complete system

const WEBHOOK_URL = 'https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook';
const LOCAL_URL = 'http://localhost:3000/api/gasbot-webhook';
const WEBHOOK_SECRET = 'FSG-gasbot-webhook-2025';

// Real tank data converted from Athara Dashboard CSV to webhook format
const realTankData = [
  {
    "LocationId": "O'Meehan Farms Tank A 65,500ltrs",
    "LocationAddress": "O'Meehan Farms, Western Australia",
    "LocationCategory": "Agricultural", 
    "LocationCalibratedFillLevel": "0",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T14:24:05Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "0.00",
    "LocationDaysRemaining": null,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-omeehan-farms-tank-a-65500ltrs",
    
    "AssetSerialNumber": "O'Meehan Farms Tank A 65,500ltrs",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "0",
    "AssetCalibratedFillLevel": "0", 
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T14:24:05Z",
    "AssetUpdatedTimestamp": "2025-07-25T14:24:05Z",
    "AssetDailyConsumption": "0.00",
    "AssetDaysRemaining": null,
    "AssetReportedLitres": "0",
    "AssetDepth": "0",
    "AssetPressure": "0", 
    "AssetRefillCapacityLitres": "65500",
    "AssetProfileName": "O'Meehan Farms Tank A 65,500ltrs",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100321",
    "DeviceLastTelemetryTimestamp": "2025-07-25T14:24:05Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-06-27T12:21:39Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100321",
    "DeviceNetworkId": "867280067150730",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Mick Water Tank", 
    "LocationAddress": "Mick Harders, Western Australia",
    "LocationCategory": "Agricultural",
    "LocationCalibratedFillLevel": "100",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T12:27:50Z", 
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "0.00",
    "LocationDaysRemaining": null,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-mick-water-tank",
    
    "AssetSerialNumber": "Mick Water Tank",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "100",
    "AssetCalibratedFillLevel": "100",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T12:27:50Z",
    "AssetUpdatedTimestamp": "2025-07-25T12:27:50Z", 
    "AssetDailyConsumption": "0.00",
    "AssetDaysRemaining": null,
    "AssetReportedLitres": "100", // Assuming percentage * some capacity
    "AssetDepth": "2.07",
    "AssetPressure": "100",
    "AssetRefillCapacityLitres": "100", // Water tank, smaller capacity
    "AssetProfileName": "Mick Water Tank",
    "AssetProfileCommodity": "Water",
    
    "DeviceSerialNumber": "0000091808",
    "DeviceLastTelemetryTimestamp": "2025-07-25T12:27:50Z",
    "DeviceSKU": "43112", 
    "DeviceModel": 43112,
    "DeviceActivationTimestamp": "2025-06-13T22:19:45Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000091808",
    "DeviceNetworkId": "867280065353971",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Mick Harders Tank",
    "LocationAddress": "Mick Harders, Western Australia", 
    "LocationCategory": "Agricultural",
    "LocationCalibratedFillLevel": "32.01",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T11:24:45Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "5.23",
    "LocationDaysRemaining": 6,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-mick-harders-tank",
    
    "AssetSerialNumber": "Mick Harders Tank",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "32.01",
    "AssetCalibratedFillLevel": "32.01",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T11:24:45Z",
    "AssetUpdatedTimestamp": "2025-07-25T11:24:45Z",
    "AssetDailyConsumption": "5.23", 
    "AssetDaysRemaining": 6,
    "AssetReportedLitres": "1600.5", // 32.01% of ~5000L tank
    "AssetDepth": "0.784",
    "AssetPressure": "32.01",
    "AssetRefillCapacityLitres": "5000",
    "AssetProfileName": "Mick Harders Tank",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100628",
    "DeviceLastTelemetryTimestamp": "2025-07-25T11:24:45Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-06-13T14:27:07Z",
    "DeviceState": "ACTIVE", 
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100628",
    "DeviceNetworkId": "867280066315193",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Lawsons Jerry South 53,000",
    "LocationAddress": "Lawson Grains - Jerry South, Jerramungup Depot, Lawson Grains, WA",
    "LocationCategory": "Agricultural",
    "LocationCalibratedFillLevel": "51.9",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T14:31:46Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "0.20",
    "LocationDaysRemaining": 264,
    "LocationLat": null,
    "LocationLng": null, 
    "LocationGuid": "loc-lawsons-jerry-south-53000",
    
    "AssetSerialNumber": "Lawsons Jerry South 53,000",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "51.9",
    "AssetCalibratedFillLevel": "51.9",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T14:31:46Z",
    "AssetUpdatedTimestamp": "2025-07-25T14:31:46Z",
    "AssetDailyConsumption": "0.20",
    "AssetDaysRemaining": 264,
    "AssetReportedLitres": "27507", // 51.9% of 53,000L
    "AssetDepth": "1.505", 
    "AssetPressure": "51.9",
    "AssetRefillCapacityLitres": "53000",
    "AssetProfileName": "Lawsons Jerry South 53,000",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100439",
    "DeviceLastTelemetryTimestamp": "2025-07-25T14:31:46Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-05-09T14:17:15Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true, 
    "DeviceGuid": "device-gasbot-0000100439",
    "DeviceNetworkId": "867280067151159",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Lake Grace Diesel 110",
    "LocationAddress": "Lake Grace Depot, WA",
    "LocationCategory": "Commercial Depot",
    "LocationCalibratedFillLevel": "49.09",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T14:27:36Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "6.58",
    "LocationDaysRemaining": 8, 
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-lake-grace-diesel-110",
    
    "AssetSerialNumber": "Lake Grace Diesel 110",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "49.09",
    "AssetCalibratedFillLevel": "49.09",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T14:27:36Z",
    "AssetUpdatedTimestamp": "2025-07-25T14:27:36Z",
    "AssetDailyConsumption": "6.58",
    "AssetDaysRemaining": 8,
    "AssetReportedLitres": "53999", // 49.09% of ~110,000L
    "AssetDepth": "1.653",
    "AssetPressure": "49.09",
    "AssetRefillCapacityLitres": "110000", 
    "AssetProfileName": "Lake Grace Diesel 110",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000097707",
    "DeviceLastTelemetryTimestamp": "2025-07-25T14:27:36Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2024-07-29T15:40:52Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000097707",
    "DeviceNetworkId": "867280065353880",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Katanning Depot Diesel",
    "LocationAddress": "Jerramungup Depot, WA", 
    "LocationCategory": "Commercial Depot",
    "LocationCalibratedFillLevel": "40.95",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T11:10:01Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "2.28",
    "LocationDaysRemaining": 18,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-katanning-depot-diesel",
    
    "AssetSerialNumber": "Katanning Depot Diesel",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "40.95",
    "AssetCalibratedFillLevel": "40.95",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T11:10:01Z",
    "AssetUpdatedTimestamp": "2025-07-25T11:10:01Z",
    "AssetDailyConsumption": "2.28",
    "AssetDaysRemaining": 18, 
    "AssetReportedLitres": "20475", // Estimated ~50,000L capacity
    "AssetDepth": "4.443",
    "AssetPressure": "40.95",
    "AssetRefillCapacityLitres": "50000",
    "AssetProfileName": "Katanning Depot Diesel",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000098281",
    "DeviceLastTelemetryTimestamp": "2025-07-25T11:10:01Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2024-09-24T16:19:49Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000098281",
    "DeviceNetworkId": "867280065350167",
    
    "TenancyName": "Great Southern Fuel Supplies" 
  },
  {
    "LocationId": "Jacup Diesel 53,000",
    "LocationAddress": "Lawson Grains - Gunnadoo, Jerramungup Depot, WA",
    "LocationCategory": "Agricultural",
    "LocationCalibratedFillLevel": "20.22",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T13:33:18Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "0.32",
    "LocationDaysRemaining": 64,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-jacup-diesel-53000",
    
    "AssetSerialNumber": "Jacup Diesel 53,000",
    "AssetDisabledStatus": false, 
    "AssetRawFillLevel": "20.22",
    "AssetCalibratedFillLevel": "20.22",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T13:33:18Z",
    "AssetUpdatedTimestamp": "2025-07-25T13:33:18Z",
    "AssetDailyConsumption": "0.32",
    "AssetDaysRemaining": 64,
    "AssetReportedLitres": "10717", // 20.22% of 53,000L
    "AssetDepth": "0.73",
    "AssetPressure": "20.22",
    "AssetRefillCapacityLitres": "53000",
    "AssetProfileName": "Lawson Gunnadoo Jacup Diesel 53,000 Ltrs",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100285",
    "DeviceLastTelemetryTimestamp": "2025-07-25T13:33:18Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-05-10T17:46:20Z", 
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100285",
    "DeviceNetworkId": "867280067144568",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Corrigin Tank 4 Diesel 54,400ltrs",
    "LocationAddress": "Corrigin Depot, WA",
    "LocationCategory": "Commercial Depot",
    "LocationCalibratedFillLevel": "59.69",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T09:55:30Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "1.56",
    "LocationDaysRemaining": 38,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-corrigin-tank-4-diesel-54400ltrs",
    
    "AssetSerialNumber": "Corrigin Tank 4 Diesel 54,400ltrs", 
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "59.69",
    "AssetCalibratedFillLevel": "59.69",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T09:55:30Z",
    "AssetUpdatedTimestamp": "2025-07-25T09:55:30Z",
    "AssetDailyConsumption": "1.56",
    "AssetDaysRemaining": 38,
    "AssetReportedLitres": "32471", // 59.69% of 54,400L
    "AssetDepth": "1.523",
    "AssetPressure": "59.69",
    "AssetRefillCapacityLitres": "54400",
    "AssetProfileName": "Corrigin Diesel Tank 4 54,000 ltrs",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100623",
    "DeviceLastTelemetryTimestamp": "2025-07-25T09:55:30Z",
    "DeviceSKU": "43111", 
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-02-03T16:20:19Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100623",
    "DeviceNetworkId": "867280067150201",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Corrigin Diesel Tank 3 54,400ltrs",
    "LocationAddress": "Corrigin Depot, WA",
    "LocationCategory": "Commercial Depot", 
    "LocationCalibratedFillLevel": "58.39",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T11:49:13Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "1.52",
    "LocationDaysRemaining": 38,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-corrigin-diesel-tank-3-54400ltrs",
    
    "AssetSerialNumber": "Corrigin Tank 3 Diesel 54,400ltrs",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "58.39",
    "AssetCalibratedFillLevel": "58.39",
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T11:49:13Z",
    "AssetUpdatedTimestamp": "2025-07-25T11:49:13Z",
    "AssetDailyConsumption": "1.52",
    "AssetDaysRemaining": 38,
    "AssetReportedLitres": "31764", // 58.39% of 54,400L
    "AssetDepth": "1.496", 
    "AssetPressure": "58.39",
    "AssetRefillCapacityLitres": "54400",
    "AssetProfileName": "Corrigin Diesel Tank 3 54,400ltrs",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100687",
    "DeviceLastTelemetryTimestamp": "2025-07-25T11:49:13Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-02-03T16:41:23Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100687",
    "DeviceNetworkId": "867280067150953",
    
    "TenancyName": "Great Southern Fuel Supplies"
  },
  {
    "LocationId": "Bruce Rock Diesel", 
    "LocationAddress": "1 Johnson Street, Bruce Rock, Western Australia",
    "LocationCategory": "Commercial Depot",
    "LocationCalibratedFillLevel": "53.31",
    "LocationLastCalibratedTelemetryTimestamp": "2025-07-25T15:09:36Z",
    "LocationDisabledStatus": false,
    "LocationDailyConsumption": "2.39",
    "LocationDaysRemaining": 23,
    "LocationLat": null,
    "LocationLng": null,
    "LocationGuid": "loc-bruce-rock-diesel",
    
    "AssetSerialNumber": "Bruce Rock Diesel",
    "AssetDisabledStatus": false,
    "AssetRawFillLevel": "53.31",
    "AssetCalibratedFillLevel": "54.43", // Note: Different between raw and calibrated in CSV
    "AssetLastCalibratedTelemetryTimestamp": "2025-07-25T15:09:36Z",
    "AssetUpdatedTimestamp": "2025-07-25T15:09:36Z",
    "AssetDailyConsumption": "2.39",
    "AssetDaysRemaining": 23,
    "AssetReportedLitres": "27215", // ~53.31% of estimated 51,000L tank
    "AssetDepth": "1.803", 
    "AssetPressure": "53.31",
    "AssetRefillCapacityLitres": "51000",
    "AssetProfileName": "Bruce Rock Diesel",
    "AssetProfileCommodity": "Diesel",
    
    "DeviceSerialNumber": "0000100402",
    "DeviceLastTelemetryTimestamp": "2025-07-25T15:09:36Z",
    "DeviceSKU": "43111",
    "DeviceModel": 43111,
    "DeviceActivationTimestamp": "2025-07-09T11:53:04Z",
    "DeviceState": "ACTIVE",
    "DeviceOnline": true,
    "DeviceGuid": "device-gasbot-0000100402",
    "DeviceNetworkId": "867280066307927",
    
    "TenancyName": "Great Southern Fuel Supplies"
  }
];

async function testWebhook(url, testName) {
  console.log(`\n🧪 Testing ${testName}`);
  console.log(`📍 URL: ${url}`);
  console.log(`📊 Sending ${realTankData.length} REAL tank records...`);
  console.log('='.repeat(80));
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Real-Tank-Data-Test/1.0'
      },
      body: JSON.stringify(realTankData)
    });
    
    const processingTime = Date.now() - startTime;
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Network Time: ${processingTime}ms`);
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${testName} SUCCESS!`);
      console.log(`📈 Results:`);
      console.log(`   📦 Total Records: ${responseData.stats.totalRecords}`);
      console.log(`   ✅ Processed: ${responseData.stats.processedRecords}`);
      console.log(`   ❌ Errors: ${responseData.stats.errorCount}`);
      console.log(`   ⏱️  Processing Time: ${responseData.stats.duration}ms`);
      console.log(`   📊 Total Time: ${processingTime}ms (network) + ${responseData.stats.duration}ms (processing)`);
      
      if (responseData.errors && responseData.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered:`);
        responseData.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      return {
        success: true,
        stats: responseData.stats,
        errors: responseData.errors || [],
        processingTime: responseData.stats.duration,
        networkTime: processingTime
      };
      
    } else {
      console.log(`❌ ${testName} FAILED:`);
      console.log(`   Error: ${responseData.error || responseData.message}`);
      console.log(`   Details:`, responseData);
      
      return {
        success: false,
        error: responseData.error || responseData.message,
        details: responseData
      };
    }
    
  } catch (error) {
    console.log(`💥 ${testName} ERROR: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log(`   💡 Tip: Make sure your local server is running (npm run dev)`);
    } else if (error.message.includes('fetch')) {
      console.log(`   💡 Tip: Check if the URL is accessible`);
    }
    
    return {
      success: false,
      error: error.message,
      details: { type: 'network_error' }
    };
  }
}

function analyzeTankData() {
  console.log('\n📊 COMPREHENSIVE TANK DATA ANALYSIS');
  console.log('='.repeat(80));
  
  const tanks = realTankData.map(tank => ({
    name: tank.LocationId,
    fuelLevel: parseFloat(tank.AssetCalibratedFillLevel),
    capacity: parseInt(tank.AssetRefillCapacityLitres),
    liters: parseInt(tank.AssetReportedLitres),
    consumption: parseFloat(tank.AssetDailyConsumption) || 0,
    daysRemaining: tank.AssetDaysRemaining,
    deviceSerial: tank.DeviceSerialNumber,
    online: tank.DeviceOnline,
    category: tank.LocationCategory,
    commodity: tank.AssetProfileCommodity
  }));
  
  // Sort by fuel level (lowest first)
  tanks.sort((a, b) => a.fuelLevel - b.fuelLevel);
  
  console.log('\n🚨 CRITICAL ALERTS (≤20% fuel):');
  const critical = tanks.filter(t => t.fuelLevel <= 20);
  if (critical.length === 0) {
    console.log('   ✅ No critical fuel levels');
  } else {
    critical.forEach((tank, i) => {
      console.log(`   ${i + 1}. ${tank.name}: ${tank.fuelLevel}% (${tank.liters.toLocaleString()}L / ${tank.capacity.toLocaleString()}L)`);
      if (tank.daysRemaining) {
        console.log(`      ⏰ Days remaining: ${tank.daysRemaining}`);
      }
      console.log(`      📍 Type: ${tank.category} | 🔧 Device: ${tank.deviceSerial}`);
    });
  }
  
  console.log('\n⚠️  LOW FUEL ALERTS (21-40% fuel):');
  const low = tanks.filter(t => t.fuelLevel > 20 && t.fuelLevel <= 40);
  if (low.length === 0) {
    console.log('   ✅ No low fuel levels');
  } else {
    low.forEach((tank, i) => {
      console.log(`   ${i + 1}. ${tank.name}: ${tank.fuelLevel}% (${tank.liters.toLocaleString()}L)`);
    });
  }
  
  console.log('\n✅ GOOD FUEL LEVELS (>40% fuel):');
  const good = tanks.filter(t => t.fuelLevel > 40);
  good.forEach((tank, i) => {
    console.log(`   ${i + 1}. ${tank.name}: ${tank.fuelLevel}% (${tank.liters.toLocaleString()}L)`);
  });
  
  // Statistics
  const totalCapacity = tanks.reduce((sum, t) => sum + t.capacity, 0);
  const totalFuel = tanks.reduce((sum, t) => sum + t.liters, 0);
  const averageFuel = tanks.reduce((sum, t) => sum + t.fuelLevel, 0) / tanks.length;
  const totalDailyConsumption = tanks.reduce((sum, t) => sum + t.consumption, 0);
  
  console.log('\n📈 FLEET STATISTICS:');
  console.log(`   🏭 Total Tanks: ${tanks.length}`);
  console.log(`   📊 Total Capacity: ${totalCapacity.toLocaleString()}L`);
  console.log(`   ⛽ Current Fuel: ${totalFuel.toLocaleString()}L (${((totalFuel/totalCapacity)*100).toFixed(1)}%)`);
  console.log(`   📊 Average Fill Level: ${averageFuel.toFixed(1)}%`);
  console.log(`   📉 Daily Consumption: ${totalDailyConsumption.toFixed(2)}L/day`);
  console.log(`   📅 Fleet Days Remaining: ~${totalFuel > 0 ? Math.round(totalFuel / totalDailyConsumption) : 'N/A'} days`);
  console.log(`   🔌 All Devices Online: ${tanks.every(t => t.online) ? '✅ Yes' : '❌ No'}`);
  
  console.log('\n🏷️  BY CATEGORY:');
  const categories = [...new Set(tanks.map(t => t.category))];
  categories.forEach(category => {
    const categoryTanks = tanks.filter(t => t.category === category);
    const avgLevel = categoryTanks.reduce((sum, t) => sum + t.fuelLevel, 0) / categoryTanks.length;
    console.log(`   ${category}: ${categoryTanks.length} tanks, avg ${avgLevel.toFixed(1)}% fuel`);
  });
  
  console.log('\n⚡ DEVICE STATUS:');
  const deviceModels = [...new Set(tanks.map(t => tanks.find(tank => tank.deviceSerial === t.deviceSerial)?.deviceSerial))];
  console.log(`   📱 Total Devices: ${tanks.length}`);
  console.log(`   ✅ Online: ${tanks.filter(t => t.online).length}`);
  console.log(`   ❌ Offline: ${tanks.filter(t => !t.online).length}`);
  
  return {
    totalTanks: tanks.length,
    critical: critical.length,
    low: low.length, 
    good: good.length,
    totalCapacity,
    totalFuel,
    averageFuel: averageFuel.toFixed(1),
    allOnline: tanks.every(t => t.online),
    categories: categories.length
  };
}

async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE REAL TANK WEBHOOK TEST');
  console.log('='.repeat(80));
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`📋 Customer: Great Southern Fuel Supplies`);
  console.log(`🏭 Total Tanks: ${realTankData.length}`);
  
  // Analyze the tank data first
  const analysis = analyzeTankData();
  
  // Test the webhook with real data
  console.log('\n🔗 WEBHOOK TESTING');
  console.log('='.repeat(80));
  
  // Test production webhook
  const productionResult = await testWebhook(WEBHOOK_URL, 'Production Vercel (REAL DATA)');
  
  console.log('\n📋 FINAL SUMMARY');
  console.log('='.repeat(80));
  
  if (productionResult.success) {
    console.log('🎉 SUCCESS! All real tank data processed successfully');
    console.log('\n📊 Database should now contain:');
    console.log(`   📍 ${analysis.totalTanks} locations in agbot_locations table`);
    console.log(`   🛠️  ${analysis.totalTanks} assets in agbot_assets table`);
    console.log(`   📈 ${analysis.totalTanks} readings in agbot_readings_history table`);
    console.log(`   📝 1 entry in agbot_sync_logs table`);
    
    console.log('\n⚠️  IMMEDIATE ACTIONS REQUIRED:');
    if (analysis.critical > 0) {
      console.log(`   🚨 ${analysis.critical} tank(s) at CRITICAL fuel levels (≤20%) - REFILL URGENTLY!`);
    }
    if (analysis.low > 0) {
      console.log(`   ⚠️  ${analysis.low} tank(s) at LOW fuel levels (21-40%) - Schedule refill`);
    }
    if (analysis.critical === 0 && analysis.low === 0) {
      console.log(`   ✅ All tanks have adequate fuel levels`);
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. ✅ Your webhook system is ready for live Gasbot hourly updates');
    console.log('2. 📊 Check AgbotPage dashboard to see all tank data');
    console.log('3. 🔔 Configure alerts for critical fuel levels');
    console.log('4. 🤝 Contact Gasbot to start sending hourly webhooks');
    
  } else {
    console.log('❌ WEBHOOK TEST FAILED');
    console.log(`   Error: ${productionResult.error}`);
    console.log('   Please check webhook configuration and try again');
  }
  
  console.log('\n✨ Test completed!');
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);