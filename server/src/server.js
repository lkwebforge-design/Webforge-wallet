import "node:process";
import { randomBytes } from "node:crypto";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import argon2 from "argon2";
import pg from "pg";
import { z } from "zod";
import { loginLimiter, issueCsrfToken, requireCsrf, requireOwner } from "./security.js";

const required = ["DATABASE_URL", "SESSION_SECRET", "OWNER_EMAIL", "OWNER_PASSWORD_HASH", "APP_ORIGIN"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});
const app = express();
const PgSession = connectPgSimple(session);
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], baseUri: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"] } } }));
app.use(cors({ origin: process.env.APP_ORIGIN, credentials: true, methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "X-CSRF-Token"] }));
app.use(express.json({ limit: "16kb", strict: true }));
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.get("origin") !== process.env.APP_ORIGIN) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
});
app.use(session({
  name: "__Host-pl_finance",
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 30 * 60 * 1000 }
}));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/csrf", issueCsrfToken);

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256)
}).strict();

app.post("/api/auth/login", loginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid login details" });
    const email = parsed.data.email.trim().toLowerCase();
    const expectedEmail = process.env.OWNER_EMAIL.trim().toLowerCase();
    const valid = email === expectedEmail && await argon2.verify(process.env.OWNER_PASSWORD_HASH, parsed.data.password).catch(() => false);
    if (!valid) return res.status(401).json({ error: "Invalid login details" });
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.ownerId = "primary-owner";
    req.session.csrfToken = cryptoRandomToken();
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.set("Cache-Control", "no-store");
    res.json({ authenticated: true, csrfToken: req.session.csrfToken });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireOwner, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: true, owner: true });
});

app.post("/api/auth/logout", requireOwner, requireCsrf, async (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie("__Host-pl_finance", { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    res.status(204).end();
  });
});

app.get("/api/ledger/summary", requireOwner, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT currency,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE -amount_minor END), 0)::text AS balance_minor
       FROM ledger_entries WHERE owner_id = $1 GROUP BY currency ORDER BY currency`,
      [req.ownerId]
    );
    res.set("Cache-Control", "no-store");
    res.json({ balances: result.rows });
  } catch (error) { next(error); }
});

app.get("/api/ledger/entries", requireOwner, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, occurred_at, entry_type, direction, amount_minor, currency, description, reference
       FROM ledger_entries WHERE owner_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT 200`,
      [req.ownerId]
    );
    res.set("Cache-Control", "no-store");
    res.json({ entries: result.rows });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  // Never return database errors, stack traces, or secrets to clients.
  console.error("Request failed:", error?.name || "Error");
  res.status(500).json({ error: "Internal server error" });
});

function cryptoRandomToken() {
  return randomBytes(32).toString("base64url");
}

const port = Number(process.env.PORT || 8787);
const server = app.listen(port, () => console.log(`PhoneLanka Finance API listening on ${port}`));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
}
