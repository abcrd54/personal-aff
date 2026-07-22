import { Hono } from "hono";
import { getDB, safeParseConfig } from "../db";
import { chat } from "../lib/llm";
import { apiKeyAuth } from "../middleware/auth";
import { getChatRateLimitKey, getClientIP } from "../middleware/ratelimit";
import { getCaptionSystemPrompt, getImageSystemPrompt } from "../lib/prompt-loader";
import type { LLMMessage, PersonaConfig } from "../types";

const app = new Hono();

app.use("*", apiKeyAuth);

function getPersona(personaId: string): PersonaConfig | null {
  const db = getDB();
  const row = db.query("SELECT config FROM personas WHERE id = ?").get(personaId) as any;
  if (!row) return null;
  const config = safeParseConfig(row.config);
  if (!config || !config.name || !config.type || !["personal", "business"].includes(config.type)) {
    return null;
  }
  return config;
}

function buildIdentityBlock(p: PersonaConfig): string {
  const s = (v: string) => (v || "").replace(/[\n\r]/g, " ").slice(0, 500);
  const lines: string[] = [];
  lines.push(`Nama: ${s(p.displayName || p.name)}`);
  if (p.occupation) lines.push(`Profesi: ${s(p.occupation)}`);
  if (p.location) lines.push(`Lokasi: ${s(p.location)}`);
  if (p.age) lines.push(`Usia: ${p.age}`);
  lines.push(`Kepribadian: ${(p.traits || []).map(s).join(", ")}`);
  if (p.expertise?.length) lines.push(`Keahlian: ${p.expertise.map(s).join(", ")}`);
  if (p.hobbies?.length) lines.push(`Hobi: ${p.hobbies.map(s).join(", ")}`);
  if (p.catchphrases?.length) lines.push(`Catchphrase: ${p.catchphrases.map(s).join(" | ")}`);
  lines.push(`Gaya komunikasi: ${p.tone}`);
  if (p.vocabularyStyle?.length) lines.push(`Cara bicara: ${p.vocabularyStyle.map(s).join("; ")}`);
  lines.push(`Backstory: ${s(p.backstory)}`);
  if (p.lifeGoals?.length) lines.push(`Tujuan hidup: ${p.lifeGoals.map(s).join("; ")}`);
  return lines.join("\n");
}

// ==================== GENERATE CAPTION ====================

