import type { LLMConfig, LLMMessage } from "../types";
import { ConcurrencyQueue } from "./queue";

const FETCH_TIMEOUT_MS = 120_000;
const MAX_CONCURRENCY = Number(process.env.LLM_MAX_CONCURRENCY) || 3;
const QUEUE_TIMEOUT_MS = Number(process.env.LLM_QUEUE_TIMEOUT_MS) || 60_000;

const llmQueue = new ConcurrencyQueue(MAX_CONCURRENCY, QUEUE_TIMEOUT_MS);

export function queueStatus() {
  return llmQueue.status();
}

function getConfig(): LLMConfig {
  return {
    provider: process.env.LLM_PROVIDER || "openai",
    apiKey: process.env.LLM_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.8,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(messages: LLMMessage[]): Promise<string> {
  return llmQueue.enqueue(async () => {
    const config = getConfig();

    const response = await fetchWithTimeout(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
        }),
      },
      FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${text}`);
    }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.warn("LLM returned empty/missing content. Response shape:", JSON.stringify(data).slice(0, 200));
  }
  return content || "";
  });
}

export async function chatStream(
  messages: LLMMessage[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    await llmQueue.enqueue(async () => {
    const config = getConfig();

    const response = await fetchWithTimeout(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          stream: true,
        }),
      },
      FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {}
      }
    }

    onDone(fullText);
    }).catch(onError);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
