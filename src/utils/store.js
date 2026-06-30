import fs from "fs";
import path from "path";
import os from "os";
import logger from "./logger.js";

/**
 * Unified key-value store with two backends, chosen automatically:
 *
 *   1. Redis  — used when REDIS_URL is set. Survives restarts, shared across
 *               instances (Vercel, PM2 cluster, multiple containers).
 *   2. File   — JSON file on disk. Used when REDIS_URL is absent. Survives
 *               restarts on a persistent host, but NOT shared across instances
 *               and NOT reliably persistent on Vercel (writes go to /tmp).
 *
 * The interface is intentionally tiny and async-only so callers don't care
 * which backend is active:
 *
 *   await store.get(namespace, key)            -> value | null
 *   await store.set(namespace, key, value)     -> void
 *   await store.del(namespace, key)            -> void
 *   await store.getAll(namespace)              -> { [key]: value }
 *   await store.incr(namespace, key, by?)      -> number (new value)
 *
 * "namespace" maps to a logical collection (apikeys, bans, usage, ...).
 * Values are JSON-serializable.
 *
 * Redis is loaded dynamically (optional dependency). If REDIS_URL is set but
 * the 'redis' package isn't installed or can't connect, we log a clear error
 * and fall back to the file backend rather than crashing the whole API.
 */

const REDIS_URL = process.env.REDIS_URL || null;
const isVercel = !!process.env.VERCEL;

// ─── File backend ────────────────────────────────────────────────────────────

const SEED_DIR = path.join(process.cwd(), "src", "data");
// On Vercel only /tmp is writable. Locally, write next to the seed files.
const WRITE_DIR = isVercel ? os.tmpdir() : SEED_DIR;

function filePathFor(namespace, dir) {
  return path.join(dir, `${namespace}.json`);
}

function readFileNamespace(namespace) {
  // Prefer the writable copy (has latest changes); fall back to bundled seed.
  for (const dir of [WRITE_DIR, SEED_DIR]) {
    try {
      const raw = fs.readFileSync(filePathFor(namespace, dir), "utf8");
      return JSON.parse(raw);
    } catch (e) {
      if (e.code !== "ENOENT") {
        logger.error(`[store] read ${namespace} from ${dir}: ${e.message}`);
      }
    }
  }
  return {};
}

function writeFileNamespace(namespace, data) {
  try {
    fs.mkdirSync(WRITE_DIR, { recursive: true });
    fs.writeFileSync(
      filePathFor(namespace, WRITE_DIR),
      JSON.stringify(data, null, 2),
      "utf8"
    );
    return true;
  } catch (e) {
    logger.error(`[store] write ${namespace}: ${e.message}`);
    return false;
  }
}

const fileBackend = {
  name: "file",
  async get(namespace, key) {
    const data = readFileNamespace(namespace);
    return key in data ? data[key] : null;
  },
  async set(namespace, key, value) {
    const data = readFileNamespace(namespace);
    data[key] = value;
    writeFileNamespace(namespace, data);
  },
  async del(namespace, key) {
    const data = readFileNamespace(namespace);
    if (key in data) {
      delete data[key];
      writeFileNamespace(namespace, data);
    }
  },
  async getAll(namespace) {
    return readFileNamespace(namespace);
  },
  async incr(namespace, key, by = 1) {
    const data = readFileNamespace(namespace);
    const next = (Number(data[key]) || 0) + by;
    data[key] = next;
    writeFileNamespace(namespace, data);
    return next;
  },
};

// ─── Redis backend ───────────────────────────────────────────────────────────

function redisKey(namespace, key) {
  return `shunapis:${namespace}:${key}`;
}
function redisPattern(namespace) {
  return `shunapis:${namespace}:*`;
}

async function createRedisBackend() {
  let createClient;
  try {
    ({ createClient } = await import("redis"));
  } catch {
    logger.warn(
      "[store] REDIS_URL is set but the 'redis' package isn't installed. " +
        "Run `npm i redis`. Falling back to file storage."
    );
    return null;
  }

  const client = createClient({ url: REDIS_URL });
  client.on("error", (err) => logger.error(`[store] redis: ${err.message}`));

  try {
    await client.connect();
    logger.ready("[store] Connected to Redis.");
  } catch (e) {
    logger.error(`[store] Redis connect failed: ${e.message}. Falling back to file storage.`);
    return null;
  }

  return {
    name: "redis",
    async get(namespace, key) {
      const raw = await client.get(redisKey(namespace, key));
      return raw == null ? null : JSON.parse(raw);
    },
    async set(namespace, key, value) {
      await client.set(redisKey(namespace, key), JSON.stringify(value));
    },
    async del(namespace, key) {
      await client.del(redisKey(namespace, key));
    },
    async getAll(namespace) {
      const result = {};
      const prefix = `shunapis:${namespace}:`;
      for await (const k of client.scanIterator({ MATCH: redisPattern(namespace), COUNT: 200 })) {
        const raw = await client.get(k);
        if (raw != null) result[k.slice(prefix.length)] = JSON.parse(raw);
      }
      return result;
    },
    async incr(namespace, key, by = 1) {
      return client.incrBy(redisKey(namespace, key), by);
    },
    // Atomic fixed-window counter: increment and, on the first hit of a new
    // window, set the key to expire after windowMs. Used by the rate limiter so
    // counts are shared across instances (not just per-process). Returns the
    // current count within the window.
    async incrWindow(namespace, key, windowMs) {
      const k = redisKey(namespace, key);
      const count = await client.incr(k);
      if (count === 1) {
        try {
          await client.pExpire(k, windowMs);
        } catch {
          await client.expire(k, Math.ceil(windowMs / 1000));
        }
      }
      return count;
    },
    _client: client,
  };
}

// ─── Backend selection ───────────────────────────────────────────────────────

let activeBackend = fileBackend;
let initPromise = null;

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (REDIS_URL) {
      const redis = await createRedisBackend();
      if (redis) {
        activeBackend = redis;
        return;
      }
    }
    logger.info(`[store] Using '${activeBackend.name}' storage backend.`);
  })();
  return initPromise;
}

// Kick off initialization immediately on import.
init();

// Public API — always awaits init so the correct backend is in place.
const store = {
  async get(namespace, key) {
    await init();
    return activeBackend.get(namespace, key);
  },
  async set(namespace, key, value) {
    await init();
    return activeBackend.set(namespace, key, value);
  },
  async del(namespace, key) {
    await init();
    return activeBackend.del(namespace, key);
  },
  async getAll(namespace) {
    await init();
    return activeBackend.getAll(namespace);
  },
  async incr(namespace, key, by = 1) {
    await init();
    return activeBackend.incr(namespace, key, by);
  },
  /**
   * Atomic windowed counter when the active backend supports it (Redis).
   * Returns the current count within the window, or null when the backend
   * has no atomic counter (file backend) — callers then fall back to an
   * in-memory counter rather than thrashing the disk on every request.
   */
  async incrWindow(namespace, key, windowMs) {
    await init();
    if (typeof activeBackend.incrWindow === "function") {
      return activeBackend.incrWindow(namespace, key, windowMs);
    }
    return null;
  },
  backendName() {
    return activeBackend.name;
  },
};

export default store;
