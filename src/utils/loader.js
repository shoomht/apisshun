import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { solveBypass } from "./globals.js";
import apiKey from "../middleware/apiKey.js";
import responseCache from "./responseCache.js";
import logger from "./logger.js";
import { validateRequest } from "./validator.js";

/**
 * Route registry: "METHOD /route" -> handler. Built once at startup; O(1)
 * lookup per request (no per-request directory scan).
 */
const routeRegistry = new Map();
const endpointInfoList = [];

function getRoutePath(filePath) {
  return (
    "/api" +
    filePath
      .replace(path.join(process.cwd(), "api"), "")
      .replace(/\.js$/, "")
      .replace(/\\/g, "/")
  );
}

function scanFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...scanFiles(full));
    // Files starting with "_" are shared helpers/libs, not endpoints — skip them.
    else if (entry.name.endsWith(".js") && !entry.name.startsWith("_")) result.push(full);
  }
  return result;
}

/**
 * Premium gate + usage tracking shared by both formats. Returns true if the
 * request should proceed, false if a response was already sent.
 */
async function passGate(def, req, res) {
  // Maintenance short-circuit: endpoints flagged isMaintenance are disabled
  // without removing their file. Checked first so no usage is recorded.
  if (def.isMaintenance) {
    res.status(503).json({
      success: false,
      error: "This endpoint is temporarily under maintenance. Please try again later.",
    });
    return false;
  }

  const usedKey = apiKey.extractKey(req);
  if (usedKey && (await apiKey.getKeyRecord(usedKey))) {
    await apiKey.recordUsage(usedKey);
  }
  if (def.isPremium && !(await apiKey.isPremiumRequest(req))) {
    res.status(403).json({
      success: false,
      error: "This endpoint requires a premium API key. Provide it via the 'x-api-key' header or '?apikey=' query parameter.",
    });
    return false;
  }
  return true;
}

/**
 * Runs validation against an endpoint's paramsSchema. On failure sends a 400
 * and returns null. On success returns the validated values object.
 */
function runValidation(def, req, res) {
  const { ok, errors, values } = validateRequest(def.paramsSchema, req);
  if (!ok) {
    res.status(400).json({ success: false, error: "Validation failed.", details: errors });
    return null;
  }
  return values;
}

function wrapLegacyHandler(def, method, routePath) {
  return async (req, res) => {
    try {
      if (!(await passGate(def, req, res))) return;

      const valid = runValidation(def, req, res);
      if (valid === null) return;
      req.validated = valid; // handlers may read sanitized values here

      const cacheEnabled =
        method === "GET" && (def.cache === true || typeof def.cacheTTL === "number");
      if (cacheEnabled) {
        const cached = responseCache.get(method, routePath, req.query);
        if (cached) return res.status(cached.code).json(cached.body);
      }

      const result = await def.run?.({ req, res, solveBypass, valid });
      if (res.headersSent) return;

      if (result && typeof result === "object") {
        const ok = result.status === undefined ? true : !!result.status;
        const code = Number(result.code || (ok ? 200 : 400));
        if (!ok) {
          return res.status(code).json({
            success: false,
            error: result.error || result.message || "Request failed",
          });
        }
        const body = { results: result.data !== undefined ? result.data : result };
        if (cacheEnabled) responseCache.set(method, routePath, req.query, { code, body }, def.cacheTTL);
        return res.status(code).json(body);
      }

      const body = { results: result };
      if (cacheEnabled) responseCache.set(method, routePath, req.query, { code: 200, body }, def.cacheTTL);
      return res.status(200).json(body);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: e?.message || "Internal server error" });
      }
    }
  };
}

function wrapNativeHandler(mod, routePath) {
  return async (req, res) => {
    try {
      if (!(await passGate(mod, req, res))) return;
      const valid = runValidation(mod, req, res);
      if (valid === null) return;
      req.validated = valid;
      return mod.run(req, res);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: e?.message || "Internal server error" });
      }
    }
  };
}

async function importFile(filePath) {
  const stat = fs.statSync(filePath);
  const url = pathToFileURL(filePath).href + "?t=" + stat.mtimeMs;
  try {
    return (await import(url)).default;
  } catch (e) {
    logger.error(`Failed to import ${filePath}: ${e.message}`);
    return null;
  }
}

async function registerFile(filePath) {
  const mod = await importFile(filePath);
  if (!mod) return;

  const handlers = [];

  if (mod && typeof mod.run === "function") {
    const routePath = getRoutePath(filePath);
    const methods = mod.methods || ["GET"];
    for (const method of methods) {
      handlers.push({
        method: method.toUpperCase(),
        route: routePath,
        run: wrapNativeHandler(mod, routePath),
        info: buildInfo(mod, filePath, routePath, [method]),
      });
    }
  }

  if (Array.isArray(mod)) {
    for (const def of mod) {
      if (!def || typeof def !== "object") continue;
      const method = (def.metode || def.method || "GET").toUpperCase();
      let routePath = (def.endpoint || "").toString();
      if (!routePath.startsWith("/")) routePath = "/" + routePath;
      if (!routePath.startsWith("/api")) routePath = "/api" + routePath;

      handlers.push({
        method,
        route: routePath,
        run: wrapLegacyHandler(def, method, routePath),
        info: buildInfo(def, filePath, routePath, [method], true),
      });
    }
  }

  for (const h of handlers) {
    const key = `${h.method} ${h.route}`;
    if (!routeRegistry.has(key)) {
      routeRegistry.set(key, h.run);
      endpointInfoList.push(h.info);
      logger.info(`• endpoint loaded: ${h.route} [${h.method}]`);
    }
  }
}

function buildInfo(def, filePath, routePath, methods, legacy = false) {
  const params = legacy
    ? Array.isArray(def.parameters)
      ? def.parameters.map((p) => p?.name).filter(Boolean)
      : def.params || []
    : def.params || [];
  return {
    name: def.name || path.basename(filePath, ".js"),
    description: def.description || "",
    category: def.category || "General",
    route: routePath,
    methods,
    params,
    paramsSchema: def.paramsSchema || {},
    isPremium: !!def.isPremium,
    isMaintenance: !!def.isMaintenance,
    isPublic: def.isPublic === undefined ? true : !!def.isPublic,
    upload: !!def.upload,
    uploadField: def.uploadField || "file",
    uploadFields: Array.isArray(def.uploadFields) ? def.uploadFields : null,
  };
}

export default async function loadEndpoints(dir, app) {
  const files = scanFiles(dir);
  await Promise.all(files.map((f) => registerFile(f)));

  app.all("/api/*", (req, res) => {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    const handler = routeRegistry.get(key);
    if (handler) return handler(req, res);
    return res.status(404).json({ success: false, error: "Endpoint not found" });
  });

  return [...endpointInfoList];
}

export async function getEndpoints(dir) {
  if (endpointInfoList.length > 0) return [...endpointInfoList];
  const files = scanFiles(dir);
  await Promise.all(files.map((f) => registerFile(f)));
  return [...endpointInfoList];
}
