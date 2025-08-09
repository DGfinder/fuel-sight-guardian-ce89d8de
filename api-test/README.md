# API Testing Interface

A simple, standalone testing interface for Fuel Sight Guardian APIs. This tool strips away all complexity to provide direct, bare-bones API testing capabilities.

## 🎯 Purpose

This testing interface was created to solve the problem of complex API debugging in the main application. When APIs aren't working, it's often impossible to determine if the issue is with:

- API configuration
- Network connectivity
- Authentication
- Data format changes
- API availability

vs issues with:

- React framework layers
- Complex state management
- Caching systems
- Authentication middleware
- Data transformation layers
- Error handling abstraction

## 🚀 Quick Start

1. **Open the interface**: Simply open `index.html` in your web browser
2. **No build process required**: Works directly with HTML/JS
3. **Start testing**: Click any test button to begin

## 📁 File Structure

```
api-test/
├── index.html          # Main testing interface
├── css/
│   └── style.css        # Simple styling
├── js/
│   ├── utils.js         # Utility functions
│   ├── config.js        # API configuration
│   ├── supabase-test.js # Supabase API tests
│   ├── athara-test.js   # Athara/Gasbot API tests
│   ├── lytx-test.js     # Lytx Video API tests
│   └── main.js          # Main interface logic
└── README.md            # This file
```

## 🧪 Available Tests

### Environment Configuration
- **Validate Environment**: Check all API keys and configurations
- **Show Config**: Display masked configuration details

### Supabase Database API
- **Test Connection**: Basic connectivity test
- **Test Auth**: Authentication with anon and service keys
- **Test Query**: Query common tables (vehicles, fuel_tanks, guardian_events)
- **Test All Supabase**: Run all Supabase tests

### Athara/Gasbot API
- **Test Connection**: Basic connectivity test
- **Test Auth**: API key authentication test
- **Fetch Locations**: Get locations data from Athara
- **Test All Athara**: Run all Athara tests

### Lytx Video API
- **Test Connection**: Basic connectivity test
- **Test Auth**: API key authentication test
- **Test Endpoints**: Test various Lytx endpoints
- **Test All Lytx**: Run all Lytx tests

### Bulk Testing
- **🧪 Test All APIs**: Run comprehensive test suite
- **❤️ Health Check**: Quick connectivity check for all APIs
- **⚡ Performance Test**: Measure response times and reliability

## 🔧 Configuration

The API configuration is stored in `js/config.js`. For security reasons in this simple testing interface, the API keys are hardcoded. In production, these should come from environment variables.

### Current APIs Configured:

1. **Supabase**
   - URL: `https://wjzsdsvbtapriiuxzmih.supabase.co`
   - Anon Key: Configured
   - Service Key: Configured

2. **Athara/Gasbot**
   - URL: `https://dashboard2-production.prod.gasbot.io`
   - API Key: Configured
   - API Secret: Configured
   - Alternative credentials: Available for fallback

3. **Lytx Video API**
   - URL: `https://lytx-api.prod7.lv.lytx.com`
   - API Key: Configured

## 📊 Understanding Results

### Result Indicators
- ✅ **Success**: API responded correctly
- ❌ **Failed**: API request failed
- ⚠️ **Warning**: Partial success or issues detected
- 🔵 **Info**: Informational status

### Response Information
Each test shows:
- **Response Time**: How long the request took (in milliseconds)
- **HTTP Status**: Response status code
- **Response Data**: Raw API response (expandable)
- **Error Details**: Error messages if the request failed

### API Status
Each API section shows a status indicator:
- ⚪ **Not tested**: No tests run yet
- ✅ **Online**: Last test successful
- ❌ **Failed**: Last test failed

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Some APIs may block cross-origin requests from browsers
   - This is expected and indicates the API is working but has security restrictions
   - The main application handles this with proper server-side requests

2. **Authentication Failures**
   - Check if API keys are correct and not expired
   - Verify the API key format matches what the API expects
   - Some APIs require specific headers or authentication methods

3. **Network Errors**
   - Check internet connectivity
   - Verify API URLs are correct and accessible
   - Some corporate networks may block certain API endpoints

4. **Rate Limiting**
   - APIs may limit the number of requests per minute/hour
   - Wait before retrying tests
   - Consider using the health check instead of full test suites

### Debugging Steps

1. **Start with Environment Validation**
   - Click "Validate Environment" to check configuration
   - Ensure all required API keys are present

2. **Test Connectivity First**
   - Use individual "Test Connection" buttons
   - This tests basic network connectivity

3. **Check Authentication**
   - Use "Test Auth" buttons to verify API keys
   - Authentication failures indicate configuration issues

4. **Use Browser Developer Tools**
   - Open browser DevTools (F12)
   - Check Console tab for detailed error messages
   - Check Network tab to see actual HTTP requests

## 📈 Performance Metrics

The performance test runs each API test 3 times and calculates:

- **Average Response Time**: Mean response time across all tests
- **Min/Max Response Time**: Fastest and slowest response times
- **Success Rate**: Percentage of successful requests
- **Reliability Rating**: Overall reliability assessment

## 💾 Exporting Results

Click "Export Results" to download a JSON file containing:
- All test results with timestamps
- Response times and success rates
- Error details and API responses
- Summary statistics

## 🔒 Security Notes

- API keys are visible in the configuration file
- This is acceptable for development/testing but not for production
- The interface runs entirely in the browser
- No data is sent to external services except the APIs being tested

## 🛠️ Extending the Interface

To add tests for new APIs:

1. **Create a new test file** (e.g., `js/newapi-test.js`)
2. **Add configuration** to `js/config.js`
3. **Add UI elements** to `index.html`
4. **Wire up event listeners** in `js/main.js`

Follow the existing patterns in the other test files.

## 🚨 Limitations

- **CORS Limitations**: Some APIs may not work from browsers due to CORS policies
- **Authentication Methods**: Only supports header-based API key authentication
- **Simple HTTP**: Only supports basic HTTP GET/POST requests
- **No WebSocket Testing**: Realtime features require more complex testing
- **Browser-Only**: Doesn't test server-side API calls

## 📞 Getting Help

If APIs are failing in this simple interface:

1. **Check the main application logs** for comparison
2. **Use browser developer tools** for detailed error information
3. **Try the tests in different browsers** to rule out browser-specific issues
4. **Test from different networks** to rule out network restrictions

This interface is designed to isolate API issues from application complexity. If APIs work here but fail in the main application, the issue is likely in the application layers, not the APIs themselves.