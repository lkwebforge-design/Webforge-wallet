import crypto from "node:crypto";
import { rateLimit } from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

export function issueCsrfToken(req, res) {
  if (!req.session) return res.status(500).json({ error: "Session unavailable" });
  const token = crypto.randomBytes(32).toString("base64url");
  req.session.csrfToken = token;
  res.set("Cache-Control", "no-store");
  return res.json({ csrfToken: token });
}

export function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get("x-csrf-token");
  if (!expected || !supplied) return res.status(403).json({ error: "CSRF validation failed" });
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }
  next();
}

export function requireOwner(req, res, next) {
  if (!req.session?.ownerId) return res.status(401).json({ error: "Authentication required" });
  req.ownerId = req.session.ownerId;
  next();
}
