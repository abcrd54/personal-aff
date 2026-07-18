import { Hono } from "hono";
import { getDB, generateId } from "../db";
import { apiKeyAuth } from "../middleware/auth";
import type { ChatSession } from "../types";

const app = new Hono();

app.use("*", apiKeyAuth);

app.post("/", async (c) => {
  const db = getDB();
  let body: { personaId?: string; title?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { personaId, title } = body;

  if (!personaId) return c.json({ error: "personaId is required" }, 400);

  const persona = db.query("SELECT id FROM personas WHERE id = ?").get(personaId) as any;
  if (!persona) return c.json({ error: "Persona not found" }, 404);

  const displayTitle = (title || "Percakapan Baru").slice(0, 200);
  const id = generateId();

  db.run(
    "INSERT INTO sessions (id, persona_id, title) VALUES (?, ?, ?)",
    [id, personaId, displayTitle]
  );

  const row = db.query(
    "SELECT id, persona_id, title, created_at, updated_at FROM sessions WHERE id = ?"
  ).get(id) as any;

  return c.json(sessionRow(row), 201);
});

app.get("/", (c) => {
  const db = getDB();
  const personaId = c.req.query("personaId");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  let rows: any[];

  if (personaId) {
    rows = db.query(
      "SELECT id, persona_id, title, created_at, updated_at FROM sessions WHERE persona_id = ?1 ORDER BY updated_at DESC LIMIT ?2"
    ).all(personaId, limit) as any[];
  } else {
    rows = db.query(
      "SELECT id, persona_id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?1"
    ).all(limit) as any[];
  }

  return c.json(rows.map(sessionRow));
});

app.get("/:id", (c) => {
  const db = getDB();
  const row = db.query(
    "SELECT id, persona_id, title, created_at, updated_at FROM sessions WHERE id = ?"
  ).get(c.req.param("id")) as any;

  if (!row) return c.json({ error: "Session not found" }, 404);
  return c.json(sessionRow(row));
});

app.get("/:id/messages", (c) => {
  const db = getDB();
  const session = db.query("SELECT id FROM sessions WHERE id = ?").get(c.req.param("id")) as any;
  if (!session) return c.json({ error: "Session not found" }, 404);

  const limit = Math.min(Number(c.req.query("limit")) || 100, 500);

  const rows = db.query(
    "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?"
  ).all(c.req.param("id"), limit) as any[];

  return c.json(
    rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    }))
  );
});

app.delete("/:id", (c) => {
  const db = getDB();
  const session = db.query("SELECT id FROM sessions WHERE id = ?").get(c.req.param("id")) as any;
  if (!session) return c.json({ error: "Session not found" }, 404);

  db.run("DELETE FROM sessions WHERE id = ?", [c.req.param("id")]);
  return c.json({ ok: true });
});

function sessionRow(row: any): ChatSession {
  return {
    id: row.id,
    personaId: row.persona_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default app;
