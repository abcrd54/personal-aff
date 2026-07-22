# 04 — Content Generation System

Two content types: **Caption** (social media text) and **Image Prompt** (AI image generator instructions). Both driven by persona identity and output mode.

## Content Modes

Three modes control the output style:

| Mode | Personal Persona | Business Persona | Behavior |
|---|---|---|---|
| `natural` | ✅ | ❌ (auto→catalog) | No products. Pure personal story. |
| `affiliate` | ✅ | ❌ (auto→catalog) | Story + product recommendation. |
| `catalog` | ❌ (auto→affiliate) | ✅ | Product specs, pricing, business tone. |

### Mode Resolution

```
If personal + mode "catalog" → "affiliate" (downgraded)
If business + any mode → "catalog" (forced)
```

## Caption Generation

### Endpoint: `POST /api/content/generate-caption`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `personaId` | `string` (UUID) | ✅ | — | Persona ID |
| `topic` | `string` | ✅ | — | Topic or product name |
| `mode` | `"natural" \| "affiliate" \| "catalog"` | ❌ | `"affiliate"` | Content mode |
| `platform` | platform string | ❌ | persona.captionStyle.platform | Target platform |
| `count` | `number` | ❌ | `1` | Variations (max 5) |
| `tone` | `string` | ❌ | persona.captionStyle.tone | Override tone |
| `emojiUsage` | `"none" \| "minimal" \| "moderate" \| "heavy"` | ❌ | persona.captionStyle.emojiUsage | |
| `hashtagCount` | `number` | ❌ | persona.captionStyle.hashtagCount | |
| `callToAction` | `string` | ❌ | persona.captionStyle.callToAction | |
| `maxLength` | `number` | ❌ | Platform default | Override max length |
| `formattingStyle` | `string` | ❌ | persona.captionStyle.formattingStyle | |

### Platform Character Limits

| Platform | Natural | Affiliate | Catalog | Thread |
|---|---|---|---|---|
| Instagram | 400 | 800 | 2200 | No |
| Facebook | 400 | 800 | 2200 | No |
| Twitter | 280×3-5 | 280 | 2200 | Yes (3-5 parts) |
| Threads | 500×3-5 | 500 | 2200 | Yes (3-5 parts) |
| TikTok | 150 | 150 | 150 | No |
| WhatsApp | 500 | 500 | 2200 | No |

### CTA Resolution

```
natural:   "save & share ke temen"
affiliate: persona.captionStyle.callToAction || "checkout link di bio"
catalog:   "DM atau klik link di bio untuk order!"
```

## Image Prompt Generation

### Endpoint: `POST /api/content/generate-image-prompt`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `personaId` | `string` (UUID) | ✅ | — | Persona ID |
| `productName` | `string` | ✅ | — | Product/subject name |
| `scene` | `string` | ❌ | — | Scene description |
| `mode` | `"natural" \| "affiliate" \| "catalog"` | ❌ | `"affiliate"` | Content mode |
| `engine` | `"midjourney" \| "dalle" \| "stablediffusion"` | ❌ | `"midjourney"` | Target engine |
| `count` | `number` | ❌ | `1` | Variations (max 3) |
| `aspectRatio` | `"1:1" \| "4:5" \| "16:9" \| "9:16"` | ❌ | persona.visualStyle.aspectRatio | |
| `lighting` | `string` | ❌ | persona.visualStyle.lighting | |
| `background` | `string` | ❌ | persona.visualStyle.background | |
| `mood` | `string` | ❌ | persona.visualStyle.mood | |
| `composition` | `string` | ❌ | persona.visualStyle.composition | |

### Engine-Specific Format

| Engine | Format | Language |
|---|---|---|
| Midjourney | Descriptive + `--ar 1:1 --style raw` | English |
| DALL-E 3 | Natural language, scene & mood | English |
| Stable Diffusion | Detailed description, style keywords | English |

## Prompt Architecture

Caption and image prompts are loaded from external `.md` files at runtime:

```
skills/05-caption-prompt.md   → Caption system prompt + mode instructions
skills/06-image-prompt.md     → Image system prompt + mode instructions
```

Loaded at startup via `src/lib/prompt-loader.ts` with `${var}` interpolation. Edit `.md` files and restart the server to change prompt behavior.