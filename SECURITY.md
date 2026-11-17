# Security policy — PhoneLanka Finance Wallet

This repository is intended to contain only source code and public configuration.

## Never commit
- API keys, access tokens, passwords, private keys, payment-provider secrets
- Database service-role keys or privileged credentials
- Real customer, seller, bank, or transaction records
- Card numbers, CVV values, bank login credentials, or session cookies

Use server-side environment variables for secrets. Keep local environment files out of Git and use placeholders only in `.env.example`.

## Financial safety requirements
- This frontend must not be treated as a financial ledger or source of truth.
- No real balance or payment may be shown unless confirmed by a trusted backend.
- Buyers pay sellers directly; PhoneLanka only receives seller subscription fees.
- USD and LKR must remain separate. Never silently convert or combine them.
- Posted ledger entries must be append-only; corrections require compensating entries.
- Webhook processing must be authenticated and idempotent.
- Withdrawals are tracking records until externally confirmed.

## Before public release
1. Review every tracked file and the complete Git history for secrets and private data.
2. Configure owner-only authentication and server-side authorization.
3. Keep the database and privileged API operations on a secure backend.
4. Run dependency, code, and security checks.
5. Confirm that the public frontend contains no sensitive information.

Report suspected vulnerabilities privately to the repository owner. Do not publish exploit details.
