# ShunKazama API — v2.0 Update

This update adds persistence, validation, security, and interactive docs.

## 1. Persistence (Redis with file fallback)

New `src/utils/store.js` — a unified key-value store.

- Set `REDIS_URL` to use Redis: API keys, IP bans, and usage counters now
  survive restarts and are shared across instances (Vercel, PM2 cluster,
  multiple containers). Install with `npm i redis`.
- Without `REDIS_URL`, it falls back to JSON files in `src/data/` — no setup
  needed, works exactly like before but through one clean interface.

Affected:
- `src/middleware/apiKey.js` — fully rewritten to be async and store-backed.
  Keys are seeded from `src/data/apikeys.json` (flat format now).
- `src/middleware/rateLimiter.js` — bans persisted to the store; window
  counters stay in-memory (hot path).

## 2. Validation & consistent errors

New `src/utils/validator.js`. Endpoints can declare a `paramsSchema`:

```js
paramsSchema: {
  url:   { type: "url", required: true },
  limit: { type: "integer", min: 1, max: 100, default: 10 },
  mode:  { type: "enum", enum: ["fast", "slow"] },
}
```

The loader validates every request against it before calling the handler and
returns a uniform 400 on failure:

```json
{ "statusCode": 400, "success": false, "error": "Validation failed.",
  "details": [{ "field": "url", "message": "'url' is required." }] }
```

Validated, sanitized values are available to handlers as `req.validated` (and
as the `valid` arg in legacy handlers). Strings are sanitized (control chars
and angle brackets stripped) as defense-in-depth.

Endpoints without a schema keep working unchanged.

## 3. Security & abuse controls

- **Per-key rate limits.** A key record can carry
  `rateLimit: { windowMs, maxRequests }`. When present, that limit applies to
  the key instead of the global IP limit — useful for premium/partner keys.
  Create via:
  ```
  POST /admin/apikey
  { "adminKey": "...", "owner": "partner", "tier": "premium",
    "rateLimit": { "windowMs": 60000, "maxRequests": 600 } }
  ```
- **Generated keys** now use `crypto.randomBytes` (`sk_…`), not `Date.now()`.
- **Admin auth** uses timing-safe comparison.
- **Optional HMAC request signing** (`src/middleware/requestSigning.js`).
  Enable with `REQUIRE_SIGNED_REQUESTS=true` + `REQUEST_SIGNING_SECRET`.
  Clients send `x-signature` (HMAC-SHA256 of
  `timestamp.method.path.body`) and `x-timestamp`; stale timestamps are
  rejected to bound replay.
- **Input sanitization** applied globally through the validator.

## 4. Interactive docs (Swagger UI + OpenAPI 3.0)

- `GET /openapi.json` now returns a real **OpenAPI 3.0.3** spec generated from
  your endpoints (premium endpoints marked with the `ApiKeyAuth` scheme).
- `GET /docs` serves **Swagger UI** (from CDN) — browse, authorize with your
  key, and try endpoints live.
- The old custom shape is still available at `GET /openapi.legacy.json`.

## New environment variables (all optional)

```
REDIS_URL=redis://default:password@host:6379
REQUIRE_SIGNED_REQUESTS=false
REQUEST_SIGNING_SECRET=your-long-random-signing-secret
SIGNATURE_TOLERANCE_MS=300000
```

Plus the ones from the previous update (rate limiter / cache tuning).

## Migration notes

- The API-key seed file moved from `src/data/apiKeys.json` (nested under
  `keys`) to `src/data/apikeys.json` (flat: key -> record). Your existing
  `shun-dev-key` was carried over.
- All `apiKey.*` lookups are now async. If you call them from custom code,
  add `await`. The built-in loader already does.

---

# UI / UX Update (explorer page)

The landing page (`public/index.html`) got a big functional upgrade while
keeping its terminal-dark identity (JetBrains Mono + Space Grotesk, the
blinking-cursor signature).

## Bug fix
- The explorer now fetches `/openapi.legacy.json` (the flat endpoint-list
  shape it needs). In v2 it was still pointing at `/openapi.json`, which now
  returns OpenAPI 3.0 — so the page had silently stopped rendering endpoints.

## New features
- **Theme toggle** (light / dark) with preference saved to localStorage and a
  system-preference default. Built on CSS variables so both themes share one
  stylesheet.
- **Stats dashboard**: endpoint count, category count, distinct HTTP methods,
  and live server uptime.
