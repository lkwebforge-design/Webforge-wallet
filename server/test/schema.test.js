import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../migrations/001_finance_schema.sql", import.meta.url), "utf8");
const hardening = await readFile(new URL("../migrations/002_audit_and_fx_integrity.sql", import.meta.url), "utf8");

test("ledger stores only supported separate currencies and positive minor units", () => {
  assert.match(schema, /amount_minor BIGINT NOT NULL CHECK \(amount_minor > 0\)/);
  assert.match(schema, /currency CHAR\(3\) NOT NULL CHECK \(currency IN \('USD','LKR'\)\)/);
});

test("ledger rejects update and delete mutations", () => {
  assert.match(schema, /BEFORE UPDATE OR DELETE ON ledger_entries/);
  assert.match(schema, /ledger entries are immutable/);
});

test("provider event IDs are unique for idempotency", () => {
  assert.match(schema, /provider_event_id TEXT UNIQUE/);
  assert.match(schema, /PRIMARY KEY\(provider, provider_event_id\)/);
});

test("audit log is append-only and records ledger inserts", () => {
  assert.match(hardening, /BEFORE UPDATE OR DELETE ON finance_audit_log/);
  assert.match(hardening, /AFTER INSERT ON ledger_entries/);
});

test("currency conversions require paired entries in one transaction", () => {
  assert.match(hardening, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(hardening, /pair_count <> 2 OR currency_count <> 2 OR direction_count <> 2/);
});
