import type { ServerWebSocket } from "bun";
import { getDB } from "../db";
import { chatStream } from "./llm";
import { getChatRateLimitKey } from "../middleware/ratelimit";
import { validateChatMessage } from "../middleware/validation";
import type { LLMMessage } from "../types";

interface WSContext {
  personaId: string;
  sessionId: string;
  systemPrompt: string;
  ip: string;
  pingInterval?: ReturnType<typeof setInterval>;
  streaming?: boolean;
}

export function initChatWS(ws: ServerWebSocket<unknown>) {
  const ctx = (ws.data as any)?.context as WSContext | undefined;
  if (!ctx) {
    ws.close(4000, "Missing context");
    return;
  }

  ctx.pingInterval = setInterval(() => {
    try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
  }, 30_000);
}

export function handleChatMessage(ws: ServerWebSocket<unknown>, msg: string) {
  const ctx = (ws.data as any)?.context as WSContext | undefined;
  if (!ctx) return;

  if (ctx.streaming) {
    ws.send(JSON.stringify({ type: "error", message: "Previous message still streaming" }));
    return;
  }

  if (getChatRateLimitKey(`ws:msg:${ctx.ip}`)) {
    ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
    return;
  }

  let data: any;
  try {
    data = JSON.parse(msg);
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    return;
  }

  if (!data.message) {
    ws.send(JSON.stringify({ type: "error", message: "message is required" }));
    return;
  }

  const msgErrors = validateChatMessage(data.message);
  if (msgErrors.length > 0) {
    ws.send(JSON.stringify({ type: "error", message: msgErrors[0].message }));
    return;
  }

  const db = getDB();
  const { sessionId, systemPrompt } = ctx;

  const insertResult = db.run(
    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
    [sessionId, "user", data.message]
  );
  const userMsgId = insertResult.lastInsertRowid;

  const history = db.query(
    "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50"
  ).all(sessionId) as any[];

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h: any) => ({ role: h.role, content: h.content }) as LLMMessage),
  ];

  ctx.streaming = true;

  chatStream(
    messages,
    (chunk) => {
      ws.send(JSON.stringify({ type: "chunk", content: chunk }));
    },
    (full) => {
      db.run("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", [sessionId, "assistant", full]);
      db.run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [sessionId]);
      ws.send(JSON.stringify({ type: "done" }));
      ctx.streaming = false;
    },
    (err) => {
      console.error("WS chat stream error:", err);
      db.run("DELETE FROM messages WHERE id = ?", [userMsgId]);
      const m = err?.message || "LLM service unavailable";
      ws.send(JSON.stringify({ type: "error", message: m.includes("Queue") ? "Server busy, try again." : "LLM service unavailable" }));
      ctx.streaming = false;
    }
  );
}

export function cleanupChatWS(ws: ServerWebSocket<unknown>) {
  const ctx = (ws.data as any)?.context as WSContext | undefined;
  if (ctx?.pingInterval) {
    clearInterval(ctx.pingInterval);
  }
}
