/**
 * Global helper functions used across api/ scrapers and Cloudflare AI endpoints.
 *
 * Configure these via environment variables in your .env / Vercel project settings.
 * All functions log a clear warning when not configured so you know exactly
 * which env var is missing, instead of getting a cryptic network error.
 */

/**
 * Returns the proxy URL prefix used to bypass blocking when scraping target sites.
 * Usage: axios.get(proxy() + targetUrl)
 *
 * Set PROXY_URL in your .env, e.g.:
 *   PROXY_URL=https://your-proxy.example.com/?url=
 */
export function proxy() {
  const url = process.env.PROXY_URL;
  if (!url) {
    console.warn(
      "[globals] proxy() called but PROXY_URL is not set in environment variables. " +
      "Requests may be blocked by target sites. Set PROXY_URL in your .env to fix this."
    );
    return "";
  }
  return url;
}

/**
 * Returns the base URL for your Cloudflare AI worker.
 * Usage: axios.post(CloudflareAi() + "/chat", ...)
 *
 * Set CLOUDFLARE_AI_URL in your .env, e.g.:
 *   CLOUDFLARE_AI_URL=https://your-worker.your-subdomain.workers.dev
 */
export function CloudflareAi() {
  const url = process.env.CLOUDFLARE_AI_URL;
  if (!url) {
    console.warn(
      "[globals] CloudflareAi() called but CLOUDFLARE_AI_URL is not set. " +
      "Set CLOUDFLARE_AI_URL in your .env to use Cloudflare AI endpoints."
    );
    return "";
  }
  return url;
}

/**
 * Returns a CAPTCHA-solving client with a solveTurnstileMin(url, sitekey) method.
 * Used by: api/bypass/turnstilemin.js, api/downloader/apple-music.js,
 *          api/downloader/spotifyv2.js, api/tools/skiplink.js.
 *
 * Configure SOLVER_API_KEY and uncomment the implementation below once you
 * have a CAPTCHA solver service set up.
 *
 * Example with a hypothetical TurnstileSolver library:
 *   import { TurnstileSolver } from 'your-solver-lib';
 *   export async function solveBypass() {
 *     return new TurnstileSolver({ apiKey: process.env.SOLVER_API_KEY });
 *   }
 */
export async function solveBypass() {
  const apiKey = process.env.SOLVER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "solveBypass() requires SOLVER_API_KEY in environment variables. " +
      "See src/utils/globals.js to configure a CAPTCHA solver."
    );
  }
  // TODO: replace with your actual solver client
  throw new Error(
    "solveBypass() is not implemented yet. See src/utils/globals.js."
  );
}
