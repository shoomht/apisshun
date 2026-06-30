import crypto from "crypto";

/**
 * Optional HMAC request-signing verification.
 *
 * Disabled unless REQUIRE_SIGNED_REQUESTS=true. When enabled, every /api/*
 * request must carry:
 *   x-signature : hex HMAC-SHA256 of `${timestamp}.${method}.${path}.${rawBody}`
 *   x-timestamp : unix epoch ms, used to reject replays
 *
 * The shared secret is REQUEST_SIGNING_SECRET. This protects against request
 * tampering and replay for clients you control (mobile app, bot), on top of —
 * not instead of — API keys.
 *
 * Requests within SIGNATURE_TOLERANCE_MS of now are accepted; older ones are
 * rejected to bound replay risk.
 */

const ENABLED = String(process.env.REQUIRE_SIGNED_REQUESTS || "").toLowerCase() === "true";
const SECRET = process.env.REQUEST_SIGNING_SECRET || "";
const TOLERANCE_MS = parseInt(process.env.SIGNATURE_TOLERANCE_MS || "300000", 10); // 5 min

function sign(timestamp, method, path, rawBody) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${timestamp}.${method}.${path}.${rawBody || ""}`)
    .digest("hex");
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export default function requestSigning(req, res, next) {
  if (!ENABLED) return next();
  if (!req.path.startsWith("/api/")) return next();

  if (!SECRET) {
    return res.status(500).json({
      success: false,
      error: "Request signing is enabled but REQUEST_SIGNING_SECRET is not configured.",
    });
  }

  const signature = req.headers["x-signature"];
  const timestamp = req.headers["x-timestamp"];

  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: "Missing x-signature or x-timestamp header.",
    });
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TOLERANCE_MS) {
    return res.status(401).json({
      success: false,
      error: "Request timestamp is invalid or outside the allowed window.",
    });
  }

  // req.body is already parsed; re-stringify for a stable representation.
  // Clients must sign the same canonical JSON (or empty string for GET).
  const rawBody =
    req.body && typeof req.body === "object" && Object.keys(req.body).length
      ? JSON.stringify(req.body)
      : "";

  const expected = sign(ts, req.method.toUpperCase(), req.path, rawBody);
  if (!safeEqualHex(signature, expected)) {
    return res.status(401).json({ success: false, error: "Invalid request signature." });
  }

  next();
}
