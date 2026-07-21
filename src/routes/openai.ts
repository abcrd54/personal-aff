import { Hono } from "hono";
import { getDB, generateId, safeParseConfig } from "../db";
import { chatWithUsage, chatStream } from "../lib/llm";
import { getCachedPrompt } from "../lib/prompt";
import { apiKeyAuth } from "../middleware/auth";
import type { LLMMessage, PersonaConfig } from "../types";

const app = new Hono();

app.use("*", apiKeyAuth);

app.get("/models", (c) => {
  const db = getDB();
  const rows = db.query("SELECT id, name, created_at FROM personas ORDER BY created_at DESC").all() as any[];

  const data = rows.map((r: any) => ({
    id: r.name || r.id,
    object: "model",
    created: Math.floor(new Date(r.created_at).getTime() / 1000),
    owned_by: "aff-personal",
  }));

  return c.json({ object: "list", data });
});

app.post("/chat/completions", async (c) => {
  const db = getDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, 400);
  }

  const { model, messages, stream, temperature, max_tokens } = body;

  if (!model) {
    return c.json({ error: { message: "model is required", type: "invalid_request_error" } }, 400);
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: { message: "messages array is required", type: "invalid_request_error" } }, 400);
  }

  let personaId: string;
  let persona: PersonaConfig;

  const uuidRow = db.query("SELECT id, name, config FROM personas WHERE id = ?").get(model) as any;
  if (uuidRow) {
    personaId = uuidRow.id;
    persona = safeParseConfig(uuidRow.config);
  } else {
    const nameRows = db.query("SELECT id, name, config FROM personas WHERE LOWER(name) = LOWER(?)").all(model) as any[];
    if (nameRows.length === 0) {
      return c.json({ error: { message: `Persona '${model}' not found`, type: "invalid_request_error" } }, 404);
    }
    if (nameRows.length > 1) {
      const ids = nameRows.map((r: any) => r.id).join(", ");
      return c.json({
        error: {
          message: `Multiple personas found with name '${model}'. Use persona UUID instead. Available IDs: ${ids}`,
          type: "invalid_request_error",
        },
      }, 400);
    }
    personaId = nameRows[0].id;
    persona = safeParseConfig(nameRows[0].config);
  }

  const systemPrompt = getCachedPrompt(personaId, persona);

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m: any) => m.role !== "system")
      .map((m: any) => ({ role: m.role, content: typeof m.content === "string" ? m.content : String(m.content || "") }) as LLMMessage),
  ];

  if (stream) {
    const completionId = `chatcmpl-${generateId()}`;
    const created = Math.floor(Date.now() / 1000);
    const modelName = persona.name || personaId;

    const responseStream = new ReadableStream({
      async start(controller) {
        await chatStream(
          llmMessages,
          (chunk) => {
            controller.enqueue(
              `data: ${JSON.stringify({
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model: modelName,
                choices: [{ index: 0, delta: { content: chunk } }],
              })}\n\n`
            );
          },
          () => {
            controller.enqueue(
              `data: ${JSON.stringify({
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model: modelName,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              })}\n\n`
            );
            controller.enqueue("data: [DONE]\n\n");
            controller.close();
          },
          (err) => {
            controller.error(err);
          },
          { temperature, maxTokens: max_tokens }
        );
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await chatWithUsage(llmMessages, { temperature, maxTokens: max_tokens });
    const completionId = `chatcmpl-${generateId()}`;
    const created = Math.floor(Date.now() / 1000);
    const modelName = persona.name || personaId;

    return c.json({
      id: completionId,
      object: "chat.completion",
      created,
      model: modelName,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.content },
          finish_reason: "stop",
        },
      ],
      usage: result.usage,
    });
  } catch (err) {
    console.error("OpenAI chat error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Queue timeout") || errMsg.includes("waited too long")) {
      return c.json({ error: { message: "Server busy. Try again later.", type: "server_error" } }, 503);
    }
    return c.json({ error: { message: "LLM service unavailable", type: "server_error" } }, 502);
  }
});

export default app;
