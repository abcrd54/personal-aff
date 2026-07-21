import type { PersonaConfig, PersonaSpeechStyle } from "../types";

const MAX_CACHE_SIZE = 500;
const PROMPT_MIN_LENGTH = 50;
const promptCache = new Map<string, string>();
const promptHashCache = new Map<string, string>();

function evictOldest() {
  if (promptCache.size > MAX_CACHE_SIZE) {
    const oldest = promptCache.keys().next().value;
    if (oldest) {
      promptCache.delete(oldest);
      promptHashCache.delete(oldest);
    }
  }
}

function configHash(config: PersonaConfig): string {
  const keys = [
    "type", "name", "displayName", "age", "gender", "location", "occupation",
    "tone", "language", "customSystemPrompt", "mbti", "relationshipToUser",
  ] as const;
  const parts = keys.map((k) => String(config[k] ?? ""));
  parts.push(config.backstory?.slice(0, 100) || "");

  const arrFields = [
    "traits", "values", "quirks", "hobbies", "expertise", "favoriteThings",
    "dislikes", "lifeGoals", "recentExperiences", "catchphrases",
    "vocabularyStyle", "conversationStarters", "responsePatterns",
  ] as const;
  for (const f of arrFields) {
    const arr = config[f] as string[] | undefined;
    parts.push(arr ? arr.join(",").slice(0, 100) : "");
  }

  if (config.behavioralRules) {
    parts.push(config.behavioralRules.dos?.join(",")?.slice(0, 100) || "");
    parts.push(config.behavioralRules.donts?.join(",")?.slice(0, 100) || "");
  }

  if (config.speechStyle) {
    parts.push(String(config.speechStyle.formality));
    parts.push(String(config.speechStyle.verbosity));
    parts.push(String(config.speechStyle.emotionality));
    parts.push(String(config.speechStyle.humorLevel));
  }

  if (config.greetingStyle) parts.push(config.greetingStyle.slice(0, 100));
  if (config.knownAboutUser) {
    parts.push(config.knownAboutUser.name || "");
    parts.push(config.knownAboutUser.history || "");
    parts.push(config.knownAboutUser.interests?.join(",")?.slice(0, 100) || "");
  }

  if (config.type === "business" && config.business) {
    parts.push(config.business.businessName);
    parts.push(config.business.businessType);
    parts.push(config.business.tagline || "");
    parts.push(String(config.business.products?.length ?? 0));
    parts.push(String(config.business.faq?.length ?? 0));
    parts.push(String(config.business.services?.length ?? 0));
    parts.push(String(config.business.policies?.length ?? 0));
    if (config.business.products) {
      parts.push(config.business.products.map(p => p.name + (p.price || "")).join(",").slice(0, 200));
    }
  }

  if (config.products && config.products.length > 0) {
    parts.push(String(config.products.length));
    parts.push(config.products.map(p => p.name + (p.price || "")).join(",").slice(0, 200));
  }

  return parts.join("|");
}

export function getCachedPrompt(personaId: string, config: PersonaConfig): string {
  const hash = configHash(config);

  if (promptHashCache.get(personaId) === hash) {
    const cached = promptCache.get(personaId);
    if (cached) return cached;
  }

  const prompt = buildSystemPrompt(config);
  if (prompt.length < PROMPT_MIN_LENGTH) {
    throw new Error("Generated prompt too short — persona config may be corrupted");
  }
  promptCache.set(personaId, prompt);
  promptHashCache.set(personaId, hash);
  evictOldest();
  return prompt;
}

export function invalidatePromptCache(personaId: string): void {
  promptCache.delete(personaId);
  promptHashCache.delete(personaId);
}

function buildSystemPrompt(persona: PersonaConfig): string {
  if (!persona.type || !persona.name) {
    throw new Error("Persona config missing required fields: type and name");
  }

  if (persona.customSystemPrompt) {
    return persona.customSystemPrompt;
  }

  if (persona.type === "business") {
    return buildBusinessPrompt(persona);
  }

  return buildPersonalPrompt(persona);
}

function safe(s: string): string {
  return s.replace(/[\n\r]/g, " ").slice(0, 2000);
}

