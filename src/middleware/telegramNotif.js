import { sendMessage } from '../bot/bot.js';

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Per-request Telegram notifications — but rate-aware.
 *
 * Telegram caps messages to a single chat at roughly 1/second; naively sending
 * one notification per API hit gets the bot throttled (or banned) and floods
 * the chat. So this middleware:
 *
 *   1. LEVEL FILTER (TELEGRAM_NOTIFY env):
 *        - "errors" (default): only notify on 4xx/5xx responses
 *        - "all":              notify on every /api/* hit
 *        - "off":              never notify
 *   2. THROTTLE: at most one message per MIN_GAP_MS. Anything that arrives
 *        inside the gap is dropped, but counted — the next message that does go
 *        out reports how many were suppressed, so volume spikes are visible
 *        without spamming.
 *
 * Notifications are fired from res.on('finish') (after the response is sent),
 * so they never add latency to the API response itself.
 */

const LEVEL = (process.env.TELEGRAM_NOTIFY || 'errors').toLowerCase();
const MIN_GAP_MS = parseInt(process.env.TELEGRAM_NOTIFY_MIN_GAP_MS || '1100', 10);

let lastSentAt = 0;
let suppressed = 0;

export default function telegramNotif(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (LEVEL === 'off') return next();
  if (!CHAT_ID || !process.env.TELEGRAM_BOT_TOKEN) return next();

  const startTime = Date.now();
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';

  res.on('finish', () => {
    const status = res.statusCode;
    if (LEVEL === 'errors' && status < 400) return; // only failures

    // Throttle: drop (but count) anything inside the min-gap window.
    const now = Date.now();
    if (now - lastSentAt < MIN_GAP_MS) {
      suppressed += 1;
      return;
    }
    lastSentAt = now;

    const responseTime = now - startTime;
    const suppressedNow = suppressed;
    suppressed = 0;

    notify({ req, ip, status, responseTime, suppressedNow }).catch(() => {});
  });

  next();
}

async function notify({ req, ip, status, responseTime, suppressedNow }) {
  const params = {
    ...req.query,
    ...(typeof req.body === 'object' && req.body !== null ? req.body : {}),
  };
  const paramStr = Object.keys(params).length
    ? Object.entries(params)
        .map(([k, v]) => `${k}=${String(v).slice(0, 50)}`)
        .join(', ')
    : '-';

  const emoji = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';
  const suppressedLine =
    suppressedNow > 0
      ? `\n🔇 <b>Suppressed:</b> <code>${suppressedNow} more in the last ${MIN_GAP_MS}ms</code>`
      : '';

  await sendMessage(
    `${emoji} <b>API Hit</b>\n\n` +
      `🔗 <b>Endpoint:</b> <code>${req.method} ${req.path}</code>\n` +
      `🌐 <b>IP:</b> <code>${ip}</code>\n` +
      `📦 <b>Params:</b> <code>${paramStr}</code>\n` +
      `📊 <b>Status:</b> <code>${status}</code>\n` +
      `⚡ <b>Response Time:</b> <code>${responseTime}ms</code>\n` +
      `🕐 <b>Waktu:</b> <code>${new Date().toISOString()}</code>` +
      suppressedLine,
    CHAT_ID
  );
}
