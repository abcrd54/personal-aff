# 02 — Persona System

## Overview

A persona is an AI character with a complete identity — personality, backstory, communication style, visual preferences, and product catalog. Personas power all chat and content generation.

Two types: `personal` (individual content creator) and `business` (company/store customer service).

## PersonaConfig — Complete Field Reference

### Identity

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"personal" \| "business"` | ✅ | Persona type |
| `name` | `string` | ✅ | Internal name (used as model ID in OpenAI API) |
| `displayName` | `string` | ❌ | Display name (default: `name`) |
| `age` | `number` | ❌ | Age |
| `gender` | `string` | ❌ | Gender (wanita/pria) |
| `location` | `string` | ❌ | City/region |
| `occupation` | `string` | ❌ | Job/profession |
| `mbti` | `string` | ❌ | MBTI personality type |

### Personality & Behavior

| Field | Type | Required | Description |
|---|---|---|---|
| `traits` | `string[]` | ✅ | Personality traits (e.g., `["ramah", "adventurous"]`) |
| `values` | `string[]` | ❌ | Life values |
| `quirks` | `string[]` | ❌ | Unique habits |
| `hobbies` | `string[]` | ❌ | Hobbies |
| `expertise` | `string[]` | ❌ | Areas of expertise |
| `favoriteThings` | `string[]` | ❌ | Favorite things |
| `dislikes` | `string[]` | ❌ | Dislikes |

### Backstory & Goals

| Field | Type | Required | Description |
|---|---|---|---|
| `backstory` | `string` | ✅ | Full background story |
| `lifeGoals` | `string[]` | ❌ | Life goals |
| `recentExperiences` | `string[]` | ❌ | Recent events |

### Communication Style

| Field | Type | Required | Description |
|---|---|---|---|
| `tone` | `"formal" \| "santai" \| "humoris" \| "inspiratif" \| "serius" \| "hangat"` | ✅ | Core communication tone |
| `language` | `"indonesia" \| "english" \| "campur"` | ❌ | Default language |
| `speechStyle` | `PersonaSpeechStyle` | ❌ | Detailed speech style |
| `catchphrases` | `string[]` | ❌ | Signature phrases |
| `vocabularyStyle` | `string[]` | ❌ | Word choice rules |
| `greetingStyle` | `string` | ❌ | Opening greeting |
| `conversationStarters` | `string[]` | ❌ | Conversation starters |

### `PersonaSpeechStyle`

| Field | Type | Range | Description |
|---|---|---|---|
| `formality` | `number` | 1-5 | 1=very casual, 5=very formal |
| `verbosity` | `number` | 1-5 | 1=terse, 5=detailed |
| `emotionality` | `number` | 1-5 | 1=flat, 5=very expressive |
| `humorLevel` | `number` | 1-5 | 1=serious, 5=jokes often |

### Behavioral Rules

| Field | Type | Description |
|---|---|---|
| `behavioralRules.dos` | `string[]` | Required behaviors |
| `behavioralRules.donts` | `string[]` | Forbidden behaviors |
| `responsePatterns` | `string[]` | Response flow rules |

### Content Style

| Field | Type | Description |
|---|---|---|
| `captionStyle` | `CaptionStyle` | Default caption generation settings |
| `visualStyle` | `VisualStyle` | Default image prompt generation settings |

### `CaptionStyle`

| Field | Type | Default | Description |
|---|---|---|---|
| `platform` | platform string | `"instagram"` | Default platform |
| `tone` | `string` | persona.tone | Caption tone |
| `maxLength` | `number` | Platform limit | Max characters |
| `hashtagCount` | `number` | `5` | Number of hashtags |
| `emojiUsage` | `"none" \| "minimal" \| "moderate" \| "heavy"` | `"moderate"` | Emoji frequency |
| `callToAction` | `string` | `"checkout link di bio"` | CTA text |
| `formattingStyle` | `string` | — | Output format |
| `examples` | `string[]` | — | Example captions |

### `VisualStyle`

| Field | Type | Default | Description |
|---|---|---|---|
| `aspectRatio` | `"1:1" \| "4:5" \| "16:9" \| "9:16"` | `"1:1"` | Image aspect ratio |
| `lighting` | `"natural" \| "studio" \| "warm" \| "cool" \| "dramatic"` | `"natural"` | Lighting style |
| `background` | `"clean" \| "lifestyle" \| "minimal" \| "outdoor" \| "product-focused"` | `"lifestyle"` | Background style |
| `colorPalette` | `string[]` | — | Preferred colors |
| `mood` | `string` | `"warm and inviting"` | Overall mood |
| `composition` | `string` | — | Composition style |
| `props` | `string[]` | — | Props to include |

### Products (Affiliate)

| Field | Type | Description |
|---|---|---|
| `products` | `AffiliateProduct[]` | Products this persona recommends |
| `products[].name` | `string` | Product name |
| `products[].description` | `string` | Product description |
| `products[].price` | `string` | Price (e.g., "Rp 150.000") |
| `products[].tags` | `string[]` | Tags for grouping |

### Business Persona

**Required in `business`:** `businessName`, `businessType`, `products[]`

| Field | Type | Description |
|---|---|---|
| `businessName` | `string` | Business name |
| `businessType` | `string` | Business type/category |
| `tagline` | `string` | Slogan |
| `products` | `BusinessProduct[]` | Product catalog |
| `services` | `string[]` | Services offered |
| `operatingHours` | `string` | Business hours |
| `location` | `string` | Physical location |
| `coverage` | `string` | Delivery coverage |
| `policies` | `string[]` | Business policies |
| `faq` | `{ question, answer }[]` | Frequently asked questions |
| `paymentMethods` | `string[]` | Accepted payment methods |

### `BusinessProduct`

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Product name |
| `description` | `string` | Product description |
| `price` | `string` | Price |
| `category` | `string` | Product category |
| `stock` | `number` | Available stock |
| `variants` | `{ name, price?, stock? }[]` | Product variants |
| `dimensions` | `string` | Dimensions |
| `imageUrl` | `string` | Product image URL |

## How System Prompts Are Built

1. All persona config fields are **sanitized** (newlines stripped, max 2000 chars per field)
2. Fields assembled into structured system prompt (Indonesian format)
3. `behavioralRules.dos` → `WAJIB DILAKUKAN` section
4. `behavioralRules.donts` → `DILARANG KERAS` section
5. Business personas get `KATALOG PRODUK` + `KEBIJAKAN` + `FAQ` sections
6. Prompt cached in LRU cache (max 500 entries), invalidated on persona update

## Blueprints

16 pre-built persona templates available at `GET /api/blueprints`:
- 8 personal (skincare, gaming, travel, cooking, etc.)
- 8 business (furniture, coffee shop, gadget store, laundry, etc.)