// Vercel serverless function to proxy LYTX API requests
// This bypasses CORS issues by making requests server-side

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, method = 'GET', headers = {}, body } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  const LYTX_API_KEY = process.env.LYTX_API_KEY || 'diCeZd54DgkVzV2aPumlLG1qcZflO0GS';
  const LYTX_BASE_URL = 'https://lytx-api.prod7.lv.lytx.com';

  try {
    const url = `${LYTX_BASE_URL}${endpoint}`;
    
    const proxyHeaders = {
      'accept': 'application/json',
      'x-apikey': LYTX_API_KEY,
      'Content-Type': 'application/json',
      ...headers
    };

    console.log(`[LYTX Proxy] ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers: proxyHeaders,
      ...(body && { body: JSON.stringify(body) })
    });

    const data = await response.text();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (!response.ok) {
      console.error(`[LYTX Proxy] Error ${response.status}:`, data);
      return res.status(response.status).json({ 
        error: `LYTX API Error: ${response.status} ${response.statusText}`,
        details: data
      });
    }

    try {
      const jsonData = JSON.parse(data);
      console.log(`[LYTX Proxy] Success response for ${endpoint}:`, typeof jsonData, Array.isArray(jsonData) ? `Array[${jsonData.length}]` : 'Object');
      res.status(200).json(jsonData);
    } catch (e) {
      console.log(`[LYTX Proxy] Non-JSON response for ${endpoint}:`, data.substring(0, 200));
      // If not JSON, return as text
      res.status(200).send(data);
    }

  } catch (error) {
    console.error('[LYTX Proxy] Request failed:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      details: error.message 
    });
  }
}

// Handle preflight OPTIONS requests
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}