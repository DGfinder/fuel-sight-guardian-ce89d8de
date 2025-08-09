/**
 * Lytx Video API Testing Functions
 */

window.lytxTests = {
    
    /**
     * Test basic Lytx API connection
     */
    async testConnection() {
        const config = window.configUtils.getServiceConfig('lytx');
        const testName = 'Lytx Connection Test';
        
        console.log('🧪 Testing Lytx API connection...');
        
        try {
            // Test basic connectivity to the base URL
            const result = await window.utils.makeRequest(config.baseUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            window.utils.displayResult('lytx-results', testName, result);
            window.utils.updateAPIStatus('lytx', result.success);
            
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Connection Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('lytx-results', testName, result);
            window.utils.updateAPIStatus('lytx', false);
            
            return result;
        }
    },
    
    /**
     * Test Lytx API authentication
     */
    async testAuth() {
        const config = window.configUtils.getServiceConfig('lytx');
        const testName = 'Lytx Auth Test';
        
        console.log('🧪 Testing Lytx API authentication...');
        
        try {
            // Test authentication by checking API key validity
            // Lytx uses API key in the Authorization header or as a query parameter
            const result = await window.utils.makeRequest(`${config.baseUrl}/video`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            window.utils.displayResult('lytx-results', testName, result);
            
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Auth Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('lytx-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test Lytx API endpoints
     */
    async testEndpoints() {
        const config = window.configUtils.getServiceConfig('lytx');
        const testName = 'Lytx Endpoints Test';
        
        console.log('🧪 Testing various Lytx endpoints...');
        
        const endpoints = [
            { path: '/video', name: 'Video API Root' },
            { path: '/video/events', name: 'Video Events' },
            { path: '/video/drivers', name: 'Drivers' },
            { path: '/video/vehicles', name: 'Vehicles' }
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                console.log(`  Testing ${endpoint.name} endpoint...`);
                
                const result = await window.utils.makeRequest(`${config.baseUrl}${endpoint.path}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'FuelSightGuardian-APITest/1.0'
                    }
                });
                
                window.utils.displayResult('lytx-results', `${testName} (${endpoint.name})`, result);
                results[endpoint.name.toLowerCase().replace(/\s+/g, '_')] = result.success;
                
                // Small delay between requests
                await window.utils.sleep(500);
                
            } catch (error) {
                const result = {
                    success: false,
                    status: 0,
                    statusText: `${endpoint.name} Test Failed`,
                    error: error.message,
                    responseTime: 0
                };
                
                window.utils.displayResult('lytx-results', `${testName} (${endpoint.name})`, result);
                results[endpoint.name.toLowerCase().replace(/\s+/g, '_')] = false;
            }
        }
        
        return {
            endpoints: results,
            overall: Object.values(results).some(success => success)
        };
    },
    
    /**
     * Test Lytx video events API
     */
    async testVideoEvents() {
        const config = window.configUtils.getServiceConfig('lytx');
        const testName = 'Lytx Video Events Test';
        
        console.log('🧪 Testing Lytx video events...');
        
        try {
            // Get recent video events (last 7 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            const params = new URLSearchParams({
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                limit: '10'
            });
            
            const result = await window.utils.makeRequest(`${config.baseUrl}/video/events?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            // Add extra processing for video events data
            if (result.success && result.data) {
                if (Array.isArray(result.data)) {
                    result.dataAnalysis = {
                        eventCount: result.data.length,
                        dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
                        sampleEvent: result.data.length > 0 ? {
                            eventId: result.data[0].eventId || result.data[0].id,
                            eventType: result.data[0].eventType || result.data[0].type,
                            driverId: result.data[0].driverId,
                            vehicleId: result.data[0].vehicleId,
                            timestamp: result.data[0].eventTime || result.data[0].timestamp
                        } : null
                    };
                } else if (result.data.events && Array.isArray(result.data.events)) {
                    result.dataAnalysis = {
                        eventCount: result.data.events.length,
                        totalCount: result.data.totalCount || result.data.total,
                        dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
                    };
                } else {
                    result.dataAnalysis = {
                        warning: 'Unexpected response format',
                        dataType: typeof result.data,
                        keys: Object.keys(result.data || {})
                    };
                }
            }
            
            window.utils.displayResult('lytx-results', testName, result);
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Video Events Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('lytx-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test Lytx drivers API
     */
    async testDrivers() {
        const config = window.configUtils.getServiceConfig('lytx');
        const testName = 'Lytx Drivers Test';
        
        console.log('🧪 Testing Lytx drivers API...');
        
        try {
            const result = await window.utils.makeRequest(`${config.baseUrl}/video/drivers?limit=10`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            // Add extra processing for drivers data
            if (result.success && result.data) {
                if (Array.isArray(result.data)) {
                    result.dataAnalysis = {
                        driverCount: result.data.length,
                        sampleDriver: result.data.length > 0 ? {
                            driverId: result.data[0].driverId || result.data[0].id,
                            driverName: result.data[0].driverName || result.data[0].name,
                            employeeId: result.data[0].employeeId
                        } : null
                    };
                } else if (result.data.drivers && Array.isArray(result.data.drivers)) {
                    result.dataAnalysis = {
                        driverCount: result.data.drivers.length,
                        totalCount: result.data.totalCount || result.data.total
                    };
                }
            }
            
            window.utils.displayResult('lytx-results', testName, result);
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Drivers Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('lytx-results', testName, result);
            return result;
        }
    },
    
    /**
     * Run all Lytx tests
     */
    async testAll() {
        console.log('🚀 Running all Lytx tests...');
        window.utils.updateGlobalStatus('Running Lytx tests...', 'loading');
        
        const results = {};
        
        try {
            results.connection = await this.testConnection();
            await window.utils.sleep(1000);
            
            results.auth = await this.testAuth();
            await window.utils.sleep(1000);
            
            results.endpoints = await this.testEndpoints();
            await window.utils.sleep(1000);
            
            results.videoEvents = await this.testVideoEvents();
            await window.utils.sleep(1000);
            
            results.drivers = await this.testDrivers();
            
            const successCount = Object.values(results).filter(r => r.success || r.overall).length;
            const totalTests = Object.keys(results).length;
            
            if (successCount === totalTests) {
                window.utils.updateGlobalStatus(`Lytx tests completed: ${successCount}/${totalTests} passed`, 'success');
            } else if (successCount > 0) {
                window.utils.updateGlobalStatus(`Lytx tests completed: ${successCount}/${totalTests} passed`, 'warning');
            } else {
                window.utils.updateGlobalStatus(`Lytx tests failed: 0/${totalTests} passed`, 'error');
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Lytx test suite failed:', error);
            window.utils.updateGlobalStatus('Lytx test suite failed', 'error');
            return { error: error.message };
        }
    }
};

// Make functions available globally
window.testLytxConnection = window.lytxTests.testConnection.bind(window.lytxTests);
window.testLytxAuth = window.lytxTests.testAuth.bind(window.lytxTests);
window.testLytxEndpoints = window.lytxTests.testEndpoints.bind(window.lytxTests);
window.testLytxAll = window.lytxTests.testAll.bind(window.lytxTests);

console.log('✅ Lytx test functions loaded');