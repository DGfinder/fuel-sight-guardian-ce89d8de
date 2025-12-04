// Debug endpoint to test specific LYTX API calls
export default async function handler(req, res) {
  const LYTX_API_KEY = process.env.LYTX_API_KEY || 'diCeZd54DgkVzV2aPumlLG1qcZflO0GS';
  const LYTX_BASE_URL = 'https://lytx-api.prod7.lv.lytx.com';

  const testEndpoints = [
    '/video/safety/events/statuses',
    '/video/safety/events/triggers', 
    '/video/safety/events/behaviors',
    '/vehicles/all?page=1&limit=5',
    '/video/safety/events?page=1&pageSize=5'
  ];

  const results = {};

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  for (const endpoint of testEndpoints) {
    try {
      console.log(`[LYTX Debug] Testing: ${endpoint}`);
      
      const response = await fetch(`${LYTX_BASE_URL}${endpoint}`, {
        headers: {
          'accept': 'application/json',
          'x-apikey': LYTX_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      const text = await response.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }

      results[endpoint] = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        dataType: Array.isArray(data) ? `Array[${data.length}]` : typeof data,
        data: Array.isArray(data) ? data.slice(0, 2) : data, // First 2 items if array
        success: response.ok
      };

      console.log(`[LYTX Debug] ${endpoint}: ${response.status} - ${Array.isArray(data) ? `Array[${data.length}]` : typeof data}`);

    } catch (error) {
      results[endpoint] = {
        error: error.message,
        success: false
      };
      console.error(`[LYTX Debug] ${endpoint} failed:`, error.message);
    }
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    apiKey: `${LYTX_API_KEY.substring(0, 8)}...`,
    baseUrl: LYTX_BASE_URL,
    results
  });
}