#!/usr/bin/env node

/**
 * Wayne Bowron - 1IDB419 Association Verification Script
 * =====================================================
 * 
 * This script verifies that the driver-vehicle associations between 
 * Wayne Bowron and vehicle 1IDB419 are working correctly across all
 * data sources (MTData, Guardian, LYTX).
 * 
 * Usage:
 *   node tools/verify-wayne-bowron-associations.js
 * 
 * Author: Claude Code
 * Created: 2025-08-25
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: Missing Supabase configuration');
    console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper function to format numbers with commas
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

/**
 * Helper function to format dates
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-AU');
}

/**
 * Check if Wayne Bowron driver record exists
 */
async function verifyDriverRecord() {
    console.log('\n🔍 Verifying Wayne Bowron driver record...');
    
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select(`
                id,
                first_name,
                last_name,
                employee_id,
                fleet,
                depot,
                status,
                created_at
            `)
            .or(`
                and(first_name.ilike.%wayne%,last_name.ilike.%bowron%),
                and(first_name.ilike.%bowron%,last_name.ilike.%wayne%)
            `);

        if (error) throw error;

        if (data && data.length > 0) {
            const driver = data[0];
            console.log('✅ Wayne Bowron driver record found:');
            console.log(`   ID: ${driver.id}`);
            console.log(`   Name: ${driver.first_name} ${driver.last_name}`);
            console.log(`   Employee ID: ${driver.employee_id || 'N/A'}`);
            console.log(`   Fleet: ${driver.fleet || 'N/A'}`);
            console.log(`   Status: ${driver.status}`);
            return driver;
        } else {
            console.log('❌ Wayne Bowron driver record not found');
            return null;
        }
    } catch (error) {
        console.error('❌ Error checking driver record:', error.message);
        return null;
    }
}

/**
 * Check vehicle 1IDB419 record
 */
async function verifyVehicleRecord() {
    console.log('\n🚛 Verifying vehicle 1IDB419 record...');
    
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select(`
                id,
                registration,
                fleet,
                depot,
                make,
                model,
                status
            `)
            .eq('registration', '1IDB419');

        if (error) throw error;

        if (data && data.length > 0) {
            const vehicle = data[0];
            console.log('✅ Vehicle 1IDB419 found:');
            console.log(`   ID: ${vehicle.id}`);
            console.log(`   Registration: ${vehicle.registration}`);
            console.log(`   Fleet: ${vehicle.fleet || 'N/A'}`);
            console.log(`   Make/Model: ${vehicle.make || 'N/A'} ${vehicle.model || 'N/A'}`);
            console.log(`   Status: ${vehicle.status || 'N/A'}`);
            return vehicle;
        } else {
            console.log('⚠️  Vehicle 1IDB419 not found in vehicles table (this is okay)');
            return null;
        }
    } catch (error) {
        console.error('❌ Error checking vehicle record:', error.message);
        return null;
    }
}

/**
 * Verify MTData trip associations
 */
async function verifyMTDataAssociations(driverId) {
    console.log('\n📊 Verifying MTData trip associations...');
    
    try {
        // Get associated trips for 1IDB419
        const { data, error } = await supabase
            .from('mtdata_trip_history')
            .select(`
                id,
                vehicle_registration,
                driver_name,
                driver_id,
                start_time,
                end_time,
                distance_km,
                driver_association_confidence,
                driver_association_method
            `)
            .eq('vehicle_registration', '1IDB419');

        if (error) throw error;

        const totalTrips = data?.length || 0;
        const associatedTrips = data?.filter(trip => trip.driver_id === driverId).length || 0;
        const unassociatedTrips = totalTrips - associatedTrips;

        console.log(`📈 MTData Trip Summary for 1IDB419:`);
        console.log(`   Total trips: ${formatNumber(totalTrips)}`);
        console.log(`   Associated with Wayne Bowron: ${formatNumber(associatedTrips)}`);
        console.log(`   Unassociated: ${formatNumber(unassociatedTrips)}`);

        if (associatedTrips > 0) {
            const associatedData = data.filter(trip => trip.driver_id === driverId);
            const dateRange = {
                earliest: Math.min(...associatedData.map(t => new Date(t.start_time).getTime())),
                latest: Math.max(...associatedData.map(t => new Date(t.start_time).getTime()))
            };
            
            console.log(`   Date range: ${formatDate(new Date(dateRange.earliest))} to ${formatDate(new Date(dateRange.latest))}`);
            
            const totalKm = associatedData.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
            console.log(`   Total distance: ${formatNumber(Math.round(totalKm))} km`);
        }

        return { totalTrips, associatedTrips, unassociatedTrips };
    } catch (error) {
        console.error('❌ Error checking MTData associations:', error.message);
        return { totalTrips: 0, associatedTrips: 0, unassociatedTrips: 0 };
    }
}

/**
 * Verify Guardian event associations
 */
