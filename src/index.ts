import { Hono } from "hono";
import { cors } from "hono/cors";
import { initDB, closeDB, getDB } from "./db";
import { getAllowedOrigins } from "./middleware/auth";
import { rateLimitHeaders } from "./middleware/ratelimit";
import personasRoute from "./routes/personas";
import sessionsRoute from "./routes/sessions";
import chatRoute from "./routes/chat";
import aiRoute from "./routes/ai";
import blueprintsRoute from "./routes/blueprints";
import contentRoute from "./routes/content";
import { queueStatus } from "./lib/llm";

const MAX_BODY_SIZE = 512 * 1024;

if (!process.env.LLM_API_KEY) {
  console.warn("WARNING: LLM_API_KEY not set. Chat endpoints will fail.");
}

if (!process.env.API_KEY) {
  console.warn("WARNING: API_KEY not set. All API routes are UNAUTHENTICATED.");
}

initDB();

const app = new Hono();

app.use("*", async (c, next) => {
  const cl = c.req.header("content-length");
  if (cl && Number(cl) > MAX_BODY_SIZE) {
    return c.json({ error: "Request body too large" }, 413);
  }
  return next();
});

const allowedOrigins = getAllowedOrigins();
app.use(
  "*",
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : ["*"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "x-api-key"],
    maxAge: 86400,
  })
);

app.route("/api/personas", personasRoute);
app.route("/api/sessions", sessionsRoute);
app.route("/api/chat", chatRoute);
app.route("/api/ai", aiRoute);
app.route("/api/blueprints", blueprintsRoute);
app.route("/api/content", contentRoute);

app.get("/", (c) => {
  return c.json({
    name: "hermes-personal",
    version: "1.0.0",
    docs: {
      auth: "Header x-api-key (jika API_KEY diset di .env)",
      integration: {
        personal: {
          endpoint: "/api/personas",
          create: "POST /api/personas — body PersonaConfig (type: personal)",
        },
        business: {
          endpoint: "/api/personas",
          create: "POST /api/personas — body PersonaConfig (type: business) + field business",
        },
        ai_enhance: {
          endpoint: "/api/ai/enhance-backstory",
          create: "POST /api/ai/enhance-backstory — body partial PersonaConfig, returns enhanced config with AI-generated backstory, catchphrases, speechStyle, rules, etc.",
        },
        chat_rest: "POST /api/chat — { personaId, message, sessionId? }",
        chat_ws: "ws://host/api/chat/ws?personaId={id}&sessionId={id}&api_key={key}",
        ws_protocol: "Kirim { message: string }, terima { type: chunk|done|error|ping, content?: string, message?: string }",
        blueprints: "GET /api/blueprints — 8 personal + 8 business blueprint siap pakai",
        generate_caption: "POST /api/content/generate-caption — { personaId, topic, platform?, count?, tone? }",
        generate_image_prompt: "POST /api/content/generate-image-prompt — { personaId, productName, scene?, engine?, count? }",
      },
    },
    endpoints: {
      personas: "/api/personas",
      sessions: "/api/sessions",
      chat: "/api/chat",
      ws: "/api/chat/ws",
      health: "/health",
    },
    ...rateLimitHeaders(),
  });
});

app.get("/health", async (c) => {
  try {
    const db = getDB();
    const result = db.query("SELECT COUNT(*) as count FROM personas").get() as { count: number } | undefined;
    const personaCount = result?.count ?? 0;

    let llm = "untested";
    if (process.env.LLM_API_KEY) {
      try {
        const resp = await fetch(
          `${process.env.LLM_BASE_URL || "https://api.openai.com/v1"}/models`,
          {
            headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` },
            signal: AbortSignal.timeout(5000),
          }
        );
        llm = resp.ok ? "connected" : `error_${resp.status}`;
      } catch {
        llm = "unreachable";
      }
    }

    return c.json({
      status: "ok",
      uptime: process.uptime(),
      db: "connected",
      llm,
      queue: queueStatus(),
      personas: personaCount,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json({ status: "degraded", db: "disconnected" }, 503);
  }
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Hermes Personal running on http://localhost:${port}`);

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  closeDB();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDB();
  server.stop();
  process.exit(0);
});
