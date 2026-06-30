## ShunKazama API's.

A multi-category REST API built with Express.js that automatically registers endpoints from the file system — drop a file in `api/`, it shows up as a route, no manual wiring needed. Includes an interactive documentation page, an API key system with premium gating, response caching, and a Telegram bot integration.

## Overview

This project auto-loads every endpoint under `api/` at runtime (with hot-reload based on file modification time) and exposes them all through a single catch-all route. Endpoints span a wide range of categories — anime scrapers, social media downloaders, currency conversion, AI chat, image tools, Indonesian primbon (fortune-telling) endpoints, and more.

## Features

- 🔄 **Auto-loading endpoints** — drop a file in `api/`, it's live; no route registration needed
- 📚 **Interactive documentation** — search, expand, and try any endpoint directly from the browser at `/`
- 🔑 **API key system** — `x-api-key` header or `?apikey=` query param, with free/premium tiers
- 🔒 **Premium gating** — endpoints can declare `isPremium: true` and require a premium key
- 📊 **Usage tracking** — per-key request counts and last-used timestamps via `/admin/apikey/stats`
- ⚡ **Response caching** — opt-in per endpoint via `cache: true` / `cacheTTL`
- 🩺 **Health check** — `/health` for uptime monitoring
- 🚀 **Custom error pages** — styled 404 and 500 pages
- 🤖 **Telegram bot** — webhook-based notifications/backups

## Project Structure

```
shunapis/
├── api/                          # Endpoints (auto-loaded — this is most of the project)
│   ├── ai/                      # GPT chat, etc.
│   ├── anime/                   # Anime scrapers (anichin, otakdesu, samehadaku, ...)
│   ├── apk/                     # APK info lookups
│   ├── berita/                  # Indonesian news scrapers
│   ├── currency/                # Fiat + crypto conversion, rates, list
│   ├── downloader/               # TikTok, Spotify, CapCut, Twitter, etc. downloaders
│   ├── iloveimg/                 # Image processing (compress, upscale, remove-bg, ...)
│   ├── maker/                    # Generators (brat image/video, IQC, textpro, ...)
│   ├── primbon/                  # Indonesian fortune-telling endpoints
│   ├── random/                   # Random image endpoints (waifu, neko, ...)
│   ├── stalker/                  # Social profile lookups (Instagram, Roblox, ...)
│   ├── tools/                    # Misc utilities (TTS, QR, base64, upload, ...)
│   └── ...                       # Several more categories — see /openapi.json for the full list
├── public/                       # Static files
│   ├── index.html                # Interactive API documentation
│   ├── 404.html                  # Custom 404 page
│   └── 500.html                  # Custom 500 page
├── src/
│   ├── app/                      # Express app setup, middleware wiring, routes
│   ├── bot/                      # Telegram bot (webhook-based)
│   ├── data/                     # API key store (apiKeys.json)
│   ├── middleware/                # apiKey auth, rate limiting, request logging
│   ├── services/                  # Business logic layer (e.g. GPT service)
│   └── utils/                     # Endpoint loader, response cache, logger
├── server.js                      # Entry point (Vercel-aware — see below)
├── package.json
└── vercel.json                    # Vercel deployment config
```

## Endpoint format

Most endpoints export a **default array** of route definitions (a single file can register more than one route this way):

```javascript
// api/example/hello.js
export default [
    {
        metode: "GET",                 // HTTP method
        endpoint: "/api/example/hello", // route path
        name: "hello",
        category: "Example",
        description: "Says hello.",
        tags: ["EXAMPLE"],
        example: "?name=Shun",
        parameters: [
            { name: "name", in: "query", required: false, schema: { type: "string" } }
        ],
        isPremium: false,     // true = requires a premium API key (see Auth below)
        isMaintenance: false,
        isPublic: true,
        cache: true,           // optional — caches GET responses (see Caching below)
        cacheTTL: 60 * 1000,    // optional — defaults to 60s if cache:true and this is omitted
        async run({ req, res, solveBypass }) {
            const { name } = req.query || {};
            return {
                status: true,
                data: { message: `Hello, ${name || "world"}!` },
            };
        },
    },
];
```

A smaller number of files use an older **native format** instead — a single default-exported object with `methods`, and a `run(req, res)` that sends its own response directly. The loader (`src/utils/loader.js`) supports both.

Returning `{ status: false, error, code }` from `run()` produces an error response with that status code. Returning anything else gets wrapped as `{ results: ... }` with a 200. If your handler sends its own response (e.g. `res.send(buffer)` for an image), just don't return anything — the loader detects `res.headersSent` and steps aside.

## Auth & premium gating

Requests can include an API key via the `x-api-key` header or `?apikey=` query param. Keys are stored in `src/data/apiKeys.json` (seeded) and managed via:

- `POST /admin/apikey` — create a key (requires `ADMIN_KEY` env var, sent as `x-admin-key` header)
- `POST /admin/apikey/revoke` — deactivate a key
- `GET /admin/apikey/stats` — list all keys with usage counts

Any endpoint with `isPremium: true` requires a key with `tier: "premium"` — see `src/middleware/apiKey.js`.

**Vercel caveat:** Vercel's filesystem is read-only except `/tmp`, which isn't reliably persistent across invocations. On Vercel, key writes go to `/tmp` and may not survive a cold start or redeploy. If you need API keys/usage stats that reliably persist on Vercel, swap the JSON file store for a real database (Vercel KV, Postgres, etc).

## Setup and installation

1. Clone your copy of the repository and `cd` into it.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in what you need (see that file for what each variable does).
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open the docs at `http://localhost:3000`, or hit an endpoint directly, e.g. `http://localhost:3000/api/currency/list`.

## Deployment

This project has been run on **both** of the following — pick whichever fits:

**Vercel** — `vercel.json` routes everything through `server.js` rather than using Vercel's `api/` folder convention (this project's own `api/` folder holds endpoint definitions, not Vercel functions, so the two would otherwise collide). `server.js` detects `process.env.VERCEL` and skips `app.listen()`/process-level signal handlers there, since Vercel runs this as a serverless function rather than a long-lived process.

**Pterodactyl / any persistent Node host** — run `npm start` (`node server.js`). The port comes from `process.env.PORT`, which is set automatically by Pterodactyl's Node egg / most panels. On a persistent host you also get the things Vercel doesn't need: crash protection (`uncaughtException`/`unhandledRejection` handlers that log and exit cleanly so a process manager can restart) and graceful shutdown on `SIGTERM`/`SIGINT`.

## Adding a new endpoint

Drop a new file anywhere under `api/`, following the format shown above. It's picked up automatically — no registration step. The route path you choose in `endpoint:` and the file's location on disk don't have to match (most existing endpoints organize files by category folder, but the loader doesn't enforce this for the array format).

## Response format

Success:
```json
{
  "results": { "...": "whatever the endpoint returned" }
}
```

Error:
```json
{
  "success": false,
  "error": "Error message description"
}
```

## License

MIT — see the LICENSE file for details.
