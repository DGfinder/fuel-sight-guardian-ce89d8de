#!/usr/bin/env node

/**
 * Bulk Vehicle-Based Driver Association Processor
 * ==============================================
 * 
 * Processes all driver-vehicle assignments and associates events using the
 * vehicle-based strategy: Driver UUID → Vehicle → Events → Driver UUID
 * 
 * This is more reliable than name matching and provides high-confidence associations.
 * 
 * Usage:
 *   node tools/bulk-process-vehicle-associations.js
 *   node tools/bulk-process-vehicle-associations.js --days-back 365 --dry-run
 * 
 * Author: Claude Code
 * Created: 2025-08-25
 */

const { createClient } = require('@supabase/supabase-js');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('days-back', {
        alias: 'd',
        type: 'number',
        description: 'Number of days back to process events',
        default: 365
    })
    .option('dry-run', {
        alias: 'n',
        type: 'boolean',
        description: 'Preview what would be processed without making changes',
        default: false
    })
    .option('driver-uuid', {
        alias: 'u',
        type: 'string',
        description: 'Process specific driver UUID only'
    })
    .option('vehicle-reg', {
        alias: 'v',
        type: 'string',
        description: 'Process specific vehicle registration only'
    })
    .help()
    .argv;

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing Supabase configuration');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Format numbers with commas
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
}

/**
 * Format dates
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-AU');
}

/**
 * Get all current driver-vehicle assignments
 */
async function getCurrentDriverAssignments() {
    console.log('🔍 Fetching current driver-vehicle assignments...');
    
    try {
        const { data, error } = await supabase
            .from('driver_assignments')
            .select(`
                driver_id,
                driver_name,
                assigned_at,
                unassigned_at,
                vehicles!inner(
                    id,
                    registration,
                    fleet,
                    make,
                    model
                ),
                drivers!inner(
                    first_name,
                    last_name,
                    employee_id,
                    fleet,
                    status
                )
            `)
            .is('unassigned_at', null)  // Only currently active assignments
            .eq('drivers.status', 'active')
            .order('assigned_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Found ${data.length} active driver-vehicle assignments`);
        return data;
        
    } catch (error) {
        console.error('❌ Error fetching driver assignments:', error.message);
        return [];
    }
}

/**
 * Get event counts for a specific driver-vehicle pair (preview)
 */
async function getEventCounts(driverUuid, vehicleRegistration, daysBack) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);
    
    try {
        // MTData trips count
        const { count: mtdataCount } = await supabase
            .from('mtdata_trip_history')
            .select('*', { count: 'exact', head: true })
            .eq('vehicle_registration', vehicleRegistration)
            .gte('start_time', dateThreshold.toISOString())
            .neq('driver_id', driverUuid);

        // Guardian events count  
        const { count: guardianCount } = await supabase
            .from('guardian_events')
            .select('*', { count: 'exact', head: true })
            .eq('vehicle_registration', vehicleRegistration)
            .gte('detection_time', dateThreshold.toISOString())
            .neq('driver_id', driverUuid);

        // LYTX events count (by driver name, since LYTX doesn't have vehicle registration)
        const { data: driverInfo } = await supabase
            .from('drivers')
            .select('first_name, last_name')
            .eq('id', driverUuid)
            .single();

        let lytxCount = 0;
        if (driverInfo) {
            const { count } = await supabase
                .from('lytx_safety_events')
                .select('*', { count: 'exact', head: true })
                .gte('event_datetime', dateThreshold.toISOString())
                .neq('driver_id', driverUuid)
                .or(`driver_name.ilike.%${driverInfo.first_name}%${driverInfo.last_name}%,driver_name.ilike.%${driverInfo.last_name}%${driverInfo.first_name}%`);
            
            lytxCount = count || 0;
        }

        return {
            mtdata: mtdataCount || 0,
            guardian: guardianCount || 0, 
            lytx: lytxCount,
            total: (mtdataCount || 0) + (guardianCount || 0) + lytxCount
        };
        
    } catch (error) {
        console.error(`⚠️  Error getting event counts for ${vehicleRegistration}:`, error.message);
        return { mtdata: 0, guardian: 0, lytx: 0, total: 0 };
    }
}

/**
 * Process a single driver-vehicle assignment
 */
