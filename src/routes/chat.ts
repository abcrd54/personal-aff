import { Hono } from "hono";
import { getDB, generateId, safeParseConfig } from "../db";
import { chat, chatStream } from "../lib/llm";
import { getCachedPrompt } from "../lib/prompt";
import { apiKeyAuth } from "../middleware/auth";
import { getChatRateLimitKey } from "../middleware/ratelimit";
import { validateChatMessage } from "../middleware/validation";
import type { LLMMessage, PersonaConfig } from "../types";

const app = new Hono();

app.use("/", apiKeyAuth);
app.use("/ws", apiKeyAuth);

app.post("/", async (c) => {
  const db = getDB();
  let body: { personaId?: string; message?: string; sessionId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { personaId, message, sessionId } = body;

  if (!personaId || !message) {
    return c.json({ error: "personaId and message are required" }, 400);
  }

  const msgErrors = validateChatMessage(message);
  if (msgErrors.length > 0) {
    return c.json({ error: "Validation failed", details: msgErrors }, 422);
  }

  const personaRow = db.query("SELECT config FROM personas WHERE id = ?").get(personaId) as any;
  if (!personaRow) return c.json({ error: "Persona not found" }, 404);

  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  if (getChatRateLimitKey(ip)) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  const persona: PersonaConfig = safeParseConfig(personaRow.config);
  const systemPrompt = getCachedPrompt(personaId, persona);

  let sid = sessionId;
  let newSessionCreated = false;
  if (sid) {
    const existing = db.query("SELECT id FROM sessions WHERE id = ? AND persona_id = ?").get(sid, personaId) as any;
    if (!existing) sid = null;
  }
  if (!sid) {
    sid = generateId();
    newSessionCreated = true;
    db.run(
      "INSERT INTO sessions (id, persona_id, title) VALUES (?, ?, ?)",
      [sid, personaId, message.slice(0, 100)]
    );
  }

  const history = db.query(
    "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50"
  ).all(sid) as any[];

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h: any) => ({ role: h.role, content: h.content }) as LLMMessage),
    { role: "user", content: message },
  ];

  const insertResult = db.run(
    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
    [sid, "user", message]
  );
  const userMsgId = insertResult.lastInsertRowid;

  try {
    const reply = await chat(messages);

    db.run(
      "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
      [sid, "assistant", reply]
    );

    db.run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [sid]);

    return c.json({ sessionId: sid, reply });
  } catch (err) {
    console.error("Chat error:", err);
    db.run("DELETE FROM messages WHERE id = ?", [userMsgId]);
    if (newSessionCreated) {
      db.run("DELETE FROM sessions WHERE id = ?", [sid]);
    }

    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Queue timeout") || errMsg.includes("waited too long")) {
      return c.json({ error: "Server busy. Too many requests. Try again later." }, 503);
    }
    return c.json({ error: "LLM service unavailable" }, 502);
  }
});

app.get("/ws", (c) => {
  const sessionId = c.req.query("sessionId");
  const personaId = c.req.query("personaId");

  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  if (getChatRateLimitKey(ip)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  if (!sessionId && !personaId) {
    return c.json({ error: "sessionId or personaId is required" }, 400);
  }

  const upgrade = c.req.raw.headers.get("upgrade");
  if (!upgrade || upgrade.toLowerCase() !== "websocket") {
    return c.json({ error: "Use WebSocket upgrade to connect" }, 426);
  }

  // WS origin validation
  const origin = c.req.raw.headers.get("origin");
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
    return c.json({ error: "Forbidden origin" }, 403);
  }

  const db = getDB();

  let sid = sessionId;
  if (sid) {
    const existing = db.query("SELECT id, persona_id FROM sessions WHERE id = ?").get(sid) as any;
    if (!existing) {
      if (!personaId) return c.json({ error: "Session not found" }, 404);
      sid = null;
    }
  }
  if (!sid && personaId) {
    const persona = db.query("SELECT id FROM personas WHERE id = ?").get(personaId) as any;
    if (!persona) return c.json({ error: "Persona not found" }, 404);
    sid = generateId();
    db.run(
      "INSERT INTO sessions (id, persona_id, title) VALUES (?, ?, ?)",
      [sid, personaId, "Percakapan Baru"]
    );
  }
  if (!sid) return c.json({ error: "Session not found" }, 404);

  const sessionRow = db.query("SELECT persona_id FROM sessions WHERE id = ?").get(sid) as any;
  const perc = db.query("SELECT config FROM personas WHERE id = ?").get(sessionRow.persona_id) as any;
  if (!perc) return c.json({ error: "Persona not found" }, 404);

  const persona: PersonaConfig = safeParseConfig(perc.config);
  const systemPrompt = getCachedPrompt(sessionRow.persona_id, persona);

  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  server.accept();

  const pingInterval = setInterval(() => {
    try {
      server.send(JSON.stringify({ type: "ping" }));
    } catch {
      clearInterval(pingInterval);
    }
  }, 30_000);

  server.addEventListener("close", () => {
    clearInterval(pingInterval);
  });

  server.addEventListener("message", async (event) => {
    // Per-message rate check using dedicated WS counter
    const msgRateKey = `ws:msg:${ip}`;
    if (getChatRateLimitKey(msgRateKey)) {
      server.send(JSON.stringify({ type: "error", message: "Message rate limit exceeded" }));
      return;
    }

    try {
      let data: any;
      try {
        data = JSON.parse(event.data.toString());
      } catch {
        server.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }
      if (!data.message) {
        server.send(JSON.stringify({ type: "error", message: "message is required" }));
        return;
      }

      const msgErrors = validateChatMessage(data.message);
      if (msgErrors.length > 0) {
        server.send(JSON.stringify({ type: "error", message: msgErrors[0].message }));
        return;
      }

      const insertResult = db.run(
        "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
        [sid, "user", data.message]
      );
      const userMsgId = insertResult.lastInsertRowid;

      const history = db.query(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50"
      ).all(sid) as any[];

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((h: any) => ({ role: h.role, content: h.content }) as LLMMessage),
      ];

      let fullReply = "";

      await chatStream(
        messages,
        (chunk) => {
          server.send(JSON.stringify({ type: "chunk", content: chunk }));
        },
        (full) => {
          fullReply = full;
          db.run(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            [sid, "assistant", fullReply]
          );
          db.run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [sid]);
          server.send(JSON.stringify({ type: "done" }));
        },
        (err) => {
          console.error("WS chat stream error:", err);
          db.run("DELETE FROM messages WHERE id = ?", [userMsgId]);
          const msg = err?.message || "LLM service unavailable";
          server.send(JSON.stringify({ type: "error", message: msg.includes("Queue") ? "Server busy, try again." : "LLM service unavailable" }));
        }
      );
    } catch (err: any) {
      server.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  return new Response(null, { status: 101, webSocket: client });
});

export default app;
