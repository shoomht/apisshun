import express from "express";
import cors from "cors";
import helmet from "helmet";
import logApiRequest from "../utils/logApiRequest.js";
import rateLimiter from "./rateLimiter.js";

/**
 * Sets up core middleware for the Express app.
 *
 * Order matters:
 * 1. helmet  — security headers (must be first)
 * 2. cors    — CORS headers before any response can be sent
 * 3. JSON/URL parsing — body must be parsed before route handlers
 * 4. logApiRequest — logs after body is available
 * 5. rateLimiter — block abusive IPs early, before heavy route logic
 * 6. static  — serve public/ last so API routes take priority
 */
export default function setupMiddleware(app) {
  // 1. Security headers
  app.use(
    helmet({
      // CSP disabled: public/index.html uses inline <script> + CDN Tailwind.
      // Helmet's default blocks both. Re-enable with a proper nonce/hash if
      // you want CSP without breaking the docs page.
      contentSecurityPolicy: false,
      // Allow cross-origin image/video fetching (waifu, brat generator, etc.)
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // 2. CORS — open by default (public API, no cookie auth)
  app.use(cors());

  // 3. Body parsers
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // 4. Request logging (after body parsing so params are available)
  app.use(logApiRequest);

  // 5. Rate limiter (blocks abusive IPs before expensive route logic)
  app.use(rateLimiter.middleware);

  // 6. Static files
  app.use(express.static("public"));
}
