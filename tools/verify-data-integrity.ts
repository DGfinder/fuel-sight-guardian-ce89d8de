#!/usr/bin/env npx tsx

/**
 * DATA INTEGRITY VERIFICATION TOOL
 * 
 * This script verifies that the captive payments data pipeline is working correctly:
 * - Checks base table record counts
 * - Verifies materialized view integrity
 * - Tests carrier-specific data filtering
 * - Validates data ranges and completeness
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wjzsdsvbtapriiuxzmih.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorLog(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DataIntegrityReport {
  baseTable: {
    recordCount: number;
    carriers: string[];
    dateRange: { min: string; max: string };
    topCustomers: string[];
  };
  materializedView: {
    deliveryCount: number;
    carriers: string[];
    dateRange: { min: string; max: string };
  };
  secureViews: {
    [key: string]: { exists: boolean; accessible: boolean; recordCount?: number };
  };
  carrierBreakdown: {
    SMB: { records: number; deliveries: number };
    GSF: { records: number; deliveries: number };
    Combined: { records: number; deliveries: number };
  };
  dataQuality: {
    duplicateRecords: number;
    missingCustomers: number;
    invalidDates: number;
    zeroVolumes: number;
  };
  performance: {
    baseTableQueryTime: number;
    materializedViewQueryTime: number;
    secureViewQueryTimes: { [key: string]: number };
  };
}

async function checkBaseTable(): Promise<DataIntegrityReport['baseTable']> {
  colorLog('blue', '📊 Checking base table: captive_payment_records');
  
  try {
    // Get record count
    const { count, error: countError } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    // Get carriers
    const { data: carrierData, error: carrierError } = await supabase
      .from('captive_payment_records')
      .select('carrier')
      .limit(1000);
    
    if (carrierError) throw carrierError;
    
    const carriers = [...new Set(carrierData?.map(r => r.carrier) || [])];
    
    // Get date range
    const { data: dateData, error: dateError } = await supabase
      .from('captive_payment_records')
      .select('delivery_date')
      .order('delivery_date', { ascending: true })
      .limit(1);
    
    const { data: maxDateData, error: maxDateError } = await supabase
      .from('captive_payment_records')
      .select('delivery_date')
      .order('delivery_date', { ascending: false })
      .limit(1);
    
    if (dateError || maxDateError) throw dateError || maxDateError;
    
    // Get top customers
    const { data: customerData, error: customerError } = await supabase
      .from('captive_payment_records')
      .select('customer')
      .limit(100);
    
    if (customerError) throw customerError;
    
    const customerCounts = customerData?.reduce((acc, r) => {
      acc[r.customer] = (acc[r.customer] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    const topCustomers = Object.entries(customerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([customer]) => customer);
    
    const result = {
      recordCount: count || 0,
      carriers,
      dateRange: {
        min: dateData?.[0]?.delivery_date || 'Unknown',
        max: maxDateData?.[0]?.delivery_date || 'Unknown'
      },
      topCustomers
    };
    
    colorLog('green', `✅ Base table: ${result.recordCount.toLocaleString()} records`);
    colorLog('green', `✅ Carriers: ${result.carriers.join(', ')}`);
    colorLog('green', `✅ Date range: ${result.dateRange.min} to ${result.dateRange.max}`);
    
    return result;
    
  } catch (error: any) {
    colorLog('red', `❌ Base table check failed: ${error?.message || JSON.stringify(error)}`);
    throw error;
  }
}

async function checkMaterializedView(): Promise<DataIntegrityReport['materializedView']> {
  colorLog('blue', '📊 Checking materialized view: captive_deliveries');
  
  try {
    // Get delivery count
    const { count, error: countError } = await supabase
      .from('captive_deliveries')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    // Get carriers
    const { data: carrierData, error: carrierError } = await supabase
      .from('captive_deliveries')
      .select('carrier')
      .limit(100);
    
    if (carrierError) throw carrierError;
    
    const carriers = [...new Set(carrierData?.map(r => r.carrier) || [])];
    
    // Get date range
    const { data: dateData, error: dateError } = await supabase
      .from('captive_deliveries')
      .select('delivery_date')
      .order('delivery_date', { ascending: true })
      .limit(1);
    
    const { data: maxDateData, error: maxDateError } = await supabase
      .from('captive_deliveries')
      .select('delivery_date')
      .order('delivery_date', { ascending: false })
      .limit(1);
    
    if (dateError || maxDateError) throw dateError || maxDateError;
    
    const result = {
      deliveryCount: count || 0,
      carriers,
      dateRange: {
        min: dateData?.[0]?.delivery_date || 'Unknown',
        max: maxDateData?.[0]?.delivery_date || 'Unknown'
      }
    };
    
    colorLog('green', `✅ Materialized view: ${result.deliveryCount.toLocaleString()} deliveries`);
    colorLog('green', `✅ Carriers: ${result.carriers.join(', ')}`);
    
    return result;
    
  } catch (error) {
    colorLog('red', `❌ Materialized view check failed: ${error}`);
    throw error;
  }
}

async function checkSecureViews(): Promise<DataIntegrityReport['secureViews']> {
  colorLog('blue', '📊 Checking secure views');
  
  const viewsToCheck = [
    'secure_captive_deliveries',
    'secure_captive_monthly_analytics',
    'secure_captive_customer_analytics',
    'secure_captive_terminal_analytics'
  ];
  
  const results: DataIntegrityReport['secureViews'] = {};
  
  for (const viewName of viewsToCheck) {
    try {
      const { count, error } = await supabase
        .from(viewName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results[viewName] = { exists: false, accessible: false };
        colorLog('red', `❌ View ${viewName}: ${error.message}`);
      } else {
        results[viewName] = { exists: true, accessible: true, recordCount: count || 0 };
        colorLog('green', `✅ View ${viewName}: ${count?.toLocaleString() || 0} records`);
      }
    } catch (err) {
      results[viewName] = { exists: false, accessible: false };
      colorLog('red', `❌ View ${viewName}: ${err}`);
    }
  }
  
  return results;
}

async function checkCarrierBreakdown(): Promise<DataIntegrityReport['carrierBreakdown']> {
  colorLog('blue', '📊 Checking carrier-specific data breakdown');
  
  const carriers = ['SMB', 'GSF', 'Combined'];
  const results: DataIntegrityReport['carrierBreakdown'] = {
    SMB: { records: 0, deliveries: 0 },
    GSF: { records: 0, deliveries: 0 },
    Combined: { records: 0, deliveries: 0 }
  };
  
  for (const carrier of carriers) {
    try {
      // Check records in base table
      const { count: recordCount } = await supabase
        .from('captive_payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('carrier', carrier);
      
      // Check deliveries in materialized view
      const { count: deliveryCount } = await supabase
        .from('captive_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('carrier', carrier);
      
      results[carrier as keyof typeof results] = {
        records: recordCount || 0,
        deliveries: deliveryCount || 0
      };
      
      colorLog('green', `✅ ${carrier}: ${recordCount?.toLocaleString()} records, ${deliveryCount?.toLocaleString()} deliveries`);
      
    } catch (error) {
      colorLog('red', `❌ Carrier ${carrier} check failed: ${error}`);
    }
  }
  
  return results;
}

async function checkDataQuality(): Promise<DataIntegrityReport['dataQuality']> {
  colorLog('blue', '📊 Checking data quality issues');
  
  const results: DataIntegrityReport['dataQuality'] = {
    duplicateRecords: 0,
    missingCustomers: 0,
    invalidDates: 0,
    zeroVolumes: 0
  };
  
  try {
    // Check for missing customers
    const { count: missingCustomers } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .or('customer.is.null,customer.eq.');
    
    results.missingCustomers = missingCustomers || 0;
    
    // Check for zero volumes
    const { count: zeroVolumes } = await supabase
      .from('captive_payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('volume_litres', 0);
    
    results.zeroVolumes = zeroVolumes || 0;
    
    if (results.missingCustomers > 0) {
      colorLog('yellow', `⚠️  ${results.missingCustomers} records with missing customers`);
    } else {
      colorLog('green', '✅ No missing customer data');
    }
    
    if (results.zeroVolumes > 0) {
      colorLog('yellow', `⚠️  ${results.zeroVolumes} records with zero volume`);
    } else {
      colorLog('green', '✅ No zero volume records');
    }
    
  } catch (error) {
    colorLog('red', `❌ Data quality check failed: ${error}`);
  }
  
  return results;
}

async function measurePerformance(): Promise<DataIntegrityReport['performance']> {
  colorLog('blue', '📊 Measuring query performance');
  
  const results: DataIntegrityReport['performance'] = {
    baseTableQueryTime: 0,
    materializedViewQueryTime: 0,
    secureViewQueryTimes: {}
  };
  
  try {
    // Test base table performance
    const baseStart = Date.now();
    await supabase
      .from('captive_payment_records')
      .select('*')
      .limit(100);
    results.baseTableQueryTime = Date.now() - baseStart;
    
    // Test materialized view performance
    const mvStart = Date.now();
    await supabase
      .from('captive_deliveries')
      .select('*')
      .limit(100);
    results.materializedViewQueryTime = Date.now() - mvStart;
    
    // Test secure views performance
    const secureViews = ['secure_captive_deliveries'];
    for (const view of secureViews) {
      try {
        const start = Date.now();
        await supabase.from(view).select('*').limit(10);
        results.secureViewQueryTimes[view] = Date.now() - start;
      } catch (err) {
        results.secureViewQueryTimes[view] = -1; // Indicates failure
      }
    }
    
    colorLog('green', `✅ Base table query: ${results.baseTableQueryTime}ms`);
    colorLog('green', `✅ Materialized view query: ${results.materializedViewQueryTime}ms`);
    
  } catch (error) {
    colorLog('red', `❌ Performance test failed: ${error}`);
  }
  
  return results;
}

async function generateReport(): Promise<DataIntegrityReport> {
  colorLog('cyan', '🚀 Starting Data Integrity Verification');
  console.log('');
  
  const report: DataIntegrityReport = {
    baseTable: await checkBaseTable(),
    materializedView: await checkMaterializedView(),
    secureViews: await checkSecureViews(),
    carrierBreakdown: await checkCarrierBreakdown(),
    dataQuality: await checkDataQuality(),
    performance: await measurePerformance()
  };
  
  console.log('');
  colorLog('cyan', '📋 DATA INTEGRITY REPORT SUMMARY');
  console.log('='.repeat(50));
  
  // Overall health assessment
  const totalRecords = report.baseTable.recordCount;
  const totalDeliveries = report.materializedView.deliveryCount;
  const secureViewsWorking = Object.values(report.secureViews).filter(v => v.accessible).length;
  const totalSecureViews = Object.keys(report.secureViews).length;
  
  colorLog('green', `📊 Total Records: ${totalRecords.toLocaleString()}`);
  colorLog('green', `📦 Total Deliveries: ${totalDeliveries.toLocaleString()}`);
  colorLog(secureViewsWorking === totalSecureViews ? 'green' : 'red', 
           `🔒 Secure Views: ${secureViewsWorking}/${totalSecureViews} working`);
  
  // Carrier breakdown
  console.log('');
  colorLog('cyan', '🚛 CARRIER BREAKDOWN:');
  Object.entries(report.carrierBreakdown).forEach(([carrier, data]) => {
    colorLog('green', `  ${carrier}: ${data.records.toLocaleString()} records → ${data.deliveries.toLocaleString()} deliveries`);
  });
  
  // Performance summary
  console.log('');
  colorLog('cyan', '⚡ PERFORMANCE:');
  colorLog('green', `  Base table query: ${report.performance.baseTableQueryTime}ms`);
  colorLog('green', `  Materialized view query: ${report.performance.materializedViewQueryTime}ms`);
  
  // Issues found
  console.log('');
  const issues = [];
  if (report.dataQuality.missingCustomers > 0) issues.push(`${report.dataQuality.missingCustomers} missing customers`);
  if (report.dataQuality.zeroVolumes > 0) issues.push(`${report.dataQuality.zeroVolumes} zero volumes`);
  if (secureViewsWorking < totalSecureViews) issues.push(`${totalSecureViews - secureViewsWorking} secure views not working`);
  
  if (issues.length > 0) {
    colorLog('yellow', '⚠️  ISSUES FOUND:');
    issues.forEach(issue => colorLog('yellow', `    • ${issue}`));
  } else {
    colorLog('green', '✅ NO ISSUES FOUND - SYSTEM IS HEALTHY');
  }
  
  console.log('');
  colorLog('cyan', '🎯 RECOMMENDATIONS:');
  
  if (totalRecords < 50000) {
    colorLog('yellow', '  • Consider importing more data - current dataset seems small');
  }
  
  if (secureViewsWorking < totalSecureViews) {
    colorLog('red', '  • CRITICAL: Fix secure views by running the production fix script');
    colorLog('blue', '  • Run: npx tsx tools/fix-production-views.ts');
  }
  
  if (report.performance.baseTableQueryTime > 1000) {
    colorLog('yellow', '  • Consider adding indexes to improve base table performance');
  }
  
  if (report.performance.materializedViewQueryTime > 500) {
    colorLog('yellow', '  • Consider refreshing materialized view: REFRESH MATERIALIZED VIEW captive_deliveries;');
  }
  
  console.log('');
  return report;
}

async function main() {
  try {
    const report = await generateReport();
    
    // Write report to file
    const fs = await import('fs/promises');
    await fs.writeFile(
      'data-integrity-report.json', 
      JSON.stringify(report, null, 2)
    );
    
    colorLog('green', '✅ Report saved to data-integrity-report.json');
    
    // Exit with appropriate code
    const allSecureViewsWork = Object.values(report.secureViews).every(v => v.accessible);
    if (!allSecureViewsWork) {
      colorLog('red', '❌ Some secure views are not working - fix required');
      process.exit(1);
    } else {
      colorLog('green', '🎉 All systems operational!');
      process.exit(0);
    }
    
  } catch (error: any) {
    colorLog('red', `❌ Verification failed: ${error?.message || JSON.stringify(error)}`);
    console.error('Full error details:', error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
main().catch(console.error);

export { generateReport, checkSecureViews };