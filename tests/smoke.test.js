/**
 * Smoke tests — run with `npm test` (uses Node's built-in test runner, no extra
 * deps). They boot the real app on an ephemeral port and hit a few routes to
 * catch gross regressions (broken middleware order, loader failures, envelope
 * shape, validation gating).
 *
 * Requires dependencies to be installed first (`npm install`), since booting the
 * app imports every endpoint module.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

let server;
let base;

before(async () => {
  // Keep the test hermetic: no Telegram, no Redis, quiet bot.
  process.env.TELEGRAM_BOT_TOKEN = "";
  process.env.TELEGRAM_CHAT_ID = "";
  process.env.TELEGRAM_NOTIFY = "off";
  delete process.env.REDIS_URL;

  const { default: app } = await import("../src/app/index.js");
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  if (server) server.close();
});

test("GET /health returns ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("GET /openapi.json returns a spec with paths", async () => {
  const res = await fetch(`${base}/openapi.json`);
  assert.equal(res.status, 200);
  const spec = await res.json();
  assert.ok(spec.openapi, "spec has an openapi version");
  assert.ok(spec.paths && typeof spec.paths === "object", "spec has paths");
});

test("unknown API route returns 404 JSON envelope", async () => {
  const res = await fetch(`${base}/api/this/does/not/exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
});

test("POST /api/tools/upscale without a file is rejected (400)", async () => {
  const res = await fetch(`${base}/api/tools/upscale`, { method: "POST" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
});
