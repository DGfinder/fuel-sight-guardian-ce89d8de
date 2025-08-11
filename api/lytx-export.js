// Vercel serverless function: aggregate LYTX events across many pages for historical analysis
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
      startDate,
      endDate,
      pageSize = 1000,
      maxPages = 100,
      environment = 'prod7',
      location = 'lv',
    } = req.body || {};

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const LYTX_API_KEY = process.env.LYTX_API_KEY || process.env.VITE_LYTX_API_KEY;
    if (!LYTX_API_KEY) {
      return res.status(500).json({ error: 'Missing LYTX API key on server' });
    }

    const BASE_URL = `https://lytx-api.${environment}.${location}.lytx.com`;
    const defaultHeaders = {
      accept: 'application/json',
      'x-apikey': LYTX_API_KEY,
      'Content-Type': 'application/json',
    };

    const aggregate = [];
    let pagesFetched = 0;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(`${BASE_URL}/video/safety/eventsWithMetadata`);
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('includeSubgroups', 'true');

      const resp = await fetch(url.toString(), { headers: defaultHeaders });
      const text = await resp.text();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: `LYTX API Error: ${resp.status} ${resp.statusText}`, details: text });
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(502).json({ error: 'Invalid JSON from LYTX', snippet: text?.slice(0, 300) });
      }

      // Normalize response arrays
      // Prefer detailed lists. Some endpoints return only IDs; we require full items here
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.events)
            ? data.events
            : (Array.isArray(data.items) ? data.items : []);

      if (items.length === 0) {
        break; // no more pages
      }

      aggregate.push(...items);
      pagesFetched++;

      // Safety cap to avoid over-large payloads (~100k when pageSize=1000 and maxPages=100)
      if (aggregate.length >= pageSize * maxPages) {
        break;
      }
    }

    // CORS for local/dev analysis tools
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return res.status(200).json({
      data: aggregate,
      pageCount: pagesFetched,
      total: aggregate.length,
      startDate,
      endDate,
    });
  } catch (e) {
    console.error('[lytx-export] failed:', e);
    return res.status(500).json({ error: 'Export failed', details: e.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

