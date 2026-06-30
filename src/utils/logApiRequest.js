import logger from "./logger.js";

/**
 * Logs every request with method, path, status code, and response time.
 *
 * Hooks into res.end() only (the lowest-level response method that
 * all of Express's res.send / res.json / res.sendFile ultimately call).
 * This avoids stacking overrides on res.json alongside responseFormatter
 * and telegramNotif, which were previously all fighting over the same method.
 */
const logApiRequest = (req, res, next) => {
  const startTime = Date.now();

  const originalEnd = res.end;

  res.end = function (...args) {
    // Restore before calling original to avoid recursion
    res.end = originalEnd;

    const responseTime = Date.now() - startTime;
    logger.info(
      `${req.method} ${req.path} [${res.statusCode}] (${responseTime}ms)`
    );

    return originalEnd.apply(this, args);
  };

  next();
};

export default logApiRequest;