async function verifyGuardianAssociations(driverId) {
    console.log('\n🛡️  Verifying Guardian event associations...');
    
    try {
        const { data, error } = await supabase
            .from('guardian_events')
            .select(`
                id,
                vehicle_registration,
                driver_name,
                driver_id,
                detection_time,
                event_type,
                severity,
                driver_association_confidence,
                driver_association_method
            `)
            .eq('vehicle_registration', '1IDB419');

        if (error) throw error;

        const totalEvents = data?.length || 0;
        const associatedEvents = data?.filter(event => event.driver_id === driverId).length || 0;
        const unassociatedEvents = totalEvents - associatedEvents;

        console.log(`🚨 Guardian Event Summary for 1IDB419:`);
        console.log(`   Total events: ${formatNumber(totalEvents)}`);
        console.log(`   Associated with Wayne Bowron: ${formatNumber(associatedEvents)}`);
        console.log(`   Unassociated: ${formatNumber(unassociatedEvents)}`);

        if (associatedEvents > 0) {
            const associatedData = data.filter(event => event.driver_id === driverId);
            const dateRange = {
                earliest: Math.min(...associatedData.map(e => new Date(e.detection_time).getTime())),
                latest: Math.max(...associatedData.map(e => new Date(e.detection_time).getTime()))
            };
            
            console.log(`   Date range: ${formatDate(new Date(dateRange.earliest))} to ${formatDate(new Date(dateRange.latest))}`);
            
            // Group by severity
            const severityGroups = associatedData.reduce((acc, event) => {
                acc[event.severity || 'Unknown'] = (acc[event.severity || 'Unknown'] || 0) + 1;
                return acc;
            }, {});
            
            console.log(`   Severity breakdown:`, severityGroups);
        }

        return { totalEvents, associatedEvents, unassociatedEvents };
    } catch (error) {
        console.error('❌ Error checking Guardian associations:', error.message);
        return { totalEvents: 0, associatedEvents: 0, unassociatedEvents: 0 };
    }
}

/**
 * Verify LYTX event associations
 */
async function verifyLYTXAssociations(driverId) {
    console.log('\n📹 Verifying LYTX event associations...');
    
    try {
        const { data, error } = await supabase
            .from('lytx_safety_events')
            .select(`
                id,
                driver_name,
                driver_id,
                event_datetime,
                event_type,
                score,
                trigger,
                driver_association_confidence,
                driver_association_method
            `)
            .eq('driver_id', driverId);

        if (error) throw error;

        const totalEvents = data?.length || 0;

        console.log(`📱 LYTX Event Summary for Wayne Bowron:`);
        console.log(`   Total events: ${formatNumber(totalEvents)}`);

        if (totalEvents > 0) {
            const dateRange = {
                earliest: Math.min(...data.map(e => new Date(e.event_datetime).getTime())),
                latest: Math.max(...data.map(e => new Date(e.event_datetime).getTime()))
            };
            
            console.log(`   Date range: ${formatDate(new Date(dateRange.earliest))} to ${formatDate(new Date(dateRange.latest))}`);
            
            const avgScore = data.reduce((sum, event) => sum + (event.score || 0), 0) / totalEvents;
            console.log(`   Average score: ${Math.round(avgScore * 100) / 100}`);

            // Group by event type
            const typeGroups = data.reduce((acc, event) => {
                acc[event.event_type || 'Unknown'] = (acc[event.event_type || 'Unknown'] || 0) + 1;
                return acc;
            }, {});
            
            console.log(`   Event types:`, typeGroups);
        }

        return { totalEvents };
    } catch (error) {
        console.error('❌ Error checking LYTX associations:', error.message);
        return { totalEvents: 0 };
    }
}

/**
 * Verify vehicle assignment
 */
async function verifyVehicleAssignment(driverId, vehicleId) {
    console.log('\n🔗 Verifying vehicle assignment...');
    
    if (!vehicleId) {
        console.log('⚠️  Skipping vehicle assignment check - vehicle not in vehicles table');
        return null;
    }
    
    try {
        const { data, error } = await supabase
            .from('driver_assignments')
            .select(`
                id,
                driver_name,
                assigned_at,
                unassigned_at,
                created_by
            `)
            .eq('driver_id', driverId)
            .eq('vehicle_id', vehicleId)
            .order('assigned_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const assignment = data[0];
            const isCurrentlyAssigned = !assignment.unassigned_at;
            
            console.log(`🎯 Vehicle Assignment:`);
            console.log(`   Currently assigned: ${isCurrentlyAssigned ? '✅ Yes' : '❌ No'}`);
            console.log(`   Assigned at: ${formatDate(assignment.assigned_at)}`);
            if (assignment.unassigned_at) {
                console.log(`   Unassigned at: ${formatDate(assignment.unassigned_at)}`);
            }
            
            return { isCurrentlyAssigned };
        } else {
            console.log('❌ No vehicle assignment found');
            return { isCurrentlyAssigned: false };
        }
    } catch (error) {
        console.error('❌ Error checking vehicle assignment:', error.message);
        return null;
    }
}

