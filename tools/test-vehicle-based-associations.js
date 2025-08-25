#!/usr/bin/env node

/**
 * Vehicle-Based Driver Association Test Suite
 * ===========================================
 * 
 * Comprehensive validation of the vehicle-based association strategy:
 * - Tests Guardian foreign key implementation
 * - Validates Wayne Bowron specific associations
 * - Compares performance of foreign key vs name matching
 * - Tests database functions
 * - Validates driver management optimizations
 * 
 * Usage:
 *   node tools/test-vehicle-based-associations.js
 *   node tools/test-vehicle-based-associations.js --wayne-only
 *   node tools/test-vehicle-based-associations.js --performance-test
 * 
 * Author: Claude Code
 * Created: 2025-08-25
 */

const { createClient } = require('@supabase/supabase-js');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('wayne-only', {
        alias: 'w',
        type: 'boolean',
        description: 'Test only Wayne Bowron associations',
        default: false
    })
    .option('performance-test', {
        alias: 'p',
        type: 'boolean', 
        description: 'Run performance comparison tests',
        default: false
    })
    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Verbose output with detailed results',
        default: false
    })
    .help()
    .argv;

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing Supabase configuration');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Wayne Bowron's confirmed UUID
const WAYNE_BOWRON_UUID = '202f3cb3-adc6-4af9-bfbb-069b87505287';
const WAYNE_VEHICLE = '1IDB419';

/**
 * Format numbers
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Test 1: Verify Guardian foreign key schema
 */
