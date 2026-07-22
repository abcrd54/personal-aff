import { Hono } from "hono";
import { cors } from "hono/cors";
import { initDB, closeDB, getDB, generateId, safeParseConfig } from "./db";
import { getAllowedOrigins } from "./middleware/auth";
import { rateLimitHeaders, getChatRateLimitKey, parseClientIP } from "./middleware/ratelimit";
import { queueStatus } from "./lib/llm";
import { getCachedPrompt } from "./lib/prompt";
import personasRoute from "./routes/personas";
import sessionsRoute from "./routes/sessions";
import chatRoute from "./routes/chat";
import aiRoute from "./routes/ai";
import blueprintsRoute from "./routes/blueprints";
import contentRoute from "./routes/content";
import openaiRoute from "./routes/openai";
import { initChatWS, handleChatMessage, cleanupChatWS } from "./lib/ws-handler";
import type { PersonaConfig } from "./types";

const MAX_BODY_SIZE = 512 * 1024;

if (!process.env.LLM_API_KEY) {
  console.warn("WARNING: LLM_API_KEY not set. Chat endpoints will fail.");
}

if (!process.env.API_KEY) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: API_KEY must be set in production.");
    process.exit(1);
  }
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
    allowHeaders: ["Content-Type", "x-api-key", "Authorization"],
    maxAge: 86400,
  })
);

app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  const icon = status >= 500 ? "❌" : status >= 400 ? "⚠️" : "✅";
  console.log(`${icon} ${method} ${path} → ${status} (${duration}ms)`);
});

app.route("/api/personas", personasRoute);
app.route("/api/sessions", sessionsRoute);
app.route("/api/chat", chatRoute);
app.route("/api/ai", aiRoute);
app.route("/api/blueprints", blueprintsRoute);
app.route("/api/content", contentRoute);
app.route("/v1", openaiRoute);

app.get("/", (c) => {
  return c.json({
    name: "aff-personal",
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

const port = Number(process.env.PORT) || 3001;

const server = Bun.serve({
  port,
  websocket: {
    open(ws) {
      initChatWS(ws);
    },
    message(ws, msg) {
      handleChatMessage(ws, msg.toString());
    },
    close(ws) {
      cleanupChatWS(ws);
    },
  },
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/chat/ws" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

      const params = url.searchParams;
      const apiKey = process.env.API_KEY;
      if (apiKey) {
        const qKey = params.get("api_key");
        const hKey = req.headers.get("x-api-key");
        if (qKey !== apiKey && hKey !== apiKey) {
          return json(401, { error: "Unauthorized" });
        }
      }

      const origin = req.headers.get("origin");
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
        return json(403, { error: "Forbidden origin" });
      }

      const ip = parseClientIP(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown");
      if (getChatRateLimitKey(ip)) {
        return json(429, { error: "Rate limit exceeded" });
      }

      const personaId = params.get("personaId");
      let sessionId = params.get("sessionId") || undefined;

      if (!sessionId && !personaId) {
        return json(400, { error: "sessionId or personaId is required" });
      }

      const db = getDB();

      if (sessionId) {
        const existing = db.query("SELECT persona_id FROM sessions WHERE id = ?").get(sessionId) as any;
        if (!existing) {
          if (!personaId) return json(404, { error: "Session not found" });
          sessionId = undefined;
        } else if (personaId && existing.persona_id !== personaId) {
          return json(403, { error: "Session does not belong to this persona" });
        }
      }

      let effectivePersonaId = personaId;
      if (!sessionId) {
        if (!personaId) return json(400, { error: "personaId required to create session" });
        const persona = db.query("SELECT id FROM personas WHERE id = ?").get(personaId) as any;
        if (!persona) return json(404, { error: "Persona not found" });
        sessionId = generateId();
        db.run(
          "INSERT INTO sessions (id, persona_id, title) VALUES (?, ?, ?)",
          [sessionId, personaId, "Percakapan Baru"]
        );
      } else {
        const sessionRow = db.query("SELECT persona_id FROM sessions WHERE id = ?").get(sessionId) as any;
        effectivePersonaId = sessionRow.persona_id;
      }

      const personaRow = db.query("SELECT config FROM personas WHERE id = ?").get(effectivePersonaId) as any;
      if (!personaRow) return json(404, { error: "Persona not found" });

      const persona: PersonaConfig = safeParseConfig(personaRow.config);
      const systemPrompt = getCachedPrompt(effectivePersonaId!, persona);

      const success = server.upgrade(req, {
        data: {
          context: {
            personaId: effectivePersonaId,
            sessionId,
            systemPrompt,
            ip,
          },
        },
      });
      return success ? undefined : new Response("Upgrade failed", { status: 500 });
    }
    return app.fetch(req);
  },
});

console.log(`aff-personal running on http://localhost:${port}`);

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
