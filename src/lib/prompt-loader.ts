import { readFileSync } from "fs";
import { join } from "path";

const SKILLS_DIR = join(import.meta.dir, "../../skills");
const cache = new Map<string, string>();

function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const path = join(SKILLS_DIR, name);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(`Prompt file not found: ${path}`);
  }
  cache.set(name, raw);
  return raw;
}

export function getCaptionSystemPrompt(vars: Record<string, string>): string {
  const raw = loadPrompt("05-caption-prompt.md");
  const parts = raw.split(/^---\s*$/m);
  const system = parts[0];
  const mode = vars.mode || "affiliate";

  let modeBlock = "";
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].includes(`MODE:${mode.toUpperCase()}`)) {
      modeBlock = parts[i].trim();
      break;
    }
  }

  return interpolate(system + "\n" + modeBlock, vars);
}

export function getImageSystemPrompt(vars: Record<string, string>): string {
  const raw = loadPrompt("06-image-prompt.md");
  const parts = raw.split(/^---\s*$/m);
  const system = parts[0];
  const mode = vars.mode || "affiliate";

  let modeBlock = "";
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].includes(`MODE:${mode.toUpperCase()}`)) {
      modeBlock = parts[i].trim();
      break;
    }
  }

  return interpolate(system + "\n" + modeBlock, vars);
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
