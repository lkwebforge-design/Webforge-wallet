import test from "node:test";
import assert from "node:assert/strict";
import { issueCsrfToken, requireCsrf, requireOwner } from "../src/security.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

test("CSRF endpoint creates a high-entropy session token and disables caching", () => {
  const req = { session: {} };
  const res = response();
  issueCsrfToken(req, res);
  assert.equal(typeof req.session.csrfToken, "string");
  assert.ok(req.session.csrfToken.length >= 40);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.body.csrfToken, req.session.csrfToken);
});

test("CSRF middleware rejects missing and incorrect tokens", () => {
  let nextCalled = false;
  const res = response();
  requireCsrf({ session: { csrfToken: "expected" }, get: () => "wrong" }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("CSRF middleware accepts the matching token", () => {
  let nextCalled = false;
  const token = "a-secure-test-token";
  requireCsrf({ session: { csrfToken: token }, get: () => token }, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("owner middleware denies unauthenticated requests", () => {
  const res = response();
  let nextCalled = false;
  requireOwner({ session: {} }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("owner middleware attaches the authenticated owner id", () => {
  const req = { session: { ownerId: "primary-owner" } };
  let nextCalled = false;
  requireOwner(req, response(), () => { nextCalled = true; });
  assert.equal(req.ownerId, "primary-owner");
  assert.equal(nextCalled, true);
});