function buildPersonalPrompt(persona: PersonaConfig): string {
  const parts: string[] = [];
  const name = safe(persona.displayName || persona.name);
  const location = safe(persona.location || "");

  parts.push(`Kamu adalah ${name}${persona.age ? `, ${persona.age} tahun` : ""}${persona.gender ? ` (${safe(persona.gender)})` : ""}${location ? ` dari ${location}` : ""}.`);
  if (persona.occupation) parts.push(`Profesi: ${safe(persona.occupation)}.`);

  if (persona.traits.length > 0) {
    parts.push(`\nKEPRIBADIAN: ${persona.mbti ? safe(persona.mbti) + " - " : ""}${persona.traits.map(safe).join(", ")}.`);
  }
  if (persona.values?.length) parts.push(`NILAI HIDUP: ${persona.values.map(safe).join(", ")}.`);
  if (persona.quirks?.length) parts.push(`KEBIASAAN UNIK: ${persona.quirks.map(safe).join("; ")}.`);

  if (persona.hobbies && persona.hobbies.length > 0) {
    parts.push(`\nHOBI: ${persona.hobbies.map(safe).join(", ")}.`);
  }
  if (persona.expertise?.length) parts.push(`KEAHLIAN: ${persona.expertise.map(safe).join(", ")}.`);
  if (persona.favoriteThings?.length) parts.push(`HAL FAVORIT: ${persona.favoriteThings.map(safe).join(", ")}.`);
  if (persona.dislikes?.length) parts.push(`HAL TIDAK DISUKAI: ${persona.dislikes.map(safe).join(", ")}.`);

  parts.push(`\nLATAR BELAKANG: ${safe(persona.backstory)}`);
  if (persona.lifeGoals?.length) parts.push(`TUJUAN HIDUP: ${persona.lifeGoals.map(safe).join("; ")}.`);
  if (persona.recentExperiences?.length) parts.push(`PENGALAMAN TERBARU: ${persona.recentExperiences.map(safe).join("; ")}.`);

  parts.push(`\nGAYA BICARA: ${toneLabel(persona.tone)}${persona.language ? `, bahasa ${languageLabel(persona.language)}` : ""}.`);
  if (persona.speechStyle) {
    parts.push(`Detail gaya: ${speechStyleLabel(persona.speechStyle)}.`);
  }
  if (persona.catchphrases?.length) parts.push(`CATCHPHRASE: ${persona.catchphrases.map((c) => `"${safe(c)}"`).join(", ")}.`);
  if (persona.vocabularyStyle?.length) parts.push(`CARA BERBICARA: ${persona.vocabularyStyle.map(safe).join("; ")}.`);

  parts.push(buildRelationshipSection(persona));
  parts.push(buildRulesSection(persona));

  if (persona.responsePatterns?.length) {
    parts.push(`\nPOLA RESPON:\n${persona.responsePatterns.map((r) => `  - ${safe(r)}`).join("\n")}`);
  }

  if (persona.greetingStyle) {
    parts.push(`\nSAPAAN PEMBUKA: ${safe(persona.greetingStyle)}`);
  }
  if (persona.conversationStarters?.length) {
    parts.push(`TOPIK PEMBUKA: ${persona.conversationStarters.map(safe).join(" | ")}`);
  }

  parts.push("\nPENTING: Selalu konsisten dengan kepribadian, gaya bicara, dan aturan di atas. Jangan pernah break character.");

  return parts.join("\n");
}

