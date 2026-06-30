/**
 * Standardizes all JSON responses with a consistent envelope.
 *
 * For 2xx responses adds: statusCode, timestamp, attribution.
 * For non-2xx responses adds: statusCode only.
 *
 * This middleware must run BEFORE route handlers so that res.json is
 * already wrapped when routes call it. It's registered in src/app/index.js
 * before any route is mounted.
 *
 * Implementation note: we wrap res.json once here, then restore it after
 * the first call to avoid double-wrapping when other middleware (logApiRequest,
 * telegramNotif) also temporarily override res.json.
 */
export default function setupResponseFormatter(app) {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    let called = false;

    res.json = function (data) {
      // Restore immediately to prevent any downstream re-wrap from re-entering
      // this formatter a second time (logApiRequest / telegramNotif restore
      // their own overrides after the first call, so this is belt-and-suspenders).
      if (!called) {
        called = true;
        res.json = originalJson;
      }

      if (data !== null && typeof data === "object" && !Array.isArray(data)) {
        const statusCode = res.statusCode || 200;
        const envelope = { statusCode, ...data };

        if (statusCode >= 200 && statusCode < 300) {
          envelope.timestamp = new Date().toISOString();
          envelope.attribution = process.env.API_ATTRIBUTION || "Sho";
        }

        return originalJson(envelope);
      }

      return originalJson(data);
    };

    next();
  });
}