- **Live server status**: a pulsing dot polls `/health` every 15s
  (online / degraded / offline) and refreshes uptime.
- **API key field**: saved locally, sent as `x-api-key` on every "try it"
  request and included in copied cURL. Show/hide toggle.
- **Copy as cURL** per endpoint — builds a runnable command from the current
  form values + API key.
- **Copy response** — one-click copy of the last response body.
- **Syntax-highlighted JSON** responses (keys, strings, numbers, booleans,
  null), HTML-escaped to prevent injection from response content.
- **Response time + status** shown on each result.
- **Recent requests** history (last 15, in localStorage) with method, path,
  status, and timing; clearable.
- **Premium endpoints** are marked with a lock chip.
- **Keyboard**: press `/` to jump to search.

## Also fixed
- `vercel.json` referenced the old `src/data/apiKeys.json` filename (renamed to
  `apikeys.json` in v2) and didn't bundle `public/`. Now includes
  `src/data/**`, `api/**`, and `public/**`.

Error pages (`404.html`, `500.html`) intentionally stay dark-only — they're
standalone and don't load the theme system.

---

# Scrapers Update (new endpoints)

Added 13 new endpoints, all wired into the standard loader with `paramsSchema`
so they get automatic validation. Shared scraper logic lives in `_`-prefixed
files which the loader now skips (they're libraries, not endpoints).

## TikTok
- `GET /api/downloader/tiktokweb` — download video/audio + stats + music
  (param: `url`). Note: the existing snaptik-based `/api/d/tiktok` is untouched;
  this is a second provider.

## Komikindo (`api/anime/komikindo/`, shares `_komikindo-lib.js`)
- `GET /api/anime/komikindo/search`  (param: `query`)
- `GET /api/anime/komikindo/daftar`  (param: `page`)
- `GET /api/anime/komikindo/terbaru` (param: `page`)
- `GET /api/anime/komikindo/detail`  (param: `slug` — slug or full komik URL)
- `GET /api/anime/komikindo/stream`  (param: `slug` — chapter slug or URL; returns page images)

Converted from the CLI scraper; the stray `=` syntax error in the original was
dropped, and the resilient multi-selector fallbacks were preserved.

## Donghua Yukz (`api/anime/donghuayukz/`, shares `_dy-lib.js`)
Proxies the upstream JSON API at donghuayukz.netlify.app.
- `GET /api/anime/donghuayukz/ongoing` (param: `page`)
- `GET /api/anime/donghuayukz/search`  (params: `query`, `page`, `mode`)
- `GET /api/anime/donghuayukz/episode` (params: `slug`, `mode`)
- `GET /api/anime/donghuayukz/detail`  (params: `slug`, `mode`)

## Kusonime (`api/anime/kusonime/`, shares `_kuso-lib.js`)
Extracted the scraper core from the WhatsApp bot plugin (WA handler dropped).
- `GET /api/anime/kusonime/search` (param: `query`)
- `GET /api/anime/kusonime/latest`
- `GET /api/anime/kusonime/detail` (param: `url` — Kusonime URL or slug)

## Loader change
- `scanFiles` now ignores files whose name starts with `_`, so shared
  helper/library modules can sit next to endpoints without being registered
  (or erroring) as routes.

## Not added
The Picsart upscale plugin from the docs was a WhatsApp bot plugin that
operates on an uploaded image buffer (multipart), not a URL-driven scraper.
It wasn't converted here since it needs file-upload handling — say the word and
I'll wire it as a POST endpoint using the existing multer setup.

---

# v2.1 — File-upload upscale + hardening

## PicsArt upscale via file upload (POST)
The PicsArt enhancer in `api/tools/upscale.js` already had a working
buffer/file code path (`UpscaleImageFromFile`, `upscaler.upscale(Buffer)`),
but only the URL-based `GET /api/tools/upscale` was exposed. Now there's a
second route on the same path:

- `POST /api/tools/upscale` — multipart/form-data, image in the `file` (or
  `image`) field, optional `scale` (1–20, form field or `?scale=`). Returns the
  enhanced PNG. The original `GET` (URL-based) is untouched.

Same path + different method is fine: the route registry keys on
`METHOD path`, so GET and POST register independently.

## New: reusable multipart helper (`src/utils/upload.js`)
The route registry stores one handler per route and doesn't run per-route
Express middleware, so multer can't be mounted the usual way. The helper runs
multer on demand from inside `run()`:

- `receiveFile(req, res)` → resolves the first uploaded file (any field name)
  or `null`; rejects with an `UploadError` carrying an HTTP `code`.
- In-memory storage (handlers get `file.buffer`, no temp files to clean up).
- Image-only (`image/*`) filter → 415 on anything else.
- Size cap via `MAX_UPLOAD_MB` (default 15) → 413 when exceeded.

multipart works alongside the global `express.json`/`urlencoded` parsers
because those skip non-matching content types and leave the stream intact for
multer.

## Docs
- `src/utils/openapi.js` now emits a `multipart/form-data` `requestBody` for
  endpoints flagged `upload: true`, so Swagger UI shows a file picker (plus
  413/415 responses). The loader passes the `upload`/`uploadField` flags through
  `buildInfo`.

## Hardening
- **Version no longer drifts:** the OpenAPI `info.version` is now read from
  `package.json` at load instead of a hardcoded string.
- Version bumped `2.0.0` → `2.1.0`.
- `MAX_UPLOAD_MB` documented in the env template (with a note that Vercel caps
  request bodies at ~4.5MB regardless).
- Syntax-checked all 238 JS files; confirmed no stale `apiKeys.json` references
  and that `vercel.json` ships `api/**`.

---

# v2.2 — Reliability fixes + upload everywhere + tests

## Fixes
- **PicsArt upscale no longer hangs forever.** `waitForCompletion` in
  `api/tools/upscale.js` looped on `while (true)`; if the upstream job never
  returned DONE/FAILED the request hung indefinitely. Now it polls up to
  ~2 minutes (60 × 2s) then throws a clear timeout. Affects both the GET and the
  new POST upscale routes.
- **Telegram notifications no longer spam.** `telegramNotif` sent one message
  per `/api/*` hit, which trips Telegram's ~1 msg/sec per-chat limit. New
  behavior: `TELEGRAM_NOTIFY` = `errors` (default, only 4xx/5xx) | `all` | `off`,
  plus a min-gap throttle (`TELEGRAM_NOTIFY_MIN_GAP_MS`, default 1100ms) that
  drops-but-counts bursts and reports the suppressed count on the next message.
  Still fired from `res.on('finish')`, so zero added latency.
- **`isMaintenance` / `isPublic` are now honored.** The loader ignored these
  flags. Now `isMaintenance: true` returns 503 (before any usage is recorded),
  and `isPublic: false` hides an endpoint from `/openapi.json` and
  `/openapi.legacy.json`.
- **Rate limit holds across instances.** The sliding-window counters were
  per-process (weak on Vercel/multi-instance). When `REDIS_URL` is set, the
  limiter now uses an atomic Redis fixed-window counter (`store.incrWindow`,
  INCR + PEXPIRE); without Redis it falls back to the same in-memory sliding
  window as before (no disk thrash). Bans were already persisted.

## Added
- **File-upload (POST) for all image tools**, reusing `src/utils/upload.js`:
  - `POST /api/tools/upscale`     (PicsArt, file)
  - `POST /api/iloveimg/upscale`  (file, scale 2/4)
  - `POST /api/iloveimg/removebg` (file)
  - `POST /api/iloveimg/blurface` (file)
  - `POST /api/imgedit/convphoto` (file + `template`/`style`)
  - `POST /api/imgedit/faceswap`  (two files: source + target)
  Each reuses the existing, proven `…FromFile`/`FromFiles` scraper helper.
- **Multi-file uploads.** `upload.js` gained `receiveFiles()` (used by
  face-swap), and the OpenAPI generator renders one binary field per
  `uploadFields` entry so Swagger UI shows multiple file pickers.
- **Smoke tests.** `npm test` now runs Node's built-in test runner (no jest/ESM
  friction, no extra deps): boots the app and checks `/health`, `/openapi.json`,
  a 404 envelope, and that `POST /api/tools/upscale` with no file returns 400.
  Run `npm install` first (booting imports every endpoint).
- **Working lint.** Added `.eslintrc.json` (eslint:recommended + sane rules) and
  `.eslintignore`, so `npm run lint` actually runs. Removed the unused `jest`
  devDependency.

## Notes
- Version `2.1.0` → `2.2.0`. The OpenAPI `info.version` is read from
  package.json, so it tracks automatically.
- New env vars documented in `env`: `TELEGRAM_NOTIFY`,
  `TELEGRAM_NOTIFY_MIN_GAP_MS` (and `MAX_UPLOAD_MB` from v2.1).
