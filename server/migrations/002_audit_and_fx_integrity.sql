-- Security hardening: audit trail and atomic paired FX conversions.
-- Apply only after 001_finance_schema.sql to the dedicated wallet database.
CREATE TABLE IF NOT EXISTS finance_audit_log (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS finance_audit_owner_time_idx
  ON finance_audit_log(owner_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit log is immutable';
END;
$$;
DROP TRIGGER IF EXISTS finance_audit_immutable ON finance_audit_log;
CREATE TRIGGER finance_audit_immutable
BEFORE UPDATE OR DELETE ON finance_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE OR REPLACE FUNCTION audit_ledger_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO finance_audit_log(owner_id,event_type,entity_type,entity_id,details)
  VALUES (
    NEW.owner_id,
    'ledger_entry_posted',
    'ledger_entry',
    NEW.id::text,
    jsonb_build_object(
      'entry_type', NEW.entry_type,
      'direction', NEW.direction,
      'amount_minor', NEW.amount_minor,
      'currency', NEW.currency,
      'source', NEW.source,
      'reference', NEW.reference
    )
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ledger_insert_audit ON ledger_entries;
CREATE TRIGGER ledger_insert_audit
AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION audit_ledger_insert();

CREATE OR REPLACE FUNCTION validate_conversion_pair()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pair_count INTEGER;
DECLARE currency_count INTEGER;
DECLARE direction_count INTEGER;
BEGIN
  IF NEW.entry_type <> 'currency_conversion' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(*), COUNT(DISTINCT currency), COUNT(DISTINCT direction)
    INTO pair_count, currency_count, direction_count
    FROM ledger_entries
   WHERE conversion_group_id = NEW.conversion_group_id;
  IF pair_count <> 2 OR currency_count <> 2 OR direction_count <> 2 THEN
    RAISE EXCEPTION 'currency conversion must be posted as exactly two opposite-currency, opposite-direction entries in one transaction';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ledger_conversion_pair_check ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_conversion_pair_check
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_conversion_pair();

-- This log is append-only; record all future administrative actions here.
DROP TRIGGER IF EXISTS finance_audit_immutable ON finance_audit_log;
CREATE TRIGGER finance_audit_immutable
BEFORE UPDATE OR DELETE ON finance_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
