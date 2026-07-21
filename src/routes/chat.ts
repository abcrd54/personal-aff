import { Hono } from "hono";
import { getDB, generateId, safeParseConfig } from "../db";
import { chat } from "../lib/llm";
import { getCachedPrompt } from "../lib/prompt";
import { apiKeyAuth } from "../middleware/auth";
import { getChatRateLimitKey } from "../middleware/ratelimit";
import { validateChatMessage } from "../middleware/validation";
import type { LLMMessage, PersonaConfig } from "../types";

const app = new Hono();

app.use("/", apiKeyAuth);

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

export default app;
