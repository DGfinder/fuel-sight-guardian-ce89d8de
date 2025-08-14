#!/usr/bin/env node

/**
 * Validate Vehicle Additions
 * 
 * Verifies that vehicles imported from MtData trip history are properly
 * integrated into the fleet management system and trip analytics.
 * 
 * Usage: node scripts/validate-vehicle-additions.js
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
 * Check trip correlation statistics
 */
async function checkTripCorrelation() {
  console.log('🔍 Analyzing trip correlation statistics...');
  
  try {
    // Total trips
    const { count: totalTrips, error: totalError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // Matched trips
    const { count: matchedTrips, error: matchedError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true })
      .not('vehicle_id', 'is', null);
    
    if (matchedError) throw matchedError;
    
    // Unmatched trips
    const { count: unmatchedTrips, error: unmatchedError } = await supabase
      .from('mtdata_trip_history')
      .select('*', { count: 'exact', head: true })
      .is('vehicle_id', null);
    
    if (unmatchedError) throw unmatchedError;
    
    const correlationRate = totalTrips > 0 ? (matchedTrips / totalTrips * 100).toFixed(1) : 0;
    
    console.log(`📊 Trip Correlation Statistics:`);
    console.log(`  - Total trips: ${totalTrips.toLocaleString()}`);
    console.log(`  - Matched trips: ${matchedTrips.toLocaleString()}`);
    console.log(`  - Unmatched trips: ${unmatchedTrips.toLocaleString()}`);
    console.log(`  - Correlation rate: ${correlationRate}%`);
    
    if (unmatchedTrips > 0) {
      // Get details about remaining unmatched vehicles
      const { data: unmatchedVehicles, error: unmatchedVehiclesError } = await supabase
        .from('mtdata_trip_history')
        .select('vehicle_registration, group_name')
        .is('vehicle_id', null)
        .order('vehicle_registration');
      
      if (!unmatchedVehiclesError) {
        const uniqueUnmatched = [...new Set(unmatchedVehicles.map(v => v.vehicle_registration))];
        console.log(`\n⚠️ Remaining unmatched vehicles (${uniqueUnmatched.length}):`);
        uniqueUnmatched.slice(0, 10).forEach(reg => {
          const vehicle = unmatchedVehicles.find(v => v.vehicle_registration === reg);
          console.log(`  - ${reg} (${vehicle.group_name})`);
        });
        if (uniqueUnmatched.length > 10) {
          console.log(`  ... and ${uniqueUnmatched.length - 10} more`);
        }
      }
    }
    
    return { correlationRate, totalTrips, matchedTrips, unmatchedTrips };
    
  } catch (error) {
    console.error(`❌ Failed to check trip correlation: ${error.message}`);
    return null;
  }
}

/**
 * Check fleet database statistics
 */