app.post("/generate-caption", async (c) => {
  const ip = getClientIP(c);
  if (getChatRateLimitKey(ip)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const personaId = body.personaId;
  const topic = body.topic || body.productName || "";
  const count = Math.min(body.count || 1, 5);
  const mode = body.mode || "affiliate";

  if (!personaId || !topic) {
    return c.json({ error: "personaId and topic (or productName) are required" }, 400);
  }

  const persona = getPersona(personaId);
  if (!persona) return c.json({ error: "Persona not found" }, 404);

  const isPersonal = persona.type === "personal";
  const actualMode = isPersonal ? (mode === "natural" ? "natural" : "affiliate") : "catalog";

  const cs = persona.captionStyle || { platform: "instagram", tone: persona.tone, emojiUsage: "moderate", hashtagCount: 5 };
  const platform = body.platform || cs.platform;
  const tone = body.tone || cs.tone;
  const emojiPref = body.emojiUsage || cs.emojiUsage;
  const hashtagCount = Math.min(body.hashtagCount ?? cs.hashtagCount ?? 5, 30);
  const cta = body.callToAction || cs.callToAction || "checkout link di bio";
  const effectiveCta = actualMode === "natural" ? "save & share ke temen" : actualMode === "affiliate" ? (cs.callToAction || "checkout link di bio") : "DM atau klik link di bio untuk order!";
  const format = body.formattingStyle || cs.formattingStyle || "paragraph with line breaks, bold key points with emojis";

  const platformLimits: Record<string, number> = {
    twitter: 280, tiktok: 150, threads: 500,
    instagram: 400, facebook: 400, whatsapp: 500
  };
  const isThreadPlatform = platform === "twitter" || platform === "threads";

  let maxLen: number;
  let isThread: boolean;

  if (actualMode === "natural") {
    maxLen = body.maxLength || cs.maxLength || platformLimits[platform] || 400;
    isThread = isThreadPlatform;
  } else if (actualMode === "affiliate") {
    maxLen = body.maxLength || cs.maxLength || (isThreadPlatform ? platformLimits[platform] : 800);
    isThread = false;
  } else {
    maxLen = body.maxLength || cs.maxLength || 2200;
    isThread = false;
  }

  let platformInstructions: string;
  if (isThread) {
    platformInstructions = `PLATFORM: ${platform} — THREAD FORMAT. Buat 3-5 bagian yang saling sambung, max ${maxLen} char per bagian. Pisahkan dengan "---". Part 1 = hook kuat, part terakhir = CTA.`;
  } else if (actualMode === "natural") {
    platformInstructions = `PLATFORM: ${platform} — SINGLE POST, pendek padat, max ${maxLen} karakter.`;
  } else if (actualMode === "affiliate") {
    platformInstructions = `PLATFORM: ${platform} — SINGLE POST, cukup panjang untuk cerita + rekomendasi, max ${maxLen} karakter. Tetap terasa personal.`;
  } else {
    platformInstructions = `PLATFORM: ${platform} — SINGLE POST, format katalog/spesifikasi, max ${maxLen} karakter.`;
  }

  const emojiInstruction = emojiPref === "heavy" ? "pakai banyak emoji, hampir setiap kalimat" : emojiPref === "moderate" ? "pakai emoji secukupnya, 1-2 per paragraf" : emojiPref === "minimal" ? "pakai emoji hanya saat penting" : "jangan pakai emoji sama sekali";

  const ctaText = actualMode === "natural"
    ? `Akhiri dengan ajakan personal "${effectiveCta}"`
    : actualMode === "affiliate"
    ? `Akhiri dengan ajakan natural "${effectiveCta}"`
    : `Akhiri dengan CTA jelas "${effectiveCta}"`;

  const countInstruction = isThread
    ? `BUAT THREAD ${platform === "twitter" ? "3-5 tweet" : "3-5 post"} yang saling sambung. Tiap bagian maks ${maxLen} karakter. Part 1 = hook, part terakhir = CTA. Pisahkan dengan "---". Bahasa: ${persona.language === "english" ? "Inggris" : persona.language === "campur" ? "campur Indonesia-Inggris" : "Indonesia"}.`
    : count > 1
    ? `BUAT ${count} VARIASI caption dengan angle berbeda. Masing-masing maks ${maxLen} karakter. Pisahkan dengan "---".`
    : `BUAT 1 caption maks ${maxLen} karakter.`;

  const systemPrompt = getCaptionSystemPrompt({
    format,
    tone,
    emojiInstructions: `${emojiPref} — ${emojiInstruction}`,
    platformInstructions,
    cta: ctaText,
    hashtagCount: String(hashtagCount),
    maxLength: String(maxLen),
    mode: actualMode,
  }) + "\n" + countInstruction;

  let userPrompt = `IDENTITAS AKUN:\n${buildIdentityBlock(persona)}${cs.examples?.length ? `\n\nCONTOH CAPTION SEBELUMNYA:\n${cs.examples.map((e, i) => `${i + 1}. ${e}`).join("\n")}` : ""}`;

  if ((actualMode === "affiliate" || actualMode === "catalog") && persona.products?.length) {
    userPrompt += `\n\nPRODUK YANG DIJUAL (rekomendasikan 1-2 yang relevan):\n${persona.products.map(p => `- ${p.name}: ${p.description} | ${p.price || ""}`).join("\n")}`;
  }

  userPrompt += `\n\nTOPIK / KONTEKS: ${topic}\nBuat caption yang engaging, personal, dan sesuai identitas akun di atas.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await chat(messages);
    const captions = raw
      .replace(/```[\s\S]*?```/g, "")
      .split("---")
      .map((s: string) => s.trim())
      .filter(Boolean);

    return c.json({
      personaId,
      topic,
      platform,
      mode: actualMode,
      captions: captions.length > 0 ? captions : [raw.trim()],
      ...(isThread ? { thread: true, parts: captions.length } : {}),
      maxLength: maxLen,
    });
  } catch (err: any) {
    return c.json({ error: "Generation failed", message: err.message }, 502);
  }
});

// ==================== GENERATE IMAGE PROMPT ====================

app.post("/generate-image-prompt", async (c) => {
  const ip = getClientIP(c);
  if (getChatRateLimitKey(ip)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const personaId = body.personaId;
  const productName = body.productName || body.topic || "";
  const scene = body.scene || "";
  const count = Math.min(body.count || 1, 3);
  const engine = body.engine || "midjourney";
  const mode = body.mode || "affiliate";

  if (!personaId || !productName) {
    return c.json({ error: "personaId and productName (or topic) are required" }, 400);
  }

  const persona = getPersona(personaId);
  if (!persona) return c.json({ error: "Persona not found" }, 404);

  const isPersonal = persona.type === "personal";
  const actualMode = isPersonal ? (mode === "natural" ? "natural" : "affiliate") : "catalog";

  const vs = persona.visualStyle || {
    aspectRatio: "1:1",
    lighting: "natural",
    background: "lifestyle",
    mood: "warm and inviting",
  };

  const aspectRatio = body.aspectRatio || vs.aspectRatio;
  const lighting = body.lighting || vs.lighting;
  const background = body.background || vs.background;
  const mood = body.mood || vs.mood;
  const colorPalette = vs.colorPalette?.length ? vs.colorPalette.join(", ") : "warna yang cocok dengan mood " + mood;
  const composition = body.composition || vs.composition || "produk sebagai focal point di tengah";
  const props = vs.props?.length ? vs.props.join(", ") : "";

  const engineInstructions = engine === "midjourney"
    ? `Format Midjourney: deskripsi detail bahasa Inggris, dengan parameter --ar ${aspectRatio.replace(":", "_")} --style raw. English only.`
    : engine === "dalle"
    ? `Format DALL-E 3: natural language, fokus scene & mood.`
    : `Format ${engine}: deskripsi detail untuk AI image generator.`;

  const systemPrompt = getImageSystemPrompt({
    engineInstructions,
    mode: actualMode,
  });

  const userPrompt = `IDENTITAS AKUN:\n${buildIdentityBlock(persona)}
NICHE: ${persona.name} — ${persona.type === "business" ? persona.business?.tagline || persona.business?.businessType || "" : persona.occupation || persona.name}
VISUAL STYLE:
- Mood: ${mood}
- Lighting: ${lighting}
- Background: ${background}
- Color: ${colorPalette}
- Composition: ${composition}${props ? `\n- Props: ${props}` : ""}

${actualMode === "natural" ? `SCENE / SETTING: ${scene || productName}` : `PRODUK / SUBJEK: ${productName}${scene ? `\nSCENE: ${scene}` : ""}`}

${count > 1 ? `Buat ${count} variasi prompt dengan angle atau komposisi berbeda. Pisahkan dengan "---".` : "Buat 1 prompt terbaik."}`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await chat(messages);
    const promptsRaw = raw
      .replace(/```[\s\S]*?```/g, "")
      .split("---")
      .map((s: string) => s.trim())
      .filter(Boolean);

    const prompts = promptsRaw.length > 0 ? promptsRaw : [raw.trim()];

    return c.json({
      personaId,
      productName,
      engine,
      aspectRatio: aspectRatio,
      mode: actualMode,
      prompts,
      visualNote: `Lighting: ${lighting} | Background: ${background} | Mood: ${mood} | Composition: ${composition}`,
    });
  } catch (err: any) {
    return c.json({ error: "Generation failed", message: err.message }, 502);
  }
});

export default app;
