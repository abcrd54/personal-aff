# aff-personal — Backend

AI-powered persona engine. Chat, content generation, affiliate, and business persona management. Bun + Hono + SQLite.

**OpenAI-compatible.** Works with any OpenAI SDK client — just change `base_url`.

## Quick Start

```bash
cp .env.example .env
# Edit .env → set LLM_API_KEY and API_KEY
bun install && bun run start
# → http://localhost:3000
```

### Docker

```bash
docker compose up -d
```

---

## OpenAI-Compatible API (`/v1`)

Use any OpenAI SDK client. Auth via `Authorization: Bearer <API_KEY>` or `x-api-key`.

### Python

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="your-api-key")

# List available personas
models = client.models.list()
for m in models.data:
    print(m.id)  # persona name

# Chat (non-streaming)
chat = client.chat.completions.create(
    model="Maya",
    messages=[{"role": "user", "content": "Rekomendasi gunung dong"}],
)
print(chat.choices[0].message.content)

# Chat (streaming)
stream = client.chat.completions.create(
    model="Maya",
    messages=[{"role": "user", "content": "Cerita pengalaman pendakian terbaikmu"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### cURL

```bash
# List personas
curl -s -H "Authorization: Bearer your-api-key" http://localhost:3000/v1/models

# Chat
curl -s -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"Maya","messages":[{"role":"user","content":"halo"}]}' \
  http://localhost:3000/v1/chat/completions

# Streaming
curl -s -N -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"Maya","messages":[{"role":"user","content":"halo"}],"stream":true}' \
  http://localhost:3000/v1/chat/completions
```

### Model Lookup

`model` can be persona **name** or **UUID**. If multiple personas share the same name, use UUID.

---

## Native API (`/api`)

All `/api` routes support `x-api-key` header or `Authorization: Bearer`.

### Persona Management

#### Create Persona (Personal)

```bash
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "type": "personal",
    "name": "Maya",
    "displayName": "Maya Putri",
    "age": 25,
    "gender": "wanita",
    "location": "Bandung",
    "occupation": "Content Creator Outdoor",
    "traits": ["adventurous", "ramah", "peduli lingkungan"],
    "hobbies": ["naik gunung", "fotografi"],
    "backstory": "Maya tumbuh di kaki Gunung Gede...",
    "tone": "hangat",
    "language": "indonesia",
    "speechStyle": { "formality": 2, "verbosity": 4, "emotionality": 4, "humorLevel": 3 },
    "catchphrases": ["Gunung nggak akan menghianati!", "Gaskeun naik!"],
    "behavioralRules": {
      "dos": ["Kasih semangat", "Rekomendasi dari pengalaman pribadi"],
      "donts": ["Jangan merendahkan pemula"]
    },
    "products": [
      { "name": "Sepatu Hiking X", "description": "Ringan, grip kuat", "price": "Rp 500.000", "tags": ["gear", "pemula"] }
    ]
  }'
```

#### Create Persona (Business)

```bash
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "type": "business",
    "name": "SofaIndo",
    "backstory": "Toko furniture online sejak 2018. 5000+ pelanggan, rating 4.8.",
    "tone": "hangat",
    "traits": ["profesional", "ramah", "informatif"],
    "business": {
      "businessName": "SofaIndo",
      "businessType": "Toko Furniture Online",
      "tagline": "Furniture Impian, Harga Bersahabat",
      "products": [{
        "name": "Sofa Minimalis Oslo",
        "description": "2-seater Skandinavia, kayu solid + dacron premium",
        "price": "Rp 3.500.000",
        "category": "Minimalis",
        "stock": 5,
        "variants": [{ "name": "Navy", "stock": 2 }, { "name": "Beige", "stock": 3 }]
      }],
      "services": ["Custom desain", "Konsultasi gratis", "Delivery"],
      "operatingHours": "08:00 - 21:00 WIB",
      "location": "Jakarta Pusat",
      "policies": ["Garansi 2 tahun", "Retur 7 hari"],
      "paymentMethods": ["Transfer", "QRIS", "Kartu Kredit 0%"],
      "faq": [{ "question": "Bisa custom ukuran?", "answer": "Bisa! 2-4 minggu pengerjaan." }]
    }
  }'
```

### Chat (Native REST + WebSocket)

```bash
# REST
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"personaId": "uuid", "message": "Rekomendasi gunung buat pemula dong"}'
# → { "sessionId": "uuid", "reply": "..." }

# WebSocket (streaming)
const ws = new WebSocket("ws://localhost:3000/api/chat/ws?personaId=UUID&api_key=your-api-key");
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.type === "chunk") console.log(d.content);
  if (d.type === "done") console.log("done");
};
ws.send(JSON.stringify({ message: "Rekomendasi gunung dong" }));
```

### AI Enhance

Auto-generate full persona config from partial input:

```bash
curl -X POST http://localhost:3000/api/ai/enhance-backstory \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "type": "personal",
    "name": "Budi",
    "traits": ["kreatif", "humoris"],
    "hobbies": ["memasak", "fotografi makanan"],
    "tone": "hangat",
    "language": "indonesia"
  }'
# → Full PersonaConfig with AI-generated backstory, catchphrases, speechStyle, etc.
```

### Blueprints

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/blueprints
# → 16 ready-to-use persona templates (8 personal + 8 business)
```

### Content Generation

**Caption:**
```bash
curl -X POST http://localhost:3000/api/content/generate-caption \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"personaId": "uuid", "topic": "belajar nerima diri sendiri", "mode": "natural", "platform": "twitter"}'
```

**Image Prompt:**
```bash
curl -X POST http://localhost:3000/api/content/generate-image-prompt \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"personaId": "uuid", "productName": "Sunscreen SPF 50", "scene": "flat lay", "mode": "affiliate", "engine": "midjourney"}'
```

**Content Modes:**
| Mode | Caption | Image | Best For |
|------|---------|-------|----------|
| `natural` | Personal story, zero product | Lifestyle moment | Trust building |
| `affiliate` | Story + product rec | Product in-context | Monetization |
| `catalog` | Specs + price + CTA | Product showroom | Direct sales |

**Platform Rules:**
| Platform | Natural | Affiliate | Business |
|----------|---------|-----------|----------|
| Instagram | 400 char | 800 char | 2200 char |
| Facebook | 400 char | 800 char | 2200 char |
| Twitter | Thread 3-5 tweet (280/part) | 280 char | 2200 char |
| Threads | Thread 3-5 post (500/part) | 500 char | 2200 char |
| TikTok | 150 char | 150 char | 150 char |
| WhatsApp | 500 char | 500 char | 2200 char |

### Sessions

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"personaId": "uuid", "title": "Rekomendasi Gunung"}'

curl -H "x-api-key: your-api-key" "http://localhost:3000/api/sessions?personaId=uuid"

curl -H "x-api-key: your-api-key" "http://localhost:3000/api/sessions/SESSION_ID/messages"
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health + queue status |
| `GET` | `/` | API documentation |
| `GET` | `/v1/models` | List personas as OpenAI models |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat (streaming + non-streaming) |
| `GET/POST` | `/api/personas` | List / Create persona |
| `GET/PUT/DELETE` | `/api/personas/:id` | Get / Update / Delete persona |
| `GET/POST` | `/api/sessions` | List / Create session |
| `GET` | `/api/sessions/:id/messages` | Chat history |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `POST` | `/api/chat` | Send message (REST) |
| `WS` | `/api/chat/ws?personaId=x&sessionId=x&api_key=x` | Stream chat (WebSocket) |
| `GET` | `/api/blueprints` | 16 persona templates |
| `POST` | `/api/ai/enhance-backstory` | AI-generate persona config |
| `POST` | `/api/content/generate-caption` | Social media caption |
| `POST` | `/api/content/generate-image-prompt` | AI image generation prompt |

All routes require auth (`x-api-key` or `Authorization: Bearer`) except `/` and `/health`.

---

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_KEY` | — | API auth key (unset = open) |
| `NODE_ENV` | — | Set to `production` for strict API_KEY check |
| `ALLOWED_ORIGINS` | — | CORS origins, comma-separated |
| `LLM_PROVIDER` | `openai` | Provider label |
| `LLM_API_KEY` | — | **Required.** LLM provider key |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `LLM_MAX_TOKENS` | `2048` | Max output tokens |
| `LLM_TEMPERATURE` | `0.8` | Creativity (0-2) |
| `LLM_MAX_CONCURRENCY` | `3` | Max simultaneous LLM calls |
| `LLM_QUEUE_TIMEOUT_MS` | `60000` | Max queue wait before 503 |
| `LLM_MAX_QUEUE_SIZE` | `100` | Max queued requests before reject |
| `LLM_FETCH_TIMEOUT` | `120000` | LLM API timeout |
| `RATE_LIMIT_CHAT_MAX` | `20` | Chat requests per window |
| `RATE_LIMIT_CHAT_WINDOW_MS` | `60000` | Chat rate limit window |
| `RATE_LIMIT_GENERAL_MAX` | `60` | General requests per window |
| `RATE_LIMIT_GENERAL_WINDOW_MS` | `60000` | General rate limit window |

---

## Deployment

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env → set LLM_API_KEY + API_KEY
docker compose up -d
```

### Manual

```bash
cp .env.example .env
# Edit .env → set LLM_API_KEY + API_KEY
bun install && bun run start
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    location /api/ { proxy_pass http://127.0.0.1:3000; }
    location /v1/  { proxy_pass http://127.0.0.1:3000; }
}
```

## Prompt Customization

All LLM prompts are external `.md` files in `skills/`:

```
skills/
├── 05-caption-prompt.md   ← Edit caption behavior, tone, slang rules
└── 06-image-prompt.md     ← Edit image prompt style, mode rules
```

Edit these files and restart the server to change how personas write captions or generate image prompts. No code changes needed. Supports `${var}` interpolation for dynamic parameters.

---

## Architecture

```
Client → API (Bearer / x-api-key auth)
  ├── /v1/chat/completions  → OpenAI-compatible chat (SSE streaming)
  ├── /v1/models            → List personas as models
  ├── /health               → Public health check
  ├── /api/personas         → CRUD (SQLite)
  ├── /api/sessions         → Session management
  ├── /api/chat             → ConcurrencyQueue → LLM API (REST + WebSocket)
  ├── /api/blueprints       → 16 persona templates
  ├── /api/content          → Caption + Image prompt generation
  └── /api/ai               → Auto-generate persona config

LLM → OpenAI-compatible API (/chat/completions)
DB  → SQLite WAL mode, UUID primary keys, cascading deletes
```

### Queue System

```
Request 1 → [Slot 1] → LLM API
Request 2 → [Slot 2] → LLM API     max 3 concurrent
Request 3 → [Slot 3] → LLM API
Request 4 → [Queue]  → wait → slot free → process
Request 5 → [Queue]  → wait → slot free → process
Request 101 → Rejected (queue full)
```

---

## Project Structure

```
src/
├── index.ts              # Entry point, Hono app
├── types.ts              # All TypeScript interfaces
├── db/
│   ├── index.ts          # SQLite: getDB, initDB, safeParse, UUID
│   ├── schema.sql        # Tables: personas, sessions, messages
│   ├── seed.ts           # Demo personas
│   └── blueprints.ts     # 16 persona templates
├── lib/
│   ├── llm.ts            # LLM client: chat, chatWithUsage, chatStream
│   ├── queue.ts          # ConcurrencyQueue
│   ├── prompt.ts         # System prompt builder + cache
│   ├── prompt-loader.ts  # External prompt loader (reads skills/*.md)
│   └── ws-handler.ts     # WebSocket chat handler
├── middleware/
│   ├── auth.ts           # x-api-key + Bearer + CORS
│   ├── ratelimit.ts      # In-memory rate limiter
│   └── validation.ts     # Persona & message validators
└── routes/
    ├── openai.ts         # /v1/chat/completions + /v1/models
    ├── personas.ts       # Persona CRUD
    ├── sessions.ts       # Session management
    ├── chat.ts           # REST chat + WebSocket
    ├── ai.ts             # AI enhance backstory
    ├── content.ts        # Caption + image prompt gen
    └── blueprints.ts     # Blueprint listing

skills/
├── 01-architecture.md       # Architecture, config, auth, DB schema
├── 02-personas.md           # Complete PersonaConfig reference
├── 03-api.md                # All endpoint reference
├── 04-content-system.md     # Content modes, platform rules
├── 05-caption-prompt.md     # Caption prompt template (loaded at runtime)
└── 06-image-prompt.md       # Image prompt template (loaded at runtime)
```

---

## Scripts

```bash
bun run start     # Production
bun run dev       # Hot reload
bun run build     # Bundle → dist/index.js
bun run db:seed   # Seed 3 demo personas
```

---

## Tech Stack

- **Runtime:** Bun
- **Framework:** Hono
- **Database:** SQLite (bun:sqlite)
- **LLM:** OpenAI-compatible API
- **Container:** Docker ARM64
