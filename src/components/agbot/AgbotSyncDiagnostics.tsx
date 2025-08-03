import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useAgbotLocations, 
  useAgbotSyncLogs,
  useAgbotSync,
  formatTimestamp 
} from '@/hooks/useAgbotData';
import { 
  AlertTriangle, 
  Database, 
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  Download,
  Eye,
  Terminal,
  Zap
} from 'lucide-react';
import { getAgbotLocations, testAtharaAPIConnection } from '@/services/agbot-api';

interface DiagnosticsData {
  apiData: any[];
  dbData: any[];
  discrepancies: {
    type: string;
    message: string;
    details?: any;
  }[];
}

export function AgbotSyncDiagnostics() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [running, setRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  
  const { data: locations, refetch: refetchLocations } = useAgbotLocations();
  const { data: syncLogs } = useAgbotSyncLogs(10);
  const syncMutation = useAgbotSync();

  // Capture console logs
  useEffect(() => {
    if (!showDiagnostics) return;

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const captureLog = (type: string, ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setConsoleOutput(prev => [...prev, `[${type}] ${message}`]);
    };

    console.log = (...args) => {
      originalLog(...args);
      captureLog('LOG', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      captureLog('ERROR', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      captureLog('WARN', ...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [showDiagnostics]);

  const runDiagnostics = async () => {
    setRunning(true);
    setConsoleOutput([]);
    
    try {
      console.log('🔍 Starting Agbot Sync Diagnostics...\n');
      
      // Test API connectivity
      console.log('1️⃣ Testing API connectivity...');
      const apiTest = await testAtharaAPIConnection();
      console.log(`   API Status: ${apiTest.success ? '✅ Connected' : '❌ Failed'}`);
      if (apiTest.dataCount) {
        console.log(`   Locations available: ${apiTest.dataCount}`);
      }
      
      // Get data from API directly
      console.log('\n2️⃣ Fetching data directly from API...');
      let apiData: any[] = [];
      try {
        const response = await fetch('/api/test-athara', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          apiData = await response.json();
          console.log(`   ✅ API returned ${apiData.length} locations`);
          
          // Count assets
          const totalApiAssets = apiData.reduce((sum, loc) => 
            sum + (loc.assets?.length || 0), 0
          );
          console.log(`   Total assets in API: ${totalApiAssets}`);
        } else {
          console.error(`   ❌ API fetch failed: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`   ❌ API fetch error: ${error}`);
      }
      
      // Get data from database
      console.log('\n3️⃣ Fetching data from database...');
      const dbData = await getAgbotLocations();
      console.log(`   ✅ Database has ${dbData.length} locations`);
      
      const totalDbAssets = dbData.reduce((sum, loc) => 
        sum + (loc.assets?.length || 0), 0
      );
      console.log(`   Total assets in database: ${totalDbAssets}`);
      
      // Compare data
      console.log('\n4️⃣ Analyzing discrepancies...');
      const discrepancies: DiagnosticsData['discrepancies'] = [];
      
      // Check for missing locations
      const apiGuids = new Set(apiData.map(loc => loc.locationGuid));
      const dbGuids = new Set(dbData.map(loc => loc.location_guid));
      
      const missingInDb = [...apiGuids].filter(guid => !dbGuids.has(guid));
      const extraInDb = [...dbGuids].filter(guid => !apiGuids.has(guid));
      
      if (missingInDb.length > 0) {
        const missingLocs = apiData.filter(loc => missingInDb.includes(loc.locationGuid));
        discrepancies.push({
          type: 'missing_locations',
          message: `${missingInDb.length} locations from API not in database`,
          details: missingLocs.map(loc => ({
            guid: loc.locationGuid,
            name: loc.customerName,
            assets: loc.assets?.length || 0
          }))
        });
        console.log(`   ⚠️  ${missingInDb.length} locations missing from database`);
      }
      
      if (extraInDb.length > 0) {
        discrepancies.push({
          type: 'extra_locations',
          message: `${extraInDb.length} locations in database not in API`,
          details: extraInDb
        });
        console.log(`   ⚠️  ${extraInDb.length} extra locations in database`);
      }
      
      // Check for asset discrepancies
      for (const apiLoc of apiData) {
        const dbLoc = dbData.find(loc => loc.location_guid === apiLoc.locationGuid);
        if (dbLoc) {
          const apiAssetCount = apiLoc.assets?.length || 0;
          const dbAssetCount = dbLoc.assets?.length || 0;
          
          if (apiAssetCount !== dbAssetCount) {
            discrepancies.push({
              type: 'asset_count_mismatch',
              message: `${apiLoc.customerName}: API has ${apiAssetCount} assets, DB has ${dbAssetCount}`,
              details: {
                location: apiLoc.customerName,
                apiAssets: apiAssetCount,
                dbAssets: dbAssetCount,
                difference: apiAssetCount - dbAssetCount
              }
            });
            console.log(`   ⚠️  Asset count mismatch for ${apiLoc.customerName}`);
          }
        }
      }
      
      // Summary
      console.log('\n5️⃣ Summary:');
      console.log(`   Total discrepancies found: ${discrepancies.length}`);
      
      if (discrepancies.length === 0) {
        console.log('   ✅ Database is in sync with API!');
      } else {
        console.log('   ❌ Database is out of sync with API');
        console.log('\n   Recommended action: Run sync to update database');
      }
      
      setDiagnosticsData({
        apiData,
        dbData,
        discrepancies
      });
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
    } finally {
      setRunning(false);
    }
  };

  const runSyncWithDiagnostics = async () => {
    setConsoleOutput([]);
    console.log('🔄 Starting sync with diagnostics...\n');
    
    await syncMutation.mutateAsync();
    
    // Refresh data after sync
    setTimeout(() => {
      refetchLocations();
      runDiagnostics();
    }, 2000);
  };

  const exportDiagnostics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      consoleOutput,
      diagnosticsData,
      syncLogs: syncLogs?.slice(0, 5)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agbot-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync Diagnostics
            <Badge variant={showDiagnostics ? 'default' : 'outline'}>
              {showDiagnostics ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Debug sync issues and verify data integrity between API and database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={showDiagnostics ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
            >
              <Terminal className="h-4 w-4 mr-1" />
              {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
            </Button>
            
            {showDiagnostics && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runDiagnostics}
                  disabled={running}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Run Diagnostics
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runSyncWithDiagnostics}
                  disabled={syncMutation.isPending || running}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Sync & Diagnose
                </Button>
                
                {consoleOutput.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportDiagnostics}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                )}
              </>
            )}
          </div>

          {showDiagnostics && diagnosticsData && (
            <div className="space-y-4">
              {/* Discrepancies Alert */}
              {diagnosticsData.discrepancies.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sync Issues Detected</AlertTitle>
                  <AlertDescription>
                    Found {diagnosticsData.discrepancies.length} discrepancies between API and database
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Database In Sync</AlertTitle>
                  <AlertDescription>
                    No discrepancies found. Database matches API data.
                  </AlertDescription>
                </Alert>
              )}

              {/* Discrepancy Details */}
              {diagnosticsData.discrepancies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Discrepancy Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosticsData.discrepancies.map((disc, index) => (
                        <div key={index} className="border rounded p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={disc.type === 'missing_locations' ? 'destructive' : 'secondary'}>
                              {disc.type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-sm font-medium">{disc.message}</span>
                          </div>
                          {disc.details && (
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(disc.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Console Output */}
          {showDiagnostics && consoleOutput.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Console Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-96 overflow-y-auto">
                  {consoleOutput.map((line, index) => (
                    <div key={index} className={
                      line.includes('[ERROR]') ? 'text-red-400' :
                      line.includes('[WARN]') ? 'text-yellow-400' :
                      line.includes('✅') ? 'text-green-400' :
                      line.includes('❌') ? 'text-red-400' :
                      line.includes('⚠️') ? 'text-yellow-400' :
                      'text-green-400'
                    }>
                      {line}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Sync Logs */}
          {syncLogs && syncLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Sync History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {syncLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {log.sync_status === 'success' ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : log.sync_status === 'partial' ? (
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>{formatTimestamp(log.started_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {log.locations_processed || 0}L / {log.assets_processed || 0}A
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.sync_duration_ms}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}