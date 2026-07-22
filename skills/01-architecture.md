# 01 — Architecture & Configuration

## Overview

**aff-personal** is an AI-powered persona engine backend. It manages AI personas (characters with personality, backstory, and style rules) and routes chat + content generation requests through an LLM.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Hono](https://hono.dev) (HTTP router) |
| Database | SQLite via `bun:sqlite` (WAL mode) |
| LLM | OpenAI-compatible API (any provider) |
| Container | Docker (ARM64 `oven/bun:1-slim`) |

## Architecture

```
Client
  │
  ├── /                  → JSON API docs
  ├── /health            → Health check (public)
  │
  ├── /v1/chat/completions  → OpenAI-compatible chat (SSE streaming)
  ├── /v1/models            → List personas as OpenAI models
  │
  ├── /api/personas   → Persona CRUD (SQLite)
  ├── /api/sessions   → Chat session management
  ├── /api/chat       → Native chat (REST + WebSocket streaming)
  ├── /api/ai         → AI persona enhancement
  ├── /api/blueprints → 16 persona templates
  └── /api/content    → Caption + image prompt generation
          │
          ▼
    ConcurrencyQueue (max 3 parallel)
          │
          ▼
    LLM API (/chat/completions — OpenAI-compatible)
```

## Database

SQLite file: `data/aff.db` (WAL mode, foreign keys ON).

```sql
personas:  id TEXT PK, name TEXT, config TEXT (JSON), created_at, updated_at
sessions:  id TEXT PK, persona_id FK→personas CASCADE, title, created_at, updated_at
messages:  id INTEGER PK AUTOINCREMENT, session_id FK→sessions CASCADE, role CHECK(user|assistant|system), content TEXT, created_at

INDEXES: sessions(persona_id), messages(session_id), messages(session_id, created_at)
```

## Auth

```
Header: x-api-key: <API_KEY>
Header: Authorization: Bearer <API_KEY>
```

- `API_KEY` unset → ALL routes are PUBLIC (dev mode warning)
- `API_KEY` set + `NODE_ENV=production` → FATAL exit if missing
- `/` and `/health` are public

## Configuration (Env Variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `API_KEY` | — | **Required in production.** Auth key |
| `ALLOWED_ORIGINS` | — | CORS origins, comma-separated |
| `NODE_ENV` | — | Set to `production` for strict API_KEY check |
| `LLM_API_KEY` | — | **Required.** LLM provider API key |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `LLM_MAX_TOKENS` | `2048` | Max output tokens |
| `LLM_TEMPERATURE` | `0.8` | Creativity (0-2) |
| `LLM_MAX_CONCURRENCY` | `3` | Max simultaneous LLM calls |
| `LLM_QUEUE_TIMEOUT_MS` | `60000` | Max queue wait before 503 |
| `LLM_MAX_QUEUE_SIZE` | `100` | Max queued requests before reject |
| `RATE_LIMIT_CHAT_MAX` | `20` | Chat requests per window |
| `RATE_LIMIT_CHAT_WINDOW_MS` | `60000` | Chat rate limit window (ms) |
| `RATE_LIMIT_GENERAL_MAX` | `60` | General requests per window |
| `RATE_LIMIT_GENERAL_WINDOW_MS` | `60000` | General rate limit window (ms) |

## Project Structure

```
src/
├── index.ts              # Entry point, Hono app, WebSocket, middleware
├── types.ts              # All TypeScript interfaces
├── db/
│   ├── index.ts          # SQLite: getDB, initDB, safeParseConfig, UUID
│   ├── schema.sql        # DDL: personas, sessions, messages
│   ├── seed.ts           # Demo personas
│   └── blueprints.ts     # 16 persona templates
├── lib/
│   ├── llm.ts            # LLM client: chat, chatWithUsage, chatStream
│   ├── queue.ts          # ConcurrencyQueue (slot-based + timeout)
│   ├── prompt.ts         # System prompt builder + LRU cache (max 500)
│   ├── prompt-loader.ts  # External prompt loader (reads skills/*.md)
│   └── ws-handler.ts     # WebSocket chat handler
├── middleware/
│   ├── auth.ts           # x-api-key + Bearer + CORS
│   ├── ratelimit.ts      # In-memory rate limiter (max 10k entries)
│   └── validation.ts     # Persona & message validators
└── routes/
    ├── openai.ts         # POST /v1/chat/completions, GET /v1/models
    ├── personas.ts       # Persona CRUD
    ├── sessions.ts       # Session + message management
    ├── chat.ts           # POST /api/chat (REST)
    ├── ai.ts             # POST /api/ai/enhance-backstory
    ├── content.ts        # Caption + image prompt generation
    └── blueprints.ts     # GET /api/blueprints

skills/
├── 01-architecture.md       # This file — architecture reference
├── 02-personas.md           # Persona system reference
├── 03-api.md                # API endpoint reference
├── 04-content-system.md     # Content system reference
├── 05-caption-prompt.md     # Caption prompts (loaded at runtime)
└── 06-image-prompt.md       # Image prompts (loaded at runtime)
```

## Queue System

```
Request 1 → [Slot 1] → LLM API
Request 2 → [Slot 2] → LLM API     max 3 concurrent
Request 3 → [Slot 3] → LLM API
Request 4 → [Queue]  → wait → slot free → process
Request 5 → [Queue]  → wait → slot free → process
Request 101 → Rejected (queue full)
```