import { Hono } from "hono";
import { getDB, generateId, safeParseConfig } from "../db";
import { apiKeyAuth } from "../middleware/auth";
import { validatePersonaConfig } from "../middleware/validation";
import { invalidatePromptCache } from "../lib/prompt";
import type { PersonaConfig, Persona } from "../types";

const app = new Hono();

app.use("*", apiKeyAuth);

app.get("/", (c) => {
  const db = getDB();
  const rows = db.query("SELECT id, name, config, created_at, updated_at FROM personas ORDER BY created_at DESC").all() as any[];
  const personas = rows.map(rowToPersona);
  return c.json(personas);
});

app.get("/:id", (c) => {
  const db = getDB();
  const row = db.query("SELECT id, name, config, created_at, updated_at FROM personas WHERE id = ?").get(c.req.param("id")) as any;
  if (!row) return c.json({ error: "Persona not found" }, 404);
  return c.json(rowToPersona(row));
});

app.post("/", async (c) => {
  let config: any;
  try {
    config = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const errors = validatePersonaConfig(config);
  if (errors.length > 0) {
    return c.json({ error: "Validation failed", details: errors }, 422);
  }

  const db = getDB();
  const id = generateId();

  db.run(
    "INSERT INTO personas (id, name, config) VALUES (?, ?, ?)",
    [id, config.name, JSON.stringify(config)]
  );

  const row = db.query("SELECT id, name, config, created_at, updated_at FROM personas WHERE id = ?").get(id) as any;
  return c.json(rowToPersona(row), 201);
});

app.put("/:id", async (c) => {
  const db = getDB();
  const existing = db.query("SELECT id FROM personas WHERE id = ?").get(c.req.param("id")) as any;
  if (!existing) return c.json({ error: "Persona not found" }, 404);

  let config: any;
  try {
    config = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const oldRow = db.query("SELECT config FROM personas WHERE id = ?").get(c.req.param("id")) as any;
  const existingConfig = safeParseConfig(oldRow.config);
  const merged = { ...existingConfig, ...config };

  const errors = validatePersonaConfig(merged);
  if (errors.length > 0) {
    return c.json({ error: "Validation failed", details: errors }, 422);
  }

  db.run(
    "UPDATE personas SET name = ?, config = ?, updated_at = datetime('now') WHERE id = ?",
    [merged.name, JSON.stringify(merged), c.req.param("id")]
  );

  invalidatePromptCache(c.req.param("id"));

  const row = db.query("SELECT id, name, config, created_at, updated_at FROM personas WHERE id = ?").get(c.req.param("id")) as any;
  return c.json(rowToPersona(row));
});

app.delete("/:id", (c) => {
  const db = getDB();
  const existing = db.query("SELECT id FROM personas WHERE id = ?").get(c.req.param("id")) as any;
  if (!existing) return c.json({ error: "Persona not found" }, 404);

  db.run("DELETE FROM personas WHERE id = ?", [c.req.param("id")]);
  invalidatePromptCache(c.req.param("id"));
  return c.json({ ok: true });
});

function rowToPersona(row: any): Persona {
  const config = safeParseConfig(row.config);
  return {
    id: row.id,
    name: row.name || config.name || "Unknown",
    ...config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default app;
