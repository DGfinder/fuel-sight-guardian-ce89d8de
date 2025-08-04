// Test endpoint for LYTX API proxy
export default async function handler(req, res) {
  const LYTX_API_KEY = process.env.LYTX_API_KEY || 'diCeZd54DgkVzV2aPumlLG1qcZflO0GS';
  const LYTX_BASE_URL = 'https://lytx-api.prod7.lv.lytx.com';

  try {
    console.log('[LYTX Test] Testing connection to LYTX API...');
    
    const response = await fetch(`${LYTX_BASE_URL}/video/safety/events/statuses`, {
      headers: {
        'accept': 'application/json',
        'x-apikey': LYTX_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!response.ok) {
      console.error(`[LYTX Test] Error ${response.status}:`, data);
      return res.status(500).json({
        success: false,
        error: `LYTX API Error: ${response.status} ${response.statusText}`,
        details: data,
        apiKey: LYTX_API_KEY ? `${LYTX_API_KEY.substring(0, 8)}...` : 'Missing'
      });
    }

    try {
      const jsonData = JSON.parse(data);
      console.log(`[LYTX Test] Success! Retrieved ${Array.isArray(jsonData) ? jsonData.length : 'unknown'} event statuses`);
      
      res.status(200).json({
        success: true,
        message: `Connected successfully! Retrieved ${Array.isArray(jsonData) ? jsonData.length : 'unknown'} event statuses`,
        data: jsonData,
        apiKey: `${LYTX_API_KEY.substring(0, 8)}...`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      res.status(200).json({
        success: true,
        message: 'Connected successfully (non-JSON response)',
        data: data,
        apiKey: `${LYTX_API_KEY.substring(0, 8)}...`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[LYTX Test] Connection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Connection failed',
      details: error.message,
      apiKey: LYTX_API_KEY ? `${LYTX_API_KEY.substring(0, 8)}...` : 'Missing',
      timestamp: new Date().toISOString()
    });
  }
}