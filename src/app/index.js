import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { startBot, processUpdate } from '../bot/bot.js';
import telegramNotif from '../middleware/telegramNotif.js';
import logger from "../utils/logger.js";
import loadEndpoints, { getEndpoints } from "../utils/loader.js";
import setupMiddleware from "../middleware/index.js";
import setupResponseFormatter from "./responseFormatter.js";
import rateLimiter from '../middleware/rateLimiter.js';
import apiKey from '../middleware/apiKey.js';
import requestSigning from '../middleware/requestSigning.js';
import { buildOpenApiSpec, swaggerUiHtml } from '../utils/openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const API_DIR = path.join(process.cwd(), "api");

app.set("trust proxy", true);
app.set("json spaces", 2);

// 1. Core middleware (helmet, cors, body parsers, logging, rate limiter, static)
setupMiddleware(app);

// 2. Response envelope formatter — must run before any route handler
setupResponseFormatter(app);

// 3. Telegram notification for all /api/* hits
app.use(telegramNotif);

// 3b. Optional HMAC request-signing verification (off unless REQUIRE_SIGNED_REQUESTS=true)
app.use(requestSigning);

// 4. Telegram webhook — registered early so it always responds before
//    the isReady gate further down.
app.post('/webhook/telegram', express.json(), async (req, res) => {
  res.sendStatus(200);
  try {
    await processUpdate(req.body);
  } catch (e) {
    console.error('[WEBHOOK] error:', e.message);
  }
});

// 5. Health check — bypasses the isReady gate intentionally so uptime
//    monitors always get a fast response even during cold start.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    endpoints: rateLimiter.getStats(),
  });
});

// 6. Load all API endpoints (async — gates the /api/* wildcard below)
let isReady = false;
const initPromise = (async () => {
  logger.info("Starting server initialization...");
  logger.info("Loading API endpoints...");
  await loadEndpoints(API_DIR, app);
  logger.ready("All endpoints loaded.");
  isReady = true;
  startBot();
})();

// Gate: hold any request that arrives before endpoints are ready.
// Health check and webhook above are exempt (registered before this).
app.use(async (req, res, next) => {
  if (!isReady) await initPromise;
  next();
});

// 7. OpenAPI 3.0 spec (consumed by Swagger UI at /docs and external tooling)
app.get("/openapi.json", async (req, res) => {
  const baseURL = `${req.protocol}://${req.get("host")}`;
  const endpoints = (await getEndpoints(API_DIR)).filter((ep) => ep.isPublic !== false);
  res.status(200).json(buildOpenApiSpec(endpoints, baseURL));
});

// 7b. Interactive Swagger UI docs
app.get("/docs", (req, res) => {
  res.status(200).type("html").send(swaggerUiHtml());
});

// 7c. Legacy custom endpoint list (kept for backward compatibility)
app.get("/openapi.legacy.json", async (req, res) => {
  const baseURL = `${req.protocol}://${req.get("host")}`;
  const endpoints = (await getEndpoints(API_DIR)).filter((ep) => ep.isPublic !== false);
  const enriched = endpoints.map((ep) => {
    let url = baseURL + ep.route;
    if (ep.params && ep.params.length > 0) {
      const query = ep.params.map((p) => `${p}=YOUR_${p.toUpperCase()}`).join("&");
      url += "?" + query;
    }
    return { ...ep, url };
  });
  res.status(200).json({
    title: "ShunKazama API",
    description: "Legacy endpoint list. See /docs for interactive documentation.",
    baseURL,
    total: enriched.length,
    endpoints: enriched,
  });
});

// 8. Admin endpoints
app.post("/admin/unban", express.json(), rateLimiter.adminUnbanHandler);
app.post("/admin/apikey", express.json(), apiKey.adminCreateKeyHandler);
app.post("/admin/apikey/revoke", express.json(), apiKey.adminRevokeKeyHandler);
app.get("/admin/apikey/stats", apiKey.adminListKeysHandler);

// 9. Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 10. 404 for non-API routes (API 404s are handled inside loader.js)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  logger.info(`404: ${req.method} ${req.path}`);
  res.status(404).sendFile(path.join(process.cwd(), 'public', '404.html'));
});

// 11. Global error handler
app.use((err, req, res, next) => {
  logger.error(`500: ${err.stack || err.message}`);
  if (res.headersSent) return next(err);
  res.status(500).sendFile(path.join(process.cwd(), 'public', '500.html'));
});

export default app;
