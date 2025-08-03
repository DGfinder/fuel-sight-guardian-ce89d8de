import type { NextApiRequest, NextApiResponse } from 'next';

const ATHARA_API_KEY = process.env.VITE_ATHARA_API_KEY || '9PAUTYO9U7VZTXD40T62VNB7KJOZQZ10C8M1';
const ATHARA_BASE_URL = process.env.VITE_ATHARA_BASE_URL || 'https://api.athara.com';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${ATHARA_BASE_URL}/locations`, {
      headers: {
        'Authorization': `Bearer ${ATHARA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `Athara API error: ${response.status} ${response.statusText}`,
        details: errorText 
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from Athara API',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}