/**
 * SERVER-SIDE VERCEL SETUP CHECK
 */

export interface SetupCheckResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export async function runVercelSetupCheck(): Promise<SetupCheckResult[]> {
  const results: SetupCheckResult[] = [];
  
  // Check Vercel environment
  results.push({
    component: 'Vercel Environment',
    status: process.env.VERCEL ? 'pass' : 'warning',
    message: process.env.VERCEL ? 'Running on Vercel' : 'Not running on Vercel'
  });
  
  // Check Blob storage
  results.push({
    component: 'Blob Storage',
    status: process.env.BLOB_READ_WRITE_TOKEN ? 'pass' : 'fail',
    message: process.env.BLOB_READ_WRITE_TOKEN ? 'Blob storage configured' : 'Blob storage not configured'
  });
  
  // Check KV
  results.push({
    component: 'KV Storage',
    status: process.env.KV_REST_API_URL ? 'pass' : 'fail',
    message: process.env.KV_REST_API_URL ? 'KV storage configured' : 'KV storage not configured'
  });
  
  return results;
}

export function printSetupReport(results: SetupCheckResult[]): string {
  let report = 'Vercel Setup Check Report\n';
  report += '========================\n\n';
  
  for (const result of results) {
    const status = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    report += `${status} ${result.component}: ${result.message}\n`;
  }
  
  return report;
}

export async function quickVercelCheck(): Promise<boolean> {
  const results = await runVercelSetupCheck();
  return results.every(result => result.status === 'pass' || result.status === 'warning');
}