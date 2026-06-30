/**
 * Simple in-memory TTL cache for GET API responses.
 *
 * Caches successful (2xx) JSON responses keyed by method + route + query
 * params, so repeated identical requests don't re-hit slow external APIs.
 *
 * Process-local — resets on restart. Not shared across instances (Vercel,
 * PM2 cluster mode). Swap in Redis/Upstash for shared caching at scale.
 *
 * Cache entries are evicted:
 *   - Lazily on read when TTL has expired.
 *   - Eagerly by a periodic sweep (every SWEEP_INTERVAL_MS).
 *   - By LRU-style eviction when MAX_ENTRIES is reached.
 */

const DEFAULT_TTL_MS = parseInt(process.env.CACHE_TTL_MS || "60000", 10); // 1 min
const MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || "500", 10);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

// Map<key, { value, expiresAt, hits }>
const store = new Map();

function buildKey(method, route, query) {
  const sortedQuery = Object.keys(query || {})
    .sort()
    .map((k) => `${k}=${String(query[k])}`)
    .join("&");
  return `${method}:${route}?${sortedQuery}`;
}

function get(method, route, query) {
  const key = buildKey(method, route, query);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  entry.hits = (entry.hits || 0) + 1;
  return entry.value;
}

function set(method, route, query, value, ttlMs = DEFAULT_TTL_MS) {
  // Evict oldest entry when at capacity
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  const key = buildKey(method, route, query);
  store.set(key, { value, expiresAt: Date.now() + ttlMs, hits: 0 });
}

function del(method, route, query) {
  store.delete(buildKey(method, route, query));
}

function clear() {
  store.clear();
}

function stats() {
  const now = Date.now();
  let expired = 0;
  let active = 0;
  let totalHits = 0;
  for (const entry of store.values()) {
    if (now > entry.expiresAt) expired++;
    else {
      active++;
      totalHits += entry.hits || 0;
    }
  }
  return { total: store.size, active, expired, totalHits, maxEntries: MAX_ENTRIES };
}

// Periodic sweep of expired entries to keep memory clean
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, SWEEP_INTERVAL_MS);

// Don't keep the process alive just for the sweep timer
if (sweepTimer.unref) sweepTimer.unref();

export default { get, set, del, clear, stats, DEFAULT_TTL_MS };
