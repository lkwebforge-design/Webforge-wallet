# Production security checklist

**Current status: NOT PRODUCTION READY.** Passing CI does not mean the live service is deployed or independently audited.

## Infrastructure
- [ ] Create a brand-new PostgreSQL database for PhoneLanka Finance only.
- [ ] Never reuse the marketplace Supabase project or its credentials/data.
- [ ] Require PostgreSQL TLS, private network access, automated backups, and tested restore.
- [ ] Deploy the API to a persistent Node.js server over HTTPS.
- [ ] Configure exact APP_ORIGIN and trusted proxy settings.

## Owner access
- [ ] Set OWNER_EMAIL in the host secret manager.
- [ ] Generate an Argon2id password hash locally using a trusted utility; never send plaintext password in chat or commit it.
- [ ] Generate a cryptographically random SESSION_SECRET of at least 32 bytes and store it in the host secret manager.
- [ ] Verify login rate limiting, session rotation, expiry, logout, CSRF and origin checks on the deployed HTTPS domain.
- [ ] Configure database session-table access with least privilege.

## Database and ledger
- [ ] Apply migrations 001 and 002 to the new empty finance database.
- [ ] Use separate database roles for migrations and runtime; runtime role must not own tables or have permission to disable triggers.
- [ ] Verify ledger UPDATE/DELETE is denied for runtime role.
- [ ] Verify audit log UPDATE/DELETE is denied for runtime role.
- [ ] Verify conversion entries must be exactly two opposite-direction entries in different currencies in one transaction.
- [ ] Test duplicate provider event IDs under concurrent requests.
- [ ] Test zero balances and no seeded sample transactions.

## Payments
- [ ] Confirm merchant approval with chosen provider.
- [ ] Obtain provider's official webhook signing specification and live credentials.
- [ ] Implement signature verification against raw request bytes, timestamp/replay controls, and idempotent settled-only crediting.
- [ ] Test invalid signatures, duplicate events, pending events, failed payments, refunds and out-of-order events.
- [ ] Do not store card PAN, CVV, bank passwords or provider secrets.

## Release
- [ ] Complete integration tests against a disposable PostgreSQL instance.
- [ ] Run dependency/security scans and an independent security review.
- [ ] Verify frontend is wired only to the secured API and never reads/writes finance data directly.
- [ ] Verify no secrets, personal financial data or payment payloads leak into logs.
- [ ] Keep repository private until the review is complete.

A green GitHub Actions build is not a production security certification. PayHere/Visa are not live until merchant verification, provider-specific webhook implementation and live end-to-end tests are complete.