async function checkFleetDatabase() {
  console.log('\n🏢 Analyzing fleet database...');
  
  try {
    // Total vehicles
    const { count: totalVehicles, error: totalError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // Fleet distribution
    const { data: fleetData, error: fleetError } = await supabase
      .from('vehicles')
      .select('fleet, depot, status');
    
    if (fleetError) throw fleetError;
    
    const fleetDistribution = fleetData.reduce((acc, vehicle) => {
      const key = `${vehicle.fleet} - ${vehicle.depot}`;
      if (!acc[key]) acc[key] = { total: 0, active: 0 };
      acc[key].total++;
      if (vehicle.status === 'Active') acc[key].active++;
      return acc;
    }, {});
    
    console.log(`📊 Fleet Database Statistics:`);
    console.log(`  - Total vehicles: ${totalVehicles.toLocaleString()}`);
    console.log(`\n🏢 Fleet Distribution:`);
    
    Object.entries(fleetDistribution).forEach(([fleet, stats]) => {
      console.log(`  - ${fleet}: ${stats.total} vehicles (${stats.active} active)`);
    });
    
    return { totalVehicles, fleetDistribution };
    
  } catch (error) {
    console.error(`❌ Failed to check fleet database: ${error.message}`);
    return null;
  }
}

/**
 * Check device mappings
 */
async function checkDeviceMappings() {
  console.log('\n📱 Analyzing device mappings...');
  
  try {
    // Guardian devices
    const { count: guardianDevices, error: guardianError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .not('guardian_unit', 'is', null);
    
    if (guardianError) throw guardianError;
    
    // LYTX devices
    const { count: lytxDevices, error: lytxError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .not('lytx_device', 'is', null);
    
    if (lytxError) throw lytxError;
    
    // Both devices
    const { count: bothDevices, error: bothError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .not('guardian_unit', 'is', null)
      .not('lytx_device', 'is', null);
    
    if (bothError) throw bothError;
    
    // Total vehicles
    const { count: totalVehicles, error: totalError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    const noDevices = totalVehicles - guardianDevices - lytxDevices + bothDevices;
    
    console.log(`📱 Device Mapping Statistics:`);
    console.log(`  - Guardian devices: ${guardianDevices}`);
    console.log(`  - LYTX devices: ${lytxDevices}`);
    console.log(`  - Both devices: ${bothDevices}`);
    console.log(`  - No device mapping: ${noDevices}`);
    
    const guardianCoverage = totalVehicles > 0 ? (guardianDevices / totalVehicles * 100).toFixed(1) : 0;
    const lytxCoverage = totalVehicles > 0 ? (lytxDevices / totalVehicles * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Coverage Rates:`);
    console.log(`  - Guardian coverage: ${guardianCoverage}%`);
    console.log(`  - LYTX coverage: ${lytxCoverage}%`);
    
    return {
      guardianDevices,
      lytxDevices,
      bothDevices,
      noDevices,
      guardianCoverage,
      lytxCoverage
    };
    
  } catch (error) {
    console.error(`❌ Failed to check device mappings: ${error.message}`);
    return null;
  }
}

/**
 * Check trip analytics functionality
 */
async function checkTripAnalytics() {
  console.log('\n📊 Validating trip analytics functionality...');
  
  try {
    // Check if trip analytics views are working
    const { data: dailyPerformance, error: dailyError } = await supabase
      .from('mtdata_daily_fleet_performance')
      .select('*')
      .limit(5);
    
    if (dailyError) {
      console.warn(`⚠️ Daily performance view error: ${dailyError.message}`);
    } else {
      console.log(`✅ Daily performance view: ${dailyPerformance.length} records accessible`);
    }
    
    // Check driver efficiency rankings
    const { data: driverRankings, error: driverError } = await supabase
      .from('mtdata_driver_efficiency_rankings')
      .select('*')
      .limit(5);
    
    if (driverError) {
      console.warn(`⚠️ Driver rankings view error: ${driverError.message}`);
    } else {
      console.log(`✅ Driver rankings view: ${driverRankings.length} records accessible`);
    }
    
    // Check route optimization view
    const { data: routeOptimization, error: routeError } = await supabase
      .from('route_optimization_opportunities')
      .select('*')
      .limit(5);
    
    if (routeError) {
      console.warn(`⚠️ Route optimization view error: ${routeError.message}`);
    } else {
      console.log(`✅ Route optimization view: ${routeOptimization.length} records accessible`);
    }
    
    // Check main trip performance view
    const { data: tripPerformance, error: tripError } = await supabase
      .from('mtdata_trip_performance_view')
      .select('*')
      .limit(5);
    
    if (tripError) {
      console.warn(`⚠️ Trip performance view error: ${tripError.message}`);
    } else {
      console.log(`✅ Trip performance view: ${tripPerformance.length} records accessible`);
    }
    
    return {
      dailyPerformanceWorking: !dailyError,
      driverRankingsWorking: !driverError,
      routeOptimizationWorking: !routeError,
      tripPerformanceWorking: !tripError
    };
    
  } catch (error) {
    console.error(`❌ Failed to check trip analytics: ${error.message}`);
    return null;
  }
}

/**
 * Check for recent vehicle additions
 */
async function checkRecentAdditions() {
  console.log('\n🆕 Checking for recent vehicle additions...');
  
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: recentVehicles, error } = await supabase
      .from('vehicles')
      .select('registration, fleet, depot, created_at')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (recentVehicles.length === 0) {
      console.log('📅 No vehicles added in the last 24 hours');
    } else {
      console.log(`🆕 ${recentVehicles.length} vehicles added in the last 24 hours:`);
      recentVehicles.slice(0, 10).forEach(vehicle => {
        const addedAt = new Date(vehicle.created_at).toLocaleString();
        console.log(`  - ${vehicle.registration} (${vehicle.fleet} - ${vehicle.depot}) at ${addedAt}`);
      });
      
      if (recentVehicles.length > 10) {
        console.log(`  ... and ${recentVehicles.length - 10} more`);
      }
    }
    
    return recentVehicles;
    
  } catch (error) {
    console.error(`❌ Failed to check recent additions: ${error.message}`);
    return null;
  }
}

/**
 * Generate validation report
 */
function generateReport(results) {
  console.log('\n📋 VALIDATION REPORT');
  console.log('=====================\n');
  
  const {
    tripCorrelation,
    fleetDatabase,
    deviceMappings,
    tripAnalytics,
    recentAdditions
  } = results;
  
  // Overall health score
  let healthScore = 0;
  let maxScore = 0;
  
  // Trip correlation score (40% of total)
  if (tripCorrelation) {
    const correlationScore = Math.min(tripCorrelation.correlationRate, 100);
    healthScore += correlationScore * 0.4;
    maxScore += 40;
    
    console.log(`🎯 Trip Correlation: ${tripCorrelation.correlationRate}% (${correlationScore}/100 points)`);
  }
  
  // Device mapping score (30% of total)
  if (deviceMappings) {
    const avgCoverage = (parseFloat(deviceMappings.guardianCoverage) + parseFloat(deviceMappings.lytxCoverage)) / 2;
    healthScore += avgCoverage * 0.3;
    maxScore += 30;
    
    console.log(`📱 Device Coverage: ${avgCoverage.toFixed(1)}% avg (${avgCoverage.toFixed(1)}/30 points)`);
  }
  
  // Analytics functionality score (30% of total)
  if (tripAnalytics) {
    const analyticsScore = Object.values(tripAnalytics).filter(Boolean).length * 7.5; // 4 components * 7.5 = 30
    healthScore += analyticsScore;
    maxScore += 30;
    
    console.log(`📊 Analytics Health: ${analyticsScore}/30 points`);
  }
  
  const overallHealth = maxScore > 0 ? (healthScore / maxScore * 100).toFixed(1) : 0;
  
  console.log(`\n🏆 Overall System Health: ${overallHealth}%`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (tripCorrelation && tripCorrelation.correlationRate < 95) {
    console.log('  - Investigate remaining unmatched trips for potential data quality issues');
  }
  
  if (deviceMappings && parseFloat(deviceMappings.guardianCoverage) < 80) {
    console.log('  - Consider updating Guardian device mappings for better fuel monitoring');
  }
  
  if (deviceMappings && parseFloat(deviceMappings.lytxCoverage) < 80) {
    console.log('  - Consider updating LYTX device mappings for better safety monitoring');
  }
  
  if (tripAnalytics && !Object.values(tripAnalytics).every(Boolean)) {
    console.log('  - Some analytics views have issues and may need database maintenance');
  }
  
  if (recentAdditions && recentAdditions.length > 0) {
    console.log(`  ✅ Successfully added ${recentAdditions.length} vehicles recently`);
  }
  
  return overallHealth;
}

/**
 * Main validation function
 */
async function main() {
  console.log('🔍 Fleet Management System Validation');
  console.log('======================================\n');
  
  try {
    const results = {};
    
    // Run all validation checks
    results.tripCorrelation = await checkTripCorrelation();
    results.fleetDatabase = await checkFleetDatabase();
    results.deviceMappings = await checkDeviceMappings();
    results.tripAnalytics = await checkTripAnalytics();
    results.recentAdditions = await checkRecentAdditions();
    
    // Generate final report
    const healthScore = generateReport(results);
    
    console.log('\n🎉 Validation completed!');
    
    if (healthScore >= 90) {
      console.log('✅ System is in excellent health!');
    } else if (healthScore >= 75) {
      console.log('⚠️ System is healthy with minor issues');
    } else {
      console.log('🚨 System has significant issues that need attention');
    }
    
  } catch (error) {
    console.error(`💥 Validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  checkTripCorrelation,
  checkFleetDatabase,
  checkDeviceMappings,
  checkTripAnalytics,
  checkRecentAdditions,
  generateReport
};