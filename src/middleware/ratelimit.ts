const SIMPLE_RATE_LIMIT: Map<string, { count: number; resetAt: number }> =
  new Map();

const CHAT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_CHAT_MAX) || 20;
const CHAT_WINDOW_MS = Number(process.env.RATE_LIMIT_CHAT_WINDOW_MS) || 60000;
const GENERAL_MAX_REQUESTS = Number(process.env.RATE_LIMIT_GENERAL_MAX) || 60;
const GENERAL_WINDOW_MS = Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 60000;

const CLEANUP_INTERVAL_MS = 300_000;

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of SIMPLE_RATE_LIMIT) {
    if (now > entry.resetAt) {
      SIMPLE_RATE_LIMIT.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = SIMPLE_RATE_LIMIT.get(key);

  if (!entry || now > entry.resetAt) {
    SIMPLE_RATE_LIMIT.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

export function getChatRateLimitKey(ip: string): boolean {
  return isRateLimited(`chat:${ip}`, CHAT_MAX_REQUESTS, CHAT_WINDOW_MS);
}

export function getGeneralRateLimitKey(ip: string): boolean {
  return isRateLimited(`general:${ip}`, GENERAL_MAX_REQUESTS, GENERAL_WINDOW_MS);
}

export function rateLimitHeaders(): Record<string, string> {
  return {
    "X-RateLimit-Chat-Max": String(CHAT_MAX_REQUESTS),
    "X-RateLimit-Chat-Window": String(CHAT_WINDOW_MS),
    "X-RateLimit-General-Max": String(GENERAL_MAX_REQUESTS),
    "X-RateLimit-General-Window": String(GENERAL_WINDOW_MS),
  };
}
