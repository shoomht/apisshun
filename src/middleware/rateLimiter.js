import 'dotenv/config';
import store from "../utils/store.js";
import apiKey from "./apiKey.js";

/**
 * Rate limiter with two layers:
 *
 *   1. PER-KEY limit  — if the request carries an API key that defines its own
 *                       { windowMs, maxRequests }, that limit applies (tracked
 *                       per key). Lets you sell/grant higher quotas per key.
 *   2. GLOBAL IP limit — otherwise, the default IP-based sliding window applies.
 *
 * Exceeding a limit bans the IP. Bans are persisted via the store (Redis or
 * file), so they survive restarts and — with Redis — are shared across
 * instances. The sliding-window request counters stay in-memory (hot path,
 * cheap to lose on restart).
 */

const WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || "10000", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_MAX_REQUESTS || "25", 10);
const BAN_DURATION_MS = parseInt(process.env.BAN_DURATION_MS || "0", 10); // 0 = permanent

const NS_BANS = "bans";

// In-memory sliding-window counters. Key is either "ip:<ip>" or "key:<apikey>".
const windows = new Map();

// In-memory mirror of bans for fast synchronous checks on the hot path;
// authoritative copy lives in the store. Loaded at startup, kept in sync on writes.
const banCache = new Map(); // ip -> { bannedAt, reason, expiresAt|null }

(async function loadBans() {
  try {
    const all = await store.getAll(NS_BANS);
    for (const [ip, info] of Object.entries(all)) banCache.set(ip, info);
  } catch {
    /* store not ready yet; bans load lazily on first write/read */
  }
})();

// Cleanup expired window entries and expired bans periodically.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of windows.entries()) {
    const filtered = arr.filter((t) => now - t <= WINDOW_MS);
    if (filtered.length === 0) windows.delete(k);
    else windows.set(k, filtered);
  }
  for (const [ip, info] of banCache.entries()) {
    if (info.expiresAt && now >= info.expiresAt) {
      banCache.delete(ip);
      store.del(NS_BANS, ip).catch(() => {});
    }
  }
}, 60_000);
if (cleanupTimer.unref) cleanupTimer.unref();

function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

async function banIp(ip, reason = "rate_limit_exceeded") {
  const now = Date.now();
  const info = {
    bannedAt: new Date(now).toISOString(),
    reason,
    by: "rateLimiter",
    expiresAt: BAN_DURATION_MS > 0 ? now + BAN_DURATION_MS : null,
  };
  banCache.set(ip, info);
  await store.set(NS_BANS, ip, info).catch(() => {});
  console.log(`[BAN] ${info.bannedAt} ${ip} reason=${reason}`);
}

async function unbanIp(ip) {
  const had = banCache.delete(ip);
  await store.del(NS_BANS, ip).catch(() => {});
  if (had) console.log(`[UNBAN] ${new Date().toISOString()} ${ip}`);
  return had;
}

function slidingHit(counterKey, windowMs, maxReq) {
  const now = Date.now();
  const arr = windows.get(counterKey) || [];
  arr.push(now);
  const recent = arr.filter((t) => now - t <= windowMs);
  windows.set(counterKey, recent);
  return recent.length > maxReq;
}

/**
 * Returns true if `counterKey` has exceeded `maxReq` within `windowMs`.
 *
 * Prefers a shared atomic counter via the store (Redis) so the limit holds
 * across instances/cold starts. When the store has no atomic counter (file
 * backend), falls back to the per-process in-memory sliding window — same
 * behavior as before, no disk thrash.
 */
async function hit(counterKey, windowMs, maxReq) {
  try {
    const count = await store.incrWindow("ratelimit", counterKey, windowMs);
    if (typeof count === "number") return count > maxReq;
  } catch {
    /* store error — fall back to in-memory */
  }
  return slidingHit(counterKey, windowMs, maxReq);
}

async function rateLimiterMiddleware(req, res, next) {
  const ip = getClientIp(req);

  // Ban check (in-memory mirror; authoritative copy in store)
  const ban = banCache.get(ip);
  if (ban) {
    if (ban.expiresAt && Date.now() >= ban.expiresAt) {
      await unbanIp(ip);
    } else {
      return res.status(403).json({
        success: false,
        error: "Your IP has been blocked due to abuse or rate limit violations.",
        note: "Contact the owner to request unblocking.",
        bannedAt: ban.bannedAt,
        reason: ban.reason,
      });
    }
  }

  // Per-key limit takes precedence if the key defines one.
  const keyLimit = await apiKey.getKeyRateLimit(req);
  if (keyLimit) {
    const k = apiKey.extractKey(req);
    const exceeded = await hit(
      `key:${k}`,
      keyLimit.windowMs,
      keyLimit.maxRequests
    );
    if (exceeded) {
      return res.status(429).json({
        success: false,
        error: `Per-key rate limit exceeded. Limit: ${keyLimit.maxRequests} requests per ${keyLimit.windowMs / 1000}s.`,
        scope: "api-key",
      });
    }
    return next(); // key-limited requests bypass the stricter global IP ban
  }

  // Global IP limit
  const exceeded = await hit(`ip:${ip}`, WINDOW_MS, MAX_REQUESTS);
  if (exceeded) {
    await banIp(ip, `exceeded_${MAX_REQUESTS}_per_${WINDOW_MS}ms`);
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded — your IP has been blocked. Limit: ${MAX_REQUESTS} requests per ${WINDOW_MS / 1000}s.`,
      note: "Contact the owner to request unblocking.",
    });
  }

  next();
}

async function adminUnbanHandler(req, res) {
  const adminKey = process.env.ADMIN_KEY || null;
  const provided =
    req.headers["x-admin-key"] || req.body?.adminKey || req.query?.adminKey;

  if (!adminKey)
    return res.status(500).json({ success: false, error: "ADMIN_KEY not configured on server." });
  if (!provided || provided !== adminKey)
    return res.status(401).json({ success: false, error: "Unauthorized." });

  const { ip } = req.body;
  if (!ip)
    return res.status(400).json({ success: false, error: "Provide ip in request body to unban." });

  const ok = await unbanIp(ip);
  if (ok) return res.json({ success: true, message: `IP ${ip} unbanned.` });
  return res.status(404).json({ success: false, error: `IP ${ip} not found in ban list.` });
}

function getBannedList() {
  return Object.fromEntries(banCache);
}

function getStats() {
  return {
    activeCounters: windows.size,
    bannedCount: banCache.size,
    windowMs: WINDOW_MS,
    maxRequests: MAX_REQUESTS,
    banDurationMs: BAN_DURATION_MS,
    backend: store.backendName(),
  };
}

export default {
  middleware: rateLimiterMiddleware,
  adminUnbanHandler,
  getBannedList,
  getStats,
  banIp,
  unbanIp,
};
