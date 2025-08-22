/*
  Minimal proxy to call Lytx VIDEO API while avoiding browser CORS and keeping the API key out of URL logs.
  Usage:
    - set LYTX_BASE (default: https://lytx-api.prod7.lv.lytx.com/video)
    - set PORT (default: 5717)
    - run: node proxy.js
  Requests:
    - Forward any GET path to LYTX_BASE with same path and query
    - Read API key from header 'x-apikey' (lowercase) from the client page and forward it as 'X-APIKey'
*/
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5717;
const LYTX_BASE = (process.env.LYTX_BASE || 'https://lytx-api.prod7.lv.lytx.com/video').replace(/\/$/, '');

app.use(cors());

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('*', async (req, res) => {
  try {
    const apiKey = req.header('x-apikey') || '';
    if (!apiKey) {
      res.status(400).json({ error: 'Missing x-apikey header' });
      return;
    }
    const search = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const targetUrl = `${LYTX_BASE}${req.path}${search}`;
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-APIKey': apiKey },
    });

    res.status(upstream.status);
    // forward content-type; default to application/json if present
    const ct = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('content-type', ct);
    const body = await upstream.buffer();
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', detail: String(err) });
  }
});

app.listen(PORT, () => {
   
  console.log(`Lytx proxy listening on http://localhost:${PORT} -> ${LYTX_BASE}`);
});

