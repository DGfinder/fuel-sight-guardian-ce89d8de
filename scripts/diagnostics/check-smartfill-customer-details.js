#!/usr/bin/env node

/**
 * SmartFill Customer Diagnostic Tool
 * 
 * This script helps diagnose specific SmartFill customer sync issues
 * Focuses on investigating the "Altona Farms 4309" customer error
 * 
 * Usage:
 *   node check-smartfill-customer-details.js [customer_reference]
 * 
 * Examples:
 *   node check-smartfill-customer-details.js ALTONAfm4309
 *   node check-smartfill-customer-details.js  # Will check all customers
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration in environment variables');
    console.error('   Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// SmartFill API configuration
const SMARTFILL_API_URL = 'https://www.fmtdata.com/API/api.php';
const REQUEST_TIMEOUT = 30000;

/**
 * Make a test call to SmartFill API
 */
async function testSmartFillCustomer(apiReference, apiSecret, customerName) {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    const payload = {
        jsonrpc: '2.0',
        method: 'Tank:Level',
        parameters: {
            clientReference: apiReference,
            clientSecret: apiSecret
        },
        id: requestId
    };

    console.log(`\n🔍 Testing SmartFill API for ${customerName} (${apiReference})`);
    console.log(`   API URL: ${SMARTFILL_API_URL}`);
    console.log(`   Method: Tank:Level`);
    console.log(`   Request ID: ${requestId}`);

    try {
        const startTime = Date.now();
        
        const response = await fetch(SMARTFILL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        const duration = Date.now() - startTime;
        console.log(`   ⏱️  Response time: ${duration}ms`);
        console.log(`   📊 HTTP Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`   ❌ HTTP Error Response:`);
            console.log(`      Status: ${response.status}`);
            console.log(`      Status Text: ${response.statusText}`);
            console.log(`      Response Body: ${errorText}`);
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
                httpStatus: response.status,
                duration
            };
        }

        const data = await response.json();
        
        if (data.error) {
            console.log(`   ❌ SmartFill API Error:`);
            console.log(`      Error Code: ${data.error.code}`);
            console.log(`      Error Message: ${data.error.message}`);
            console.log(`      Full Error Object:`, JSON.stringify(data.error, null, 2));
            return {
                success: false,
                error: `SmartFill API Error ${data.error.code}: ${data.error.message}`,
                errorCode: data.error.code,
                duration
            };
        }

        console.log(`   ✅ Success!`);
        
        if (data.result && data.result.columns && data.result.values) {
            console.log(`   📊 Data Summary:`);
            console.log(`      Columns: ${data.result.columns.length}`);
            console.log(`      Rows: ${data.result.values.length}`);
            console.log(`      Column Names: ${data.result.columns.join(', ')}`);
            
            if (data.result.values.length > 0) {
                console.log(`   📝 Sample Data (first row):`);
                data.result.columns.forEach((col, i) => {
                    if (data.result.values[0] && data.result.values[0][i] !== undefined) {
                        console.log(`      ${col}: ${data.result.values[0][i]}`);
                    }
                });
            }
        } else {
            console.log(`   ⚠️  Unexpected response structure:`, JSON.stringify(data, null, 2));
        }

        return {
            success: true,
            data: data.result,
            duration,
            rowCount: data.result?.values?.length || 0,
            columnCount: data.result?.columns?.length || 0
        };

    } catch (error) {
        console.log(`   ❌ Request Failed:`);
        console.log(`      Error Type: ${error.name}`);
        console.log(`      Error Message: ${error.message}`);
        
        if (error.name === 'AbortError') {
            console.log(`      Cause: Request timeout after ${REQUEST_TIMEOUT}ms`);
        }
        
        return {
            success: false,
            error: `${error.name}: ${error.message}`,
            duration: Date.now() - Date.now()
        };
    }
}

/**
 * Get recent sync logs for analysis
 */
async function getRecentSyncLogs(limit = 10) {
    console.log(`\n📋 Fetching recent sync logs (limit: ${limit})`);
    
    const { data, error } = await supabase
        .from('smartfill_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error(`   ❌ Database error:`, error);
        return [];
    }

    console.log(`   ✅ Found ${data.length} sync log entries`);
    
    data.forEach((log, index) => {
        console.log(`\n   📊 Sync Log #${index + 1}:`);
        console.log(`      ID: ${log.id}`);
        console.log(`      Type: ${log.sync_type}`);
        console.log(`      Status: ${log.sync_status}`);
        console.log(`      Started: ${log.started_at}`);
        console.log(`      Completed: ${log.completed_at || 'Not completed'}`);
        console.log(`      Duration: ${log.sync_duration_ms ? `${log.sync_duration_ms}ms` : 'N/A'}`);
        console.log(`      Assets Processed: ${log.assets_processed || 0}`);
        console.log(`      Locations Processed: ${log.locations_processed || 0}`);
        console.log(`      Tanks Processed: ${log.tanks_processed || 0}`);
        
        if (log.error_message) {
            console.log(`      ❌ Error Message (${log.error_message.length} chars):`);
            console.log(`         ${log.error_message}`);
        }
    });

    return data;
}

/**
 * Check specific customer data in database
 */
async function checkCustomerInDatabase(customerReference) {
    console.log(`\n🔍 Checking customer in database: ${customerReference}`);
    
    const { data, error } = await supabase
        .from('smartfill_customers')
        .select('*')
        .eq('api_reference', customerReference)
        .single();

    if (error) {
        console.log(`   ❌ Customer not found in database:`, error.message);
        return null;
    }

    console.log(`   ✅ Customer found in database:`);
    console.log(`      ID: ${data.id}`);
    console.log(`      Name: ${data.name}`);
    console.log(`      API Reference: ${data.api_reference}`);
    console.log(`      API Secret: ${data.api_secret.substring(0, 8)}...`);
    console.log(`      Active: ${data.active}`);
    console.log(`      Created: ${data.created_at}`);
    console.log(`      Updated: ${data.updated_at}`);

    // Check associated locations and tanks
    const { data: locations } = await supabase
        .from('smartfill_locations')
        .select(`
            *,
            smartfill_tanks(*)
        `)
        .eq('customer_id', data.id);

    if (locations && locations.length > 0) {
        console.log(`   📍 Locations: ${locations.length}`);
        locations.forEach((loc, i) => {
            console.log(`      Location ${i + 1}: Unit ${loc.unit_number} - ${loc.description}`);
            console.log(`         Tanks: ${loc.smartfill_tanks?.length || 0}`);
            console.log(`         Last Update: ${loc.latest_update_time}`);
        });
    } else {
        console.log(`   ⚠️  No locations found for this customer`);
    }

    return data;
}

/**
 * List all SmartFill customers
 */
async function listAllCustomers() {
    console.log(`\n📋 Listing all SmartFill customers`);
    
    const { data, error } = await supabase
        .from('smartfill_customers')
        .select('id, api_reference, name, active, created_at')
        .order('name');

    if (error) {
        console.error(`   ❌ Database error:`, error);
        return;
    }

    console.log(`   ✅ Found ${data.length} customers total`);
    
    const activeCustomers = data.filter(c => c.active);
    const inactiveCustomers = data.filter(c => !c.active);
    
    console.log(`   📊 Active: ${activeCustomers.length}, Inactive: ${inactiveCustomers.length}`);
    
    console.log(`\n   🟢 Active Customers:`);
    activeCustomers.forEach(customer => {
        console.log(`      ${customer.api_reference.padEnd(15)} | ${customer.name}`);
    });
    
    if (inactiveCustomers.length > 0) {
        console.log(`\n   🔴 Inactive Customers:`);
        inactiveCustomers.forEach(customer => {
            console.log(`      ${customer.api_reference.padEnd(15)} | ${customer.name}`);
        });
    }

    return data;
}

/**
 * Main diagnostic function
 */
async function runDiagnostics() {
    const args = process.argv.slice(2);
    const specificCustomer = args[0];

    console.log('🔧 SmartFill Customer Diagnostic Tool');
    console.log('=====================================');
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    if (specificCustomer) {
        console.log(`🎯 Target Customer: ${specificCustomer}`);
    } else {
        console.log(`🌐 Mode: Analyze all customers`);
    }

    try {
        // Step 1: Get recent sync logs
        await getRecentSyncLogs(5);

        // Step 2: List customers or check specific customer
        if (specificCustomer) {
            const customer = await checkCustomerInDatabase(specificCustomer);
            
            if (customer) {
                // Test the API for this specific customer
                const testResult = await testSmartFillCustomer(
                    customer.api_reference,
                    customer.api_secret,
                    customer.name
                );
                
                console.log(`\n📊 API Test Summary for ${customer.name}:`);
                console.log(`   Success: ${testResult.success}`);
                console.log(`   Duration: ${testResult.duration}ms`);
                
                if (!testResult.success) {
                    console.log(`   Error: ${testResult.error}`);
                    
                    if (testResult.httpStatus) {
                        console.log(`   HTTP Status: ${testResult.httpStatus}`);
                    }
                    
                    if (testResult.errorCode) {
                        console.log(`   SmartFill Error Code: ${testResult.errorCode}`);
                    }
                } else {
                    console.log(`   Data Rows: ${testResult.rowCount}`);
                    console.log(`   Data Columns: ${testResult.columnCount}`);
                }
            }
        } else {
            const customers = await listAllCustomers();
            
            // Look for customers that might match "Altona Farms 4309"
            const altonaCustomers = customers.filter(c => 
                c.name.toLowerCase().includes('altona') || 
                c.api_reference.toLowerCase().includes('4309') ||
                c.api_reference.toLowerCase().includes('altona')
            );
            
            if (altonaCustomers.length > 0) {
                console.log(`\n🔍 Found potential Altona Farms customers:`);
                altonaCustomers.forEach(customer => {
                    console.log(`   ${customer.api_reference} | ${customer.name} | Active: ${customer.active}`);
                });
                
                // Test the first matching customer
                if (altonaCustomers[0]) {
                    const customer = await checkCustomerInDatabase(altonaCustomers[0].api_reference);
                    if (customer) {
                        await testSmartFillCustomer(
                            customer.api_reference,
                            customer.api_secret,
                            customer.name
                        );
                    }
                }
            }
        }

    } catch (error) {
        console.error('\n💥 Diagnostic tool encountered an error:');
        console.error(`   ${error.message}`);
        console.error('\nStack trace:', error.stack);
    }

    console.log(`\n✅ Diagnostic completed at: ${new Date().toISOString()}`);
}

// Run the diagnostics
runDiagnostics();