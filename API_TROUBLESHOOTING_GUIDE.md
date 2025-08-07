# API Integration Troubleshooting Guide

## 🚨 Common Issues & Solutions

### 1. Environment Variables Not Set
**Problem**: APIs fail because environment variables are missing
**Solution**: 
```bash
# Run the environment setup script
./create-complete-env-file.bat

# Or manually create .env file with:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
LYTX_API_KEY=your-lytx-api-key
VITE_ATHARA_API_KEY=your-gasbot-api-key
```

### 2. CORS Issues
**Problem**: Browser blocks cross-origin requests
**Solution**: 
- Use server-side proxies (like your `lytx-proxy.js`)
- Add proper CORS headers
- Use Vercel serverless functions for API calls

### 3. Authentication Failures
**Problem**: API keys are invalid or expired
**Solution**:
- Verify API keys are correct
- Check if keys have proper permissions
- Test with API documentation tools

### 4. Rate Limiting
**Problem**: APIs return 429 (Too Many Requests)
**Solution**:
- Implement exponential backoff
- Add request queuing
- Respect API rate limits

### 5. Network Connectivity
**Problem**: Cannot reach external APIs
**Solution**:
- Check internet connection
- Verify firewall settings
- Test with curl or Postman

## 🔧 Quick Fixes

### For Supabase Issues:
```javascript
// Test Supabase connection
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const { data, error } = await supabase.from('your_table').select('*').limit(1);
if (error) console.log('Supabase error:', error);
```

### For LYTX Issues:
```javascript
// Test LYTX API
const response = await fetch('https://lytx-api.prod7.lv.lytx.com/api/v1/events', {
  headers: {
    'x-apikey': process.env.LYTX_API_KEY,
    'Content-Type': 'application/json'
  }
});
```

### For Gasbot Issues:
```javascript
// Test Gasbot API
const response = await fetch('https://dashboard2-production.prod.gasbot.io/api/v1/locations', {
  headers: {
    'Authorization': `Bearer ${process.env.VITE_ATHARA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
```

## 🧪 Testing Your APIs

Run the comprehensive test script:
```bash
node test-api-connections.js
```

This will test:
- ✅ Environment variables
- ✅ Supabase connection
- ✅ LYTX API connection
- ✅ Gasbot API connection
- ✅ SmartFill API connection
- ✅ Local API endpoints

## 📋 Debugging Checklist

### Environment Setup:
- [ ] `.env` file exists
- [ ] All required variables are set
- [ ] No typos in variable names
- [ ] API keys are valid and active

### Network & Connectivity:
- [ ] Internet connection is working
- [ ] Firewall allows outbound requests
- [ ] DNS resolution works
- [ ] No corporate proxy blocking requests

### API-Specific Issues:
- [ ] API keys have correct permissions
- [ ] API endpoints are correct
- [ ] Request format matches API spec
- [ ] Rate limits are respected

### Code Issues:
- [ ] Error handling is implemented
- [ ] Timeouts are set appropriately
- [ ] Retry logic is in place
- [ ] CORS is handled properly

## 🛠️ Common Error Messages & Solutions

### "Cannot read property 'fetch' of undefined"
**Cause**: Running in Node.js environment without fetch
**Solution**: 
```javascript
// Add to your script
const fetch = require('node-fetch'); // or use global fetch in Node 18+
```

### "ENOTFOUND" errors
**Cause**: DNS resolution failure
**Solution**: Check internet connection and DNS settings

### "ECONNREFUSED" errors
**Cause**: Cannot connect to API server
**Solution**: Check if API is down or URL is incorrect

### "401 Unauthorized" errors
**Cause**: Invalid API key or authentication
**Solution**: Verify API credentials and permissions

### "403 Forbidden" errors
**Cause**: Insufficient permissions
**Solution**: Check API key permissions and scope

### "429 Too Many Requests"
**Cause**: Rate limit exceeded
**Solution**: Implement rate limiting and retry logic

## 🚀 Best Practices

### 1. Always Handle Errors
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
} catch (error) {
  console.error('API call failed:', error);
  // Handle gracefully
}
```

### 2. Implement Retry Logic
```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 3. Use Environment Variables Properly
```javascript
// Good
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY not set');

// Bad
const apiKey = 'hardcoded-key';
```

### 4. Test APIs Individually
```javascript
// Test each API separately
async function testAllAPIs() {
  const results = {
    supabase: await testSupabase(),
    lytx: await testLYTX(),
    gasbot: await testGasbot()
  };
  
  console.log('API Test Results:', results);
}
```

## 📞 Getting Help

If you're still having issues:

1. **Run the test script**: `node test-api-connections.js`
2. **Check the logs**: Look for specific error messages
3. **Verify credentials**: Test with API documentation
4. **Check network**: Use curl or Postman to test manually
5. **Review code**: Look for syntax or logic errors

## 🎯 Why Claude Can Struggle with APIs

Claude is actually quite good at API integrations, but common issues include:

1. **Environment Setup**: Missing or incorrect environment variables
2. **Authentication**: Complex API auth flows
3. **Rate Limiting**: Not accounting for API limits
4. **CORS**: Browser security policies
5. **Data Format**: API response format mismatches
6. **Network Issues**: Connectivity problems

The key is proper testing and debugging - which is why I created the test script for you! 