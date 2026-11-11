# AGENT.md - carrot-web

Instructions for coding agents and automated reviewers working in this repository.

## What this is

The customer storefront for Carrot Cart, a wholesale carrot business. Buyers sign in, browse business-specific prices and availability, build a cart, check out, and read their orders and invoices. It talks only to `carrot-gateway`; it never calls an internal service.

## Stack and layout

React 18, TypeScript (strict), Vite, react-router, vitest.

- `src/app/` routes, layout, protected routes
- `src/features/{auth,account,catalog,cart,orders,invoices}/` one folder per feature: pages, hooks, pure logic modules, tests
- `src/components/` shared UI (buttons, banners, status badges, money display)
- `src/lib/api/` the typed gateway client, DTO types (`types.ts`) and endpoint functions
- `src/lib/money.ts` money helpers; `src/styles/` plain CSS with CSS variables

Config: `VITE_API_BASE_URL` (default `/api/v1`), `GATEWAY_PROXY_TARGET` for the dev proxy. The app is expected to be served same-origin with the gateway.

## Contract with the gateway

- DTOs in `src/lib/api/types.ts` mirror the gateway's public API exactly: snake_case fields, money as `{ amount_minor, currency }`, quantities as whole `quantity_kg`.
- Errors arrive in the envelope `{ error: { code, message, request_id, details } }`. Branch on `code`, never on message text.
- Do not add a call or field the gateway does not already expose. If a feature needs one, it belongs in a gateway change first.

## Invariants to protect

Flag changes that break any of these:

1. **No bearer tokens in browser storage.** Auth is an HttpOnly session cookie set by the gateway. `localStorage` is only for the cart and the selected organization id.
2. **CSRF.** Every non-GET request sends `X-CSRF-Token` from the gateway's csrf endpoint. Requests use `credentials: 'include'`, and send `X-Organization-Id` once known.
3. **The server is authoritative for money.** Cart totals are a preview of `unit_price x quantity`; order totals and line items shown after checkout come from the server response. Money stays in integer minor units; never use floating-point arithmetic for amounts.
4. **Checkout is idempotent.** One `Idempotency-Key` per checkout attempt, kept across retries and double clicks, regenerated only after a terminal result or a cart edit. The submit control is disabled while a request is in flight.
5. **Every checkout outcome is handled:** 201/200 success, 202 `payment_pending`, 402 `payment_declined`, 409 `insufficient_stock` (show per-product availability), 409 `idempotency_conflict`, 401 session expiry, network and 5xx errors.
6. **Role-gated controls.** Cancel and "check payment status" are admin-only and only shown for the statuses where they apply. No simulation or payment-outcome controls exist anywhere in the UI.
7. **Safe rendering and exports.** No `dangerouslySetInnerHTML`. Anything exported (for example CSV) must quote per RFC 4180 and neutralize spreadsheet formulas (cells starting with `=`, `+`, `-`, `@`).
8. **Accessibility.** Inputs have labels, status changes are announced, interactive elements are keyboard reachable, tables use real table semantics.

## Conventions

- Feature-first folders; keep pure logic in plain `.ts` modules next to the component so it can be tested without rendering.
- Shared UI goes in `src/components/`; new styles go next to the feature in their own CSS file rather than growing `src/styles/index.css`.
- Strict TypeScript: no `any`, no unused locals or imports, type-only imports where possible.
- Comments only for non-obvious decisions.

## Tests

vitest, `*.test.ts` files in a node environment (no DOM). Test pure logic and API-client behavior; render components with `renderToStaticMarkup` where needed. Tests must assert real behavior; never encode a bug as expected.

## Review focus

Prioritize correctness, security and contract compatibility over style. Useful questions: does this still match the gateway contract? Can a user double-submit? Can stale or other-organization data show up? Is a state (loading, empty, error, expired session) missing?
