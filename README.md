# carrot-web

React + TypeScript storefront for Carrot Cart. It talks only to the gateway public API (`/api/v1`).

## Run

```
cp .env.example .env
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

The dev server proxies `/api` to `GATEWAY_PROXY_TARGET` (default `http://localhost:8080`), so the browser sees one origin and the gateway's cookies work without CORS.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | API prefix used by the browser |
| `GATEWAY_PROXY_TARGET` | `http://localhost:8080` | Dev proxy target (not exposed to the browser) |

## Layout

- `src/lib/api` gateway client, error decoding, DTO types
- `src/features/*` auth, account, catalog, cart, orders, invoices
- `src/components` shared UI pieces
- `src/styles` CSS variables and page styles

## Notes

- The session lives in an HttpOnly cookie. Nothing secret is kept in browser storage; the cart (per organization) is the only thing persisted.
- Checkout sends one `Idempotency-Key` per attempt. It is reused on retries and double clicks, and replaced after a final result or when the cart changes.
- Totals shown after an order is created come from the server. The cart total is a preview.
