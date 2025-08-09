# Lytx VIDEO API - Simple HTML/JSON Tester

This sandbox lets you call the Lytx VIDEO API quickly with a static HTML page and (optional) local proxy to avoid CORS and keep your API key out of browser network logs.

## Quick start

1) Open a terminal in `sandbox/lytx-api-tests` and install deps:

```sh
npm install
```

2) Run the proxy (recommended):

```sh
npm run start-proxy
```

This starts `http://localhost:5717` forwarding to `https://lytx-api.prod7.lv.lytx.com/video` and injects your `X-APIKey`.

3) Open `index.html` in your browser (no server required). Check "Use local proxy" and paste your API key.

4) Click a template chip (e.g., `/safety/events`) and Send.

## Without proxy

If your API origin allows direct calls from a file:// page, you can uncheck "Use local proxy" and the page will send `X-APIKey` directly to the API. Most pods will block this with CORS, so prefer the proxy.

## Security notes

- The API key you enter is used only in-memory by the page and not saved.
- When using the proxy, the key is sent to `http://localhost:5717` as header `x-apikey` and forwarded as `X-APIKey` to Lytx.

## Customizing

- Change base URL via the UI or set `LYTX_BASE` env var for the proxy.
- Proxy port defaults to `5717` (override via `PORT`).

