import 'dotenv/config';
import './src/utils/httpDefaults.js';
import os from "os";
import app from './src/app/index.js';
import logger from './src/utils/logger.js';

/**
 * This file is deployed on Vercel, which runs the app as a serverless
 * function rather than a long-lived process. process.env.VERCEL is set
 * automatically in that environment. Everything below this check (listen(),
 * crash handlers that call process.exit(), graceful shutdown) assumes a
 * persistent process and either does nothing useful or actively misbehaves
 * under Vercel's per-request function lifecycle, so it's skipped there.
 */
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  /**
   * Crash protection (non-Vercel only).
   *
   * Without these, a single uncaught error anywhere in the process (e.g. a
   * promise rejection from a library call outside any try/catch) takes down
   * the entire Node process. We log with full detail and then exit, rather
   * than silently continuing: after an uncaughtException in particular, the
   * process is in an unknown state, and limping along risks corrupting data
   * or behaving unpredictably. Exiting lets a process manager (PM2, Docker,
   * systemd, etc.) restart cleanly — only relevant if you ever run this
   * outside Vercel, since Vercel doesn't use a process manager like this.
   */
  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err?.stack || err?.message || err}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    const detail = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
    logger.error(`Unhandled promise rejection: ${detail}`);
    process.exit(1);
  });
}

/**
 * Server port number from environment variables or default fallback
 * @constant {number}
 * @default 3000
 */
const PORT = process.env.PORT || 3000;

let server = null;

if (!isVercel) {
  /**
   * Starts the Express server and logs startup information including network interfaces
   * @function
   * @listens Express.Application#listen
   *
   * @description
   * This module is the main entry point that starts the Express server.
   * It performs the following operations on startup:
   * 1. Starts the server on the specified PORT
   * 2. Logs successful server initialization
   * 3. Displays local and network access URLs
   * 4. Handles network interface detection gracefully
   *
   * @example
   * // Server startup output example:
   * //
   * // [READY] Server started successfully
   * // [INFO] Local: http://localhost:3000
   * // [INFO] Network: http://192.168.1.100:3000
   * // [INFO] Ready for connections
   * //
   */
  server = app.listen(PORT, () => {
    console.log(""); // Empty line for better readability

    /**
     * Log server startup success message
     * @event logger#ready
     */
    logger.ready(`Server started successfully`);

    /**
     * Log local access URL
     * @event logger#info
     */
    logger.info(`Local: http://localhost:${PORT}`);

    try {
      /**
       * Retrieve network interface information from the operating system
       * @type {Object.<string, os.NetworkInterfaceInfo[]>}
       */
      const nets = os.networkInterfaces();

      /**
       * Object to store filtered IPv4 network addresses
       * @type {Object.<string, string[]>}
       */
      const results = {};

      /**
       * Iterate through all network interfaces to find external IPv4 addresses
       * @loop
       * @description Filters out internal interfaces and IPv6 addresses
       */
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          // Filter for IPv4 addresses that are not internal (loopback, etc.)
          if (net.family === "IPv4" && !net.internal) {
            if (!results[name]) results[name] = [];
            results[name].push(net.address);
          }
        }
      }

      /**
       * Log all detected external network addresses for remote access
       * @loop
       * @description Logs each network interface address that can be used for remote access
       */
      for (const [, addresses] of Object.entries(results)) {
        for (const addr of addresses) {
          /**
           * Log network access URL for each external IP address
           * @event logger#info
           */
          logger.info(`Network: http://${addr}:${PORT}`);
        }
      }
    } catch (error) {
      /**
       * Handle errors during network interface detection gracefully
       * @event logger#warn
       * @param {Error} error - The error encountered during network detection
       */
      logger.warn(`Cannot detect network interfaces: ${error.message}`);
    }

    /**
     * Log server readiness for accepting connections
     * @event logger#info
     */
    logger.info("Ready for connections");

    console.log(""); // Empty line for better readability
  });

  /**
   * Graceful shutdown (non-Vercel only).
   *
   * SIGTERM is what process managers (PM2, Docker, systemd, most PaaS
   * platforms) send when stopping or restarting your app — e.g. during a
   * deploy. SIGINT is Ctrl+C in a terminal. Without handling these,
   * in-flight requests get cut off mid-response when the process is killed.
   *
   * server.close() stops accepting new connections but lets existing ones
   * finish, then we exit. A timeout forces exit anyway if something hangs.
   */
  const gracefulShutdown = (signal) => {
    logger.warn(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info("All connections closed, exiting.");
      process.exit(0);
    });

    // Safety net: force-exit if connections don't close in time
    setTimeout(() => {
      logger.warn("Forced shutdown after timeout — some connections didn't close in time.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

/**
 * Export the Express application instance. On Vercel, this is what gets
 * wrapped and invoked per-request by the @vercel/node runtime. Locally /
 * on a persistent host, this export is unused by this file (listen() above
 * already started the server) but stays available for tests or reuse.
 * @type {express.Application}
 */
export default app;
