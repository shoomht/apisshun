/**
 * Lightweight request validation + sanitization.
 *
 * Endpoints can declare a `paramsSchema` describing their expected inputs.
 * The loader runs validateRequest() before calling the handler, returning a
 * 400 with a clear, consistent error list when validation fails — so every
 * endpoint gets uniform validation without per-file boilerplate.
 *
 * Schema shape (all fields optional):
 *   paramsSchema: {
 *     <name>: {
 *       type: "string" | "number" | "integer" | "boolean" | "url" | "enum",
 *       required: boolean,        // default false
 *       enum: [...],              // for type "enum"
 *       min: number,              // min length (string) or min value (number)
 *       max: number,              // max length (string) or max value (number)
 *       pattern: string,          // regex source, tested against string value
 *       default: any,             // applied when value is absent
 *     }
 *   }
 *
 * On success, returns { ok:true, values } where `values` holds coerced,
 * sanitized inputs merged from query + body. On failure, returns
 * { ok:false, errors:[{ field, message }] }.
 */

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Basic string sanitization: trims, strips control chars and angle brackets
 * (defense-in-depth against reflected XSS / log injection). Does NOT mutate
 * intended content beyond that — scrapers still get usable values.
 */
export function sanitizeString(value) {
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars
    .replace(/[<>]/g, "")                   // angle brackets
    .trim();
}

function coerce(type, raw) {
  switch (type) {
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : NaN;
    }
    case "integer": {
      const n = Number(raw);
      return Number.isInteger(n) ? n : NaN;
    }
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      const s = String(raw).toLowerCase();
      if (["true", "1", "yes"].includes(s)) return true;
      if (["false", "0", "no"].includes(s)) return false;
      return null; // invalid
    }
    case "url":
    case "string":
    case "enum":
    default:
      return sanitizeString(raw);
  }
}

export function validateRequest(schema, req) {
  // Merge sources; body wins over query for POST/PUT.
  const input = { ...(req.query || {}), ...(typeof req.body === "object" && req.body ? req.body : {}) };

  if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
    // No schema declared: pass through sanitized query/body untouched.
    return { ok: true, values: input };
  }

  const values = {};
  const errors = [];

  for (const [field, rules = {}] of Object.entries(schema)) {
    const present = input[field] !== undefined && input[field] !== "" && input[field] !== null;

    if (!present) {
      if (rules.required) {
        errors.push({ field, message: `'${field}' is required.` });
      } else if (rules.default !== undefined) {
        values[field] = rules.default;
      }
      continue;
    }

    const type = rules.type || "string";
    const coerced = coerce(type, input[field]);

    // Type checks
    if ((type === "number" || type === "integer") && Number.isNaN(coerced)) {
      errors.push({ field, message: `'${field}' must be a${type === "integer" ? "n integer" : " number"}.` });
      continue;
    }
    if (type === "boolean" && coerced === null) {
      errors.push({ field, message: `'${field}' must be a boolean.` });
      continue;
    }
    if (type === "url" && !URL_RE.test(coerced)) {
      errors.push({ field, message: `'${field}' must be a valid http(s) URL.` });
      continue;
    }
    if (type === "enum") {
      const allowed = Array.isArray(rules.enum) ? rules.enum : [];
      if (!allowed.includes(coerced)) {
        errors.push({ field, message: `'${field}' must be one of: ${allowed.join(", ")}.` });
        continue;
      }
    }

    // Range / length checks
    if (typeof coerced === "number") {
      if (rules.min !== undefined && coerced < rules.min) {
        errors.push({ field, message: `'${field}' must be >= ${rules.min}.` });
        continue;
      }
      if (rules.max !== undefined && coerced > rules.max) {
        errors.push({ field, message: `'${field}' must be <= ${rules.max}.` });
        continue;
      }
    }
    if (typeof coerced === "string") {
      if (rules.min !== undefined && coerced.length < rules.min) {
        errors.push({ field, message: `'${field}' must be at least ${rules.min} characters.` });
        continue;
      }
      if (rules.max !== undefined && coerced.length > rules.max) {
        errors.push({ field, message: `'${field}' must be at most ${rules.max} characters.` });
        continue;
      }
      if (rules.pattern) {
        try {
          if (!new RegExp(rules.pattern).test(coerced)) {
            errors.push({ field, message: `'${field}' has an invalid format.` });
            continue;
          }
        } catch {
          /* bad pattern in schema — ignore rather than 500 */
        }
      }
    }

    values[field] = coerced;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, values };
}

export default { validateRequest, sanitizeString };
