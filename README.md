# PhoneLanka Finance Wallet

Private owner-only finance dashboard for PhoneLanka subscription revenue and business finances.

## Current implementation

- React + Vite dashboard in this repository.
- Supabase Auth email/password sign-in, restricted in the UI to the designated owner account.
- Reads only the isolated `finance_*` tables using the public publishable key.
- Supabase Row Level Security is the real authorization boundary; the designated owner mapping is stored in the private schema.
- Overview, USD/LKR-separated balances, ledger, income, pending settlements, expenses, refunds, withdrawals, reports and audit log views.
- CSV export is generated locally from rows the signed-in owner is allowed to read.
- The browser dashboard is read-only in this first release. It does not insert or update financial records.

## Backend project

The user explicitly selected the existing PhoneLanka Supabase project for this wallet. Finance records are kept in a separate set of `finance_*` tables with their own RLS policies and private owner mapping. The marketplace's seller, shop, phone listing and merchant wallet tables are not queried or modified by this dashboard.

- Project URL: `https://ivacdswettainjderwwz.supabase.co`
- Project reference: `ivacdswettainjderwwz`
- Owner login: `phonelankahub@gmail.com`
- The finance tables are currently empty; balances correctly start at zero.
- No payment provider is connected. PayHere is not live.

## Configure local development

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` to the project URL.
3. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's active publishable key (never use a service-role or secret key in the browser).
4. Run Node.js 20 or later:

```bash
npm install
npm run dev
```

For a GitHub Actions build, add repository Actions variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and map them into the build step. The publishable key is intended for public clients; RLS must remain enabled.

## Financial rules

- Buyers pay sellers directly. PhoneLanka does not collect buyer payments or hold seller funds.
- PhoneLanka collects seller subscription fees only.
- Starter: USD $1 for the first month; one shop; up to 10 phone listings; 2 images per phone.
- Premium: USD $13.50 monthly; one shop; up to 25 phone listings; 4 images per phone; top placement opportunities.
- USD and LKR remain separate. Conversions require a recorded rate, source, timestamp and paired ledger entries.
- Only provider-confirmed settled subscription payments count as received revenue and available balance.
- Pending payments are shown separately.
- Posted ledger entries are immutable. Corrections use compensating entries.
- Webhook processing must be idempotent.
- Withdrawal records are tracking only until an external transfer is confirmed.

## Not production-ready for money movement

This version is a read-only dashboard. No browser-side financial writes are enabled. Trusted server-side functions must be built and tested before enabling expenses, refunds, manual adjustments, FX conversion, payment webhooks or withdrawals. Never expose a service_role key. Never store card numbers, CVV, bank login credentials or provider secrets.

The existing `server/` folder is a legacy standalone API prototype and is not connected to this Supabase-backed dashboard. Do not deploy it against the marketplace database.
