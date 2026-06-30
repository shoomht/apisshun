import axios from "axios";

/**
 * Sets a global default timeout for all axios requests made anywhere in
 * this codebase, unless a specific call already overrides it.
 *
 * Without this, axios's own default is 0 — meaning no timeout, so a slow
 * or hanging external API (anime scrapers, downloaders, etc.) leaves the
 * request waiting indefinitely. On Vercel that means the function keeps
 * running (and billing) until Vercel's own function timeout kills it with
 * a less helpful error; on a persistent server it means connections pile
 * up under load.
 *
 * IMPORTANT: this only affects the default `axios` import (`import axios
 * from 'axios'`). It does NOT apply to instances created via
 * axios.create() — those start from their own defaults (timeout: 0)
 * regardless of this setting, per axios's documented config-merge order
 * (library defaults -> instance defaults -> request config). Files using
 * axios.create() need their own `timeout` passed into the create() call.
 *
 * This module must be imported before any code calls axios.get/post/etc
 * for the first time — it's imported at the very top of server.js for
 * that reason.
 */
axios.defaults.timeout = 30_000; // 30 seconds
