# Hermes Personal — Backend

AI-powered persona engine. Chat, content generation, affiliate, and business persona management. Bun + Hono + SQLite.

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

## Usage Examples (curl)

All examples use `x-api-key: hermes-test-key-2024`.

### 1. Create Persona (Personal)

```bash
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
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
    "backstory": "Maya tumbuh di kaki Gunung Gede. Sejak kecil diajak ayahnya mendaki...",
    "tone": "hangat",
    "language": "indonesia",
    "speechStyle": { "formality": 2, "verbosity": 4, "emotionality": 4, "humorLevel": 3 },
    "catchphrases": ["Gunung nggak akan menghianati!", "Gaskeun naik!"],
    "behavioralRules": {
      "dos": ["Kasih semangat", "Rekomendasi dari pengalaman pribadi"],
      "donts": ["Jangan merendahkan pemula"]
    },
    "responsePatterns": ["Tanya dulu level pengalaman sebelum rekomendasi"],
    "captionStyle": {
      "platform": "instagram",
      "tone": "hangat & personal",
      "hashtagCount": 5,
      "emojiUsage": "moderate",
      "callToAction": "save & share ke temen outdoor!"
    },
    "visualStyle": {
      "aspectRatio": "4:5",
      "lighting": "natural",
      "background": "outdoor",
      "mood": "adventurous & inspiring"
    },
    "products": [
      { "name": "Sepatu Hiking X", "description": "Ringan, grip kuat", "price": "Rp 500.000", "tags": ["gear", "pemula"] },
      { "name": "Carrier 60L Y", "description": "Buat pendakian 3 hari+", "price": "Rp 1.200.000", "tags": ["gear", "advance"] }
    ]
  }'
```

### 2. Create Persona (Business)

```bash
curl -X POST http://localhost:3000/api/personas \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
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
      "products": [
        {
          "name": "Sofa Minimalis Oslo",
          "description": "2-seater Skandinavia, kayu solid + dacron premium",
          "price": "Rp 3.500.000",
          "category": "Minimalis",
          "stock": 5,
          "dimensions": "140x80x85 cm",
          "variants": [
            { "name": "Navy", "stock": 2 },
            { "name": "Beige", "stock": 3 }
          ]
        }
      ],
      "services": ["Custom desain", "Konsultasi gratis", "Delivery"],
      "operatingHours": "08:00 - 21:00 WIB",
      "location": "Jakarta Pusat",
      "policies": ["Garansi 2 tahun", "Retur 7 hari", "Cicilan 0%"],
      "paymentMethods": ["Transfer", "QRIS", "Kartu Kredit 0%"],
      "faq": [
        { "question": "Bisa custom ukuran?", "answer": "Bisa! 2-4 minggu pengerjaan." }
      ]
    }
  }'
```

### 3. Chat (REST)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{
    "personaId": "uuid-from-step-1",
    "message": "Rekomendasi gunung buat pemula dong"
  }'

# Response:
# { "sessionId": "uuid", "reply": "Gunung Papandayan cocok buat pemula..." }
```

### 4. Chat (WebSocket)

```javascript
const ws = new WebSocket(
  "ws://localhost:3000/api/chat/ws?personaId=UUID&api_key=hermes-test-key-2024"
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "chunk") console.log(data.content);  // streaming
  if (data.type === "done") console.log("selesai");
  if (data.type === "error") console.error(data.message);
  if (data.type === "ping") {}  // keepalive every 30s
};

ws.send(JSON.stringify({ message: "Rekomendasi gunung dong" }));
```

### 5. AI Enhance (Auto-Generate Persona)

```bash
curl -X POST http://localhost:3000/api/ai/enhance-backstory \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{
    "type": "personal",
    "name": "Budi",
    "traits": ["kreatif", "humoris"],
    "hobbies": ["memasak", "fotografi makanan"],
    "expertise": ["masakan Indonesia"],
    "tone": "hangat",
    "language": "indonesia"
  }'

# Response: Full PersonaConfig with AI-generated backstory, catchphrases,
#           speechStyle, behavioralRules, values, lifeGoals, quirks...
```

### 6. Blueprints

```bash
curl -H "x-api-key: hermes-test-key-2024" \
  http://localhost:3000/api/blueprints

# Returns 16 ready-to-use persona templates (8 personal + 8 business)
# Each includes full config: backstory, products, captionStyle, visualStyle
```

### 7. Generate Caption

**Natural (no product):**
```bash
curl -X POST http://localhost:3000/api/content/generate-caption \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{
    "personaId": "uuid",
    "topic": "belajar nerima diri sendiri",
    "mode": "natural",
    "platform": "twitter"
  }'

# Twitter/Threads return thread format:
# { "thread": true, "parts": 5, "captions": ["Part 1...", "Part 2...", ...] }
```

**Affiliate (product recommendation):**
```bash
curl -X POST http://localhost:3000/api/content/generate-caption \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{
    "personaId": "uuid",
    "topic": "Azarine Sunscreen SPF 50",
    "mode": "affiliate",
    "platform": "instagram",
    "count": 2
  }'
