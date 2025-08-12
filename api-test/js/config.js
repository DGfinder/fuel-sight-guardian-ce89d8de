/**
 * Configuration for API Testing
 * 
 * NOTE: In production, these values should come from secure environment variables.
 * For this testing interface, we're hardcoding them for simplicity.
 */

window.CONFIG = {
    // Supabase Configuration
    VITE_SUPABASE_URL: 'https://wjzsdsvbtapriiuxzmih.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxODA1NTIsImV4cCI6MjA2NDc1NjU1Mn0.XJeTNtWQGIzgKRk4zIKKEAr5PXVjrg6LhKBtjr8LPYg',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo',
    
    // Athara/Gasbot API Configuration
    VITE_ATHARA_BASE_URL: 'https://dashboard2-production.prod.gasbot.io',
    VITE_ATHARA_API_KEY: '0H5NTKJPLQURW4SQDU3J0G5EO7UNZCI6EB3C',
    VITE_ATHARA_API_SECRET: '1F01ONSVQGCN47NOS987MAR768RBXJF5NO1VORQF7W',
    
    // Alternative Athara credentials for fallback testing
    VITE_ATHARA_API_KEY_ALT: '9PAUTYO9U7VZTXD40T62VNB7KJOZQZ10C8M1',
    VITE_ATHARA_API_SECRET_ALT: '8XEKF3W4EM0Z1CAA95G0XH7LYRCBINM4CIBIEOSBNT',
    
    // Lytx Video API Configuration
    VITE_LYTX_BASE_URL: 'https://lytx-api.prod7.lv.lytx.com',
    VITE_LYTX_API_KEY: 'diCeZd54DgkVzV2aPumlLG1qcZflO0GS',
    
    // Vercel Blob Storage (if needed)
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_rzOfaWRtdfVVHypG_PKPFXlpSfjVJseJjhNmxveGxpoPMqO',
    
    // Webhook secrets (for reference)
    GASBOT_WEBHOOK_SECRET: 'FSG-gasbot-webhook-2025',
    GASBOT_SYNC_SECRET: 'FSG-gasbot-sync-2025',
    
    // Test default credentials
    VITE_DEFAULT_USER_PASSWORD: 'FuelSight2024!SecurePassword'
};

/**
 * Configuration validation and helper functions
 */
window.configUtils = {
    
    /**
     * Validate that all required configuration is present
     */
    validateConfig() {
        const requiredConfigs = [
            'VITE_SUPABASE_URL',
            'VITE_SUPABASE_ANON_KEY', 
            'VITE_ATHARA_BASE_URL',
            'VITE_ATHARA_API_KEY',
            'VITE_ATHARA_API_SECRET',
            'VITE_LYTX_BASE_URL',
            'VITE_LYTX_API_KEY'
        ];
        
        const missingConfigs = [];
        const invalidConfigs = [];
        
        requiredConfigs.forEach(key => {
            const value = window.CONFIG[key];
            
            if (!value) {
                missingConfigs.push(key);
            } else if (value.length < 10) {
                invalidConfigs.push(`${key} (too short)`);
            } else if (value.includes('your-') || value.includes('YOUR_')) {
                invalidConfigs.push(`${key} (placeholder value)`);
            }
        });
        
        return {
            valid: missingConfigs.length === 0 && invalidConfigs.length === 0,
            missingConfigs,
            invalidConfigs,
            totalConfigs: Object.keys(window.CONFIG).length
        };
    },
    
    /**
     * Get configuration summary for display
     */
    getConfigSummary() {
        const config = window.CONFIG;
        
        return {
            supabase: {
                url: config.VITE_SUPABASE_URL,
                hasAnonKey: !!config.VITE_SUPABASE_ANON_KEY,
                hasServiceKey: !!config.SUPABASE_SERVICE_ROLE_KEY,
                anonKeyLength: config.VITE_SUPABASE_ANON_KEY ? config.VITE_SUPABASE_ANON_KEY.length : 0,
                serviceKeyLength: config.SUPABASE_SERVICE_ROLE_KEY ? config.SUPABASE_SERVICE_ROLE_KEY.length : 0
            },
            athara: {
                baseUrl: config.VITE_ATHARA_BASE_URL,
                hasApiKey: !!config.VITE_ATHARA_API_KEY,
                hasApiSecret: !!config.VITE_ATHARA_API_SECRET,
                hasAltCredentials: !!(config.VITE_ATHARA_API_KEY_ALT && config.VITE_ATHARA_API_SECRET_ALT),
                apiKeyLength: config.VITE_ATHARA_API_KEY ? config.VITE_ATHARA_API_KEY.length : 0,
                secretLength: config.VITE_ATHARA_API_SECRET ? config.VITE_ATHARA_API_SECRET.length : 0
            },
            lytx: {
                baseUrl: config.VITE_LYTX_BASE_URL,
                hasApiKey: !!config.VITE_LYTX_API_KEY,
                apiKeyLength: config.VITE_LYTX_API_KEY ? config.VITE_LYTX_API_KEY.length : 0
            },
            other: {
                hasBlobToken: !!config.BLOB_READ_WRITE_TOKEN,
                hasWebhookSecret: !!config.GASBOT_WEBHOOK_SECRET,
                hasSyncSecret: !!config.GASBOT_SYNC_SECRET
            }
        };
    },
    
    /**
     * Test URL accessibility (basic ping test)
     */
    async testUrlAccessibility(url) {
        try {
            const response = await fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors', // Avoid CORS issues for simple connectivity test
                cache: 'no-cache'
            });
            return { accessible: true, status: 'reachable' };
        } catch (error) {
            // Even with no-cors, we can detect if the URL is completely unreachable
            return { 
                accessible: false, 
                status: 'unreachable',
                error: error.message 
            };
        }
    },
    
    /**
     * Get masked version of API key for display
     */
    maskApiKey(key) {
        if (!key || key.length < 8) return '***';
        return key.substring(0, 4) + '****' + key.substring(key.length - 4);
    },
    
    /**
     * Get configuration for specific service
     */
    getServiceConfig(service) {
        switch (service.toLowerCase()) {
            case 'supabase':
                return {
                    url: window.CONFIG.VITE_SUPABASE_URL,
                    anonKey: window.CONFIG.VITE_SUPABASE_ANON_KEY,
                    serviceKey: window.CONFIG.SUPABASE_SERVICE_ROLE_KEY
                };
            case 'athara':
            case 'gasbot':
                return {
                    baseUrl: window.CONFIG.VITE_ATHARA_BASE_URL,
                    apiKey: window.CONFIG.VITE_ATHARA_API_KEY,
                    apiSecret: window.CONFIG.VITE_ATHARA_API_SECRET,
                    altApiKey: window.CONFIG.VITE_ATHARA_API_KEY_ALT,
                    altApiSecret: window.CONFIG.VITE_ATHARA_API_SECRET_ALT
                };
            case 'lytx':
                return {
                    baseUrl: window.CONFIG.VITE_LYTX_BASE_URL,
                    apiKey: window.CONFIG.VITE_LYTX_API_KEY
                };
            default:
                return {};
        }
    }
};

// Log configuration status on load
console.log('🔧 API Configuration loaded');
console.log('📊 Config validation:', window.configUtils.validateConfig());
console.log('📋 Config summary:', window.configUtils.getConfigSummary());