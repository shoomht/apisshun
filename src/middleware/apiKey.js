import crypto from "crypto";
import store from "../utils/store.js";

/**
 * API key management, backed by the unified store (Redis or file).
 *
 * Namespaces used:
 *   apikeys  -> key -> { owner, tier, active, createdAt, rateLimit, requestCount, lastUsedAt }
 *
 * A key record's optional `rateLimit` field enables PER-KEY rate limiting,
 * checked in rateLimiter.js:
 *   rateLimit: { windowMs: number, maxRequests: number }
 * When null/absent, the key falls back to the global IP-based limit.
 *
 * All lookups are async now (the store may be Redis). Endpoint handlers in
 * loader.js await these.
 */

const NS_KEYS = "apikeys";

// Small in-process cache of key records to avoid hitting the store on every
// request. Short TTL so revocations/tier changes propagate quickly.
const recordCache = new Map(); // key -> { record, expiresAt }
const RECORD_TTL_MS = 10_000;

function cacheGet(key) {
  const hit = recordCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.record;
  recordCache.delete(key);
  return undefined;
}
function cacheSet(key, record) {
  recordCache.set(key, { record, expiresAt: Date.now() + RECORD_TTL_MS });
}
function cacheBust(key) {
  recordCache.delete(key);
}

/**
 * Extract API key from request: header `x-api-key`, or `apikey` query/body param.
 */
function extractKey(req) {
  return (
    req.headers?.["x-api-key"] ||
    req.query?.apikey ||
    req.body?.apikey ||
    null
  );
}

/**
 * Returns the key record if the key exists and is active, else null.
 * Cached briefly in-process.
 */
async function getKeyRecord(key) {
  if (!key) return null;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const record = await store.get(NS_KEYS, key);
  const valid = record && record.active !== false ? record : null;
  cacheSet(key, valid);
  return valid;
}

async function isAuthenticated(req) {
  return (await getKeyRecord(extractKey(req))) !== null;
}

async function isPremiumRequest(req) {
  const record = await getKeyRecord(extractKey(req));
  return !!record && record.tier === "premium";
}

/**
 * Returns the per-key rate-limit config if the request's key has one, else null.
 * Used by rateLimiter.js to apply per-key limits.
 */
async function getKeyRateLimit(req) {
  const record = await getKeyRecord(extractKey(req));
  if (record && record.rateLimit && typeof record.rateLimit === "object") {
    return record.rateLimit;
  }
  return null;
}

// --- Usage tracking ----------------------------------------------------------
// Batched in memory, flushed periodically (non-Vercel) or immediately (Vercel,
// where periodic timers aren't reliable).

const pendingUsage = new Map(); // key -> { count, lastUsedAt }
const FLUSH_INTERVAL_MS = 30_000;
const isVercel = !!process.env.VERCEL;

async function recordUsage(key) {
  if (!key) return;
  const entry = pendingUsage.get(key) || { count: 0, lastUsedAt: null };
  entry.count += 1;
  entry.lastUsedAt = new Date().toISOString();
  pendingUsage.set(key, entry);
  if (isVercel) await flushUsage();
}

async function flushUsage() {
  if (pendingUsage.size === 0) return;
  const entries = [...pendingUsage.entries()];
  pendingUsage.clear();
  for (const [key, { count, lastUsedAt }] of entries) {
    const record = await store.get(NS_KEYS, key);
    if (!record) continue; // revoked/removed since
    record.requestCount = (record.requestCount || 0) + count;
    record.lastUsedAt = lastUsedAt;
    await store.set(NS_KEYS, key, record);
    cacheBust(key);
  }
}

if (!isVercel) {
  const t = setInterval(() => {
    flushUsage().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  if (t.unref) t.unref();
}

// --- Key CRUD ----------------------------------------------------------------

function generateKey() {
  return "sk_" + crypto.randomBytes(24).toString("hex");
}

async function addKey(key, { owner = "unknown", tier = "free", rateLimit = null } = {}) {
  const record = {
    owner,
    tier,
    rateLimit,
    createdAt: new Date().toISOString(),
    active: true,
    requestCount: 0,
    lastUsedAt: null,
  };
  await store.set(NS_KEYS, key, record);
  cacheBust(key);
  return record;
}

async function revokeKey(key) {
  const record = await store.get(NS_KEYS, key);
  if (!record) return false;
  record.active = false;
  await store.set(NS_KEYS, key, record);
  cacheBust(key);
  return true;
}

// --- Admin auth + handlers ---------------------------------------------------

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isAdminAuthorized(req) {
  const adminKey = process.env.ADMIN_KEY || null;
  const provided =
    req.headers["x-admin-key"] || req.body?.adminKey || req.query?.adminKey;
  return !!adminKey && !!provided && timingSafeEqual(provided, adminKey);
}

function requireAdminConfigured(res) {
  if (!process.env.ADMIN_KEY) {
    res.status(500).json({ success: false, error: "ADMIN_KEY not configured on server." });
    return false;
  }
  return true;
}

async function adminCreateKeyHandler(req, res) {
  if (!requireAdminConfigured(res)) return;
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized." });
  }

  const { key, owner = "unknown", tier = "free", rateLimit = null } = req.body || {};
  if (tier !== "free" && tier !== "premium") {
    return res.status(400).json({ success: false, error: "tier must be 'free' or 'premium'." });
  }
  if (rateLimit !== null) {
    if (
      typeof rateLimit !== "object" ||
      typeof rateLimit.windowMs !== "number" ||
      typeof rateLimit.maxRequests !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "rateLimit must be null or { windowMs:number, maxRequests:number }.",
      });
    }
  }

  const newKey = key || generateKey();
  const record = await addKey(newKey, { owner, tier, rateLimit });
  return res.json({ success: true, apiKey: newKey, ...record });
}

async function adminRevokeKeyHandler(req, res) {
  if (!requireAdminConfigured(res)) return;
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized." });
  }
  const { key } = req.body || {};
  if (!key) {
    return res.status(400).json({ success: false, error: "Provide key in request body to revoke." });
  }
  const ok = await revokeKey(key);
  if (!ok) return res.status(404).json({ success: false, error: "Key not found." });
  return res.json({ success: true, message: "API key revoked." });
}

async function adminListKeysHandler(req, res) {
  if (!requireAdminConfigured(res)) return;
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: "Unauthorized." });
  }

  await flushUsage(); // make sure stored counts are current
  const keys = await store.getAll(NS_KEYS);
  const result = Object.entries(keys).map(([key, record]) => ({
    key,
    owner: record.owner,
    tier: record.tier,
    active: record.active !== false,
    createdAt: record.createdAt,
    rateLimit: record.rateLimit || null,
    requestCount: record.requestCount || 0,
    lastUsedAt: record.lastUsedAt || null,
  }));

  return res.json({ success: true, backend: store.backendName(), keys: result });
}

/**
 * Middleware: requires a valid API key. Use on routes that should always be gated.
 */
async function requireApiKey(req, res, next) {
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({
      success: false,
      error: "A valid API key is required. Provide it via the 'x-api-key' header or '?apikey=' query parameter.",
    });
  }
  next();
}

export default {
  isAuthenticated,
  isPremiumRequest,
  getKeyRecord,
  getKeyRateLimit,
  extractKey,
  addKey,
  revokeKey,
  requireApiKey,
  recordUsage,
  adminCreateKeyHandler,
  adminRevokeKeyHandler,
  adminListKeysHandler,
};