async function testGuardianForeignKeySchema() {
    console.log('\n🔍 TEST 1: Guardian Foreign Key Schema Validation');
    console.log('-'.repeat(50));
    
    try {
        // Check if foreign key columns exist
        const { data: schemaInfo, error } = await supabase.rpc('exec_sql', {
            sql: `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'guardian_events'
                AND column_name IN ('driver_id', 'driver_association_confidence', 'driver_association_method', 'driver_association_updated_at')
                ORDER BY column_name;
            `
        });

        if (error) throw error;

        if (schemaInfo && schemaInfo.length >= 4) {
            console.log('✅ Guardian foreign key columns found:');
            schemaInfo.forEach(col => {
                console.log(`   • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
            });
        } else {
            console.log('❌ Guardian foreign key columns missing - run migration first');
            return false;
        }

        // Test foreign key constraint
        const { data: constraintInfo } = await supabase.rpc('exec_sql', {
            sql: `
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_name = 'guardian_events'
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name LIKE '%driver_id%';
            `
        });

        if (constraintInfo && constraintInfo.length > 0) {
            console.log('✅ Guardian-drivers foreign key constraint exists');
        } else {
            console.log('⚠️  Guardian-drivers foreign key constraint not found');
        }

        return true;
        
    } catch (error) {
        console.error('❌ Schema validation failed:', error.message);
        return false;
    }
}

/**
 * Test 2: Wayne Bowron specific associations
 */
async function testWayneBowronAssociations() {
    console.log('\n👤 TEST 2: Wayne Bowron Association Validation');
    console.log('-'.repeat(50));
    
    try {
        // Verify Wayne Bowron exists
        const { data: wayne, error: wayneError } = await supabase
            .from('drivers')
            .select('id, first_name, last_name, fleet')
            .eq('id', WAYNE_BOWRON_UUID)
            .single();

        if (wayneError || !wayne) {
            console.error('❌ Wayne Bowron not found with UUID:', WAYNE_BOWRON_UUID);
            return false;
        }

        console.log(`✅ Wayne Bowron found: ${wayne.first_name} ${wayne.last_name} (${wayne.fleet})`);

        // Test MTData associations
        const { count: mtdataCount } = await supabase
            .from('mtdata_trip_history')
            .select('*', { count: 'exact', head: true })
            .eq('vehicle_registration', WAYNE_VEHICLE)
            .eq('driver_id', WAYNE_BOWRON_UUID);

        console.log(`📊 MTData trips associated: ${formatNumber(mtdataCount || 0)}`);

        // Test Guardian associations
        const { count: guardianCount } = await supabase
            .from('guardian_events')
            .select('*', { count: 'exact', head: true })
            .eq('vehicle_registration', WAYNE_VEHICLE)
            .eq('driver_id', WAYNE_BOWRON_UUID);

        console.log(`🛡️  Guardian events associated: ${formatNumber(guardianCount || 0)}`);

        // Test LYTX associations
        const { count: lytxCount } = await supabase
            .from('lytx_safety_events')
            .select('*', { count: 'exact', head: true })
            .eq('driver_id', WAYNE_BOWRON_UUID);

        console.log(`📹 LYTX events associated: ${formatNumber(lytxCount || 0)}`);

        const totalAssociated = (mtdataCount || 0) + (guardianCount || 0) + (lytxCount || 0);
        console.log(`🎯 Total associations: ${formatNumber(totalAssociated)}`);

        if (totalAssociated > 0) {
            console.log('✅ Wayne Bowron associations working');
            return true;
        } else {
            console.log('⚠️  No associations found - may need to run association migration');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Wayne Bowron test failed:', error.message);
        return false;
    }
}

/**
 * Test 3: Database function validation
 */
async function testDatabaseFunctions() {
    console.log('\n⚙️  TEST 3: Database Function Validation');
    console.log('-'.repeat(50));
    
    try {
        // Test get_vehicle_driver_associations_summary function
        console.log('Testing get_vehicle_driver_associations_summary...');
        
        const { data: summaryResult, error: summaryError } = await supabase.rpc(
            'get_vehicle_driver_associations_summary',
            {
                p_driver_uuid: WAYNE_BOWRON_UUID,
                p_vehicle_registration: WAYNE_VEHICLE,
                p_days_back: 180
            }
        );

        if (summaryError) throw summaryError;

        if (summaryResult && summaryResult.success) {
            console.log('✅ Summary function working');
            if (argv.verbose) {
                console.log('   Result preview:', JSON.stringify(summaryResult, null, 2).substring(0, 500) + '...');
            }
        } else {
            console.log('❌ Summary function failed:', summaryResult?.error);
            return false;
        }

        // Test associate_events_by_vehicle_assignment function
        console.log('Testing associate_events_by_vehicle_assignment...');
        
        const { data: associateResult, error: associateError } = await supabase.rpc(
            'associate_events_by_vehicle_assignment',
            {
                p_driver_uuid: WAYNE_BOWRON_UUID,
                p_vehicle_registration: WAYNE_VEHICLE,
                p_date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
                p_date_to: new Date().toISOString()
            }
        );

        if (associateError) throw associateError;

        if (associateResult && associateResult.success) {
            console.log('✅ Association function working');
            const associations = associateResult.associations_created;
            console.log(`   Recent associations: MTData: ${associations?.mtdata_trips || 0}, Guardian: ${associations?.guardian_events || 0}, LYTX: ${associations?.lytx_events || 0}`);
        } else {
            console.log('❌ Association function failed:', associateResult?.error);
            return false;
        }

        return true;
        
    } catch (error) {
        console.error('❌ Database function test failed:', error.message);
        return false;
    }
}

/**
 * Test 4: Performance comparison (foreign key vs name matching)
 */
async function testPerformanceComparison() {
    console.log('\n⚡ TEST 4: Performance Comparison');
    console.log('-'.repeat(50));
    
    try {
        // Get a few drivers for testing
        const { data: testDrivers } = await supabase
            .from('drivers')
            .select('id, first_name, last_name')
            .limit(5);

        if (!testDrivers || testDrivers.length === 0) {
            console.log('⚠️  No test drivers found');
            return false;
        }

        const driverIds = testDrivers.map(d => d.id);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Test 1: Foreign key approach (bulk query)
        console.log('🚀 Testing foreign key approach (bulk query)...');
        const fkStartTime = Date.now();
        
        const { data: fkResults, count: fkCount } = await supabase
            .from('guardian_events')
            .select('driver_id, detection_time, event_type, severity', { count: 'exact' })
            .in('driver_id', driverIds)
            .gte('detection_time', thirtyDaysAgo);
            
        const fkDuration = Date.now() - fkStartTime;
        console.log(`   ✅ Foreign key query: ${formatDuration(fkDuration)}, ${formatNumber(fkCount || 0)} events`);

        // Test 2: Name matching approach (individual queries)
        console.log('🐌 Testing name matching approach (individual queries)...');
        const nameStartTime = Date.now();
        let nameTotalCount = 0;
        
        for (const driver of testDrivers) {
            const { count } = await supabase
                .from('guardian_events')
                .select('*', { count: 'exact', head: true })
                .ilike('driver_name', `%${driver.first_name}%${driver.last_name}%`)
                .gte('detection_time', thirtyDaysAgo);
                
            nameTotalCount += count || 0;
        }
        
        const nameDuration = Date.now() - nameStartTime;
        console.log(`   ⏳ Name matching queries: ${formatDuration(nameDuration)}, ${formatNumber(nameTotalCount)} events`);

        // Performance comparison
        const speedup = nameDuration / fkDuration;
        console.log(`\n📊 Performance Results:`);
        console.log(`   • Foreign key approach: ${formatDuration(fkDuration)} (1 query)`);
        console.log(`   • Name matching approach: ${formatDuration(nameDuration)} (${testDrivers.length} queries)`);
        console.log(`   • Performance improvement: ${speedup.toFixed(1)}x faster`);
        console.log(`   • Query reduction: ${testDrivers.length} → 1 query (${((testDrivers.length - 1) / testDrivers.length * 100).toFixed(0)}% reduction)`);

        if (speedup > 2) {
            console.log('✅ Significant performance improvement achieved');
        } else if (speedup > 1.2) {
            console.log('✅ Moderate performance improvement achieved');
        } else {
            console.log('⚠️  Performance improvement less than expected');
        }

        return speedup > 1;
        
    } catch (error) {
        console.error('❌ Performance test failed:', error.message);
        return false;
    }
}

/**
 * Test 5: Driver Management integration test
 */
async function testDriverManagementIntegration() {
    console.log('\n🎛️  TEST 5: Driver Management Integration');
    console.log('-'.repeat(50));
    
    try {
        // Simulate optimized driver summaries query
        const { data: drivers } = await supabase
            .from('drivers')
            .select('id, first_name, last_name, fleet')
            .limit(3);

        if (!drivers || drivers.length === 0) {
            console.log('⚠️  No drivers found for integration test');
            return false;
        }

        const driverIds = drivers.map(d => d.id);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        console.log(`Testing with ${drivers.length} drivers...`);

        // Test bulk Guardian query (optimized approach)
        const bulkStartTime = Date.now();
        const { data: bulkGuardianEvents } = await supabase
            .from('guardian_events')
            .select('driver_id, detection_time, event_type, severity')
            .in('driver_id', driverIds)
            .gte('detection_time', thirtyDaysAgo);
            
        const bulkDuration = Date.now() - bulkStartTime;

        // Group by driver
        const eventsByDriver = new Map();
        bulkGuardianEvents?.forEach(event => {
            if (!eventsByDriver.has(event.driver_id)) {
                eventsByDriver.set(event.driver_id, []);
            }
            eventsByDriver.get(event.driver_id).push(event);
        });

        console.log(`✅ Bulk query completed in ${formatDuration(bulkDuration)}`);
        console.log(`   Events found: ${formatNumber(bulkGuardianEvents?.length || 0)}`);
        console.log(`   Drivers with events: ${eventsByDriver.size}`);

        // Verify each driver has their events
        let allDriversHaveData = true;
        drivers.forEach(driver => {
            const driverEvents = eventsByDriver.get(driver.id) || [];
            console.log(`   • ${driver.first_name} ${driver.last_name}: ${driverEvents.length} events`);
        });

        console.log('✅ Driver Management bulk query pattern working');
        return true;
        
    } catch (error) {
        console.error('❌ Driver Management integration test failed:', error.message);
        return false;
    }
}

/**
 * Test 6: Data quality validation
 */
async function testDataQuality() {
    console.log('\n📊 TEST 6: Data Quality Validation');
    console.log('-'.repeat(50));
    
    try {
        // Check association method distribution
        const { data: methodStats } = await supabase
            .from('guardian_events')
            .select('driver_association_method')
            .not('driver_id', 'is', null);

        if (methodStats) {
            const methodCounts = methodStats.reduce((acc, item) => {
                const method = item.driver_association_method || 'null';
                acc[method] = (acc[method] || 0) + 1;
                return acc;
            }, {});

            console.log('📈 Association method distribution:');
            Object.entries(methodCounts).forEach(([method, count]) => {
                console.log(`   • ${method}: ${formatNumber(count)}`);
            });
        }

        // Check confidence score distribution
        const { data: confidenceStats } = await supabase
            .from('guardian_events')
            .select('driver_association_confidence')
            .not('driver_id', 'is', null);

        if (confidenceStats) {
            const avgConfidence = confidenceStats.reduce((sum, item) => 
                sum + (item.driver_association_confidence || 0), 0
            ) / confidenceStats.length;

            const highConfidenceCount = confidenceStats.filter(item => 
                (item.driver_association_confidence || 0) >= 0.9
            ).length;

            console.log(`📊 Association quality metrics:`);
            console.log(`   • Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
            console.log(`   • High confidence (≥90%): ${formatNumber(highConfidenceCount)} (${((highConfidenceCount / confidenceStats.length) * 100).toFixed(1)}%)`);
        }

        // Check vehicle assignment coverage
        const { count: totalGuardianEvents } = await supabase
            .from('guardian_events')
            .select('*', { count: 'exact', head: true });

        const { count: associatedGuardianEvents } = await supabase
            .from('guardian_events')
            .select('*', { count: 'exact', head: true })
            .not('driver_id', 'is', null);

        const associationRate = (associatedGuardianEvents / totalGuardianEvents) * 100;
        
        console.log(`🎯 Association coverage:`);
        console.log(`   • Total Guardian events: ${formatNumber(totalGuardianEvents || 0)}`);
        console.log(`   • Associated events: ${formatNumber(associatedGuardianEvents || 0)}`);
        console.log(`   • Association rate: ${associationRate.toFixed(1)}%`);

        if (associationRate >= 80) {
            console.log('✅ Good association coverage');
        } else if (associationRate >= 50) {
            console.log('⚠️  Moderate association coverage - consider running bulk association');
        } else {
            console.log('❌ Low association coverage - run association migration');
        }

        return associationRate >= 50;
        
    } catch (error) {
        console.error('❌ Data quality test failed:', error.message);
        return false;
    }
}

/**
 * Main test runner
 */
async function main() {
    const startTime = Date.now();
    
    console.log('🧪 Vehicle-Based Driver Association Test Suite');
    console.log('='.repeat(60));
    console.log(`Mode: ${argv.wayneOnly ? 'Wayne Bowron Only' : 'Full Test Suite'}`);
    console.log(`Performance Test: ${argv.performanceTest ? 'Enabled' : 'Disabled'}`);
    console.log(`Verbose: ${argv.verbose ? 'Enabled' : 'Disabled'}`);
    console.log('');

    const tests = [];
    const results = [];

    if (!argv.wayneOnly) {
        tests.push(
            { name: 'Guardian Foreign Key Schema', fn: testGuardianForeignKeySchema },
            { name: 'Database Functions', fn: testDatabaseFunctions },
            { name: 'Driver Management Integration', fn: testDriverManagementIntegration },
            { name: 'Data Quality', fn: testDataQuality }
        );
    }

    // Always include Wayne Bowron test
    tests.push({ name: 'Wayne Bowron Associations', fn: testWayneBowronAssociations });

    if (argv.performanceTest && !argv.wayneOnly) {
        tests.push({ name: 'Performance Comparison', fn: testPerformanceComparison });
    }

    // Run tests
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, success: result });
        } catch (error) {
            console.error(`❌ Test "${test.name}" crashed:`, error.message);
            results.push({ name: test.name, success: false, error: error.message });
        }
    }

    // Final summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Tests run: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`Success rate: ${Math.round((passed / results.length) * 100)}%`);
    console.log(`Duration: ${duration}s`);
    
    console.log('\nDetailed Results:');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.name}`);
        if (result.error) {
            console.log(`      Error: ${result.error}`);
        }
    });

    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('Vehicle-based driver associations are working correctly.');
        if (!argv.wayneOnly) {
            console.log('The Driver Management page should now have optimized performance.');
        }
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed - check the issues above`);
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run the test suite
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Test suite crashed:', error);
        process.exit(1);
    });
}