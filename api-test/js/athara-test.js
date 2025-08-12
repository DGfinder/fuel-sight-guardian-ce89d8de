/**
 * Athara/Gasbot API Testing Functions
 */

window.atharaTests = {
    
    /**
     * Test basic Athara API connection
     */
    async testConnection() {
        const config = window.configUtils.getServiceConfig('athara');
        const testName = 'Athara Connection Test';
        
        console.log('🧪 Testing Athara API connection...');
        
        try {
            // Test basic connectivity to the base URL
            const result = await window.utils.makeRequest(config.baseUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            window.utils.displayResult('athara-results', testName, result);
            window.utils.updateAPIStatus('athara', result.success);
            
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Connection Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('athara-results', testName, result);
            window.utils.updateAPIStatus('athara', false);
            
            return result;
        }
    },
    
    /**
     * Test Athara API authentication
     */
    async testAuth() {
        const config = window.configUtils.getServiceConfig('athara');
        const testName = 'Athara Auth Test';
        
        console.log('🧪 Testing Athara API authentication...');
        
        try {
            // Test authentication by attempting to access a protected endpoint
            const result = await window.utils.makeRequest(`${config.baseUrl}/locations`, {
                method: 'GET',
                headers: {
                    'X-API-Key': config.apiKey,
                    'X-API-Secret': config.apiSecret,
                    'Content-Type': 'application/json',
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            window.utils.displayResult('athara-results', testName, result);
            
            // If primary credentials fail, test with alternative credentials
            if (!result.success && config.altApiKey && config.altApiSecret) {
                console.log('🔄 Trying alternative credentials...');
                
                const altResult = await window.utils.makeRequest(`${config.baseUrl}/locations`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': config.altApiKey,
                        'X-API-Secret': config.altApiSecret,
                        'Content-Type': 'application/json',
                        'User-Agent': 'FuelSightGuardian-APITest/1.0'
                    }
                });
                
                window.utils.displayResult('athara-results', `${testName} (Alt Credentials)`, altResult);
                
                return {
                    primaryAuth: result.success,
                    altAuth: altResult.success,
                    overall: result.success || altResult.success
                };
            }
            
            return {
                primaryAuth: result.success,
                altAuth: null,
                overall: result.success
            };
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Auth Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('athara-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test fetching locations from Athara API
     */
    async testLocations() {
        const config = window.configUtils.getServiceConfig('athara');
        const testName = 'Athara Locations Test';
        
        console.log('🧪 Testing Athara locations endpoint...');
        
        try {
            const result = await window.utils.makeRequest(`${config.baseUrl}/locations`, {
                method: 'GET',
                headers: {
                    'X-API-Key': config.apiKey,
                    'X-API-Secret': config.apiSecret,
                    'Content-Type': 'application/json',
                    'User-Agent': 'FuelSightGuardian-APITest/1.0'
                }
            });
            
            // Add extra processing for locations data
            if (result.success && result.data) {
                if (Array.isArray(result.data)) {
                    result.dataAnalysis = {
                        locationCount: result.data.length,
                        hasAssets: result.data.some(loc => loc.assets && loc.assets.length > 0),
                        totalAssets: result.data.reduce((sum, loc) => sum + (loc.assets?.length || 0), 0),
                        sampleLocation: result.data.length > 0 ? {
                            customerName: result.data[0].customerName,
                            locationId: result.data[0].locationId,
                            fillPercentage: result.data[0].latestCalibratedFillPercentage,
                            assetCount: result.data[0].assets?.length || 0
                        } : null
                    };
                } else {
                    result.dataAnalysis = {
                        warning: 'Response is not an array of locations',
                        dataType: typeof result.data
                    };
                }
            }
            
            window.utils.displayResult('athara-results', testName, result);
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Locations Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('athara-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test different Athara API endpoints
     */
    async testEndpoints() {
        const config = window.configUtils.getServiceConfig('athara');
        const testName = 'Athara Endpoints Test';
        
        console.log('🧪 Testing various Athara endpoints...');
        
        const endpoints = [
            { path: '/locations', name: 'Locations' },
            { path: '/assets', name: 'Assets' },
            { path: '/devices', name: 'Devices' },
            { path: '/readings', name: 'Readings' }
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                console.log(`  Testing ${endpoint.name} endpoint...`);
                
                const result = await window.utils.makeRequest(`${config.baseUrl}${endpoint.path}`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': config.apiKey,
                        'X-API-Secret': config.apiSecret,
                        'Content-Type': 'application/json',
                        'User-Agent': 'FuelSightGuardian-APITest/1.0'
                    }
                });
                
                window.utils.displayResult('athara-results', `${testName} (${endpoint.name})`, result);
                results[endpoint.name.toLowerCase()] = result.success;
                
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
                
                window.utils.displayResult('athara-results', `${testName} (${endpoint.name})`, result);
                results[endpoint.name.toLowerCase()] = false;
            }
        }
        
        return {
            endpoints: results,
            overall: Object.values(results).some(success => success)
        };
    },
    
    /**
     * Test Athara API rate limiting and error handling
     */
    async testRateLimiting() {
        const config = window.configUtils.getServiceConfig('athara');
        const testName = 'Athara Rate Limiting Test';
        
        console.log('🧪 Testing Athara rate limiting...');
        
        try {
            const requests = [];
            const startTime = Date.now();
            
            // Make 5 rapid requests to test rate limiting
            for (let i = 0; i < 5; i++) {
                requests.push(
                    window.utils.makeRequest(`${config.baseUrl}/locations`, {
                        method: 'GET',
                        headers: {
                            'X-API-Key': config.apiKey,
                            'X-API-Secret': config.apiSecret,
                            'Content-Type': 'application/json',
                            'User-Agent': 'FuelSightGuardian-APITest/1.0'
                        }
                    })
                );
            }
            
            const results = await Promise.all(requests);
            const endTime = Date.now();
            
            const successfulRequests = results.filter(r => r.success).length;
            const rateLimitedRequests = results.filter(r => r.status === 429).length;
            
            const result = {
                success: true,
                status: 200,
                statusText: 'Rate Limiting Test Complete',
                data: {
                    totalRequests: results.length,
                    successfulRequests,
                    rateLimitedRequests,
                    totalTime: endTime - startTime,
                    averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
                    rateLimitingActive: rateLimitedRequests > 0
                },
                responseTime: endTime - startTime
            };
            
            window.utils.displayResult('athara-results', testName, result);
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Rate Limiting Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('athara-results', testName, result);
            return result;
        }
    },
    
    /**
     * Run all Athara tests
     */
    async testAll() {
        console.log('🚀 Running all Athara tests...');
        window.utils.updateGlobalStatus('Running Athara tests...', 'loading');
        
        const results = {};
        
        try {
            results.connection = await this.testConnection();
            await window.utils.sleep(1000);
            
            results.auth = await this.testAuth();
            await window.utils.sleep(1000);
            
            results.locations = await this.testLocations();
            await window.utils.sleep(1000);
            
            results.endpoints = await this.testEndpoints();
            await window.utils.sleep(1000);
            
            // Skip rate limiting test by default to avoid issues
            // results.rateLimiting = await this.testRateLimiting();
            
            const successCount = Object.values(results).filter(r => r.success || r.overall).length;
            const totalTests = Object.keys(results).length;
            
            if (successCount === totalTests) {
                window.utils.updateGlobalStatus(`Athara tests completed: ${successCount}/${totalTests} passed`, 'success');
            } else if (successCount > 0) {
                window.utils.updateGlobalStatus(`Athara tests completed: ${successCount}/${totalTests} passed`, 'warning');
            } else {
                window.utils.updateGlobalStatus(`Athara tests failed: 0/${totalTests} passed`, 'error');
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Athara test suite failed:', error);
            window.utils.updateGlobalStatus('Athara test suite failed', 'error');
            return { error: error.message };
        }
    }
};

// Make functions available globally
window.testAtharaConnection = window.atharaTests.testConnection.bind(window.atharaTests);
window.testAtharaAuth = window.atharaTests.testAuth.bind(window.atharaTests);
window.testAtharaLocations = window.atharaTests.testLocations.bind(window.atharaTests);
window.testAtharaAll = window.atharaTests.testAll.bind(window.atharaTests);

console.log('✅ Athara test functions loaded');