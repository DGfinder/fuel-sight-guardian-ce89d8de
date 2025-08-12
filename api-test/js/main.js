/**
 * Main JavaScript file for API Testing Interface
 * Handles UI interactions and coordinates all test functions
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 API Testing Interface initialized');
    
    // Initialize the interface
    initializeInterface();
    
    // Set up event listeners
    setupEventListeners();
    
    // Perform initial environment validation
    performInitialValidation();
});

/**
 * Initialize the interface
 */
function initializeInterface() {
    window.utils.updateGlobalStatus('Interface loaded - Ready to test APIs', 'info');
    
    // Show welcome message in global log
    window.utils.addToGlobalLog('API Testing Interface', true, 0);
    
    // Validate configuration on load
    const configValidation = window.configUtils.validateConfig();
    if (!configValidation.valid) {
        window.utils.updateGlobalStatus('Configuration issues detected', 'warning');
        console.warn('⚠️ Configuration validation failed:', configValidation);
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    
    // Environment Configuration Tests
    document.getElementById('test-env-config')?.addEventListener('click', testEnvironmentConfig);
    document.getElementById('show-config')?.addEventListener('click', showConfiguration);
    
    // Supabase Tests
    document.getElementById('test-supabase-connection')?.addEventListener('click', handleSupabaseConnection);
    document.getElementById('test-supabase-auth')?.addEventListener('click', handleSupabaseAuth);
    document.getElementById('test-supabase-query')?.addEventListener('click', handleSupabaseQuery);
    document.getElementById('test-supabase-all')?.addEventListener('click', handleSupabaseAll);
    
    // Athara Tests
    document.getElementById('test-athara-connection')?.addEventListener('click', handleAtharaConnection);
    document.getElementById('test-athara-locations')?.addEventListener('click', handleAtharaLocations);
    document.getElementById('test-athara-auth')?.addEventListener('click', handleAtharaAuth);
    document.getElementById('test-athara-all')?.addEventListener('click', handleAtharaAll);
    
    // Lytx Tests
    document.getElementById('test-lytx-connection')?.addEventListener('click', handleLytxConnection);
    document.getElementById('test-lytx-auth')?.addEventListener('click', handleLytxAuth);
    document.getElementById('test-lytx-endpoints')?.addEventListener('click', handleLytxEndpoints);
    document.getElementById('test-lytx-all')?.addEventListener('click', handleLytxAll);
    
    // Bulk Tests
    document.getElementById('test-all-apis')?.addEventListener('click', handleTestAllAPIs);
    document.getElementById('health-check')?.addEventListener('click', handleHealthCheck);
    document.getElementById('performance-test')?.addEventListener('click', handlePerformanceTest);
    
    // Utility Functions
    document.getElementById('clear-results')?.addEventListener('click', window.utils.clearAllResults);
    document.getElementById('export-results')?.addEventListener('click', window.utils.exportResults);
}

/**
 * Perform initial validation
 */
async function performInitialValidation() {
    // Quick config validation
    const validation = window.configUtils.validateConfig();
    console.log('📋 Initial config validation:', validation);
    
    if (validation.missingConfigs.length > 0) {
        console.warn('⚠️ Missing configurations:', validation.missingConfigs);
    }
    
    if (validation.invalidConfigs.length > 0) {
        console.warn('⚠️ Invalid configurations:', validation.invalidConfigs);
    }
}

// =============================================================================
// Environment Configuration Functions
// =============================================================================

/**
 * Test environment configuration
 */
async function testEnvironmentConfig() {
    const button = document.getElementById('test-env-config');
    const originalText = button.textContent;
    
    try {
        button.textContent = '🔄 Validating...';
        button.disabled = true;
        
        const validation = window.configUtils.validateConfig();
        const summary = window.configUtils.getConfigSummary();
        
        const result = {
            success: validation.valid,
            status: validation.valid ? 200 : 400,
            statusText: validation.valid ? 'Configuration Valid' : 'Configuration Issues',
            data: {
                validation,
                summary,
                configCount: validation.totalConfigs,
                recommendations: generateConfigRecommendations(validation)
            },
            responseTime: 50
        };
        
        window.utils.displayResult('config-results', 'Environment Configuration Test', result);
        
        if (validation.valid) {
            window.utils.updateGlobalStatus('Environment configuration valid', 'success');
        } else {
            window.utils.updateGlobalStatus('Environment configuration has issues', 'warning');
        }
        
    } catch (error) {
        const result = {
            success: false,
            status: 500,
            statusText: 'Configuration Test Failed',
            error: error.message,
            responseTime: 0
        };
        
        window.utils.displayResult('config-results', 'Environment Configuration Test', result);
        window.utils.updateGlobalStatus('Configuration test failed', 'error');
        
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Show configuration details
 */
function showConfiguration() {
    const configResults = document.getElementById('config-results');
    
    if (configResults.style.display === 'none') {
        const summary = window.configUtils.getConfigSummary();
        const maskedConfig = {};
        
        // Create masked version of config for display
        Object.keys(window.CONFIG).forEach(key => {
            const value = window.CONFIG[key];
            if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
                maskedConfig[key] = window.configUtils.maskApiKey(value);
            } else {
                maskedConfig[key] = value;
            }
        });
        
        const result = {
            success: true,
            status: 200,
            statusText: 'Configuration Display',
            data: {
                maskedConfig,
                summary,
                note: 'Sensitive values are masked for security'
            },
            responseTime: 10
        };
        
        window.utils.displayResult('config-results', 'Configuration Details', result);
        configResults.style.display = 'block';
        
    } else {
        configResults.style.display = 'none';
    }
}

/**
 * Generate configuration recommendations
 */
function generateConfigRecommendations(validation) {
    const recommendations = [];
    
    if (validation.missingConfigs.length > 0) {
        recommendations.push('Add missing environment variables: ' + validation.missingConfigs.join(', '));
    }
    
    if (validation.invalidConfigs.length > 0) {
        recommendations.push('Fix invalid configurations: ' + validation.invalidConfigs.join(', '));
    }
    
    if (recommendations.length === 0) {
        recommendations.push('Configuration looks good! All required values are present.');
    }
    
    return recommendations;
}

// =============================================================================
// Button Handler Functions
// =============================================================================

async function handleSupabaseConnection() {
    await executeTest('test-supabase-connection', window.testSupabaseConnection, '🔗 Test Connection');
}

async function handleSupabaseAuth() {
    await executeTest('test-supabase-auth', window.testSupabaseAuth, '🔐 Test Auth');
}

async function handleSupabaseQuery() {
    await executeTest('test-supabase-query', window.testSupabaseQuery, '🗄️ Test Query');
}

async function handleSupabaseAll() {
    await executeTest('test-supabase-all', window.testSupabaseAll, '🧪 Test All Supabase');
}

async function handleAtharaConnection() {
    await executeTest('test-athara-connection', window.testAtharaConnection, '🔗 Test Connection');
}

async function handleAtharaLocations() {
    await executeTest('test-athara-locations', window.testAtharaLocations, '⛽ Fetch Locations');
}

async function handleAtharaAuth() {
    await executeTest('test-athara-auth', window.testAtharaAuth, '🔐 Test Auth');
}

async function handleAtharaAll() {
    await executeTest('test-athara-all', window.testAtharaAll, '🧪 Test All Athara');
}

async function handleLytxConnection() {
    await executeTest('test-lytx-connection', window.testLytxConnection, '🔗 Test Connection');
}

async function handleLytxAuth() {
    await executeTest('test-lytx-auth', window.testLytxAuth, '🔐 Test Auth');
}

async function handleLytxEndpoints() {
    await executeTest('test-lytx-endpoints', window.testLytxEndpoints, '🎥 Test Endpoints');
}

async function handleLytxAll() {
    await executeTest('test-lytx-all', window.testLytxAll, '🧪 Test All Lytx');
}

// =============================================================================
// Bulk Testing Functions
// =============================================================================

/**
 * Test all APIs sequentially
 */
async function handleTestAllAPIs() {
    const button = document.getElementById('test-all-apis');
    const originalText = button.textContent;
    
    try {
        button.textContent = '🔄 Testing All APIs...';
        button.disabled = true;
        
        window.utils.updateGlobalStatus('Running comprehensive API tests...', 'loading');
        window.utils.addToGlobalLog('Started comprehensive API testing', true, 0);
        
        const startTime = Date.now();
        const results = {};
        
        // Test each API suite
        console.log('🚀 Starting comprehensive API testing...');
        
        results.supabase = await window.testSupabaseAll();
        await window.utils.sleep(2000);
        
        results.athara = await window.testAtharaAll();
        await window.utils.sleep(2000);
        
        results.lytx = await window.testLytxAll();
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Calculate overall results
        const totalTests = Object.values(results).reduce((count, suite) => {
            if (suite.error) return count + 1;
            return count + Object.keys(suite).length;
        }, 0);
        
        const successfulTests = Object.values(results).reduce((count, suite) => {
            if (suite.error) return count;
            return count + Object.values(suite).filter(test => test.success || test.overall).length;
        }, 0);
        
        const bulkResult = {
            success: successfulTests > 0,
            status: successfulTests === totalTests ? 200 : 206,
            statusText: `Bulk Test Complete: ${successfulTests}/${totalTests} passed`,
            data: {
                totalTests,
                successfulTests,
                failedTests: totalTests - successfulTests,
                totalTime,
                averageTestTime: totalTime / totalTests,
                results
            },
            responseTime: totalTime
        };
        
        window.utils.displayResult('bulk-results', 'Comprehensive API Test', bulkResult);
        
        if (successfulTests === totalTests) {
            window.utils.updateGlobalStatus(`All tests passed! ${successfulTests}/${totalTests}`, 'success');
        } else if (successfulTests > 0) {
            window.utils.updateGlobalStatus(`Partial success: ${successfulTests}/${totalTests}`, 'warning');
        } else {
            window.utils.updateGlobalStatus(`All tests failed: 0/${totalTests}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Bulk testing failed:', error);
        window.utils.updateGlobalStatus('Bulk testing failed', 'error');
        
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Perform health check on all APIs
 */
async function handleHealthCheck() {
    const button = document.getElementById('health-check');
    const originalText = button.textContent;
    
    try {
        button.textContent = '🔄 Checking Health...';
        button.disabled = true;
        
        window.utils.updateGlobalStatus('Performing health check...', 'loading');
        
        const healthChecks = [];
        
        // Quick connection tests for each API
        healthChecks.push({
            name: 'Supabase',
            test: window.testSupabaseConnection
        });
        
        healthChecks.push({
            name: 'Athara',
            test: window.testAtharaConnection
        });
        
        healthChecks.push({
            name: 'Lytx',
            test: window.testLytxConnection
        });
        
        const results = {};
        const startTime = Date.now();
        
        for (const check of healthChecks) {
            console.log(`🏥 Health check: ${check.name}`);
            results[check.name] = await check.test();
            await window.utils.sleep(500);
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        const healthyAPIs = Object.values(results).filter(r => r.success).length;
        const totalAPIs = Object.keys(results).length;
        
        const healthResult = {
            success: healthyAPIs > 0,
            status: healthyAPIs === totalAPIs ? 200 : 206,
            statusText: `Health Check: ${healthyAPIs}/${totalAPIs} APIs healthy`,
            data: {
                healthyAPIs,
                totalAPIs,
                healthPercentage: (healthyAPIs / totalAPIs * 100).toFixed(1),
                totalTime,
                results
            },
            responseTime: totalTime
        };
        
        window.utils.displayResult('bulk-results', 'API Health Check', healthResult);
        
        if (healthyAPIs === totalAPIs) {
            window.utils.updateGlobalStatus(`All APIs healthy! ${healthyAPIs}/${totalAPIs}`, 'success');
        } else if (healthyAPIs > 0) {
            window.utils.updateGlobalStatus(`Some APIs unhealthy: ${healthyAPIs}/${totalAPIs}`, 'warning');
        } else {
            window.utils.updateGlobalStatus('All APIs unhealthy', 'error');
        }
        
    } catch (error) {
        console.error('❌ Health check failed:', error);
        window.utils.updateGlobalStatus('Health check failed', 'error');
        
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Perform performance test on all APIs
 */
async function handlePerformanceTest() {
    const button = document.getElementById('performance-test');
    const originalText = button.textContent;
    
    try {
        button.textContent = '🔄 Testing Performance...';
        button.disabled = true;
        
        window.utils.updateGlobalStatus('Running performance tests...', 'loading');
        
        const performanceTests = [];
        const iterations = 3;
        
        // Run each API test multiple times to measure performance
        for (let i = 0; i < iterations; i++) {
            console.log(`⚡ Performance test iteration ${i + 1}/${iterations}`);
            
            const iteration = {
                iteration: i + 1,
                supabase: await window.testSupabaseConnection(),
                athara: await window.testAtharaConnection(),
                lytx: await window.testLytxConnection()
            };
            
            performanceTests.push(iteration);
            await window.utils.sleep(1000);
        }
        
        // Calculate performance metrics
        const metrics = {};
        const apis = ['supabase', 'athara', 'lytx'];
        
        apis.forEach(api => {
            const responseTimes = performanceTests.map(test => test[api].responseTime);
            const successCount = performanceTests.filter(test => test[api].success).length;
            
            metrics[api] = {
                averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
                minResponseTime: Math.min(...responseTimes),
                maxResponseTime: Math.max(...responseTimes),
                successRate: (successCount / iterations * 100).toFixed(1),
                reliability: successCount === iterations ? 'Excellent' : 
                            successCount > iterations * 0.8 ? 'Good' : 
                            successCount > iterations * 0.5 ? 'Fair' : 'Poor'
            };
        });
        
        const performanceResult = {
            success: true,
            status: 200,
            statusText: `Performance Test Complete (${iterations} iterations)`,
            data: {
                iterations,
                metrics,
                overallAverageTime: Object.values(metrics).reduce((sum, m) => sum + m.averageResponseTime, 0) / apis.length,
                fastestAPI: apis.reduce((fastest, api) => 
                    metrics[api].averageResponseTime < metrics[fastest].averageResponseTime ? api : fastest
                ),
                mostReliableAPI: apis.reduce((reliable, api) => 
                    parseFloat(metrics[api].successRate) > parseFloat(metrics[reliable].successRate) ? api : reliable
                )
            },
            responseTime: performanceTests.reduce((sum, test) => 
                sum + test.supabase.responseTime + test.athara.responseTime + test.lytx.responseTime, 0
            )
        };
        
        window.utils.displayResult('bulk-results', 'Performance Test', performanceResult);
        window.utils.updateGlobalStatus('Performance test completed', 'success');
        
    } catch (error) {
        console.error('❌ Performance test failed:', error);
        window.utils.updateGlobalStatus('Performance test failed', 'error');
        
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generic test execution wrapper
 */
async function executeTest(buttonId, testFunction, originalText) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    try {
        window.utils.setButtonLoading(buttonId, true);
        const result = await testFunction();
        return result;
        
    } catch (error) {
        console.error(`❌ Test failed: ${originalText}`, error);
        window.utils.updateGlobalStatus(`Test failed: ${originalText}`, 'error');
        
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('loading');
    }
}

// Make main functions available globally
window.apiTesting = {
    testEnvironmentConfig,
    showConfiguration,
    handleTestAllAPIs,
    handleHealthCheck,
    handlePerformanceTest
};

console.log('✅ Main API testing interface loaded and ready!');