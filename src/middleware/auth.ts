import type { Context, Next } from "hono";

const API_KEY = process.env.API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function apiKeyAuth(c: Context, next: Next) {
  if (!API_KEY) {
    return next();
  }

  const header = c.req.header("x-api-key");
  const query = c.req.query("api_key");

  if (header === API_KEY || query === API_KEY) {
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
}

export function getAllowedOrigins(): string[] {
  return ALLOWED_ORIGINS;
}