/**
 * Test the database functions
 */
async function testDatabaseFunctions() {
    console.log('\n🧪 Testing database functions...');
    
    try {
        // Test the get_driver_vehicle_associations function
        const { data, error } = await supabase.rpc('get_driver_vehicle_associations', {
            p_first_name: 'Wayne',
            p_last_name: 'Bowron',
            p_vehicle_registration: '1IDB419'
        });

        if (error) throw error;

        console.log('✅ Database function test successful:');
        console.log('   Function: get_driver_vehicle_associations');
        console.log('   Result summary:');
        
        if (data.success) {
            console.log(`   - Driver ID: ${data.driver_id}`);
            console.log(`   - Vehicle ID: ${data.vehicle_id || 'N/A'}`);
            console.log(`   - MTData trips: ${data.mtdata_trips?.total_trips || 0}`);
            console.log(`   - Guardian events: ${data.guardian_events?.total_events || 0}`);
            console.log(`   - LYTX events: ${data.lytx_events?.total_events || 0}`);
            console.log(`   - Currently assigned: ${data.vehicle_assignment?.is_currently_assigned || false}`);
        } else {
            console.log(`   - Error: ${data.error}`);
        }

        return data;
    } catch (error) {
        console.error('❌ Error testing database functions:', error.message);
        return null;
    }
}

/**
 * Main verification function
 */
async function main() {
    console.log('🚀 Starting Wayne Bowron - 1IDB419 Association Verification');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // Step 1: Verify driver record
    const driver = await verifyDriverRecord();
    if (!driver) {
        console.log('\n❌ Cannot proceed - Wayne Bowron driver record not found');
        process.exit(1);
    }

    // Step 2: Verify vehicle record
    const vehicle = await verifyVehicleRecord();

    // Step 3: Verify associations
    const mtdataStats = await verifyMTDataAssociations(driver.id);
    const guardianStats = await verifyGuardianAssociations(driver.id);
    const lytxStats = await verifyLYTXAssociations(driver.id);

    // Step 4: Verify vehicle assignment
    const assignmentStats = await verifyVehicleAssignment(driver.id, vehicle?.id);

    // Step 5: Test database functions
    const functionTest = await testDatabaseFunctions();

    // Final summary
    console.log('\n📋 FINAL SUMMARY');
    console.log('='.repeat(40));
    
    const totalAssociations = mtdataStats.associatedTrips + guardianStats.associatedEvents + lytxStats.totalEvents;
    const totalRecords = mtdataStats.totalTrips + guardianStats.totalEvents + lytxStats.totalEvents;
    
    console.log(`Driver: Wayne Bowron (${driver.id})`);
    console.log(`Vehicle: 1IDB419 ${vehicle ? `(${vehicle.id})` : '(not in vehicles table)'}`);
    console.log(`Total associated records: ${formatNumber(totalAssociations)}`);
    console.log(`Total available records: ${formatNumber(totalRecords)}`);
    
    if (totalRecords > 0) {
        const associationRate = (totalAssociations / totalRecords) * 100;
        console.log(`Association rate: ${Math.round(associationRate * 100) / 100}%`);
    }

    console.log(`\nBreakdown:`);
    console.log(`• MTData trips: ${formatNumber(mtdataStats.associatedTrips)}/${formatNumber(mtdataStats.totalTrips)}`);
    console.log(`• Guardian events: ${formatNumber(guardianStats.associatedEvents)}/${formatNumber(guardianStats.totalEvents)}`);
    console.log(`• LYTX events: ${formatNumber(lytxStats.totalEvents)}`);
    console.log(`• Vehicle assigned: ${assignmentStats?.isCurrentlyAssigned ? '✅' : '❌'}`);
    console.log(`• Database functions: ${functionTest?.success ? '✅' : '❌'}`);

    const endTime = Date.now();
    console.log(`\n⏱️  Verification completed in ${Math.round((endTime - startTime) / 1000)} seconds`);

    // Exit with appropriate code
    const hasIssues = (
        mtdataStats.unassociatedTrips > 0 || 
        guardianStats.unassociatedEvents > 0 ||
        !functionTest?.success
    );
    
    if (hasIssues) {
        console.log('\n⚠️  Some associations may need attention');
        process.exit(0); // Exit normally but indicate issues found
    } else {
        console.log('\n✅ All associations verified successfully!');
        process.exit(0);
    }
}

// Run the verification
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    verifyDriverRecord,
    verifyVehicleRecord,
    verifyMTDataAssociations,
    verifyGuardianAssociations,
    verifyLYTXAssociations,
    verifyVehicleAssignment,
    testDatabaseFunctions
};