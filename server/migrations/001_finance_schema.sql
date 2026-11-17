-- Dedicated PhoneLanka Finance database only. Never run against marketplace data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('subscription_income','expense','refund','withdrawal','currency_conversion','adjustment')),
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD','LKR')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 240),
  reference TEXT,
  source TEXT NOT NULL CHECK (source IN ('provider','manual_owner','conversion','system')),
  provider_event_id TEXT UNIQUE,
  conversion_group_id UUID,
  exchange_rate NUMERIC(20,10),
  exchange_rate_source TEXT,
  exchange_rate_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (entry_type = 'currency_conversion' AND conversion_group_id IS NOT NULL
      AND exchange_rate IS NOT NULL AND exchange_rate > 0
      AND exchange_rate_source IS NOT NULL AND exchange_rate_at IS NOT NULL)
    OR
    (entry_type <> 'currency_conversion' AND conversion_group_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS ledger_owner_currency_time_idx
  ON ledger_entries(owner_id, currency, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ledger_conversion_group_idx
  ON ledger_entries(conversion_group_id) WHERE conversion_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are immutable; append a compensating entry';
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- Provider event IDs are unique so a settled webhook cannot be credited twice.
CREATE TABLE IF NOT EXISTS processed_provider_events (
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted','ignored')),
  PRIMARY KEY(provider, provider_event_id)
);

-- Do not create sample owners, balances, payments, or transactions.
