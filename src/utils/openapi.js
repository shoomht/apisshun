/**
 * Builds an OpenAPI 3.0 document from the loaded endpoint info list, so the
 * Swagger UI page (/docs) and any external OpenAPI tooling get a real, valid
 * spec — not just the custom JSON shape the old /openapi.json returned.
 *
 * It maps each endpoint's paramsSchema to OpenAPI parameter objects and marks
 * premium endpoints as requiring the ApiKeyAuth security scheme.
 */

import fs from "fs";
import path from "path";

// Read the API version from package.json so the OpenAPI spec never drifts out
// of sync with the real package version. Resolved once at module load.
let PKG_VERSION = "0.0.0";
try {
  const pkgRaw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
  PKG_VERSION = JSON.parse(pkgRaw).version || PKG_VERSION;
} catch {
  /* fall back to placeholder if package.json can't be read */
}

function schemaTypeToOpenApi(type) {
  switch (type) {
    case "integer":
      return { type: "integer" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "url":
      return { type: "string", format: "uri" };
    case "enum":
      return { type: "string" };
    case "string":
    default:
      return { type: "string" };
  }
}

function paramsToOpenApi(ep) {
  const out = [];
  const schema = ep.paramsSchema || {};

  // Prefer the rich paramsSchema if present.
  if (Object.keys(schema).length > 0) {
    for (const [name, rules = {}] of Object.entries(schema)) {
      const s = schemaTypeToOpenApi(rules.type);
      if (rules.type === "enum" && Array.isArray(rules.enum)) s.enum = rules.enum;
      if (rules.min !== undefined) {
        if (s.type === "string") s.minLength = rules.min;
        else s.minimum = rules.min;
      }
      if (rules.max !== undefined) {
        if (s.type === "string") s.maxLength = rules.max;
        else s.maximum = rules.max;
      }
      if (rules.pattern) s.pattern = rules.pattern;
      if (rules.default !== undefined) s.default = rules.default;
      out.push({
        name,
        in: "query",
        required: !!rules.required,
        schema: s,
      });
    }
    return out;
  }

  // Fall back to the flat params name list.
  for (const name of ep.params || []) {
    out.push({ name, in: "query", required: false, schema: { type: "string" } });
  }
  return out;
}

export function buildOpenApiSpec(endpoints, baseURL) {
  const paths = {};

  for (const ep of endpoints) {
    const route = ep.route;
    paths[route] = paths[route] || {};
    for (const method of ep.methods || ["GET"]) {
      const m = method.toLowerCase();
      const operation = {
        tags: [ep.category || "General"],
        summary: ep.name || route,
        description: ep.description || "",
        parameters: paramsToOpenApi(ep),
        security: ep.isPremium ? [{ ApiKeyAuth: [] }] : [],
        responses: {
          200: {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statusCode: { type: "integer", example: 200 },
                    results: {},
                    timestamp: { type: "string", format: "date-time" },
                    attribution: { type: "string" },
                  },
                },
              },
            },
          },
          400: { description: "Validation failed" },
          403: { description: "Premium key required / IP blocked" },
          429: { description: "Rate limit exceeded" },
          500: { description: "Internal server error" },
        },
      };

      // File-upload endpoints declare a multipart body so Swagger UI shows a
      // file picker instead of (or alongside) query params.
      if (ep.upload) {
        const fields =
          Array.isArray(ep.uploadFields) && ep.uploadFields.length > 0
            ? ep.uploadFields
            : [ep.uploadField || "file"];
        const properties = {};
        for (const f of fields) {
          properties[f] = {
            type: "string",
            format: "binary",
            description: "Image file to process.",
          };
        }
        operation.requestBody = {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties,
                required: fields,
              },
            },
          },
        };
        operation.responses[200].description = "Returns the processed image (binary).";
        operation.responses[413] = { description: "Uploaded file too large" };
        operation.responses[415] = { description: "Unsupported file type (images only)" };
      }

      paths[route][m] = operation;
    }
  }

  // Stable, sorted tag list for the UI.
  const tagSet = [...new Set(endpoints.map((e) => e.category || "General"))].sort();

  return {
    openapi: "3.0.3",
    info: {
      title: "ShunKazama API",
      description:
        "Multi-purpose REST API. Use the **Authorize** button to provide your API key " +
        "for premium endpoints (sent as the `x-api-key` header).",
      version: PKG_VERSION,
    },
    servers: [{ url: baseURL }],
    tags: tagSet.map((t) => ({ name: t })),
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
    },
    paths,
  };
}

/**
 * Returns a minimal HTML page that loads Swagger UI from a CDN and points it
 * at /openapi.json. No build step, no local assets.
 */
export function swaggerUiHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShunKazama API — Docs</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css" />
  <style>
    body { margin: 0; background: #0f1117; }
    .topbar { display: none; }
    #swagger-ui { max-width: 1100px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>`;
}

export default { buildOpenApiSpec, swaggerUiHtml };
