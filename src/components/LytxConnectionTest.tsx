import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useLytxConnectionTest, useLytxReferenceData } from '@/hooks/useLytxData';
import { lytxApi } from '@/services/lytxApi';

const LytxConnectionTest: React.FC = () => {
  const [testResults, setTestResults] = useState<{
    connection: boolean | null;
    message: string;
    details?: any;
  }>({ connection: null, message: '' });
  const [isManualTesting, setIsManualTesting] = useState(false);

  const connectionTest = useLytxConnectionTest();
  const referenceData = useLytxReferenceData();

  const runConnectionTest = async () => {
    setIsManualTesting(true);
    try {
      const result = await lytxApi.testConnection();
      setTestResults({
        connection: result.success,
        message: result.message,
        details: result
      });
      
      if (result.success) {
        // Also test reference data
        connectionTest.refetch();
      }
    } catch (error) {
      setTestResults({
        connection: false,
        message: `Connection failed: ${error.message}`,
        details: error
      });
    } finally {
      setIsManualTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (isManualTesting || connectionTest.isLoading) {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    
    if (testResults.connection === true || connectionTest.data?.success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    
    if (testResults.connection === false || connectionTest.isError) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusMessage = () => {
    if (isManualTesting) return 'Testing connection...';
    if (connectionTest.isLoading) return 'Loading...';
    
    if (testResults.message) return testResults.message;
    if (connectionTest.data?.message) return connectionTest.data.message;
    if (connectionTest.error) return `Error: ${connectionTest.error.message}`;
    
    return 'Connection not tested';
  };

  const getApiConfig = () => {
    const config = lytxApi.getConfiguration();
    return config;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Lytx API Connection Status</h3>
        <button
          onClick={runConnectionTest}
          disabled={isManualTesting || connectionTest.isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          <RefreshCw className={`h-4 w-4 ${isManualTesting ? 'animate-spin' : ''}`} />
          Test Connection
        </button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-3 mb-4">
        {getStatusIcon()}
        <span className="text-sm text-gray-700">
          {getStatusMessage()}
        </span>
      </div>

      {/* API Configuration */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium text-gray-900">API Configuration</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Base URL:</span>
            <span className="ml-2 font-mono text-gray-900">
              {getApiConfig().baseUrl}
            </span>
          </div>
          <div>
            <span className="text-gray-600">API Key:</span>
            <span className="ml-2 text-gray-900">
              {getApiConfig().hasApiKey ? '✓ Configured' : '✗ Missing'}
            </span>
          </div>
        </div>
      </div>

      {/* Reference Data Status */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium text-gray-900 mb-3">Reference Data Status</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {referenceData.statuses.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : referenceData.statuses.isError ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : referenceData.statuses.data ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span>
              Event Statuses: {referenceData.statuses.data?.data.length || 0} loaded
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {referenceData.triggers.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : referenceData.triggers.isError ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : referenceData.triggers.data ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span>
              Event Triggers: {referenceData.triggers.data?.data.length || 0} loaded
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {referenceData.behaviors.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : referenceData.behaviors.isError ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : referenceData.behaviors.data ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span>
              Event Behaviors: {referenceData.behaviors.data?.data.length || 0} loaded
            </span>
          </div>
        </div>
      </div>

      {/* Error Details */}
      {(referenceData.isError || connectionTest.isError || testResults.connection === false) && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-red-900 mb-2">Error Details</h4>
          <div className="bg-red-50 p-3 rounded text-sm text-red-800">
            {referenceData.error?.message || 
             connectionTest.error?.message || 
             testResults.message}
          </div>
        </div>
      )}

      {/* Success Details */}
      {(testResults.connection === true || connectionTest.data?.success) && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-green-900 mb-2">Connection Successful</h4>
          <div className="bg-green-50 p-3 rounded text-sm text-green-800">
            Successfully connected to Lytx API. Great Southern Fuels safety data is available.
          </div>
        </div>
      )}
    </div>
  );
};

export default LytxConnectionTest;