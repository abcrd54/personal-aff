# aff-personal — AI Agent Reference

> This file is the entry point for AI coding assistants (Claude, Cursor, Codex, etc.) working on or integrating with aff-personal.

## What Is This?

aff-personal is an AI-powered persona engine backend. It lets you create AI personas with full identity (backstory, tone, style, products) and use them for chat, content generation, and affiliate marketing.

**Stack:** Bun + Hono + SQLite + OpenAI-compatible LLM API.

## Documentation Index

| File | Contents | Read When |
|---|---|---|
| `skills/01-architecture.md` | Architecture, tech stack, config, auth, DB schema, project structure | Understanding the system, debugging, deployment |
| `skills/02-personas.md` | Complete PersonaConfig reference, personal vs business, speechStyle, rules, products | Creating personas, understanding persona fields |
| `skills/03-api.md` | All endpoints with request/response examples, error codes | Integrating with the API, debugging requests |
| `skills/04-content-system.md` | Caption & image prompt generation, modes, platform rules, visual style | Generating content for social media |
| `skills/05-caption-prompt.md` | Caption prompt template (loaded at runtime) | Editing caption generation behavior |
| `skills/06-image-prompt.md` | Image prompt template (loaded at runtime) | Editing image prompt generation behavior |

## Quick Start

```bash
cp .env.example .env   # Edit → set LLM_API_KEY + API_KEY
bun install && bun run start
# → http://localhost:3000
```

## Key Files

```
src/index.ts              # Entry point, Hono app, WebSocket upgrade
src/types.ts              # All TypeScript interfaces
src/db/blueprints.ts      # 16 persona templates (8 personal + 8 business)
src/lib/prompt.ts         # System prompt builder, sanitization, LRU cache
src/routes/openai.ts      # OpenAI-compatible /v1 endpoint
src/routes/content.ts     # Caption + image prompt generation
```

## API Quick Reference

| Endpoint | Auth | Description |
|---|---|---|
| `POST /v1/chat/completions` | Bearer/key | OpenAI-compatible chat (SSE streaming) |
| `GET /v1/models` | Bearer/key | List personas as models |
| `POST /api/personas` | Bearer/key | Create persona |
| `POST /api/chat` | Bearer/key | Native chat (REST) |
| `WS /api/chat/ws` | key (query) | Native chat (streaming) |
| `POST /api/content/generate-caption` | Bearer/key | Generate caption |
| `POST /api/content/generate-image-prompt` | Bearer/key | Generate image prompt |
| `GET /api/blueprints` | Bearer/key | Get 16 templates |
| `POST /api/ai/enhance-backstory` | Bearer/key | AI-generate persona |

## Auth

```
Header: x-api-key: <API_KEY>
Header: Authorization: Bearer <API_KEY>
```

Both accepted on all authenticated endpoints.

## Runtime Notes

- Single-threaded via Bun event loop
- Session-level locks prevent concurrent message interleaving
- Prompt cache: LRU, max 500 entries, invalidated on persona update
- Rate limiter: in-memory, 10k max entries, evicts oldest
- Body size limit: 512KB
- Streaming: WebSocket for native API, SSE for OpenAI-compatible API
