/**
 * Utility functions for API testing
 */

// Global test results storage
window.testResults = [];

/**
 * Utility function to make HTTP requests with timeout and error handling
 */
async function makeRequest(url, options = {}) {
    const startTime = Date.now();
    
    const defaultOptions = {
        method: 'GET',
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };

    try {
        console.log(`🔗 Making request to: ${url}`);
        console.log(`📤 Options:`, defaultOptions);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);

        const response = await fetch(url, {
            ...defaultOptions,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Get response headers
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        console.log(`📥 Response (${responseTime}ms):`, responseData);

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers,
            data: responseData,
            responseTime,
            url
        };

    } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.error(`❌ Request failed:`, error);
        
        return {
            success: false,
            status: 0,
            statusText: 'Request Failed',
            headers: {},
            data: null,
            responseTime,
            url,
            error: error.message
        };
    }
}

/**
 * Display a test result in the UI
 */
function displayResult(containerId, testName, result) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const resultElement = document.createElement('div');
    resultElement.className = `result-item ${result.success ? 'success' : 'error'}`;
    
    const timestamp = new Date().toLocaleTimeString();
    
    resultElement.innerHTML = `
        <div class="result-header">
            <span class="result-title">${testName}</span>
            <span class="result-time">${timestamp}</span>
        </div>
        <div class="result-details">
            <span class="result-status ${result.success ? 'success' : 'error'}">
                ${result.success ? '✅' : '❌'} ${result.status} ${result.statusText}
            </span>
            <span style="margin-left: 15px; color: #6c757d;">
                ${result.responseTime}ms
            </span>
        </div>
        ${result.error ? `<div style="color: #dc3545; font-weight: 500; margin: 8px 0;">Error: ${result.error}</div>` : ''}
        ${result.data ? `
            <details style="margin-top: 10px;">
                <summary style="cursor: pointer; font-weight: 500; color: #495057;">Response Data</summary>
                <div class="result-data">${typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data}</div>
            </details>
        ` : ''}
    `;

    container.insertBefore(resultElement, container.firstChild);

    // Store result in global array
    window.testResults.push({
        timestamp,
        testName,
        containerId,
        ...result
    });

    // Add to global log
    addToGlobalLog(testName, result.success, result.responseTime);
}

/**
 * Add entry to global results log
 */
function addToGlobalLog(testName, success, responseTime) {
    const globalResults = document.getElementById('global-results');
    if (!globalResults) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${success ? 'success' : 'error'}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span>${testName}: ${success ? '✅ Success' : '❌ Failed'} (${responseTime}ms)</span>
    `;

    globalResults.insertBefore(logEntry, globalResults.firstChild);

    // Keep only last 50 entries
    while (globalResults.children.length > 50) {
        globalResults.removeChild(globalResults.lastChild);
    }
}

/**
 * Update API status indicator
 */
function updateAPIStatus(apiName, success) {
    const statusElement = document.getElementById(`${apiName}-status`);
    if (!statusElement) return;

    if (success) {
        statusElement.textContent = '✅ Online';
        statusElement.className = 'api-status success';
    } else {
        statusElement.textContent = '❌ Failed';
        statusElement.className = 'api-status error';
    }
}

/**
 * Update global status indicator
 */
function updateGlobalStatus(message, type = 'info') {
    const statusIndicator = document.getElementById('status-indicator');
    if (!statusIndicator) return;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '🔵',
        loading: '🔄'
    };

    statusIndicator.textContent = `${icons[type] || '🔵'} ${message}`;
    statusIndicator.className = `status ${type}`;
}

/**
 * Show loading state for button
 */
function setButtonLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (loading) {
        button.disabled = true;
        button.textContent = button.textContent.replace(/[🔗🧪⚡❤️]/g, '🔄');
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        // Text will be restored by the calling function
    }
}

/**
 * Clear all results from a container
 */
function clearResults(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Clear all global results
 */
function clearAllResults() {
    // Clear all results containers
    const containers = [
        'config-results',
        'supabase-results', 
        'athara-results',
        'lytx-results',
        'bulk-results'
    ];
    
    containers.forEach(clearResults);
    
    // Clear global log
    const globalResults = document.getElementById('global-results');
    if (globalResults) {
        globalResults.innerHTML = '';
    }
    
    // Clear stored results
    window.testResults = [];
    
    // Reset status indicators
    const statusElements = document.querySelectorAll('.api-status');
    statusElements.forEach(element => {
        element.textContent = '⚪ Not tested';
        element.className = 'api-status unknown';
    });
    
    updateGlobalStatus('Results cleared', 'info');
}

/**
 * Export test results to JSON
 */
function exportResults() {
    if (window.testResults.length === 0) {
        alert('No test results to export');
        return;
    }

    const exportData = {
        exportTimestamp: new Date().toISOString(),
        totalTests: window.testResults.length,
        successfulTests: window.testResults.filter(r => r.success).length,
        failedTests: window.testResults.filter(r => !r.success).length,
        averageResponseTime: window.testResults.reduce((sum, r) => sum + r.responseTime, 0) / window.testResults.length,
        results: window.testResults
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `api-test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateGlobalStatus(`Exported ${window.testResults.length} test results`, 'success');
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get environment variable (for frontend use)
 * Note: This is a simplified version for testing
 */
function getEnvVar(name, defaultValue = '') {
    // In a real application, these would come from build-time environment variables
    // For this testing interface, we'll define them in config.js
    return window.CONFIG?.[name] || defaultValue;
}

/**
 * Validate URL format
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique test ID
 */
function generateTestId() {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log message with timestamp
 */
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// Export functions to global scope
window.utils = {
    makeRequest,
    displayResult,
    addToGlobalLog,
    updateAPIStatus,
    updateGlobalStatus,
    setButtonLoading,
    clearResults,
    clearAllResults,
    exportResults,
    formatBytes,
    getEnvVar,
    isValidUrl,
    sleep,
    generateTestId,
    log
};