```

**Platform rules:**
| Platform | Natural | Affiliate | Business |
|----------|---------|-----------|----------|
| Instagram | 400 char, single post | 800 char, cerita+produk | 2200 char |
| Facebook | 400 char | 800 char | 2200 char |
| Twitter | **Thread 3-5 tweet** (280/part) | 280 char, single tweet | 2200 char |
| Threads | **Thread 3-5 post** (500/part) | 500 char, single post | 2200 char |
| TikTok | 150 char | 150 char | 150 char |
| WhatsApp | 500 char | 500 char | 2200 char |

### 8. Generate Image Prompt

```bash
curl -X POST http://localhost:3000/api/content/generate-image-prompt \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{
    "personaId": "uuid",
    "productName": "Azarine Sunscreen SPF 50",
    "scene": "flat lay di meja putih dengan daun monstera",
    "mode": "affiliate",
    "engine": "midjourney",
    "count": 2
  }'

# Response:
# { "engine": "midjourney", "aspectRatio": "1:1",
#   "prompts": ["Top-down flat lay... --ar 1:1 --style raw", "..."],
#   "visualNote": "Lighting: studio | Background: clean | Mood: clinical" }
```

### 9. Session Management

```bash
# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "x-api-key: hermes-test-key-2024" \
  -d '{"personaId": "uuid", "title": "Rekomendasi Gunung"}'

# List sessions
curl -H "x-api-key: hermes-test-key-2024" \
  "http://localhost:3000/api/sessions?personaId=uuid"

# Get session messages
curl -H "x-api-key: hermes-test-key-2024" \
  "http://localhost:3000/api/sessions/SESSION_ID/messages"
```

### 10. Health Check

```bash
curl http://localhost:3000/health

# { "status": "ok", "db": "connected", "llm": "connected",
#   "queue": { "running": 0, "queued": 0, "maxConcurrency": 3, "availableSlots": 3 },
#   "personas": 5, "uptime": 120.5 }
```

---

## API Reference

All routes require `x-api-key` header except `/` and `/health`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health + queue status |
| `GET` | `/` | API documentation |
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

---

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_KEY` | — | API auth key (unset = open) |
| `ALLOWED_ORIGINS` | — | CORS origins, comma-separated |
| `LLM_API_KEY` | — | **Required.** LLM provider key |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `LLM_MAX_TOKENS` | `2048` | Max output tokens |
| `LLM_TEMPERATURE` | `0.8` | Creativity (0-1) |
| `LLM_MAX_CONCURRENCY` | `3` | Max simultaneous LLM calls |
| `LLM_QUEUE_TIMEOUT_MS` | `60000` | Max queue wait before 503 |
| `LLM_MAX_QUEUE_SIZE` | `100` | Max queued requests before reject |
| `LLM_FETCH_TIMEOUT` | `120000` | LLM API timeout |
| `RATE_LIMIT_CHAT_MAX` | `20` | Chat requests per window |
| `RATE_LIMIT_CHAT_WINDOW_MS` | `60000` | Chat rate limit window |
| `RATE_LIMIT_GENERAL_MAX` | `60` | General requests per window |
| `RATE_LIMIT_GENERAL_WINDOW_MS` | `60000` | General rate limit window |

---

## Architecture

```
Client → API (x-api-key auth)
  ├── /health          → Public health check
  ├── /api/personas    → CRUD (SQLite)
  ├── /api/sessions    → Session management
  ├── /api/chat        → ConcurrencyQueue → LLM API (REST + WebSocket)
  ├── /api/blueprints  → 16 persona templates
  ├── /api/content     → Caption + Image prompt generation
  └── /api/ai          → Auto-generate persona config

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

### Content Modes

| Mode | Caption | Image | Ideal For |
|------|---------|-------|-----------|
| `natural` | Personal story, zero product | Lifestyle moment, human focus | Trust building |
| `affiliate` | Story + product rec | Product in-context | Monetization |
| `catalog` | Specs + price + CTA | Product showroom | Direct sales |

---

## Project Structure

```
src/
├── index.ts              # Entry point, Hono app
├── types.ts              # All TypeScript interfaces
├── db/
│   ├── index.ts          # SQLite: getDB, initDB, safeParse, UUID
│   ├── schema.sql        # Tables: personas, sessions, messages
│   ├── seed.ts           # Demo personas (manually via bun run db:seed)
│   └── blueprints.ts     # 16 persona templates
├── lib/
│   ├── llm.ts            # LLM client: chat, chatStream, queue
│   ├── queue.ts          # ConcurrencyQueue
│   └── prompt.ts         # System prompt builder + cache
├── middleware/
│   ├── auth.ts           # x-api-key + CORS origin
│   ├── ratelimit.ts      # In-memory rate limiter
│   └── validation.ts     # Persona & message validators
└── routes/
    ├── personas.ts       # Persona CRUD
    ├── sessions.ts       # Session management
    ├── chat.ts           # REST chat + WebSocket
    ├── ai.ts             # AI enhance backstory
    ├── content.ts        # Caption + image prompt gen
    └── blueprints.ts     # Blueprint listing
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
