/**
 * Supabase API Testing Functions
 */

window.supabaseTests = {
    
    /**
     * Test basic Supabase connection
     */
    async testConnection() {
        const config = window.configUtils.getServiceConfig('supabase');
        const testName = 'Supabase Connection Test';
        
        console.log('🧪 Testing Supabase connection...');
        
        try {
            const result = await window.utils.makeRequest(`${config.url}/rest/v1/`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', testName, result);
            window.utils.updateAPIStatus('supabase', result.success);
            
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Connection Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            window.utils.updateAPIStatus('supabase', false);
            
            return result;
        }
    },
    
    /**
     * Test Supabase authentication
     */
    async testAuth() {
        const config = window.configUtils.getServiceConfig('supabase');
        const testName = 'Supabase Auth Test';
        
        console.log('🧪 Testing Supabase authentication...');
        
        try {
            // Test with anonymous key
            const anonResult = await window.utils.makeRequest(`${config.url}/auth/v1/user`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', `${testName} (Anon Key)`, anonResult);
            
            // Test with service role key if available
            if (config.serviceKey) {
                const serviceResult = await window.utils.makeRequest(`${config.url}/rest/v1/auth/users`, {
                    method: 'GET',
                    headers: {
                        'apikey': config.serviceKey,
                        'Authorization': `Bearer ${config.serviceKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                window.utils.displayResult('supabase-results', `${testName} (Service Key)`, serviceResult);
                
                return {
                    anonAuth: anonResult.success,
                    serviceAuth: serviceResult.success,
                    overall: anonResult.success || serviceResult.success
                };
            }
            
            return {
                anonAuth: anonResult.success,
                serviceAuth: null,
                overall: anonResult.success
            };
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Auth Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test basic Supabase query
     */
    async testQuery() {
        const config = window.configUtils.getServiceConfig('supabase');
        const testName = 'Supabase Query Test';
        
        console.log('🧪 Testing Supabase query...');
        
        try {
            // Test a simple query to a common table (vehicles)
            const vehiclesResult = await window.utils.makeRequest(`${config.url}/rest/v1/vehicles?limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', `${testName} (vehicles table)`, vehiclesResult);
            
            // Test another common table (fuel_tanks)
            const tanksResult = await window.utils.makeRequest(`${config.url}/rest/v1/fuel_tanks?limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', `${testName} (fuel_tanks table)`, tanksResult);
            
            // Test Guardian events table
            const guardianResult = await window.utils.makeRequest(`${config.url}/rest/v1/guardian_events?limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', `${testName} (guardian_events table)`, guardianResult);
            
            return {
                vehiclesQuery: vehiclesResult.success,
                tanksQuery: tanksResult.success,
                guardianQuery: guardianResult.success,
                overall: vehiclesResult.success || tanksResult.success || guardianResult.success
            };
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Query Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test Supabase realtime capabilities
     */
    async testRealtime() {
        const config = window.configUtils.getServiceConfig('supabase');
        const testName = 'Supabase Realtime Test';
        
        console.log('🧪 Testing Supabase realtime...');
        
        try {
            // Test realtime WebSocket connection
            const realtimeUrl = config.url.replace('https://', 'wss://') + '/realtime/v1/websocket';
            
            const result = {
                success: true,
                status: 200,
                statusText: 'Realtime Test (Mock)',
                data: {
                    message: 'Realtime testing requires WebSocket connection which is complex for this simple test interface',
                    realtimeUrl: realtimeUrl,
                    note: 'For full realtime testing, use the main application'
                },
                responseTime: 50
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            return result;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Realtime Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            return result;
        }
    },
    
    /**
     * Test Supabase storage
     */
    async testStorage() {
        const config = window.configUtils.getServiceConfig('supabase');
        const testName = 'Supabase Storage Test';
        
        console.log('🧪 Testing Supabase storage...');
        
        try {
            // List storage buckets
            const storageResult = await window.utils.makeRequest(`${config.url}/storage/v1/bucket`, {
                method: 'GET',
                headers: {
                    'apikey': config.anonKey,
                    'Authorization': `Bearer ${config.anonKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            window.utils.displayResult('supabase-results', testName, storageResult);
            return storageResult;
            
        } catch (error) {
            const result = {
                success: false,
                status: 0,
                statusText: 'Storage Test Failed',
                error: error.message,
                responseTime: 0
            };
            
            window.utils.displayResult('supabase-results', testName, result);
            return result;
        }
    },
    
    /**
     * Run all Supabase tests
     */
    async testAll() {
        console.log('🚀 Running all Supabase tests...');
        window.utils.updateGlobalStatus('Running Supabase tests...', 'loading');
        
        const results = {};
        
        try {
            results.connection = await this.testConnection();
            await window.utils.sleep(1000); // Pause between tests
            
            results.auth = await this.testAuth();
            await window.utils.sleep(1000);
            
            results.query = await this.testQuery();
            await window.utils.sleep(1000);
            
            results.storage = await this.testStorage();
            
            const successCount = Object.values(results).filter(r => r.success || r.overall).length;
            const totalTests = Object.keys(results).length;
            
            if (successCount === totalTests) {
                window.utils.updateGlobalStatus(`Supabase tests completed: ${successCount}/${totalTests} passed`, 'success');
            } else if (successCount > 0) {
                window.utils.updateGlobalStatus(`Supabase tests completed: ${successCount}/${totalTests} passed`, 'warning');
            } else {
                window.utils.updateGlobalStatus(`Supabase tests failed: 0/${totalTests} passed`, 'error');
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Supabase test suite failed:', error);
            window.utils.updateGlobalStatus('Supabase test suite failed', 'error');
            return { error: error.message };
        }
    }
};

// Make functions available globally
window.testSupabaseConnection = window.supabaseTests.testConnection.bind(window.supabaseTests);
window.testSupabaseAuth = window.supabaseTests.testAuth.bind(window.supabaseTests);
window.testSupabaseQuery = window.supabaseTests.testQuery.bind(window.supabaseTests);
window.testSupabaseAll = window.supabaseTests.testAll.bind(window.supabaseTests);

console.log('✅ Supabase test functions loaded');