async function processDriverVehicleAssignment(assignment, daysBack, isDryRun) {
    const driverUuid = assignment.driver_id;
    const vehicleReg = assignment.vehicles.registration;
    const driverName = `${assignment.drivers.first_name} ${assignment.drivers.last_name}`;
    
    console.log(`\n🔄 Processing: ${driverName} → ${vehicleReg}`);
    
    try {
        if (isDryRun) {
            // Preview mode - just show what would be processed
            const eventCounts = await getEventCounts(driverUuid, vehicleReg, daysBack);
            
            console.log(`   📊 Events that would be associated:`);
            console.log(`      • MTData trips: ${formatNumber(eventCounts.mtdata)}`);
            console.log(`      • Guardian events: ${formatNumber(eventCounts.guardian)}`);
            console.log(`      • LYTX events: ${formatNumber(eventCounts.lytx)}`);
            console.log(`      • Total: ${formatNumber(eventCounts.total)}`);
            
            return {
                success: true,
                driverName,
                vehicleRegistration: vehicleReg,
                driverUuid,
                preview: eventCounts,
                processed: false
            };
            
        } else {
            // Actually process the associations
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - daysBack);
            
            const { data: result, error } = await supabase.rpc(
                'associate_events_by_vehicle_assignment',
                {
                    p_driver_uuid: driverUuid,
                    p_vehicle_registration: vehicleReg,
                    p_date_from: dateFrom.toISOString(),
                    p_date_to: new Date().toISOString()
                }
            );
            
            if (error) throw error;
            
            if (result.success) {
                const associations = result.associations_created;
                console.log(`   ✅ Successfully associated:`);
                console.log(`      • MTData trips: ${formatNumber(associations.mtdata_trips)}`);
                console.log(`      • Guardian events: ${formatNumber(associations.guardian_events)}`);
                console.log(`      • LYTX events: ${formatNumber(associations.lytx_events)}`);
                console.log(`      • Total: ${formatNumber(associations.total)}`);
                
                return {
                    success: true,
                    driverName,
                    vehicleRegistration: vehicleReg,
                    driverUuid,
                    associations,
                    processed: true
                };
            } else {
                console.log(`   ❌ Failed: ${result.error}`);
                return {
                    success: false,
                    driverName,
                    vehicleRegistration: vehicleReg,
                    driverUuid,
                    error: result.error,
                    processed: false
                };
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error processing ${driverName} → ${vehicleReg}: ${error.message}`);
        return {
            success: false,
            driverName,
            vehicleRegistration: vehicleReg,
            driverUuid,
            error: error.message,
            processed: false
        };
    }
}

/**
 * Main processing function
 */
async function main() {
    const startTime = Date.now();
    
    console.log('🚀 Vehicle-Based Driver Association Processor');
    console.log('='.repeat(50));
    console.log(`Mode: ${argv.dryRun ? '🔍 DRY RUN (Preview Only)' : '⚡ LIVE PROCESSING'}`);
    console.log(`Days back: ${argv.daysBack}`);
    if (argv.driverUuid) console.log(`Driver filter: ${argv.driverUuid}`);
    if (argv.vehicleReg) console.log(`Vehicle filter: ${argv.vehicleReg}`);
    console.log('');

    // Get all current driver assignments
    let assignments = await getCurrentDriverAssignments();
    
    if (assignments.length === 0) {
        console.log('❌ No active driver assignments found');
        process.exit(1);
    }
    
    // Filter by specific driver or vehicle if specified
    if (argv.driverUuid) {
        assignments = assignments.filter(a => a.driver_id === argv.driverUuid);
        console.log(`🔍 Filtered to specific driver: ${assignments.length} assignment(s)`);
    }
    
    if (argv.vehicleReg) {
        assignments = assignments.filter(a => a.vehicles.registration === argv.vehicleReg);
        console.log(`🔍 Filtered to specific vehicle: ${assignments.length} assignment(s)`);
    }
    
    if (assignments.length === 0) {
        console.log('❌ No assignments match the specified filters');
        process.exit(1);
    }

    // Process each assignment
    const results = [];
    let successful = 0;
    let failed = 0;
    let totalAssociations = { mtdata: 0, guardian: 0, lytx: 0, total: 0 };
    
    for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        const result = await processDriverVehicleAssignment(assignment, argv.daysBack, argv.dryRun);
        
        results.push(result);
        
        if (result.success) {
            successful++;
            if (result.associations) {
                totalAssociations.mtdata += result.associations.mtdata_trips || 0;
                totalAssociations.guardian += result.associations.guardian_events || 0;
                totalAssociations.lytx += result.associations.lytx_events || 0;
                totalAssociations.total += result.associations.total || 0;
            } else if (result.preview) {
                totalAssociations.mtdata += result.preview.mtdata || 0;
                totalAssociations.guardian += result.preview.guardian || 0;
                totalAssociations.lytx += result.preview.lytx || 0;
                totalAssociations.total += result.preview.total || 0;
            }
        } else {
            failed++;
        }
        
        // Progress indicator
        if (assignments.length > 5 && (i + 1) % 5 === 0) {
            console.log(`\n📊 Progress: ${i + 1}/${assignments.length} (${Math.round(((i + 1) / assignments.length) * 100)}%)`);
        }
    }

    // Final summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(50));
    
    console.log(`Mode: ${argv.dryRun ? 'DRY RUN (Preview)' : 'LIVE PROCESSING'}`);
    console.log(`Total assignments processed: ${assignments.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${Math.round((successful / assignments.length) * 100)}%`);
    
    console.log(`\n📊 Event Associations ${argv.dryRun ? '(Would Be Created)' : '(Created)'}:`);
    console.log(`• MTData trips: ${formatNumber(totalAssociations.mtdata)}`);
    console.log(`• Guardian events: ${formatNumber(totalAssociations.guardian)}`);
    console.log(`• LYTX events: ${formatNumber(totalAssociations.lytx)}`);
    console.log(`• Total events: ${formatNumber(totalAssociations.total)}`);
    
    console.log(`\n⏱️  Completed in ${duration} seconds`);
    
    // Show failures if any
    if (failed > 0) {
        console.log('\n❌ Failed Assignments:');
        results
            .filter(r => !r.success)
            .forEach(r => {
                console.log(`   • ${r.driverName} → ${r.vehicleRegistration}: ${r.error}`);
            });
    }
    
    // Show next steps
    if (argv.dryRun && totalAssociations.total > 0) {
        console.log('\n🎯 NEXT STEPS:');
        console.log('   Run without --dry-run to execute the associations:');
        console.log(`   node tools/bulk-process-vehicle-associations.js --days-back ${argv.daysBack}`);
    } else if (!argv.dryRun && successful > 0) {
        console.log('\n🎉 VEHICLE-BASED ASSOCIATIONS COMPLETE!');
        console.log('   The Driver Management page should now have optimized foreign key queries');
        console.log('   for all Guardian events, eliminating slow name-based matching.');
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run the processor
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}