# PhoneLanka Finance API — security foundation

This is a backend starter, not a deployed or independently audited financial service.

## Isolation
Provision a brand-new PostgreSQL database for this wallet. Do not reuse the PhoneLanka marketplace database, Supabase project, credentials, tables, or seller/customer records.

## Owner authentication
There is no public registration endpoint. Configure one owner email and an Argon2id password hash in the backend secret manager. Generate a hash with a trusted Argon2id utility on a secure machine; never store the plaintext password in GitHub. Login is rate-limited, sessions are stored server-side in PostgreSQL, cookies are HttpOnly/Secure/SameSite=Strict, and state-changing auth requests require a session CSRF token.

## Environment
Copy this file's keys from `.env.example` into the backend host's secret manager. Use HTTPS only. Set `APP_ORIGIN` to the exact deployed frontend origin. Configure PostgreSQL TLS. Do not commit real values.

## Database
Apply `migrations/001_finance_schema.sql` to the dedicated empty wallet database. The ledger is append-only at the database layer. Correct mistakes with compensating entries. Amounts are integer minor units. USD and LKR are queried separately; no implicit conversion exists.

## Current API scope
- `GET /api/health`: basic liveness only.
- `GET /api/csrf`: obtains a CSRF token.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- `GET /api/ledger/summary` and `GET /api/ledger/entries` (owner only).
- There is intentionally no ledger-write endpoint or payment webhook until provider verification and authorization rules are implemented and tested.

## Deployment blockers
A secure backend requires an actual server runtime, managed secrets, dedicated PostgreSQL, HTTPS, and a configured owner password hash. GitHub stores source code; GitHub Pages cannot run this API or enforce server-side financial authorization. Do not publish this as a live finance system yet.

## Before accepting money
Implement provider-specific signature verification and idempotent settled-event processing; enforce seller plan and subscription rules; add expense/refund/withdrawal workflows; verify conversion pairs in a database transaction; add integration tests and external security review. Do not claim PayHere or Visa is connected until merchant approval and live credentials are verified.