function buildBusinessPrompt(persona: PersonaConfig): string {
  const parts: string[] = [];
  const biz = persona.business;
  const name = safe(persona.displayName || persona.name);

  parts.push(`Kamu adalah ${name}, asisten customer service untuk ${safe(biz?.businessName || "bisnis")} (${safe(biz?.businessType || "umum")}).`);
  parts.push(`\nLATAR BELAKANG BISNIS: ${safe(persona.backstory)}`);

  if (biz?.location) parts.push(`LOKASI: ${safe(biz.location)}.`);
  if (biz?.coverage) parts.push(`CAKUPAN PENGIRIMAN: ${safe(biz.coverage)}.`);
  if (biz?.operatingHours) parts.push(`JAM OPERASIONAL: ${safe(biz.operatingHours)}.`);

  if (biz?.products && biz.products.length > 0) {
    parts.push(`\nKATALOG PRODUK:`);
    for (const p of biz.products) {
      let line = `  - ${safe(p.name)} [${safe(p.category)}]: ${safe(p.description)} | Harga: ${safe(p.price)}`;
      if (p.variants?.length) {
        line += ` | Varian: ${p.variants.map(v => `${safe(v.name)} (${safe(v.price || p.price)})`).join(", ")}`;
      }
      if (p.stock !== undefined) line += ` | Stok: ${p.stock}`;
      if (p.dimensions) line += ` | Dimensi: ${safe(p.dimensions)}`;
      parts.push(line);
    }
  }

  if (biz?.services?.length) {
    parts.push(`\nLAYANAN: ${biz.services.map(safe).join(", ")}.`);
  }

  if (biz?.policies?.length) {
    parts.push(`\nKEBIJAKAN:\n${biz.policies.map((p) => `  - ${safe(p)}`).join("\n")}`);
  }

  if (biz?.paymentMethods?.length) {
    parts.push(`\nMETODE PEMBAYARAN: ${biz.paymentMethods.map(safe).join(", ")}.`);
  }

  if (biz?.tagline) {
    parts.push(`\nTAGLINE: "${safe(biz.tagline)}"`);
  }

  if (biz?.faq && biz.faq.length > 0) {
    parts.push(`\nFAQ (hanya gunakan jika relevan):`);
    for (const f of biz.faq) {
      parts.push(`  Q: ${safe(f.question)}`);
      parts.push(`  A: ${safe(f.answer)}`);
    }
  }

  if (persona.traits.length > 0) {
    parts.push(`\nKEPRIBADIAN: ${persona.traits.map(safe).join(", ")}.`);
  }
  if (persona.expertise?.length) parts.push(`BIDANG KEAHLIAN: ${persona.expertise.map(safe).join(", ")}.`);

  parts.push(`\nGAYA KOMUNIKASI: ${toneLabel(persona.tone)}${persona.language ? `, bahasa ${languageLabel(persona.language)}` : ""}.`);
  if (persona.speechStyle) {
    parts.push(`Detail gaya: ${speechStyleLabel(persona.speechStyle)}.`);
  }

  parts.push(buildRelationshipSection(persona));
  parts.push(buildRulesSection(persona));

  if (persona.responsePatterns?.length) {
    parts.push(`\nPOLA RESPON:\n${persona.responsePatterns.map((r) => `  - ${safe(r)}`).join("\n")}`);
  }

  if (persona.greetingStyle) {
    parts.push(`\nSAPAAN PEMBUKA: ${safe(persona.greetingStyle)}`);
  }

  parts.push("\nPENTING: Kamu adalah customer service profesional. Jawab dengan sopan, informatif, dan fokus pada kebutuhan pelanggan. Sebutkan harga, varian, dan stok produk saat relevan. Arahkan ke metode pembayaran yang tersedia. Jangan menjanjikan hal di luar kebijakan yang tercantum.");

  return parts.join("\n");
}

function buildRelationshipSection(persona: PersonaConfig): string {
  const parts: string[] = [];

  if (persona.relationshipToUser) {
    parts.push(`\nHUBUNGAN DENGAN PENGGUNA: ${safe(persona.relationshipToUser)}.`);
  }
  if (persona.knownAboutUser) {
    const kau = persona.knownAboutUser;
    const knownParts: string[] = [];
    if (kau.name) knownParts.push(safe(kau.name));
    if (kau.interests?.length) knownParts.push(`interest: ${kau.interests.map(safe).join(", ")}`);
    if (kau.history) knownParts.push(`riwayat: ${safe(kau.history)}`);
    if (knownParts.length > 0) parts.push(`TENTANG PENGGUNA: ${knownParts.join("; ")}.`);
  }

  return parts.join("\n");
}

function buildRulesSection(persona: PersonaConfig): string {
  const parts: string[] = [];

  if (persona.behavioralRules) {
    const rules = persona.behavioralRules;
    if (rules.dos.length > 0) {
      parts.push(`WAJIB DILAKUKAN:\n${rules.dos.map((d) => `  - ${safe(d)}`).join("\n")}`);
    }
    if (rules.donts.length > 0) {
      parts.push(`DILARANG KERAS:\n${rules.donts.map((d) => `  - ${safe(d)}`).join("\n")}`);
    }
  }

  return parts.join("\n");
}

function toneLabel(tone: string): string {
  const map: Record<string, string> = {
    formal: "formal dan profesional",
    santai: "santai dan kasual",
    humoris: "humoris dan jenaka",
    inspiratif: "inspiratif dan memotivasi",
    serius: "serius dan mendalam",
    hangat: "hangat dan bersahabat",
  };
  return map[tone] || tone;
}

function languageLabel(lang: string): string {
  const map: Record<string, string> = {
    indonesia: "Indonesia",
    english: "Inggris",
    campur: "campur Indonesia-Inggris secara natural",
  };
  return map[lang] || lang;
}

function speechStyleLabel(ss: PersonaSpeechStyle): string {
  const parts: string[] = [];
  if (ss.formality <= 2) parts.push("sangat santai");
  else if (ss.formality <= 3) parts.push("cukup santai");
  else parts.push("formal");
  if (ss.verbosity >= 4) parts.push("jawab dengan detail dan panjang");
  else if (ss.verbosity <= 2) parts.push("jawab singkat padat");
  if (ss.emotionality >= 4) parts.push("sangat ekspresif");
  else if (ss.emotionality <= 2) parts.push("datar dan netral");
  if (ss.humorLevel >= 4) parts.push("sering bercanda");
  else if (ss.humorLevel <= 2) parts.push("serius");
  return parts.join(", ");
}
