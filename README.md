# Hermes Personal — Backend

AI-powered persona chat engine for personal branding & contextual affiliate marketing. Runs on Bun + Hono + SQLite.

## Quick Start

```bash
cp .env.example .env
# Edit .env → set LLM_API_KEY and API_KEY
bun install
bun run start
```

Server starts on `http://localhost:3000`.

### Docker

```bash
docker compose up -d
```

## Configuration

| Env | Required | Default | Description |
|-----|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `API_KEY` | No* | — | API authentication key. *If unset, ALL routes are open. |
| `ALLOWED_ORIGINS` | No | — | CORS origins, comma-separated. Empty = allow all. |
| `LLM_API_KEY` | **Yes** | — | LLM provider API key |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible API endpoint |
| `LLM_MODEL` | No | `gpt-4o-mini` | Model name sent to API |
| `LLM_MAX_TOKENS` | No | `2048` | Max output tokens |
| `LLM_TEMPERATURE` | No | `0.8` | LLM temperature |
| `LLM_MAX_CONCURRENCY` | No | `3` | Max simultaneous LLM requests |
| `LLM_QUEUE_TIMEOUT_MS` | No | `60000` | Max wait time in queue before 503 |
| `RATE_LIMIT_CHAT_MAX` | No | `20` | Chat requests per window |
| `RATE_LIMIT_CHAT_WINDOW_MS` | No | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_GENERAL_MAX` | No | `60` | General API requests per window |
| `RATE_LIMIT_GENERAL_WINDOW_MS` | No | `60000` | General rate limit window (ms) |

All LLM requests use the OpenAI-compatible `/chat/completions` endpoint with `stream: true` support.

## Authentication

All `/api/*` routes require header:

```
x-api-key: your-api-key
```

Health check (`/health`) and root (`/`) are public.

## API Reference

### Health

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "db": "connected",
  "llm": "connected",
  "queue": { "running": 0, "queued": 0, "maxConcurrency": 3, "availableSlots": 3 },
  "personas": 5,
  "uptime": 120.5,
  "timestamp": "2026-07-18T05:00:00.000Z"
}
```

---

### Personas

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/personas` | List all personas |
| `GET` | `/api/personas/:id` | Get persona by ID |
| `POST` | `/api/personas` | Create persona |
| `PUT` | `/api/personas/:id` | Update persona |
| `DELETE` | `/api/personas/:id` | Delete persona |

**Create Persona** (personal):
```json
POST /api/personas
{
  "type": "personal",
  "name": "Maya",
  "backstory": "Maya adalah pendaki gunung berpengalaman...",
  "tone": "hangat",
  "traits": ["adventurous", "ramah"],
  "hobbies": ["naik gunung", "fotografi"],
  "language": "indonesia",
  "products": [
    { "name": "Sepatu Hiking X", "description": "Ringan, grip kuat", "price": "Rp 500.000", "tags": ["pemula", "gear"] }
  ]
}
```

**Create Persona** (business):
```json
POST /api/personas
{
  "type": "business",
  "name": "SofaIndo",
  "backstory": "Toko furniture online sejak 2018...",
  "tone": "hangat",
  "traits": ["profesional", "ramah"],
  "business": {
    "businessName": "SofaIndo",
    "businessType": "Toko Furniture Online",
    "tagline": "Sofa Impian, Harga Bersahabat",
    "products": [
      { "name": "Sofa Oslo", "description": "2-seater Skandinavia", "price": "Rp 3.500.000", "category": "Minimalis", "stock": 5, "dimensions": "140x80x85 cm", "variants": [{ "name": "Navy", "stock": 2 }] }
    ],
    "services": ["Custom desain", "Delivery"],
    "operatingHours": "08:00-21:00",
    "location": "Jakarta",
    "coverage": "Jabodetabek 3-5 hari",
    "policies": ["Garansi 2 tahun", "Retur 7 hari"],
    "paymentMethods": ["Transfer", "QRIS", "Cicilan 0%"],
    "faq": [{ "question": "Bisa custom?", "answer": "Bisa, 2-4 minggu." }]
  }
}
```

**Full PersonaConfig fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"personal" \| "business"` | **Yes** | Persona type |
| `name` | string | **Yes** | Persona name |
| `backstory` | string | **Yes** | Rich background story |
| `tone` | `"formal" \| "santai" \| "humoris" \| "inspiratif" \| "serius" \| "hangat"` | **Yes** | Communication tone |
| `traits` | string[] | **Yes** | Character traits |
| `displayName` | string | No | Display name (defaults to `name`) |
| `age` | number | No | Age |
| `gender` | `"pria" \| "wanita" \| "lainnya"` | No | Gender |
| `location` | string | No | Location |
| `occupation` | string | No | Job/role |
| `hobbies` | string[] | No | Hobbies (personal only) |
| `expertise` | string[] | No | Areas of expertise |
| `mbti` | string | No | MBTI type |
| `values` | string[] | No | Core values |
| `quirks` | string[] | No | Unique habits |
| `language` | `"indonesia" \| "english" \| "campur"` | No | Primary language |
| `speechStyle` | object | No | Formality/verbosity/emotionality/humorLevel (1-5) |
| `catchphrases` | string[] | No | Signature phrases |
| `vocabularyStyle` | string[] | No | Speaking style notes |
| `greetingStyle` | string | No | Opening greeting |
| `conversationStarters` | string[] | No | Topic starters |
| `behavioralRules` | `{ dos: string[], donts: string[] }` | No | Behavioral constraints |
| `responsePatterns` | string[] | No | Response templates |
| `relationshipToUser` | string | No | Relationship context |
| `knownAboutUser` | `{ name?, interests?, history? }` | No | What persona knows about user |
| `lifeGoals` | string[] | No | Life goals |
| `recentExperiences` | string[] | No | Recent experiences |
| `customSystemPrompt` | string | No | Override ALL prompts with custom |
| `products` | AffiliateProduct[] | No | Affiliate catalog (personal) |
| `business` | BusinessConfig | No | Business config (business) |
| `captionStyle` | CaptionStyle | No | Social media caption preferences |
| `visualStyle` | VisualStyle | No | Image generation visual style |

**AffiliateProduct:**
```json
{ "name": "...", "description": "...", "price": "...", "tags": ["tag1"], "affiliateLink?": "..." }
```

**CaptionStyle:**
```json
{ "platform": "instagram", "tone": "hangat", "hashtagCount": 5, "emojiUsage": "moderate", "callToAction": "...", "formattingStyle": "...", "examples?": [] }
```

**VisualStyle:**
```json
{ "aspectRatio": "4:5", "lighting": "natural", "background": "lifestyle", "mood": "warm", "composition": "...", "colorPalette?": [], "props?": [] }
```

---

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions?personaId={id}` | List sessions for persona |
| `GET` | `/api/sessions/:id` | Get session |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/:id/messages` | Get session messages |
| `DELETE` | `/api/sessions/:id` | Delete session + all messages |

---

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Send message (REST) |
| `WS` | `/api/chat/ws?personaId={id}&sessionId={id}&api_key={key}` | Stream chat (WebSocket) |

**REST:**
```json
POST /api/chat
{
  "personaId": "uuid",
  "message": "Rekomendasi gunung buat pemula dong",
  "sessionId?": "uuid"
}

Response:
{ "sessionId": "uuid", "reply": "Gunung Papandayan cocok buat pemula..." }
```

**WebSocket:**
```
ws://host:3000/api/chat/ws?personaId={id}&sessionId={id}&api_key={key}

Send:    { "message": "halo" }
Receive: { "type": "chunk", "content": "Ha" }
Receive: { "type": "chunk", "content": "lo" }
Receive: { "type": "done" }
Receive: { "type": "error", "message": "..." }
Receive: { "type": "ping" }  // keepalive every 30s
```

---

### Blueprints

```
GET /api/blueprints
```

Returns 16 ready-to-use persona templates (8 personal + 8 business). Each includes full config with affiliate products, caption style, and visual style.

Create a persona from blueprint:
```bash
# Get blueprint
curl -H "x-api-key: key" http://localhost:3000/api/blueprints > blueprints.json

# Pick one and create
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -H "x-api-key: key" \
  -d '{...blueprint config...}'
```

---

### Content Generation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/content/generate-caption` | Generate social media caption |
| `POST` | `/api/content/generate-image-prompt` | Generate AI image prompt |

**Generate Caption:**
```json
POST /api/content/generate-caption
{
  "personaId": "uuid",
  "topic": "HappyCall panci anti lengket",
  "mode": "natural|affiliate|catalog",
  "platform?": "instagram",
  "count?": 3,
  "tone?": "hangat",
  "emojiUsage?": "moderate",
  "hashtagCount?": 5,
  "callToAction?": "checkout link di bio"
}

Response:
{
  "personaId": "uuid",
  "topic": "...",
  "platform": "instagram",
  "mode": "affiliate",
  "captions": ["Caption 1...", "Caption 2..."]
}
```

**Generate Image Prompt:**
```json
POST /api/content/generate-image-prompt
{
  "personaId": "uuid",
  "productName": "Azarine Sunscreen SPF 50",
  "mode": "natural|affiliate|catalog",
  "scene?": "flat lay di meja putih dengan daun monstera",
  "engine?": "midjourney|dalle|generic",
  "count?": 2
}

Response:
{
  "personaId": "uuid",
  "productName": "...",
  "engine": "midjourney",
  "aspectRatio": "1:1",
  "mode": "affiliate",
  "prompts": ["Prompt 1... --ar 1:1 --style raw", "Prompt 2..."],
  "visualNote": "Lighting: studio | Background: clean | Mood: clean | ..."
}
```

**Content Modes:**

| Mode | Caption | Image | Use Case |
|------|---------|-------|----------|
| `natural` | Personal story, life lesson — **zero product mention** | Lifestyle moment, human emotion — **no product in frame** | Build trust & connection |
| `affiliate` | Personal story + natural product recommendation | Product in real-life context + human element | Monetize |
| `catalog` | Product specs, prices, variants (auto for business) | Product showroom, clean background | Direct sales |

---

### AI Enhance

```
POST /api/ai/enhance-backstory
```

Generate rich persona config from basic fields:
```json
POST /api/ai/enhance-backstory
{
  "type": "personal",
  "name": "Budi",
  "traits": ["kreatif", "humoris"],
  "hobbies": ["memasak", "fotografi"],
  "expertise": ["masakan Indonesia"],
  "tone": "hangat",
  "language": "indonesia"
}

Response: Full PersonaConfig with generated backstory, catchphrases, speechStyle, behavioralRules, etc.
```

---

## Architecture

```
Client → API (x-api-key auth)
  ├── /health          → Public
  ├── /api/personas    → CRUD (SQLite)
  ├── /api/sessions    → Session management
  ├── /api/chat        → ConcurrencyQueue → LLM API
  ├── /api/blueprints  → Static template library
  ├── /api/content     → Caption + Image prompt generation
  └── /api/ai          → Auto-generate persona config

LLM → OpenAI-compatible API (/chat/completions)
DB  → SQLite (WAL mode, foreign keys ON)
```

### Queue System

- Max concurrent LLM requests: configurable via `LLM_MAX_CONCURRENCY` (default: 3)
- Excess requests queued with timeout: `LLM_QUEUE_TIMEOUT_MS` (default: 60s)
- Queue status visible via `/health`

### Security

- API key authentication on all `/api/*` routes
- CORS origin whitelist
- Rate limiting: 20 chat req/60s, 60 general req/60s per IP
- Request body size limit: 512KB
- Input validation on all endpoints
- JSON parse error handling (returns 400, not 500)
- `.dockerignore` prevents `.env` leak into Docker images

### Database

- SQLite with WAL mode (concurrent-safe for reads)
- Cascading deletes (persona → sessions → messages)
- Auto-generated UUIDs for personas and sessions

---

## Scripts

```bash
bun run start     # Start production server
bun run dev       # Start with hot reload (watch mode)
bun run build     # Bundle to dist/index.js
bun run db:seed   # Seed database with sample personas (3 demo personas)
```

---

## Tech Stack

- **Runtime:** Bun
- **Framework:** Hono
- **Database:** SQLite (bun:sqlite)
- **LLM:** OpenAI-compatible API
- **Container:** Docker (ARM64 optimized)
