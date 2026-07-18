import { Hono } from "hono";
import { chat } from "../lib/llm";
import { apiKeyAuth } from "../middleware/auth";
import { getChatRateLimitKey } from "../middleware/ratelimit";
import type { LLMMessage } from "../types";

const app = new Hono();

app.use("*", apiKeyAuth);

function sanitize(s: string): string {
  return s.replace(/[\n\r"']/g, " ").slice(0, 500);
}

app.post("/enhance-backstory", async (c) => {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  if (getChatRateLimitKey(ip)) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return c.json({ error: "Request body must be an object" }, 400);
  }

  const name = sanitize(body.name || "Unnamed");
  const type = body.type || "personal";
  const traits = (body.traits || []).map(sanitize).join(", ") || "umum";
  const hobbies = (body.hobbies || []).map(sanitize).join(", ") || "tidak disebutkan";
  const expertise = (body.expertise || []).map(sanitize).join(", ") || "tidak disebutkan";
  const occupation = sanitize(body.occupation || "tidak disebutkan");
  const gender = sanitize(body.gender || "");
  const age = typeof body.age === "number" ? String(body.age) : "";
  const location = sanitize(body.location || "");
  const tone = sanitize(body.tone || "hangat");
  const language = sanitize(body.language || "indonesia");
  const businessName = sanitize(body.business?.businessName || "");
  const businessType = sanitize(body.business?.businessType || "");

  const isBusiness = type === "business";

  const systemPrompt = `You are an AI persona designer. Your job is to generate rich, detailed, and consistent persona configurations for a chat agent.
Respond ONLY with valid JSON. No explanations, no markdown, no code fences — just the raw JSON object.

The JSON must follow this structure exactly:
{
  "backstory": "string — 2-4 paragraphs, rich backstory with specific details, experiences, and personality",
  "catchphrases": ["string", "string", "string"],
  "greetingStyle": "string — natural opening greeting this persona would use",
  "conversationStarters": ["string", "string", "string"],
  "behavioralRules": {
    "dos": ["string", "string", "string", "string"],
    "donts": ["string", "string", "string"]
  },
  "responsePatterns": ["string", "string", "string"],
  "speechStyle": { "formality": number(1-5), "verbosity": number(1-5), "emotionality": number(1-5), "humorLevel": number(1-5) },
  "values": ["string", "string", "string"],
  "lifeGoals": ["string", "string"],
  "quirks": ["string", "string"],
  "vocabularyStyle": ["string", "string"]
}`;

  let userPrompt = `Create a detailed persona configuration for ${isBusiness ? "a business/customer service agent" : "a personal assistant/friend"} with these characteristics:

Name: ${name}${gender ? `\nGender: ${gender}` : ""}${age ? `\nAge: ${age}` : ""}${location ? `\nLocation: ${location}` : ""}${occupation ? `\nOccupation: ${occupation}` : ""}
Type: ${type}
Personality Traits: ${traits}${isBusiness ? "" : `\nHobbies: ${hobbies}`}
Expertise: ${expertise}
Communication Tone: ${tone}
Language: ${language}`;

  if (isBusiness && businessName) {
    userPrompt += `\nBusiness Name: ${businessName}\nBusiness Type: ${businessType}`;
    userPrompt += `\n\nIMPORTANT: This is a business persona. Focus on customer service professionalism, product knowledge, and business communication style.`;
    userPrompt += `\n- backstory should describe the business history, reputation, and values`;
    userPrompt += `\n- greetingStyle should be a professional welcome greeting`;
    userPrompt += `\n- conversationStarters should be questions about customer needs`;
    userPrompt += `\n- behavioralRules should focus on customer service best practices`;
    userPrompt += `\n- values should reflect business ethics`;
  } else {
    userPrompt += `\n\nIMPORTANT: This is a personal persona. Make them feel like a real person with depth, quirks, and unique voice.`;
    userPrompt += `\n- backstory should read like a mini-biography with specific life experiences`;
    userPrompt += `\n- catchphrases should be natural expressions this person would actually say`;
    userPrompt += `\n- greetingStyle should be warm and personal`;
    userPrompt += `\n- conversationStarters should feel natural for this person's interests`;
    userPrompt += `\n- values and lifeGoals should be authentic and align with their personality`;
    userPrompt += `\n- quirks should be small, endearing habits or preferences`;
  }

  userPrompt += `\n\nGenerate in ${language === "english" ? "English" : "Indonesian"} language.

IMPORTANT: Backstory should be at least 200 characters. All fields must be filled with quality content. No placeholder or generic text.
Respond with ONLY the JSON object, nothing else.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await chat(messages);
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // remove control chars
      .trim();

    let result: any = null;

    // Strategy 1: direct parse
    try { result = JSON.parse(cleaned); } catch {}

    // Strategy 2: extract JSON object with regex
    if (!result) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    // Strategy 3: auto-repair common JSON issues
    if (!result) {
      result = repairJSON(cleaned);
    }

    // Strategy 4: use raw text as backstory, generate rest
    if (!result) {
      result = {
        backstory: cleaned.slice(0, 2000),
        catchphrases: [],
        greetingStyle: `Halo! Ada yang bisa saya bantu?`,
        conversationStarters: [],
        behavioralRules: { dos: ["Bersikap ramah dan membantu"], donts: ["Jangan kasar"] },
        responsePatterns: [],
        speechStyle: { formality: 2, verbosity: 3, emotionality: 3, humorLevel: 2 },
        values: [],
        lifeGoals: [],
        quirks: [],
        vocabularyStyle: [],
      };
    }

    // Sanitize: ensure all required fields exist with defaults
    const enhanced = {
      backstory: result.backstory || body.backstory || `Profil dari ${name}.`,
      catchphrases: Array.isArray(result.catchphrases) ? result.catchphrases.slice(0, 5) : [],
      greetingStyle: result.greetingStyle || `Halo! Ada yang bisa saya bantu?`,
      conversationStarters: Array.isArray(result.conversationStarters) ? result.conversationStarters.slice(0, 5) : [],
      behavioralRules: {
        dos: Array.isArray(result.behavioralRules?.dos) ? result.behavioralRules.dos.slice(0, 10) : [],
        donts: Array.isArray(result.behavioralRules?.donts) ? result.behavioralRules.donts.slice(0, 10) : [],
      },
      responsePatterns: Array.isArray(result.responsePatterns) ? result.responsePatterns.slice(0, 10) : [],
      speechStyle: {
        formality: clamp(result.speechStyle?.formality, 1, 5, 2),
        verbosity: clamp(result.speechStyle?.verbosity, 1, 5, 3),
        emotionality: clamp(result.speechStyle?.emotionality, 1, 5, 3),
        humorLevel: clamp(result.speechStyle?.humorLevel, 1, 5, 2),
      },
      values: Array.isArray(result.values) ? result.values.slice(0, 10) : [],
      lifeGoals: Array.isArray(result.lifeGoals) ? result.lifeGoals.slice(0, 5) : [],
      quirks: Array.isArray(result.quirks) ? result.quirks.slice(0, 5) : [],
      vocabularyStyle: Array.isArray(result.vocabularyStyle) ? result.vocabularyStyle.slice(0, 5) : [],
    };

    // Merge with original body, letting AI fields override
    const final = { ...body, ...enhanced };

    return c.json(final);
  } catch (err: any) {
    return c.json({ error: "AI generation failed", message: err.message }, 502);
  }
});

function clamp(val: any, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || isNaN(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function repairJSON(text: string): any {
  try {
    // Find outermost braces
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1) return null;

    let json = text.slice(start, (end !== -1 ? end + 1 : undefined));

    // Count braces and brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (const ch of json) {
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === "\\") { escapeNext = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
      if (ch === "[") bracketCount++;
      if (ch === "]") bracketCount--;
    }

    // Add missing closing brackets
    while (bracketCount > 0) { json += "]"; bracketCount--; }
    while (braceCount > 0) { json += "}"; braceCount--; }

    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default app;
